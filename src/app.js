// KerjaYuk v1.1 — Inisialisasi aplikasi Express (dipisah dari server.js agar mudah di-test)
const express = require('express');
const cors = require('cors');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app = express();

// --- Middleware dasar ---
// CORS: di produksi dibatasi ke origin frontend (FRONTEND_URL dari env Render),
// di pengembangan lokal terbuka. Tanpa FRONTEND_URL -> allow all (dev mode).
const allowedOrigin = process.env.FRONTEND_URL;
app.use(
  cors({
    origin: allowedOrigin ? allowedOrigin.split(',').map((s) => s.trim()) : true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json()); // Parser body JSON

// --- Health check (dipakai Render untuk monitoring) ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'kerjayuk-backend', version: '1.1' });
});

// --- Router terpusat: seluruh middleware auth + controller terpasang di sini ---
app.use('/api', require('./routes/api'));

// --- 404 untuk endpoint yang tidak dikenal ---
app.use(notFound);

// --- Global error handler WAJIB paling bawah (HTTP 500 JSON standar) ---
app.use(errorHandler);

module.exports = app;
