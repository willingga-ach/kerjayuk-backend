// Unit test untuk lowonganController.
// Fokus: IDOR guard pada toggleLowongan (RECRUITER hanya boleh meng-toggle miliknya).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const prismaMock = require('../src/lib/prisma');
const controllers = require('../src/controllers/lowonganController');
const { makeRes, makeNext, makeReq } = require('./helpers');

function resetMocks() {
  Object.assign(prismaMock, {
    lowongan: {
      findUnique: async () => null,
      findMany: async () => [],
      create: async () => ({}),
      update: async () => ({}),
      count: async () => 0,
    },
    $transaction: async (arg) => {
      if (typeof arg === 'function') return arg({ lowongan: { update: async () => ({}) } });
      const out = [];
      for (const p of arg) out.push(await p);
      return out;
    },
  });
}

test('toggleLowongan: RECRUITER ditolak (403) jika meng-toggle lowongan orang lain', async () => {
  resetMocks();
  prismaMock.lowongan.findUnique = async () => ({
    id: 'low-1',
    recruiterId: 'recruiter-lain',
    is_open: true,
  });

  const req = makeReq({
    params: { id: 'low-1' },
    user: { id: 'recruiter-saya', role: 'RECRUITER' },
  });
  const res = makeRes();
  const next = makeNext();

  await controllers.toggleLowongan(req, res, next);

  assert.equal(res.statusCode, 403);
  assert.equal(res.jsonBody.error, 'Akses ditolak untuk lowongan ini');
});

test('toggleLowongan: RECRUITER diizinkan meng-toggle lowongan miliknya', async () => {
  resetMocks();
  prismaMock.lowongan.findUnique = async () => ({
    id: 'low-1',
    recruiterId: 'recruiter-saya',
    is_open: true,
  });
  prismaMock.lowongan.update = async () => ({
    id: 'low-1',
    recruiterId: 'recruiter-saya',
    is_open: false,
  });

  const req = makeReq({
    params: { id: 'low-1' },
    user: { id: 'recruiter-saya', role: 'RECRUITER' },
  });
  const res = makeRes();
  const next = makeNext();

  await controllers.toggleLowongan(req, res, next);

  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonBody.message, 'Lowongan ditutup');
  assert.equal(res.jsonBody.lowongan.is_open, false);
});

test('toggleLowongan: ADMIN diizinkan meng-toggle lowongan apa pun', async () => {
  resetMocks();
  prismaMock.lowongan.findUnique = async () => ({
    id: 'low-1',
    recruiterId: 'recruiter-lain',
    is_open: false,
  });
  prismaMock.lowongan.update = async () => ({
    id: 'low-1',
    recruiterId: 'recruiter-lain',
    is_open: true,
  });

  const req = makeReq({
    params: { id: 'low-1' },
    user: { id: 'admin-1', role: 'ADMIN' },
  });
  const res = makeRes();
  const next = makeNext();

  await controllers.toggleLowongan(req, res, next);

  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonBody.message, 'Lowongan dibuka');
  assert.equal(res.jsonBody.lowongan.is_open, true);
});

test('toggleLowongan: lowongan tidak ditemukan mengembalikan 404', async () => {
  resetMocks();
  prismaMock.lowongan.findUnique = async () => null;

  const req = makeReq({
    params: { id: 'low-tak-ada' },
    user: { id: 'recruiter-saya', role: 'RECRUITER' },
  });
  const res = makeRes();
  const next = makeNext();

  await controllers.toggleLowongan(req, res, next);

  assert.equal(res.statusCode, 404);
  assert.equal(res.jsonBody.error, 'Lowongan tidak ditemukan');
});
