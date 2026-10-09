// KerjaYuk v1.1 — Validasi URL Portofolio (AC-4)
// Mencegah domain spoofing & SSRF: parse URL, ekstrak host,
// dan hanya izinkan domain yang terdaftar di allowlist eksplisit.

// Allowlist default sesuai PRD (misal: github.com, linkedin.com).
// Bisa dioverride lewat env PORTFOLIO_ALLOWLIST (dipisah koma).
const DEFAULT_ALLOWLIST = [
  'github.com',
  'gitlab.com',
  'linkedin.com',
  'dribbble.com',
  'behance.net',
  'medium.com',
];

function getAllowlist() {
  if (process.env.PORTFOLIO_ALLOWLIST) {
    return process.env.PORTFOLIO_ALLOWLIST.split(',').map((s) => s.trim().toLowerCase());
  }
  return DEFAULT_ALLOWLIST;
}

/**
 * Validasi URL portofolio.
 * @param {string|null} rawUrl  — boleh null/undefined (portfolio opsional)
 * @returns {{ valid: boolean, host?: string, error?: string }}
 *
 * Aturan:
 * 1. Kosong = valid (kolom opsional di skema).
 * 2. Harus URL absolut yang bisa di-parse (bukan "javascript:...", string acak, dst).
 * 3. Harus https:// (http ditolak — data sensitif + anti downgrade).
 * 4. Tidak boleh mengandung userinfo (user:pass@host) — vektor SSRF/spoofing.
 * 5. Host (setelah www. dilepas) HARUS persis ada di allowlist.
 *    Subdomain lain (evil-github.com, github.com.evil.io) otomatis tertolak.
 */
function validatePortfolioUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    return { valid: true, host: null }; // opsional
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: 'URL portofolio tidak valid' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'URL portofolio harus menggunakan https://' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URL portofolio tidak boleh mengandung kredensial' };
  }

  // Normalisasi: buang prefix www. lalu cocokkan persis dengan allowlist
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const allowlist = getAllowlist();

  if (!allowlist.includes(host)) {
    return {
      valid: false,
      error: `Domain tidak diizinkan. Gunakan: ${allowlist.join(', ')}`,
    };
  }

  return { valid: true, host };
}

module.exports = { validatePortfolioUrl, getAllowlist, DEFAULT_ALLOWLIST };
