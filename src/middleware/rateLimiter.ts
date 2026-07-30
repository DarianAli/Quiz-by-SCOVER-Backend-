import rateLimit from "express-rate-limit"
import { Request, Response } from "express"

/**
 * Helper untuk konsistensi response error 429 (Too Many Requests)
 */
const createLimitHandler = (message: string) => {
  return (request: Request, response: Response) => {
    response.status(429).json({
      status: false,
      message,
    })
  }
}

/**
 * 1. Global Limiter
 * Melindungi seluruh server dari bot/scraping.
 * Angka dinaikkan (1000 req/15m) agar puluhan siswa dalam 1 Wi-Fi bimbel
 * tidak saling memblokir satu sama lain.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: process.env.NODE_ENV === "production" ? 1000 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler("Aktivitas jaringan terlalu padat. Silakan coba beberapa saat lagi."),
})

/**
 * 2. Register Limiter
 * Mencegah spam pendaftaran akun baru.
 */
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: process.env.NODE_ENV === "production" ? 20 : 100,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler("Terlalu banyak pendaftaran dari koneksi ini. Coba lagi dalam 15 menit."),
})

/**
 * 3. POST Limiter
 * Digunakan saat membuat kuis, menambah soal, atau posting data baru.
 * Batas dinaikkan agar Admin/Guru tidak terblokir saat input banyak soal berturut-turut.
 */
export const postLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 menit
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler("Terlalu banyak permintaan pembuatan data. Harap tunggu sebentar."),
})

/**
 * 4. UPDATE Limiter (PUT/PATCH)
 * Digunakan saat mengedit opsi soal, profil, atau status kuis.
 */
export const updateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 menit
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler("Terlalu banyak pembaruan data dalam waktu singkat."),
})

/**
 * 5. Password / Auth Limiter
 * Mencegah percobaan brute-force login/reset password.
 * Dilonggarkan sedikit ke 10-15 kali untuk mentoleransi siswa yang sering lupa/salah ketik password.
 */
export const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler("Terlalu banyak percobaan masuk/password. Akses dikunci sementara 15 menit."),
})

/**
 * 6. DELETE Limiter
 * Mencegah aksi hapus massal secara tidak sengaja atau berbahaya.
 */
export const deleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler("Batas penghapusan data tercapai. Coba lagi nanti."),
})

/**
 * 7. Attempt Limiter (Mulai Kuis / Tryout)
 * Membatasi request saat siswa menekan tombol "Mulai Kuis" atau mengulang kuis.
 */
export const attemptLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 menit
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler("Terlalu banyak sesi kuis dibuka. Silakan muat ulang halaman kuis Anda."),
})

/**
 * 8. Answer Limiter (Pengiriman Jawaban & Auto-Save)
 * Sangat krusial untuk kuis online!
 * Angka dibuat besar (300 req/menit) untuk mengakomodasi:
 * - Fitur Auto-Save di latar belakang (background sync).
 * - Siswa yang berpindah-pindah nomor soal dengan cepat.
 * - Jaringan Wi-Fi bimbel yang berisi banyak siswa aktif bersamaan.
 */
export const answerLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 menit
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler("Sistem mendeteksi pengiriman jawaban terlalu cepat. Pelan-pelan ya."),
})