// KerjaYuk v1.1 — Middleware Autentikasi JWT (AC-3: Token Versioning)
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

/**
 * Middleware `authenticate`:
 * 1. Ambil token dari header `Authorization: Bearer <token>`
 * 2. Verifikasi signature & masa berlaku JWT
 * 3. Cocokkan `token_version` di payload JWT dengan di database.
 *    Jika beda -> token sudah dicabut (logout) -> HTTP 401.
 * 4. Tempel data user ke `req.user` untuk dipakai route berikutnya.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Token tidak ditemukan, silakan login' });
    }

    // Verifikasi signature + expiry
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return res.status(401).json({ error: 'Pengguna tidak ditemukan' });
    }

    // AC-3: token_version JWT harus sama dengan di database.
    // Logout menaikkan token_version di DB, sehingga semua token lama langsung ditolak.
    if (payload.token_version !== user.token_version) {
      return res.status(401).json({ error: 'Sesi telah dicabut, silakan login kembali' });
    }

    req.user = {
      id: user.id,
      nama: user.nama,
      email: user.email,
      role: user.role,
      token_version: user.token_version,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware `requireRole(...roles)`:
 * Pembatasan akses per role. Pemakaian: router.delete('/', requireRole('ADMIN'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Akses ditolak untuk role Anda' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
