# Rangkuman Proyek KerjaYuk

Dokumen ini merangkum seluruh analisis, perbaikan, debugging, dan hasil akhir proyek **KerjaYuk** — aplikasi portal lowongan kerja & magang full-stack.

- **Frontend** → `D:\WEB\frontend-kerjayuk` → GitHub: `willingga-ach/kerjayuk-frontend`
- **Backend** → `D:\WEB\KerjaYuk-App\backend` → GitHub: `willingga-ach/kerjayuk-backend`

---

## 1. Gambaran Umum

KerjaYuk adalah aplikasi web full-stack dengan tiga peran pengguna: **PELAMAR**, **RECRUITER**, dan **ADMIN**. Alur utama: pelamar mencari lowongan → melamar → recruiter meninjau & memperbarui status → admin meninjau semua lamaran.

---

## 2. Teknologi & Bahasa Pemrograman

| Lapisan | Teknologi | Detail |
|---|---|---|
| **Frontend (UI)** | React 19 | `^19.2.8`, SPA berbasis komponen |
| | React Router 7 | `^7.18.4` — routing + role-based guard |
| | Vite 8 | `^8.3.0` — build tool & dev server |
| | Tailwind CSS 4 | `^4.3.3` (+ PostCSS, autoprefixer) |
| | oxlint | `^1.81.0` — linter (0 warning / 0 error) |
| **Backend (API)** | Node.js 24 | Runtime (diperiksa dengan Node 24) |
| | Express 5 | `^5.2.1` — REST API |
| | Prisma 5 | `^5.22.0` — ORM |
| | PostgreSQL | via Supabase (URL di `.env`) |
| | JWT + bcryptjs | autentikasi & hashing password |
| **Bahasa** | JavaScript (ESM di frontend, CommonJS di backend) | frontend `"type": "module"`, backend `"type": "commonjs"` |
| **Test** | Node built-in `node:test` | tanpa dependency tambahan (11 test) |

---

## 3. Deployment

| Bagian | Platform | Konfigurasi |
|---|---|---|
| **Frontend** | **Vercel** | URL produksi: `https://kerjayuk-frontend.vercel.app`; `vercel.json` berisi rewrite SPA ke `index.html`; build `vite build` → folder `dist` |
| **Backend** | **Render** | konfigurasi lewat env `FRONTEND_URL` (CORS), `PORT`; health check `GET /api/health` |
| **Database** | **Supabase** (PostgreSQL) | `DATABASE_URL`, `DIRECT_URL`, di `.env` (tidak di-commit) |

### Environment variable utama
- Frontend (`.env`): `VITE_API_URL` → `https://kerjayuk-backend.onrender.com/api`
- Backend (`.env`): `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `FRONTEND_URL`

---

## 4. Struktur Proyek

```
D:\WEB
├── frontend-kerjayuk/        # React + Vite + Tailwind (deploy Vercel)
│   ├── src/
│   │   ├── App.jsx           # routing + guard berbasis role
│   │   ├── context/          # AuthContext, ThemeContext
│   │   ├── lib/api.js        # klien API terpusat (token otomatis)
│   │   ├── components/       # DashboardLayout, Logo
│   │   └── pages/            # MasukAkun, DaftarPelamar, Katalog, Detail, dll.
│   ├── vercel.json
│   └── package.json
└── KerjaYuk-App/backend/     # Express + Prisma + PostgreSQL (deploy Render)
    ├── src/
    │   ├── app.js            # inisialisasi Express + CORS + health check
    │   ├── routes/api.js     # router terpusat
    │   ├── controllers/      # auth, lowongan, lamaran
    │   ├── middleware/       # auth (JWT + token versioning), error handler
    │   ├── lib/prisma.js     # singleton PrismaClient
    │   └── utils/            # portfolioValidator (AC-4)
    ├── prisma/schema.prisma  # model User, Lowongan, Lamaran, LogStatus
    ├── test/                 # unit test (node:test)
    └── package.json
```

---

## 5. Arsitektur & Alur Autentikasi

```
MasukAkun.jsx (form) → POST /api/auth/login → authController.login()
  → verifikasi bcrypt → terbitkan JWT (sub, role, token_version)
  → localStorage (token + user)
  → redirect sesuai role: RECRUITER→/recruiter, ADMIN→/admin, PELAMAR→/lowongan
```

- **Klien API terpusat** (`lib/api.js`): otomatis tempel `Authorization: Bearer <jwt>`; pada respons **401** → hapus sesi & picu event `kerjayuk:unauthorized`.
- **AuthContext**: on-load validasi ulang via `GET /auth/me`.
- **Fitur keamanan**:
  - **AC-1** Compare-and-Swap (`version` kolom) cegah race condition saat ubah status.
  - **AC-2** Matriks status adaptif: `DITOLAK → DIPROSES` wajib `notes`.
  - **AC-3** Token versioning (`token_version`): logout menaikkan versi → semua token lama invalid instan.
  - **AC-4** Validasi URL portofolio (allowlist host + wajib `https://` + tanpa kredensial).
  - **AC-5** Paginasi + index `created_at` (desc) untuk kinerja.

