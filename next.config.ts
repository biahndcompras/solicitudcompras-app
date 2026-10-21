import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  // El PDF se arma en el servidor leyendo el logo y las fuentes del disco. Sin esto, Vercel
  // no los incluye en el bundle de la función y el PDF saldría sin logo (o con fuente de
  // reemplazo).
  outputFileTracingIncludes: {
    "/api/**": ["./public/bia-logo.png", "./assets/Geist-*.ttf"],
  },
};

export default nextConfig;
