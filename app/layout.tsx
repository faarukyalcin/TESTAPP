import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DeutschAI",
  description: "Kişiselleştirilmiş Almanca öğrenme",
  // Giriş gerektiren platform arama motorlarına kapalı.
  robots: { index: false, follow: false }
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="tr"><body>{children}</body></html>;
}
