"use client";
export function speak(text: string, rate = 0.9) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE"; u.rate = rate;
  const v = window.speechSynthesis.getVoices().find(x => x.lang.startsWith("de"));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
  return true;
}
