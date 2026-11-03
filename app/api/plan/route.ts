import { NextResponse } from "next/server";
import { apiContext } from "@/lib/auth";
import { buildAndActivateLearningPlan, LearningPlanError } from "@/lib/learning-plan";

// Öğrencinin açık isteğiyle mevcut ilerlemesine göre programı yeniler ve aktif plana geçirir.
export async function POST() {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Giriş yapman gerekiyor." }, { status: 401 });
  try {
    const plan = await buildAndActivateLearningPlan(c.user.id, c.profile, c.sb);
    return NextResponse.json({ plan, integrated: true });
  } catch (error) {
    if (error instanceof LearningPlanError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Learning plan update failed", error);
    return NextResponse.json({ error: "Program güncellenemedi. Mevcut programın korunuyor." }, { status: 502 });
  }
}
