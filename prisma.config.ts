import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Configuración de Prisma 7. La URL de conexión ya no vive en schema.prisma:
// aquí la usan los comandos de CLI (migrate, studio, introspección). El cliente
// en tiempo de ejecución usa un driver adapter (ver src/server/db.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
