// Helper bersama untuk unit test controller (node:test).
'use strict';

/** Mock respons Express yang chainable: res.status(403).json({...}) */
function makeRes() {
  return {
    statusCode: 200,
    body: null,
    jsonBody: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.jsonBody = body;
      this.body = body;
      return this;
    },
  };
}

/** Mock `next` untuk menangkap error yang diteruskan ke error handler. */
function makeNext() {
  const next = (err) => {
    next.error = err;
  };
  return next;
}

/** Membuat req mock sederhana. */
function makeReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'u-1', role: 'PELAMAR', nama: 'User', email: 'u@mail.com' },
    ...overrides,
  };
}

/**
 * Membangun objek mock prisma untuk lamaran.
 * Hanya method yang dibutuhkan test yang diisi.
 */
function makeLamaranPrismaMock() {
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
      // Bentuk callback: $transaction(async (tx) => ...)
      if (typeof arg === 'function') {
        return arg(makeTxProxy());
      }
      // Bentuk array: $transaction([...]) — jalankan berurutan.
      const out = [];
      for (const p of arg) out.push(await p);
      return out;
    },
  };
}

/** Proxy tx untuk di dalam $transaction(callback). */
function makeTxProxy() {
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

/** Membangun objek mock prisma untuk lowongan. */
function makeLowonganPrismaMock() {
  return {
    lowongan: {
      findUnique: async () => null,
      findMany: async () => [],
      create: async () => ({}),
      update: async () => ({}),
      count: async () => 0,
    },
    $transaction: async (arg) => {
      if (typeof arg === 'function') {
        return arg(makeTxProxy());
      }
      const out = [];
      for (const p of arg) out.push(await p);
      return out;
    },
  };
}

module.exports = { makeRes, makeNext, makeReq, makeLamaranPrismaMock, makeLowonganPrismaMock };
