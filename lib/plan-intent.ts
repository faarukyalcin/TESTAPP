export function isPlanRegenerationRequest(message: string) {
  const normalized = message.toLocaleLowerCase("tr-TR").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i");
  return /\b(?:program|plan)\w*\b/.test(normalized)
    && /\b(?:yeniden|tekrar|bastan|guncelle|degistir|yenile|olustur|hazirla|yap)\b/.test(normalized);
}
