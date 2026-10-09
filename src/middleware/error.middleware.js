// KerjaYuk v1.1 — Global Error Handling Middleware
// Ditangkap paling bawah di urutan middleware Express agar server tidak crash.

/**
 * 404 untuk endpoint yang tidak dikenal.
 */
function notFound(req, res) {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
}

/**
 * Global error handler (4 argumen — signature wajib untuk Express).
 * - err.status  : status kustom yang dilempar controller (mis. 409 CAS)
 * - err.code    : kode error Prisma (P2002 unique, P2003 FK, P2025 not found)
 * - selain itu  : HTTP 500 dengan JSON standar, pesan asli disembunyikan
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.status || '', err.message);

  if (res.headersSent) {
    return; // respons sudah terkirim, serahkan ke default Express
  }

  let status = err.status || 500;
  let message = err.message || 'Terjadi kesalahan pada server';

  // Pemetaan error Prisma yang umum
  if (err.code === 'P2002') { status = 409; message = 'Data sudah ada (duplikat)'; }
  if (err.code === 'P2003') { status = 409; message = 'Data terkait tidak ditemukan / baru dihapus'; }
  if (err.code === 'P2025') { status = 404; message = 'Data tidak ditemukan'; }

  // Jangan bocorkan detail internal pada error 500
  if (status === 500) {
    message = 'Terjadi kesalahan pada server';
  }

  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
