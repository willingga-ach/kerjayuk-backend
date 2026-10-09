// KerjaYuk v1.1 — Entry point server
// Inisialisasi Express, pasang router terpusat, lalu global error handler
// di urutan PALING BAWAH.
require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`KerjaYuk backend v1.1 berjalan di port ${PORT}`);
});
