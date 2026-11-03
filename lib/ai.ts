import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/secrets";
export const assessmentSchema=z.object({intro:z.string().max(5000).default(""),grammar:z.number().int().min(0).max(1),reading:z.number().int().min(0).max(1),goal:z.string().max(160),minutes:z.number().int().min(10).max(180)});
export const aiAssessmentSchema=z.object({level:z.enum(["A1","A2"]),summary:z.string().max(2000),strengths:z.array(z.string().max(300)).max(8).default([]),weaknesses:z.array(z.string().max(300)).max(8).default([]),plan:z.object({weekly_focus:z.string().max(300),summary:z.string().max(1500),days:z.array(z.object({day:z.string().max(40),focus:z.string().max(300),minutes:z.number().min(0).max(240)})).max(7).default([])})});
export const chatSchema=z.object({message:z.string().trim().min(1).max(4000),level:z.string().max(40).default("A1")});
type AIConfig = { provider: "gemini" | "openai"; apiKey: string; model: string };

/** Each signed-in learner uses their own encrypted provider credential. */
export async function getAIConfig(userId?: string, userDb?: any): Promise<AIConfig> {
  if (userId) {
    if (!userDb) throw new Error("Kullanıcı AI ayarı okunamadı.");
    const { data, error } = await userDb.from("user_ai_settings")
      .select("provider,model,api_key_ciphertext").eq("user_id", userId).maybeSingle();
    if (error) throw new Error("Kişisel AI ayarları okunamadı. Supabase 0007 migration dosyasını çalıştır.");
    if (!data?.api_key_ciphertext) throw new Error("Önce kendi Gemini veya OpenAI API anahtarını ekle.");
    return { provider: data.provider, model: data.model, apiKey: decryptSecret(data.api_key_ciphertext) };
  }

  // Legacy global settings are retained only for the administrator's connection test.
  let stored: { provider?: string; model?: string; api_key_ciphertext?: string } | null = null;
  try {
    const { data } = await supabaseAdmin().from("platform_ai_settings")
      .select("provider,model,api_key_ciphertext").eq("id", "default").maybeSingle();
    stored = data;
  } catch { /* Existing deployments can continue using Vercel environment variables. */ }
  const provider = (stored?.provider || process.env.AI_PROVIDER || "gemini").toLowerCase();
  if (provider !== "gemini" && provider !== "openai") throw new Error("AI_PROVIDER must be gemini or openai");
  const encrypted = stored?.api_key_ciphertext;
  const apiKey = encrypted
    ? decryptSecret(encrypted)
    : provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error(`${provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY"} missing`);
  const model = stored?.model || (provider === "openai" ? process.env.OPENAI_MODEL || "gpt-4.1-mini" : process.env.GEMINI_MODEL || "gemini-3.8-flash");
  return { provider, apiKey, model };
}

export async function askAI(system:string,prompt:string,json=false,userId?:string,userDb?:any){
  const config = await getAIConfig(userId,userDb);
  let response:Response;
  if(config.provider==="openai"){
    response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${config.apiKey}`,"Content-Type":"application/json"},signal:AbortSignal.timeout(60000),body:JSON.stringify({max_tokens:2500,model:config.model,messages:[{role:"system",content:system},{role:"user",content:prompt}],...(json?{response_format:{type:"json_object"}}:{})})});
    if(!response.ok){const d=await response.json().catch(()=>null);throw Error(`OpenAI ${response.status}: ${d?.error?.message||"İstek reddedildi."}`);}
    const d=await response.json(); return d.choices[0].message.content as string;
  }
  response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":config.apiKey},signal:AbortSignal.timeout(60000),body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:.35,maxOutputTokens:4096,...(json?{responseMimeType:"application/json"}:{})}})});
  if(!response.ok){const d=await response.json().catch(()=>null);throw Error(`Gemini ${response.status}: ${d?.error?.message||"İstek reddedildi."}`);}
  const d=await response.json(); return (d.candidates?.[0]?.content?.parts||[]).map((p:{text?:string})=>p.text||"").join("");
}
export function parseAIJson(raw:string){return JSON.parse(raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g,"").trim());}
const goethePlan=z.object({exam_level:z.enum(["A1","A2"]).default("A2"),weeks:z.array(z.object({week:z.number().int().min(1).max(52),focus:z.string().max(200),skills:z.array(z.string().max(40)).max(4),practice:z.string().max(300)})).max(52).default([])});
const planShape=z.object({weekly_focus:z.string().max(300),summary:z.string().max(1500),daily_words:z.number().int().min(0).max(30).default(10),days:z.array(z.object({day:z.string().max(40),focus:z.string().max(300),minutes:z.number().min(0).max(240)})).max(7).default([]),review_topics:z.array(z.string().max(120)).max(8).default([]),goethe:goethePlan.default({exam_level:"A2",weeks:[]})});
export const planSchema=planShape;
export const assessmentAISchema=z.object({summary:z.string().max(2000),writing_score:z.number().int().min(0).max(100).nullable().default(null),strengths:z.array(z.string().max(300)).max(8).default([]),weaknesses:z.array(z.string().max(300)).max(8).default([]),plan:planShape});
const sc=z.number().int().min(0).max(100);
export const writingResultSchema=z.object({level:z.enum(["A1","A2"]),corrected:z.string().max(6000),errors:z.array(z.object({original:z.string().max(300),fix:z.string().max(300),reason:z.string().max(400)})).max(15).default([]),scores:z.object({grammar:sc,vocabulary:sc,structure:sc,spelling:sc,coherence:sc,task:sc}),alternatives:z.array(z.string().max(300)).max(5).default([]),feedback:z.string().max(1500)});

