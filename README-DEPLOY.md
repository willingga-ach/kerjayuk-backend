# Deploy Backend KerjaYuk — Railway (aktif)

Backend berjalan di **Railway** (kembali aktif setelah masa langganan diperpanjang).

- URL produksi: `https://kerjayuk-backend-production.up.railway.app`
- API base: `https://kerjayuk-backend-production.up.railway.app/api`
- Health check: `GET /api/health` → `{"status":"ok",...}`
- Frontend produksi: `https://kerjayuk-frontend.vercel.app` (env `VITE_API_URL` menunjuk ke URL di atas)

## Verifikasi (terakhir: 14 Nov 2026)

```bash
curl https://kerjayuk-backend-production.up.railway.app/api/health

curl -X POST https://kerjayuk-backend-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pelamar@kerjayuk.id","password":"password123"}'
# → 200 { token, user }
```

Login nyata dari `https://kerjayuk-frontend.vercel.app/masuk` → sukses menuju `/lowongan`.

## Env yang dipakai Railway

| Variabel | Nilai |
|---|---|
| `PORT` | `3000` |
| `DATABASE_URL` | Supabase Postgres (Transaction-mode) |
| `DIRECT_URL` | Supabase Postgres (Session-mode, untuk migrasi) |
| `JWT_SECRET` | rahasia kuat |
| `JWT_EXPIRES_IN` | `1d` |
| `FRONTEND_URL` | `https://kerjayuk-frontend.vercel.app` |

## ⚠️ Pitfall: Prisma + runtime Alpine (musl)

**Gejala**: crash-loop setelah auto-deploy, log:
```
PrismaClientInitializationError: Prisma Client could not locate the Query Engine
for runtime "linux-musl-openssl-3.0.x".
This happened because Prisma Client was generated for "linux-musl"
```
**Sebab**: Railway buildpack / image runtime berbasis Alpine (musl). Prisma Client
yang hanya di-generate untuk `native` (glibc) tidak menemukan engine.

**Solusi (sudah diterapkan)**: `prisma/schema.prisma`:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```
Setelah mengubah schema, jalankan `npx prisma generate` dan push. Prisma akan
men-download engine untuk kedua target.

**Penting**: JANGAN push `Dockerfile` berbasis `node:*-alpine` ke repo Railway —
Railway auto-deploy akan switch ke Docker builder dan (contoh) crash. Biarkan
Buildpack default (Nixpacks) menangani build.
