// KerjaYuk v1.1 — Seed data untuk pengujian
// Jalankan: node prisma/seed.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const pass = await bcrypt.hash('password123', 10);

  const recruiter = await prisma.user.upsert({
    where: { email: 'recruiter@kerjayuk.id' },
    update: {},
    create: {
      nama: 'Budi Recruiter',
      email: 'recruiter@kerjayuk.id',
      password_hash: pass,
      role: 'RECRUITER',
    },
  });

  const pelamar = await prisma.user.upsert({
    where: { email: 'pelamar@kerjayuk.id' },
    update: {},
    create: {
      nama: 'Sinta Pelamar',
      email: 'pelamar@kerjayuk.id',
      password_hash: pass,
      role: 'PELAMAR',
      portfolio_url: 'https://github.com/sinta',
    },
  });

  const jumlahLowongan = await prisma.lowongan.count();
  if (jumlahLowongan === 0) {
    await prisma.lowongan.createMany({
      data: [
        {
          judul: 'Backend Developer',
          deskripsi: 'Node.js & Express',
          perusahaan: 'PT Teknologi Maju',
          recruiterId: recruiter.id,
        },
        {
          judul: 'Frontend Developer',
          deskripsi: 'React.js',
          perusahaan: 'PT Digital Kreatif',
          recruiterId: recruiter.id,
        },
        {
          judul: 'QA Engineer',
          deskripsi: 'Manual & automation testing',
          perusahaan: 'PT Teknologi Maju',
          recruiterId: recruiter.id,
          is_open: false, // untuk uji penolakan lamaran ke lowongan tutup
        },
      ],
    });
  }

  console.log('Seed selesai:');
  console.log('  recruiter: recruiter@kerjayuk.id / password123');
  console.log('  pelamar  : pelamar@kerjayuk.id / password123');
  console.log('  lowongan :', await prisma.lowongan.count());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
