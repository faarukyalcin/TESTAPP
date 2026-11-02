import { requireAdmin } from "@/lib/auth";

// Yönetici sayfaları oturum, aktif hesap ve rol kontrolünden geçer.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
