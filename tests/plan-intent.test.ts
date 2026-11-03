import { describe, expect, it } from "vitest";
import { isPlanRegenerationRequest } from "../lib/plan-intent";
import { extractDailyMinutesUpdate } from "../lib/assistant-intent";

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

describe("daily study time commands", () => {
  it.each([
    ["Çalışma programımı 15 dakikadan 2 saate çıkar", 120],
    ["Günlük hedefimi 90 dakikaya ayarla", 90],
    ["Günlük çalışma süremi bir saat yap", 60],
    ["Programımı 30 dk'dan 1,5 saate yükselt", 90]
  ])("extracts the requested target from %s", (message, expected) => {
    expect(extractDailyMinutesUpdate(message)).toBe(expected);
  });

  it("does not change the persistent goal for a one-time availability statement", () => {
    expect(extractDailyMinutesUpdate("Bugün iki saat çalışabilirim")).toBeNull();
  });
});
