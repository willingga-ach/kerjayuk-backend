// KerjaYuk v1.1 — Auth Routes (AC-3: Token Versioning)
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * POST /api/auth/login
 * Body: { email, password }
 * JWT yang diterbitkan MEMUAT token_version dari database (AC-3).
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Pesan error sengaja sama untuk user tak terdaftar & password salah
    // (mencegah user enumeration)
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        token_version: user.token_version, // AC-3: muat token_version di payload
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role,
        portfolio_url: user.portfolio_url,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout (wajib login)
 * AC-3: naikkan token_version + 1 di database agar SEMUA token lama
 * tercabut (revoke) secara instan, meski secara stateless JWT masih "valid".
 */
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { token_version: { increment: 1 } }, // token_version + 1
    });

    res.json({ message: 'Logout berhasil, semua sesi token lama telah dicabut' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me (wajib login)
 * Utilitas kecil untuk frontend: cek sesi aktif & ambil profil dari token.
 */
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
