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
