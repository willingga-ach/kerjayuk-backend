// KerjaYuk v1.1 — Lowongan Routes
// AC-5: Paginasi dengan limit maksimum 50 + tie-breaker created_at descending
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const MAX_LIMIT = 50; // AC-5: batas keras per request

/**
 * GET /api/lowongan?page=1&limit=20&status=buka|tutup  (wajib login)
 *
 * - limit dicukupkan ke maksimum 50 (client minta 100 -> tetap 50).
 * - Urutan: created_at DESC sebagai tie-breaker (indeks @@index([created_at(sort: Desc)]))
 *   sehingga paginasi stabil walau ada baris dengan timestamp sama.
 * - Metadata paginasi: page, limit, total, total_pages.
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, MAX_LIMIT);
    const skip = (page - 1) * limit;

    // Filter opsional: hanya lowongan yang masih buka
    const where = {};
    if (req.query.status === 'buka') where.is_open = true;
    if (req.query.status === 'tutup') where.is_open = false;

    const [total, lowongan] = await prisma.$transaction([
      prisma.lowongan.count({ where }),
      prisma.lowongan.findMany({
        where,
        orderBy: { created_at: 'desc' }, // tie-breaker via indeks AC-5
        skip,
        take: limit,
        select: {
          id: true,
          judul: true,
          perusahaan: true,
          deskripsi: true,
          is_open: true,
          created_at: true,
          recruiter: { select: { nama: true } },
          _count: { select: { lamaran: true } },
        },
      }),
    ]);

    res.json({
      data: lowongan.map((l) => ({
        ...l,
        jumlah_pelamar: l._count.lamaran,
        _count: undefined,
      })),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/lowongan/:id  (wajib login)
 * Detail satu lowongan.
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const lowongan = await prisma.lowongan.findUnique({
      where: { id: req.params.id },
      include: {
        recruiter: { select: { nama: true, email: true } },
        _count: { select: { lamaran: true } },
      },
    });

    if (!lowongan) {
      return res.status(404).json({ error: 'Lowongan tidak ditemukan' });
    }

    res.json({
      ...lowongan,
      jumlah_pelamar: lowongan._count.lamaran,
      _count: undefined,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/lowongan  (RECRUITER / ADMIN)
 * Body: { judul, deskripsi, perusahaan }
 */
router.post(
  '/',
  authenticate,
  requireRole('RECRUITER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const { judul, deskripsi, perusahaan } = req.body || {};

      if (!judul || !deskripsi || !perusahaan) {
        return res.status(400).json({
          error: 'judul, deskripsi, dan perusahaan wajib diisi',
        });
      }

      const lowongan = await prisma.lowongan.create({
        data: {
          judul,
          deskripsi,
          perusahaan,
          recruiterId: req.user.id,
          is_open: true,
        },
      });

      res.status(201).json({ message: 'Lowongan berhasil dibuat', lowongan });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/lowongan/:id/toggle  (RECRUITER / ADMIN)
 * Buka/tutup lowongan. Menutup lowongan mencegah lamaran baru masuk
 * (POST /api/lamaran menolak dengan HTTP 400 jika is_open = false).
 */
router.patch(
  '/:id/toggle',
  authenticate,
  requireRole('RECRUITER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const lowongan = await prisma.lowongan.findUnique({
        where: { id: req.params.id },
      });
      if (!lowongan) {
        return res.status(404).json({ error: 'Lowongan tidak ditemukan' });
      }

      const updated = await prisma.lowongan.update({
        where: { id: lowongan.id },
        data: { is_open: !lowongan.is_open },
      });

      res.json({
        message: updated.is_open ? 'Lowongan dibuka' : 'Lowongan ditutup',
        lowongan: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
