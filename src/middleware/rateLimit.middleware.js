// KerjaYuk v1.2 — Rate limiting
// - authLimiter : proteksi brute force pada endpoint login/register (ketat)
// - apiLimiter  : pembatas umum agar satu klien tidak membanjiri API (longgar)
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  limit: 20, // maks 20 percobaan login/daftar per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000, // cukup untuk pemakaian normal aplikasi
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' },
});

module.exports = { authLimiter, apiLimiter };
