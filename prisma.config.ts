import { definePrismaConfig } from "prisma/config";

export default definePrismaConfig({});
// Catatan: bagian `skills` dihapus agar npm install tidak lagi membuat folder
// .claude/.cursor/.agents/.devin (cache skills untuk AI agent — tidak dibutuhkan
// untuk menjalankan aplikasi).
