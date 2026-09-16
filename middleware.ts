import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Rutas públicas: solicitante + vista pública + login + assets.
const PUBLICAS = [
  "/",
  "/solicitud",
  "/mis-solicitudes",
  "/comparativa",
  "/login",
  "/_next",
  "/favicon",
];

// Mapa de ruta protegida -> rol requerido.
const PROTEGIDAS: Record<string, "coordinador" | "admin"> = {
  "/panel": "coordinador",
  "/admin": "admin",
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Si las variables de Supabase no están configuradas (p. ej. build/preview sin env),
  // no fallar toda la app: las rutas públicas siguen funcionando y los guards de
  // las rutas protegidas/API rechazarán sin sesión.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;

  if (!supabaseUrl || !anonKey) {
    if (pathname.startsWith("/api/admin") || pathname.startsWith("/api/metricas")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refrescar la sesión (renueva cookies si es necesario). Si Supabase no responde
  // (indisponible o dominio no autorizado), se degrada a "sin sesión" en lugar de 500.
  let user: { app_metadata?: { rol?: string } } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = (data.user ?? null) as { app_metadata?: { rol?: string } } | null;
  } catch {
    user = null;
  }

  // API de administración y métricas: exclusivo de rol admin (403 para fetch, no redirect).
  if (pathname.startsWith("/api/admin") || pathname.startsWith("/api/metricas")) {
    const userRol = user?.app_metadata?.rol as string | undefined;
    if (!user || userRol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  // Si está en una ruta pública protegida por rol, resolverla.
  for (const [prefix, rol] of Object.entries(PROTEGIDAS)) {
    if (pathname.startsWith(prefix)) {
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = `/login/${rol}`;
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
      const userRol = user.app_metadata?.rol as string | undefined;
      if (userRol !== rol) {
        // Rol incorrecto: redirige a su portal correspondiente.
        const dest = userRol === "admin" ? "/admin" : "/panel";
        if (pathname.startsWith(dest)) return response;
        return NextResponse.redirect(new URL(dest, request.url));
      }
      return response;
    }
  }

  // Si está en /login y ya tiene sesión, redirigir a su portal.
  if (pathname.startsWith("/login") && user) {
    const rol = user.app_metadata?.rol as string | undefined;
    const dest = rol === "admin" ? "/admin" : "/panel";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export const PUBLIC_ROUTES = PUBLICAS;
