// KerjaYuk v1.1 — Lamaran Routes
// AC-1: Compare-and-Swap (kolom `version`)
// AC-2: Matriks Status Adaptif (DITOLAK -> DIPROSES wajib notes)
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

// Semua status yang valid sesuai enum StatusLamaran
const STATUS_VALID = ['DIPROSES', 'DITERIMA', 'DITOLAK'];

/**
 * PATCH /api/lamaran/:id/status  (RECRUITER / ADMIN)
 * Body: { status_baru, current_version, notes? }
 *
 * AC-1: Update hanya dieksekusi jika `version` di DB masih sama dengan
 *       `current_version` yang dikirim client (Compare-and-Swap).
 *       Jika baris berubah (count = 0) -> HTTP 409 Conflict.
 * AC-2: Transisi DITOLAK -> DIPROSES wajib menyertakan `notes` -> HTTP 400 jika kosong.
 *       Update Lamaran + insert LogStatus berjalan atomik dalam satu $transaction.
 */
router.patch(
  '/:id/status',
  authenticate,
  requireRole('RECRUITER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status_baru, current_version, notes } = req.body || {};

      // --- Validasi input dasar (HTTP 400) ---
      if (!status_baru || !STATUS_VALID.includes(status_baru)) {
        return res.status(400).json({
          error: `status_baru wajib salah satu dari: ${STATUS_VALID.join(', ')}`,
        });
      }
      if (typeof current_version !== 'number' || !Number.isInteger(current_version)) {
        return res.status(400).json({ error: 'current_version wajib berupa integer' });
      }

      // --- Ambil status lamaran saat ini (untuk AC-2) ---
      const lamaran = await prisma.lamaran.findUnique({ where: { id } });
      if (!lamaran) {
        return res.status(404).json({ error: 'Lamaran tidak ditemukan' });
      }

      // --- AC-2: Matriks Status Adaptif ---
      // "Ditolak" tidak lagi terkunci permanen: boleh kembali ke "Diproses",
      // TAPI catatan evaluasi wajib diisi (tidak boleh kosong/null).
      const undoPenolakan =
        lamaran.status === 'DITOLAK' && status_baru === 'DIPROSES';

      if (undoPenolakan && (!notes || notes.trim() === '')) {
        return res.status(400).json({
          error:
            'Transisi DITOLAK -> DIPROSES wajib menyertakan catatan evaluasi (notes)',
        });
      }

      // --- AC-1: Compare-and-Swap dalam transaksi atomik ---
      try {
        const hasil = await prisma.$transaction(async (tx) => {
          // Compare-and-Swap: WHERE id = :id AND version = :current_version
          const updated = await tx.lamaran.updateMany({
            where: { id, version: current_version },
            data: {
              status: status_baru,
              notes: notes ?? lamaran.notes,
              version: { increment: 1 }, // version + 1 untuk penulis berikutnya
            },
          });

          // count = 0 -> versi sudah berubah (pihak lain menulis lebih dulu)
          if (updated.count === 0) {
            const err = new Error(
              'Data telah diubah oleh pihak lain. Muat ulang dan coba lagi.'
            );
            err.status = 409; // AC-1: HTTP 409 Conflict
            throw err;
          }

          // Insert histori — satu transaksi dengan update di atas (atomik)
          await tx.logStatus.create({
            data: {
              lamaranId: id,
              changedBy: req.user.id,
              status_lama: lamaran.status,
              status_baru,
              notes: notes ?? null,
            },
          });

          // Ambil baris terbaru (version sudah +1) sebagai respons
          return tx.lamaran.findUnique({ where: { id } });
        });

        res.json({
          message: 'Status lamaran berhasil diperbarui',
          lamaran: hasil,
        });
      } catch (txErr) {
        if (txErr.status === 409) {
          return res.status(409).json({ error: txErr.message });
        }
        throw txErr; // error lain -> error handler terpusat (500)
      }
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/lamaran  (PELAMAR)
 * Body: { lowonganId }
 * Menutup celah dari Laporan Evaluasi: pendaftaran tepat saat lowongan
 * dihapus/ditutup. Cek dilakukan terhadap kondisi DB terkini, dan
 * race yang tersisa ditangani lewat FK onDelete: Cascade (lowongan hilang ->
 * insert gagal -> HTTP 409) serta unique constraint (dua kali melamar -> 409).
 */
router.post(
  '/',
  authenticate,
  requireRole('PELAMAR'),
  async (req, res, next) => {
    try {
      const { lowonganId } = req.body || {};
      if (!lowonganId) {
        return res.status(400).json({ error: 'lowonganId wajib diisi' });
      }

      // Cek ketersediaan lowongan (kondisi DB terkini, bukan dari cache client)
      const lowongan = await prisma.lowongan.findUnique({
        where: { id: lowonganId },
      });

      if (!lowongan) {
        return res.status(404).json({ error: 'Lowongan tidak ditemukan' });
      }
      if (!lowongan.is_open) {
        return res.status(400).json({ error: 'Lowongan sudah ditutup' });
      }

      try {
        const lamaran = await prisma.lamaran.create({
          data: {
            pelamarId: req.user.id,
            lowonganId,
            status: 'DIPROSES',
            version: 1, // AC-1: versi awal untuk Compare-and-Swap
          },
        });

        res.status(201).json({
          message: 'Lamaran berhasil dikirim',
          lamaran,
        });
      } catch (err) {
        // P2002 = unique constraint: pelamar sudah melamar di lowongan ini
        if (err.code === 'P2002') {
          return res.status(409).json({
            error: 'Anda sudah melamar di lowongan ini',
          });
        }
        // P2003 = foreign key: lowongan dihapus tepat sebelum insert (race)
        if (err.code === 'P2003') {
          return res.status(409).json({
            error: 'Lowongan baru saja dihapus, lamaran gagal diproses',
          });
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/lamaran/:id/log  (RECRUITER / ADMIN)
 * Riwayat perubahan status — berguna untuk audit undo penolakan.
 * Paginasi AC-5: limit maksimum 50 baris per request.
 */
router.get(
  '/:id/log',
  authenticate,
  requireRole('RECRUITER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50); // AC-5: max 50
      const logs = await prisma.logStatus.findMany({
        where: { lamaranId: req.params.id },
        orderBy: { created_at: 'desc' },
        take: limit,
      });
      res.json({ total: logs.length, logs });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
