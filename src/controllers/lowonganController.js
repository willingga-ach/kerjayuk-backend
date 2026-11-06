// KerjaYuk v1.1 — Lowongan Controller
// AC-5: Paginasi (page/limit, skip/take) dengan limit maksimum 50
//        + tie-breaker created_at descending (indeks @@index([created_at(sort: Desc)]))
const prisma = require('../lib/prisma');

const MAX_LIMIT = 50; // AC-5: batas keras per request

/**
 * GET /api/lowongan?page=1&limit=20&status=buka|tutup  (wajib login)
 */
async function listLowongan(req, res, next) {
  try {
    // AC-5: tangkap query page & limit, clamp ke nilai aman
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.status === 'buka') where.is_open = true;
    if (req.query.status === 'tutup') where.is_open = false;

    const [total, data] = await prisma.$transaction([
      prisma.lowongan.count({ where }),
      prisma.lowongan.findMany({
        where,
        orderBy: { created_at: 'desc' }, // tie-breaker via indeks AC-5
        skip,                             // AC-5: skip = (page-1) * limit
        take: limit,                      // AC-5: take = limit (max 50)
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
      data: data.map((l) => ({ ...l, jumlah_pelamar: l._count.lamaran, _count: undefined })),
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/lowongan/:id  (wajib login)
 */
async function getLowonganDetail(req, res, next) {
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
}

/**
 * POST /api/lowongan  (RECRUITER / ADMIN)
 * Body: { judul, deskripsi, perusahaan }
 */
async function createLowongan(req, res, next) {
  try {
    const { judul, deskripsi, perusahaan } = req.body || {};

    if (!judul || !deskripsi || !perusahaan) {
      return res.status(400).json({ error: 'judul, deskripsi, dan perusahaan wajib diisi' });
    }

    const lowongan = await prisma.lowongan.create({
      data: { judul, deskripsi, perusahaan, recruiterId: req.user.id, is_open: true },
    });

    res.status(201).json({ message: 'Lowongan berhasil dibuat', lowongan });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/lowongan/:id/toggle  (RECRUITER / ADMIN)
 * Buka/tutup lowongan (menutup memblokir lamaran baru).
 */
async function toggleLowongan(req, res, next) {
  try {
    const lowongan = await prisma.lowongan.findUnique({ where: { id: req.params.id } });
    if (!lowongan) {
      return res.status(404).json({ error: 'Lowongan tidak ditemukan' });
    }

    // IDOR guard: RECRUITER hanya boleh meng-toggle lowongan miliknya sendiri.
    if (req.user.role === 'RECRUITER' && lowongan.recruiterId !== req.user.id) {
      return res.status(403).json({ error: 'Akses ditolak untuk lowongan ini' });
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

module.exports = { listLowongan, getLowonganDetail, createLowongan, toggleLowongan };
