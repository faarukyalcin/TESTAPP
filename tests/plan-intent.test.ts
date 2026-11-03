import { describe, expect, it } from "vitest";
import { isPlanRegenerationRequest } from "../lib/plan-intent";

describe("plan regeneration intent", () => {
  it.each([
    "Programımı yeniden yap",
    "Çalışma planını baştan oluştur",
    "Programıma göre tekrar program hazırla",
    "Planımı güncelle"
  ])("recognizes: %s", message => {
    expect(isPlanRegenerationRequest(message)).toBe(true);
  });

  it.each([
    "Bugünkü programımda ne var?",
    "Almanca çalışmak için öneri ver",
    "Plan kelimesi Almancada ne demek?"
  ])("does not regenerate for: %s", message => {
    expect(isPlanRegenerationRequest(message)).toBe(false);
  });
});
