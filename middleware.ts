import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll(cs) {
          cs.forEach(c => req.cookies.set(c.name, c.value));
          res = NextResponse.next({ request: req });
          cs.forEach(c => res.cookies.set(c.name, c.value, c.options));
        }
      }
    }
  );
  const { data: { user } } = await sb.auth.getUser();
  const path = req.nextUrl.pathname;
  const isLogin = path === "/login";
  const isAuthFlow = path.startsWith("/auth/") || path === "/forgot-password" || path === "/disabled";

  if (!user && !isLogin && !isAuthFlow) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    u.search = "";
    u.searchParams.set("next", path);
    return NextResponse.redirect(u);
  }
  if (user && isLogin) {
    const u = req.nextUrl.clone();
    u.pathname = "/";
    u.search = "";
    return NextResponse.redirect(u);
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