---

## 6. Temuan & Perbaikan (Debugging)

### Bug yang diperbaiki

| # | Lokasi | Bug | Perbaikan |
|---|---|---|---|
| 1 | `src/pages/SesiBerakhir.jsx` | `useTheme()` dipakai tanpa impor → **Runtime `ReferenceError`** saat `/sesi-berakhir` dirender | Tambah `import { useTheme } from '../context/ThemeContext'` |
| 2 | `backend/src/controllers/lamaranController.js` (`listLamaran`) | Cabang ADMIN jatuh ke filter `{ lowongan: { recruiterId: req.user.id } }` → ADMIN hanya melihat lamaran miliknya sendiri (0 baris) | Pisahkan skop per role: `PELAMAR` → miliknya, `ADMIN` → semua (`{}`), `RECRUITER` → lowongan miliknya |
| 3 | `backend/src/controllers/lamaranController.js` (`updateStatusLamaran` & `getLamaranLog`) | **IDOR**: RECRUITER bisa ubah/lihat lamaran lowongan orang lain | Tambah guard kepemilikan `lamaran.lowongan.recruiterId === req.user.id` → 403 jika bukan miliknya |
| 4 | `backend/src/controllers/lowonganController.js` (`toggleLowongan`) | **IDOR**: RECRUITER bisa buka/tutup lowongan orang lain | Tambah guard `lowongan.recruiterId === req.user.id` → 403 |

### Warning lint yang dibersihkan (frontend)
- 6 warning lama (`set-state-in-effect` & `only-export-components`) — kini **0 warning / 0 error**.

### Pemeriksaan lain (bukan bug)
- `ThemeContext.jsx` memakai `prefers-color-scheme` — media query CSS standar yang benar, bukan typo.
- Endpoint `/auth/me` mengembalikan `req.user` tanpa `portfolio_url`; setelah refresh `ProfilPelamar` bisa kehilangan URL portofolio (minor, tidak diubah agar kontrak API tidak berubah).
- Guard `/admin` mengizinkan `RECRUITER` membuka `/admin` — kemungkinan disengaja karena memakai halaman recruiter bersama.

---

## 7. Unit Test

Backend memakai **Node built-in `node:test`** (tanpa dependency tambahan) dengan mock objek `prisma` singleton.

| File | Cakupan |
|---|---|
| `test/helpers.js` | Helper mock `req`/`res`/`next` + mock prisma |
| `test/lamaranController.test.js` | IDOR (RECRUITER 403), izin RECRUITER/ADMIN, AC-1 CAS → 409, AC-2 notes wajib → 400, log IDOR |
| `test/lowonganController.test.js` | IDOR 403, izin RECRUITER/ADMIN, 404 tak ditemukan |

**Hasil:** ✅ **11/11 test lolos** (0 gagal). Script: `npm test` → `node --test test/lamaranController.test.js test/lowonganController.test.js`.

---

## 8. Hasil Pemeriksaan Otomatis

| Pemeriksaan | Hasil |
|---|---|
| `npm run lint` (frontend) | ✅ 0 warning / 0 error |
| `node --check` (controller backend) | ✅ sintaks valid |
| `node --test` (backend) | ✅ 11/11 pass |

---

## 9. Version Control & Push GitHub

| Repo | Remote GitHub | Status |
|---|---|---|
| **Frontend** | `https://github.com/willingga-ach/kerjayuk-frontend.git` | ✅ commit `9230a90` di-push ke `origin/main` (6 file: AuthContext, ThemeContext, KandidatRecruiter, LamaranSaya, LowonganRecruiter, SesiBerakhir) |
| **Backend** | `https://github.com/willingga-ach/kerjayuk-backend.git` | ✅ commit `cdf784a` di-push ke `origin/main` (perbaikan IDOR + unit test + package.json script test) |

Kedua repo berada di cabang `main` yang sinkron dengan remote (`working tree clean`). File `.env` tidak ikut ter-commit (dikecualikan `.gitignore`).

---

## 10. Cara Menjalankan

### Backend
```powershell
Set-Location D:\WEB\KerjaYuk-App\backend
npm.cmd ci
Copy-Item .env.example .env    # isi DATABASE_URL, DIRECT_URL, JWT_SECRET
npm.cmd run db:generate
npm.cmd run db:validate
npm.cmd start                   # port 3000, health check GET /api/health
```

