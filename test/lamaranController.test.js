// Unit test untuk lamaranController.
// Fokus: IDOR guard (kepemilikan RECRUITER), AC-1 (CAS), AC-2 (notes wajib).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// Simpan referensi ke modul lib agar bisa di-override setelah require controller.
const prismaMock = require('../src/lib/prisma');
const controllers = require('../src/controllers/lamaranController');
const { makeRes, makeNext, makeReq } = require('./helpers');

/** Helper: rebuild mock objek prisma untuk tiap test. */
function resetMocks() {
  Object.assign(prismaMock, basePrismaMock());
}

function basePrismaMock() {
  return {
    lamaran: {
      findUnique: async () => null,
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
      create: async () => ({}),
      count: async () => 0,
    },
    logStatus: {
      create: async () => ({}),
      findMany: async () => [],
    },
    $transaction: async (arg) => {
      if (typeof arg === 'function') {
        return arg(txProxy());
      }
      const out = [];
      for (const p of arg) out.push(await p);
      return out;
    },
  };
}

function txProxy() {
  return {
    lamaran: {
      updateMany: async () => ({ count: 1 }),
      findUnique: async () => null,
      create: async () => ({}),
    },
    logStatus: {
      create: async () => ({}),
    },
  };
}

// ---------- updateStatusLamaran: IDOR guard ----------
test('updateStatusLamaran: RECRUITER ditolak (403) jika lamaran bukan miliknya', async () => {
  resetMocks();
  // Lowongan milik recruiter lain (recruiterId berbeda dari req.user.id)
  prismaMock.lamaran.findUnique = async () => ({
    id: 'lam-1',
    status: 'DIPROSES',
    version: 1,
    lowongan: { recruiterId: 'recruiter-lain' },
  });

  const req = makeReq({
    params: { id: 'lam-1' },
    body: { status_baru: 'DITERIMA', current_version: 1 },
    user: { id: 'recruiter-saya', role: 'RECRUITER' },
  });
  const res = makeRes();
  const next = makeNext();

  await controllers.updateStatusLamaran(req, res, next);

  assert.equal(res.statusCode, 403);
  assert.equal(res.jsonBody.error, 'Akses ditolak untuk lamaran ini');
});

test('updateStatusLamaran: RECRUITER diizinkan (200) untuk lamaran di lowongan miliknya', async () => {
  resetMocks();
  prismaMock.lamaran.findUnique = async () => ({
    id: 'lam-1',
    status: 'DIPROSES',
    version: 1,
    lowongan: { recruiterId: 'recruiter-saya' },
  });

  prismaMock.$transaction = async (arg) => {
    if (typeof arg === 'function') {
      return arg({
        lamaran: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({
            id: 'lam-1',
            status: 'DITERIMA',
            version: 2,
            lowongan: { recruiterId: 'recruiter-saya' },
          }),
        },
        logStatus: { create: async () => ({}) },
      });
    }
    return [];
  };

  const req = makeReq({
    params: { id: 'lam-1' },
    body: { status_baru: 'DITERIMA', current_version: 1 },
    user: { id: 'recruiter-saya', role: 'RECRUITER' },
  });
  const res = makeRes();
  const next = makeNext();

  await controllers.updateStatusLamaran(req, res, next);

  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonBody.lamaran.status, 'DITERIMA');
  assert.equal(res.jsonBody.lamaran.version, 2);
});

test('updateStatusLamaran: ADMIN diizinkan untuk lamaran apa pun', async () => {
  resetMocks();
  prismaMock.lamaran.findUnique = async () => ({
    id: 'lam-1',
    status: 'DIPROSES',
    version: 1,
    lowongan: { recruiterId: 'recruiter-lain' },
  });

  prismaMock.$transaction = async (arg) => {
    if (typeof arg === 'function') {
      return arg({
        lamaran: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({
            id: 'lam-1',
            status: 'DITERIMA',
            version: 2,
            lowongan: { recruiterId: 'recruiter-lain' },
          }),
        },
        logStatus: { create: async () => ({}) },
      });
    }
    return [];
  };

  const req = makeReq({
    params: { id: 'lam-1' },
    body: { status_baru: 'DITERIMA', current_version: 1 },
    user: { id: 'admin-1', role: 'ADMIN' },
  });
  const res = makeRes();
  const next = makeNext();

  await controllers.updateStatusLamaran(req, res, next);

  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonBody.lamaran.status, 'DITERIMA');
});

