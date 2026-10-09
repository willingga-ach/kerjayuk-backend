-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PELAMAR', 'RECRUITER', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatusLamaran" AS ENUM ('DIPROSES', 'DITERIMA', 'DITOLAK');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PELAMAR',
    "token_version" INTEGER NOT NULL DEFAULT 1,
    "portfolio_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lowongan" (
    "id" UUID NOT NULL,
    "recruiter_id" UUID NOT NULL,
    "judul" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "perusahaan" TEXT NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lowongan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lamaran" (
    "id" UUID NOT NULL,
    "pelamar_id" UUID NOT NULL,
    "lowongan_id" UUID NOT NULL,
    "status" "StatusLamaran" NOT NULL DEFAULT 'DIPROSES',
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lamaran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_status" (
    "id" UUID NOT NULL,
    "lamaran_id" UUID NOT NULL,
    "changed_by" UUID NOT NULL,
    "status_lama" "StatusLamaran",
    "status_baru" "StatusLamaran" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "lowongan_created_at_idx" ON "lowongan"("created_at" DESC);

-- CreateIndex
CREATE INDEX "lowongan_recruiter_id_idx" ON "lowongan"("recruiter_id");

-- CreateIndex
CREATE INDEX "lamaran_status_idx" ON "lamaran"("status");

-- CreateIndex
CREATE INDEX "lamaran_pelamar_id_idx" ON "lamaran"("pelamar_id");

-- CreateIndex
CREATE INDEX "lamaran_lowongan_id_idx" ON "lamaran"("lowongan_id");

-- CreateIndex
CREATE UNIQUE INDEX "lamaran_pelamar_id_lowongan_id_key" ON "lamaran"("pelamar_id", "lowongan_id");

-- CreateIndex
CREATE INDEX "log_status_status_baru_idx" ON "log_status"("status_baru");

-- CreateIndex
CREATE INDEX "log_status_lamaran_id_idx" ON "log_status"("lamaran_id");

-- AddForeignKey
ALTER TABLE "lowongan" ADD CONSTRAINT "lowongan_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lamaran" ADD CONSTRAINT "lamaran_pelamar_id_fkey" FOREIGN KEY ("pelamar_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lamaran" ADD CONSTRAINT "lamaran_lowongan_id_fkey" FOREIGN KEY ("lowongan_id") REFERENCES "lowongan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_status" ADD CONSTRAINT "log_status_lamaran_id_fkey" FOREIGN KEY ("lamaran_id") REFERENCES "lamaran"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_status" ADD CONSTRAINT "log_status_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