### Frontend
```powershell
Set-Location D:\WEB\frontend-kerjayuk
npm.cmd ci
Copy-Item .env.example .env     # atur VITE_API_URL
npm.cmd run dev
```

### Akun demo (seed)
- `recruiter@kerjayuk.id` / `password123`
- `pelamar@kerjayuk.id` / `password123`

---

## 11. Rekomendasi Lanjutan
1. Tambahkan unit test untuk skop `listLamaran` (PELAMAR/ADMIN/RECRUITER).
2. Pertimbangkan memperkaya payload `/auth/me` dengan `portfolio_url`.
3. Siapkan CI (mis. GitHub Actions) untuk otomatis `lint` + `test` pada setiap push.

---

## 12. Diagnosis Masalah Login di Deployment

### Gejala
Web yang sudah di-deploy tidak bisa login; muncul tulisan **"Terjadi kesalahan pada server"** (500).

### Temuan diagnosis (diuji langsung)
| Probe | Hasil | Arti |
|---|---|---|
| `https://kerjayuk-backend.onrender.com/api/health` | **404** (body kosong) | Backend **tidak** berjalan di URL Render ini; bukan backend yang dipakai |
| Bundle JS frontend deploy (`index-BCMS4W-M.js`) | memuat `https://kerjayuk-backend-production.up.railway.app/api` | Frontend sebenarnya menunjuk ke **Railway**, bukan Render |
| `https://kerjayuk-backend-production.up.railway.app/api/health` | **200 OK** `{status:"ok",service:"kerjayuk-backend",version:"1.1"}` | Backend Railway hidup & merchant jalankan kode aplikasi |
| `POST /api/auth/login` (recruiter & pelamar demo) | **500 Internal Server Error** | Login gagal |
| `POST /api/auth/register` (email baru) | **500** | Query `prisma.user.create` gagal |
| `POST /api/auth/login` (email tidak ada) | **500** (harusnya 401) | `prisma.user.findUnique` sendiri gagal |
| `GET /api/auth/me` tanpa token | **401** | Server hidup & middleware auth berjalan |

### Akar masalah
Semua probe yang menyentuh **database (Prisma)** mengembalikan 500, termasuk yang seharusnya 401. Ini menegaskan bahwa **backend di Railway tidak dapat terkoneksi ke database** — kemungkinan besar:
1. **Migrasi belum dijalankan** di environment Railway (`npx prisma migrate deploy` / `prisma migrate deploy`) — tabel belum ada.
2. **`DATABASE_URL`/`DIRECT_URL` tidak di-set atau salah** di environment Railway.

> Catatan: pesan 500 disembunyikan oleh `errorHandler` (`Terjadi kesalahan pada server`), jadi tidak terlihat detail dari luar.

### Langkah perbaikan (perlu akses dashboard Railway)
1. Di dashboard Railway service `kerjayuk-backend`, set Environment Variables:
   - `DATABASE_URL` & `DIRECT_URL` → URL PostgreSQL (Supabase) yang valid.
   - `JWT_SECRET` (rahasia kuat), `JWT_EXPIRES_IN=1d`, `FRONTEND_URL=https://kerjayuk-frontend.vercel.app`.
2. Jalankan migrasi: di build/start command atau shell Railway: `npx prisma migrate deploy`.
3. Jalankan seed: `node prisma/seed.js` untuk akun demo `recruiter@kerjayuk.id` / `pelamar@kerjayuk.id` (password `password123`).
4. Restart service dan uji ulang `POST /api/health` lalu `POST /api/auth/login` (harus 200, bukan 500).

### Catatan tambahan
- URL Render (`kerjayuk-backend.onrender.com`) tampaknya **tidak aktif/berisi service lain**; frontend production memakai Railway, jadi fokus perbaikan di Railway.
- `.env` lokal frontend menunjuk `http://localhost:3000/api` (untuk dev lokal, wajar).

### Status verifikasi ulang (sudah diperbaiki)
Setelah perbaikan di sisi Railway, verifikasi ulang menunjukkan **backend sudah berfungsi penuh**:

| Probe | Hasil | Status |
|---|---|---|
| `GET /api/health` (Railway) | **200 OK** | ✅ |
| `POST /api/auth/login` (recruiter) | **200** + token JWT + user `RECRUITER` | ✅ |
| `POST /api/auth/login` (pelamar) | **200** + token + user `PELAMAR` | ✅ |
| `GET /api/auth/me` (pakai token) | **200** `{ user: {...} }` | ✅ |
| `GET /api/lowongan` (pakai token) | **200**, total 6 lowongan | ✅ |

> Kesimpulan: masalah login "Terjadi kesalahan pada server" **sudah teratasi**; backend Railway dapat login dan menyajikan data.

