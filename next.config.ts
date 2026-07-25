import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El manual (público, autocontenido) vive en public/doc/index.html.
  // Este rewrite permite abrirlo en /doc sin escribir /index.html.
  async rewrites() {
    return [
      // Manual del equipo (roles internos).
      { source: "/doc", destination: "/doc/index.html" },
      // Guía del usuario final (cliente del portal).
      { source: "/guia", destination: "/guia/index.html" },
    ];
  },
};

export default nextConfig;
