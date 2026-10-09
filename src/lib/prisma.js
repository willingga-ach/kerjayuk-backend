// KerjaYuk v1.1 — Instance Prisma Client tunggal (singleton)
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
