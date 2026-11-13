// KerjaYuk v1.2 — Entry point server
require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  // Startup banner — bukan sisa debug
  console.log(`KerjaYuk backend v1.2 berjalan di port ${PORT}`); // aislop-ignore-line -- log startup esensial
});
