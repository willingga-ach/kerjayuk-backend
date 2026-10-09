// KerjaYuk v1.1 — Lamaran Controller
// AC-1: Compare-and-Swap (kolom `version`)
// AC-2: Matriks Status Adaptif (DITOLAK -> DIPROSES wajib notes)
// AC-5: Paginasi GET data (page/limit, skip/take, max 50)
const prisma = require('../lib/prisma');

const MAX_LIMIT = 50;
const STATUS_VALID = ['DIPROSES', 'DITERIMA', 'DITOLAK'];

/**
 * GET /api/lamaran?page=1&limit=20  (wajib login)
 * PELAMAR        -> daftar lamaran miliknya sendiri
 * RECRUITER/ADMIN -> daftar lamaran pada lowongan miliknya
 */
async function listLamaran(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where =
      req.user.role === 'PELAMAR'
        ? { pelamarId: req.user.id }
        : { lowongan: { recruiterId: req.user.id } };

    const [total, data] = await prisma.$transaction([
      prisma.lamaran.count({ where }),
      prisma.lamaran.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          lowongan: { select: { judul: true, perusahaan: true, is_open: true } },
        },
      }),
    ]);

    res.json({
      data,
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/lamaran  (PELAMAR)
 * Body: { lowonganId }
 * Menutup celah Laporan Evaluasi: pendaftaran tepat saat lowongan
 * dihapus/ditutup -> cek DB terkini + P2002/P2003 -> HTTP 409.
 */
async function createLamaran(req, res, next) {
  try {
    const { lowonganId } = req.body || {};
    if (!lowonganId) {
      return res.status(400).json({ error: 'lowonganId wajib diisi' });
    }

    const lowongan = await prisma.lowongan.findUnique({ where: { id: lowonganId } });
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

      res.status(201).json({ message: 'Lamaran berhasil dikirim', lamaran });
    } catch (err) {
      if (err.code === 'P2002') {
        return res.status(409).json({ error: 'Anda sudah melamar di lowongan ini' });
      }
      // FK violation: lowongan dihapus tepat sebelum insert (race)
      if (err.code === 'P2003') {
        return res.status(409).json({ error: 'Lowongan baru saja dihapus, lamaran gagal diproses' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/lamaran/:id/status  (RECRUITER / ADMIN)
 * Body: { status_baru, current_version, notes? }
 *
 * AC-1: WHERE id AND version = current_version; count = 0 -> HTTP 409 Conflict.
 * AC-2: DITOLAK -> DIPROSES wajib notes; kosong -> HTTP 400.
 * Update Lamaran + insert LogStatus atomik dalam satu $transaction.
 */
async function updateStatusLamaran(req, res, next) {
  try {
    const { id } = req.params;
    const { status_baru, current_version, notes } = req.body || {};

    if (!status_baru || !STATUS_VALID.includes(status_baru)) {
      return res.status(400).json({
        error: `status_baru wajib salah satu dari: ${STATUS_VALID.join(', ')}`,
      });
    }
    if (typeof current_version !== 'number' || !Number.isInteger(current_version)) {
      return res.status(400).json({ error: 'current_version wajib berupa integer' });
    }

    const lamaran = await prisma.lamaran.findUnique({ where: { id } });
    if (!lamaran) {
      return res.status(404).json({ error: 'Lamaran tidak ditemukan' });
    }

    // --- AC-2: Matriks Status Adaptif ---
    const undoPenolakan = lamaran.status === 'DITOLAK' && status_baru === 'DIPROSES';
    if (undoPenolakan && (!notes || notes.trim() === '')) {
      return res.status(400).json({
        error: 'Transisi DITOLAK -> DIPROSES wajib menyertakan catatan evaluasi (notes)',
      });
    }

    // --- AC-1: Compare-and-Swap dalam transaksi atomik ---
    try {
      const hasil = await prisma.$transaction(async (tx) => {
        const updated = await tx.lamaran.updateMany({
          where: { id, version: current_version }, // CAS: cocokkan versi
          data: {
            status: status_baru,
            notes: notes ?? lamaran.notes,
            version: { increment: 1 }, // version + 1
          },
        });

        if (updated.count === 0) {
          const err = new Error('Data telah diubah oleh pihak lain. Muat ulang dan coba lagi.');
          err.status = 409; // AC-1: HTTP 409 Conflict
          throw err;
        }

        await tx.logStatus.create({
          data: {
            lamaranId: id,
            changedBy: req.user.id,
            status_lama: lamaran.status,
            status_baru,
            notes: notes ?? null,
          },
        });

        return tx.lamaran.findUnique({ where: { id } });
      });

      res.json({ message: 'Status lamaran berhasil diperbarui', lamaran: hasil });
    } catch (txErr) {
      if (txErr.status === 409) {
        return res.status(409).json({ error: txErr.message });
      }
      throw txErr;
    }
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/lamaran/:id/log  (RECRUITER / ADMIN)
 * Riwayat perubahan status (audit undo). Limit max 50 (AC-5).
 */
async function getLamaranLog(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, MAX_LIMIT);
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

module.exports = { listLamaran, createLamaran, updateStatusLamaran, getLamaranLog };
