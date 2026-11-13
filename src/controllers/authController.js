// KerjaYuk v1.2 — Auth Controller (AC-3: Token Versioning)
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { validatePortfolioUrl } = require('../utils/portfolioValidator'); // AC-4

// Proyeksi user yang aman dikirim ke klien (tanpa password_hash / token_version)
function serializeUser(user) {
  return {
    id: user.id,
    nama: user.nama,
    email: user.email,
    role: user.role,
    portfolio_url: user.portfolio_url,
  };
}

/** POST /api/auth/login — { email, password }; JWT memuat token_version (AC-3) */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Pesan error sengaja sama (mencegah user enumeration)
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
      user: serializeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/auth/logout — token_version+1 sehingga semua token lama tercabut */
async function logout(req, res, next) {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { token_version: { increment: 1 } },
    });

    res.json({ message: 'Logout berhasil, semua sesi token lama telah dicabut' });
  } catch (err) {
    next(err);
  }
}

/** GET /api/auth/me (wajib login) */
async function me(req, res) {
  res.json({ user: req.user });
}

/** POST /api/auth/register — akun PELAMAR; portfolio_url divalidasi allowlist (AC-4) */
async function register(req, res, next) {
  try {
    const { nama, email, password, portfolio_url } = req.body || {};

    if (!nama || !email || !password) {
      return res.status(400).json({ error: 'nama, email, dan password wajib diisi' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password minimal 8 karakter' });
    }

    // AC-4: validasi allowlist host (github.com, linkedin.com, dst.)
    const cek = validatePortfolioUrl(portfolio_url);
    if (!cek.valid) {
      return res.status(400).json({ error: cek.error });
    }

    const sudahAda = await prisma.user.findUnique({ where: { email } });
    if (sudahAda) {
      return res.status(409).json({ error: 'Email sudah terdaftar' });
    }

    const user = await prisma.user.create({
      data: {
        nama,
        email: email.trim().toLowerCase(),
        password_hash: await bcrypt.hash(password, 10),
        role: 'PELAMAR',
        portfolio_url: cek.host ? portfolio_url.trim() : null,
      },
    });

    res.status(201).json({
      message: 'Registrasi berhasil, silakan login',
      user: serializeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/auth/profile (wajib login) — { nama?, portfolio_url? } */
async function updateProfile(req, res, next) {
  try {
    const { nama, portfolio_url } = req.body || {};

    const data = {};
    if (nama !== undefined) {
      if (!nama || nama.trim() === '') {
        return res.status(400).json({ error: 'Nama tidak boleh kosong' });
      }
      data.nama = nama.trim();
    }
    if (portfolio_url !== undefined) {
      const cek = validatePortfolioUrl(portfolio_url); // AC-4
      if (!cek.valid) {
        return res.status(400).json({ error: cek.error });
      }
      data.portfolio_url = cek.host ? portfolio_url.trim() : null;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Tidak ada data yang diubah' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });

    res.json({
      message: 'Profil berhasil diperbarui',
      user: serializeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, me, register, updateProfile };
