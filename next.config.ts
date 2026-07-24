import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El manual (público, autocontenido) vive en public/doc/index.html.
  // Este rewrite permite abrirlo en /doc sin escribir /index.html.
  async rewrites() {
    return [{ source: "/doc", destination: "/doc/index.html" }];
  },
};

export default nextConfig;
