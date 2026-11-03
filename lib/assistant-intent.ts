export function extractDailyMinutesUpdate(message: string): number | null {
  const normalized = message.toLocaleLowerCase("tr-TR").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i");
  const explicitChange = /\b(?:cikar|artir|ayarla|degistir|guncelle|yukselt|azalt|dusur|yenile|yap|belirle)\w*\b/.test(normalized)
    || /\b(?:gunluk hedefim|calisma surem|gunluk calisma surem)\w*\b/.test(normalized);
  if (!explicitChange) return null;

  const numberWords: Record<string, number> = { bir: 1, iki: 2, uc: 3, dort: 4, bes: 5, alti: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10 };
  const matches = [...normalized.matchAll(/\b(\d{1,3}(?:[.,]\d)?|bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on)\s*(saat\w*|dakika\w*|dk\b|min\b)\w*/g)];
  const last = matches.at(-1);
  if (!last) return null;
  const count = numberWords[last[1]] ?? Number(last[1].replace(",", "."));
  if (!Number.isFinite(count)) return null;
  return Math.round(count * (last[2].startsWith("saat") ? 60 : 1));
}
