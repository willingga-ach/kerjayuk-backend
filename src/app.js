// KerjaYuk v1.2 — Inisialisasi aplikasi Express (dipisah dari server.js agar mudah di-test)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter } = require('./middleware/rateLimit.middleware');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app = express();

// Di belakang proxy (Render/Heroku) agar IP asli terbaca oleh rate limiter
app.set('trust proxy', 1);

app.use(helmet()); // header keamanan: nosniff, frame, referrer-policy, dst.

const allowedOrigin = process.env.FRONTEND_URL;
app.use(
  cors({
    origin: allowedOrigin ? allowedOrigin.split(',').map((s) => s.trim()) : true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '100kb' })); // Parser body JSON + batas ukuran

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'kerjayuk-backend', version: '1.2' });
});

app.use('/api', apiLimiter, require('./routes/api'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
