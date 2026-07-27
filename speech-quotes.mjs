const quotes = [
  {
    text: 'Orang, rakyat di desa enggak pakai dolar, kok, iya, kan.',
    context: 'Peresmian Museum Ibu Marsinah dan Rumah Singgah, 16 Mei 2026',
    sourceLabel: 'Presiden RI — transkrip resmi',
    source: 'https://presidenri.go.id/transkrip/peresmian-museum-ibu-marsinah-dan-rumah-singgah/',
  },
  {
    text: '…mereka ya itu, sudah jadi antek-antek asing, …',
    context: 'Pengarahan kepada Guru dan Kepala Sekolah Rakyat, 22 Agustus 2025',
    sourceLabel: 'Presiden RI — transkrip resmi',
    source: 'https://presidenri.go.id/transkrip/pengarahan-presiden-ri-kepada-guru-dan-kepala-sekolah-rakyat/',
  },
  {
    text: 'Biar anjing menggonggong kafilah tetap akan terus.',
    context: 'Pengarahan kepada Guru dan Kepala Sekolah Rakyat, 22 Agustus 2025',
    sourceLabel: 'Presiden RI — transkrip resmi',
    source: 'https://presidenri.go.id/transkrip/pengarahan-presiden-ri-kepada-guru-dan-kepala-sekolah-rakyat/',
  },
  {
    text: 'Konsep Makan Bergizi Gratis ini konsepnya adalah sangat sederhana.',
    context: 'Building Indonesia’s Future Generations Through Nutrition',
    sourceLabel: 'Presiden RI — transkrip resmi',
    source: 'https://presidenri.go.id/transkrip/acara-building-indonesias-future-generations-through-nutrition/',
  },
  {
    text: 'Makan, ini pekerjaan yang mulia bagi kita dan ini harus berhasil, akan berhasil.',
    context: 'Building Indonesia’s Future Generations Through Nutrition',
    sourceLabel: 'Presiden RI — transkrip resmi',
    source: 'https://presidenri.go.id/transkrip/acara-building-indonesias-future-generations-through-nutrition/',
  },
  {
    text: 'Kita negara besar, persoalan kita besar.',
    context: 'Puncak Peringatan Hari Guru Nasional 2025',
    sourceLabel: 'Presiden RI — transkrip resmi',
    source: 'https://presidenri.go.id/transkrip/puncak-peringatan-hari-guru-nasional-tahun-2025/',
  },
  {
    text: 'Ndasmu etik.',
    context: 'Rakornas tertutup Gerindra, 15 Desember 2023',
    sourceLabel: 'Tempo — laporan dan konfirmasi juru bicara',
    source: 'https://www.tempo.co/politik/sambutan-prabowo-yang-bocor-dari-rakornas-tertutup-gerindra-ndasmu-etik-107889',
  },
  {
    text: 'Kalau kau kembalikan yang kau curi, ya mungkin kita maafkan.',
    context: 'Pertemuan dengan mahasiswa Indonesia di Universitas Al-Azhar, Kairo',
    sourceLabel: 'Presiden RI — transkrip resmi',
    source: 'https://presidenri.go.id/transkrip/sambutan-pertemuan-dengan-mahasiswa-indonesia-yang-sedang-menuntut-ilmu-di-universitas-al-azhar-kairo/',
  },
  {
    text: 'Kalau koruptornya sudah tobat, bagaimana, Tokoh-tokoh Agama, iya kan?',
    context: 'Perayaan Natal Nasional 2024',
    sourceLabel: 'Presiden RI — transkrip resmi',
    source: 'https://presidenri.go.id/transkrip/sambutan-perayaan-natal-nasional-tahun-2024/',
  },
  {
    text: '…semakin pintar, banyak yang pintar, pintar maling.',
    context: 'Peringatan Hari Buruh Internasional',
    sourceLabel: 'Presiden RI — transkrip resmi',
    source: 'https://presidenri.go.id/transkrip/peringatan-hari-buruh-internasional/',
  },
  {
    text: '…sopan-sopan tetap maling, sopan-sopan korupsi.',
    context: 'Puncak PENAS Petani dan Nelayan XVII',
    sourceLabel: 'Presiden RI — transkrip resmi',
    source: 'https://presidenri.go.id/transkrip/puncak-pekan-nasional-penas-petani-dan-nelayan-xvii/',
  },
  {
    text: 'Si koruptor, si maling, si bajingan itu begitu ke pengadilan lolos.',
    context: 'Acara Pengukuhan Hakim',
    sourceLabel: 'Presiden RI — transkrip resmi',
    source: 'https://presidenri.go.id/transkrip/acara-pengukuhan-hakim/',
  },
  {
    text: 'Masalahnya, maling-malingnya juga banyak.',
    context: 'Peringatan Hari Buruh Internasional 2025',
    sourceLabel: 'Presiden RI — transkrip resmi',
    source: 'https://presidenri.go.id/transkrip/peringatan-hari-buruh-internasional-tahun-2025/',
  },
  {
    text: '…nanti maling-maling kita akan semua kejar itu, …',
    context: 'Peluncuran Digitalisasi Pembelajaran untuk Indonesia Cerdas',
    sourceLabel: 'Presiden RI — transkrip resmi',
    source: 'https://presidenri.go.id/transkrip/dialog-presiden-ri-dengan-para-perwakilan-sekolah-daring-pada-peresmian-peluncuran-digitalisasi-pembelajaran-untuk-indonesia-cerdas/',
  },
  {
    text: 'Kita tidak mau lagi kekayaan Indonesia dicuri terus.',
    context: 'Operasionalisasi Koperasi Desa/Kelurahan Merah Putih',
    sourceLabel: 'Presiden RI — transkrip resmi',
    source: 'https://presidenri.go.id/transkrip/peresmian-operasionalisasi-1-061-koperasi-desa-kelurahan-merah-putih-di-wilayah-jawa-timur-dan-jawa-tengah/',
  },
  {
    text: 'Yang mau membela maling-maling itu, silakan di situ.',
    context: 'Operasionalisasi Koperasi Desa/Kelurahan Merah Putih',
    sourceLabel: 'Presiden RI — transkrip resmi',
    source: 'https://presidenri.go.id/transkrip/peresmian-operasionalisasi-1-061-koperasi-desa-kelurahan-merah-putih-di-wilayah-jawa-timur-dan-jawa-tengah/',
  },
];

export const SPEECH_QUOTES = Object.freeze(quotes.map((entry) => Object.freeze(entry)));
export const SPEECH_QUOTE_TEXTS = Object.freeze(SPEECH_QUOTES.map(({ text }) => text));

export function pickSpeechQuote(random = Math.random) {
  return SPEECH_QUOTE_TEXTS[Math.floor(random() * SPEECH_QUOTE_TEXTS.length)];
}