// ---------- updateStatusLamaran: AC-1 CAS ----------
test('updateStatusLamaran: CAS conflict mengembalikan 409', async () => {
  resetMocks();
  prismaMock.lamaran.findUnique = async () => ({
    id: 'lam-1',
    status: 'DIPROSES',
    version: 1,
    lowongan: { recruiterId: 'recruiter-saya' },
  });

  prismaMock.$transaction = async (arg) => {
    if (typeof arg === 'function') {
      return arg({
        lamaran: { updateMany: async () => ({ count: 0 }) },
        logStatus: { create: async () => ({}) },
      });
    }
    return [];
  };

  const req = makeReq({
    params: { id: 'lam-1' },
    body: { status_baru: 'DITERIMA', current_version: 1 },
    user: { id: 'recruiter-saya', role: 'RECRUITER' },
  });
  const res = makeRes();
  const next = makeNext();

  await controllers.updateStatusLamaran(req, res, next);

  assert.equal(res.statusCode, 409);
  assert.match(res.jsonBody.error, /telah diubah oleh pihak lain/);
});

// ---------- updateStatusLamaran: AC-2 notes wajib ----------
test('updateStatusLamaran: DITOLAK -> DIPROSES tanpa notes mengembalikan 400', async () => {
  resetMocks();
  prismaMock.lamaran.findUnique = async () => ({
    id: 'lam-1',
    status: 'DITOLAK',
    version: 2,
    lowongan: { recruiterId: 'recruiter-saya' },
  });

  const req = makeReq({
    params: { id: 'lam-1' },
    body: { status_baru: 'DIPROSES', current_version: 2, notes: '' },
    user: { id: 'recruiter-saya', role: 'RECRUITER' },
  });
  const res = makeRes();
  const next = makeNext();

  await controllers.updateStatusLamaran(req, res, next);

  assert.equal(res.statusCode, 400);
  assert.match(res.jsonBody.error, /wajib menyertakan catatan evaluasi/);
});

// ---------- getLamaranLog: IDOR guard ----------
test('getLamaranLog: RECRUITER ditolak (403) jika lamaran bukan miliknya', async () => {
  resetMocks();
  prismaMock.lamaran.findUnique = async () => ({
    id: 'lam-1',
    lowongan: { recruiterId: 'recruiter-lain' },
  });

  const req = makeReq({
    params: { id: 'lam-1' },
    query: { limit: '10' },
    user: { id: 'recruiter-saya', role: 'RECRUITER' },
  });
  const res = makeRes();
  const next = makeNext();

  await controllers.getLamaranLog(req, res, next);

  assert.equal(res.statusCode, 403);
  assert.equal(res.jsonBody.error, 'Akses ditolak untuk lamaran ini');
});

test('getLamaranLog: RECRUITER diizinkan untuk lamaran miliknya', async () => {
  resetMocks();
  prismaMock.lamaran.findUnique = async () => ({
    id: 'lam-1',
    lowongan: { recruiterId: 'recruiter-saya' },
  });
  prismaMock.logStatus.findMany = async () => [{ id: 'log-1', status_baru: 'DITERIMA' }];

  const req = makeReq({
    params: { id: 'lam-1' },
    query: { limit: '10' },
    user: { id: 'recruiter-saya', role: 'RECRUITER' },
  });
  const res = makeRes();
  const next = makeNext();

  await controllers.getLamaranLog(req, res, next);

  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonBody.logs.length, 1);
  assert.equal(res.jsonBody.total, 1);
});
