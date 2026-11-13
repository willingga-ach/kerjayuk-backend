# Deploy Backend KerjaYuk ke Koyeb

Panduan langkah-demi-langkah pengganti Railway. DB Supabase tetap dipakai.

---

## Langkah 1 — Persiapkan env

Buka `.env` lokal lalu **salin nilai asli** ke clipboard (dibutuhkan di Langkah 3):

| Variabel | Sumber |
|---|---|
| `DATABASE_URL` | dari `.env` lokal |
| `DIRECT_URL` | dari `.env` lokal |
| `JWT_SECRET` | dari `.env` lokal |
| `JWT_EXPIRES_IN` | `1d` |
| `PORT` | `3000` |
| `FRONTEND_URL` | `https://kerjayuk-frontend.vercel.app` |

## Langkah 2 — Buat akun & hubungkan GitHub

1. Buka **https://app.koyeb.com** → daftar (gratis, tanpa kartu kredit).
2. Klik **Create Service → Deploy from GitHub**.
3. Pilih repo **`kerjayuk-backend`** → branch `main`.

## Langkah 3 — Konfigurasi service

Isi di form (atau tempel `koyeb.yaml` ini:

| Field | Nilai |
|---|---|
| Builder | **Buildpack** (default) atau Docker |
| Build command | `npm ci && npx prisma generate` |
| Run command | `node src/server.js` |
| Instance | nano (gratis) |
| Port | `3000` |
| Health check | path `/api/health`, port 3000 |
| Environment | isi 6 variabel dari Langkah 1 |

## Langkah 4 — Deploy

Klik **Deploy**. Tunggu sampai status **Healthy**. Verifikasi:

```bash
curl https://<nama-service>.koyeb.app/api/health
# → {"status":"ok","service":"kerjayuk-backend","version":"1.2"}
```

> URL service: biasanya `https://<app>-<service>.koyeb.app` (lihat di dashboard).

## Langkah 5 — Arahkan frontend ke Koyeb

Di **Vercel**:
1. Project `kerjayuk-frontend` → Settings → Environment Variables.
2. Set `VITE_API_URL=https://<nama-service>.koyeb.app/api`.
3. Redeploy frontend.

## Verifikasi akhir

```bash
# 1) health
curl https://<nama-service>.koyeb.app/api/health

# 2) login nyata
curl -X POST https://<nama-service>.koyeb.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pelamar@kerjayuk.id","password":"password123"}'
# → 200 {token, user}
```

Buka `https://kerjayuk-frontend.vercel.app/masuk` → login dengan akun demo.

---

## Catatan penting
- **Kredensial tidak boleh masuk ke repo.** `.env` sudah di-ignore git; semua nilai dimasukkan lewat dashboard Koyeb.
- **Cold start**: free tier tidur saat idle (beberapa detik yang pertama kali dipanggil) — wajar.
- **Jika memakai Dockerfile**: pilih builder Docker, namun **Buildpack sudah cukup** dan tidak perlu file itu. `Dockerfile` disertakan sebagai cadangan.
- **Testing ulang**: setelah rollout, jalankan `npm test` (jika DB tersedia) dan login manual dari UI.
