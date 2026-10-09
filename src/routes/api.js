// KerjaYuk v1.1 — Router terpusat
// Menggabungkan seluruh middleware auth (authenticate/requireRole)
// dengan controller, dalam satu titik pemasangan: app.use('/api', apiRouter)
const router = require('express').Router();

const auth = require('../controllers/authController');
const lowongan = require('../controllers/lowonganController');
const lamaran = require('../controllers/lamaranController');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

// ---------- Auth ----------
router.post('/auth/register', auth.register);                 // publik (AC-4)
router.post('/auth/login', auth.login);                       // publik
router.post('/auth/logout', authenticate, auth.logout);       // wajib login (AC-3)
router.get('/auth/me', authenticate, auth.me);                // wajib login
router.patch('/auth/profile', authenticate, auth.updateProfile); // wajib login (AC-4)

// ---------- Lowongan ----------
router.get('/lowongan', authenticate, lowongan.listLowongan);                     // AC-5 paginasi
router.get('/lowongan/:id', authenticate, lowongan.getLowonganDetail);
router.post('/lowongan', authenticate, requireRole('RECRUITER', 'ADMIN'), lowongan.createLowongan);
router.patch('/lowongan/:id/toggle', authenticate, requireRole('RECRUITER', 'ADMIN'), lowongan.toggleLowongan);

// ---------- Lamaran ----------
router.get('/lamaran', authenticate, lamaran.listLamaran);                        // AC-5 paginasi
router.post('/lamaran', authenticate, requireRole('PELAMAR'), lamaran.createLamaran);
router.patch('/lamaran/:id/status', authenticate, requireRole('RECRUITER', 'ADMIN'), lamaran.updateStatusLamaran); // AC-1 + AC-2
router.get('/lamaran/:id/log', authenticate, requireRole('RECRUITER', 'ADMIN'), lamaran.getLamaranLog);

module.exports = router;
