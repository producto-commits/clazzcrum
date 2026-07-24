# Imagen de producción de Clazz (Next.js 16 + Prisma 7).
# Prisma 7 usa driver adapter (pg) en runtime → no requiere binario de engine.
# Las migraciones (prisma migrate deploy) se aplican al arrancar el contenedor.
FROM node:22-slim

# openssl/ca-certificates: los usa el CLI de Prisma para migrate deploy.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias (incluye devDeps: se necesitan para `next build` y `tsx` del seed).
# Se usa `npm install` (no `npm ci`) porque el lockfile se generó en macOS y en
# Linux faltan dependencias opcionales específicas de plataforma (@emnapi/*).
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

# Código y build de producción.
COPY . .
# DATABASE_URL ficticia SOLO para el build (prisma.config.ts la exige para
# `generate`, y `next build` no se conecta a la BD). En runtime, Easypanel
# inyecta la DATABASE_URL real y esta queda sobreescrita.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Entrypoint: aplica migraciones (y seed opcional) y luego arranca Next.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
