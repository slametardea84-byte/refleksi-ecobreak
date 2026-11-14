export interface ClassGroup {
  gradeLabel: string;
  classes: string[];
}

export const CLASS_GROUPS: ClassGroup[] = [
  { gradeLabel: 'Kelas 7', classes: ['71', '72', '73'] },
  { gradeLabel: 'Kelas 8', classes: ['81', '82', '83', '84', '85'] },
  { gradeLabel: 'Kelas 9', classes: ['91', '92', '93', '94', '95'] },
];

export const ALL_CLASSES: string[] = CLASS_GROUPS.flatMap((g) => g.classes);

export const ABSEN_NUMBERS: number[] = Array.from({ length: 30 }, (_, i) => i + 1);

export const STUDENT_PASSWORD = 'SMPBHATUR';

export const INSTRUCTIONS: string[] = [
  'Bacalah setiap pertanyaan dengan teliti.',
  'Pilih satu jawaban yang paling tepat untuk soal pilihan ganda.',
  'Jawablah soal esai singkat sesuai pengalaman dan pemahamanmu.',
  'Kerjakan dengan jujur dan mandiri.',
];

export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface McqQuestion {
  id: string;
  number: number;
  type: 'mcq';
  prompt: string;
  options: Record<OptionKey, string>;
  correctOption: OptionKey;
}

export interface EssayQuestion {
  id: string;
  number: number;
  type: 'essay';
  prompt: string;
  placeholder?: string;
}

export type QuestionItem = McqQuestion | EssayQuestion;

export interface SubSection {
  id: string;
  code: string;
  title: string;
  questions: QuestionItem[];
}

export interface ReflectionPart {
  id: string;
  shortTitle: string;
  title: string;
  description?: string;
  subSections: SubSection[];
}

export const REFLECTION_PARTS: ReflectionPart[] = [
  {
    id: 'bagian-1',
    shortTitle: 'Bagian 1',
    title: 'BAGIAN 1 – REFLEKSI PEMAHAMAN, KARAKTER, DAN KEPAHLAWANAN',
    subSections: [
      {
        id: 'sub-a',
        code: 'A',
        title: 'A. Diskusi tentang Sampah, Dampak, dan Solusi',
        questions: [
          {
            id: 'A1',
            number: 1,
            type: 'mcq',
            prompt: 'Apa yang dimaksud dengan sampah?',
            options: {
              A: 'Barang yang selalu dibutuhkan manusia',
              B: 'Sisa kegiatan manusia atau proses alam yang sudah tidak digunakan',
              C: 'Semua benda yang masih baru',
              D: 'Barang yang selalu memiliki nilai jual',
            },
            correctOption: 'B',
          },
          {
            id: 'A2',
            number: 2,
            type: 'mcq',
            prompt: 'Salah satu permasalahan sampah yang sering ditemukan di lingkungan sekolah adalah ....',
            options: {
              A: 'tempat sampah berbau tidak sedap',
              B: 'Tanaman tumbuh dengan subur',
              C: 'Ruang kelas tertata rapi',
              D: 'Siswa membuang sampah pada loker tempat duduk',
            },
            correctOption: 'A',
          },
          {
            id: 'A3',
            number: 3,
            type: 'mcq',
            prompt: 'Apa dampak membuang sampah sembarangan?',
            options: {
              A: 'Lingkungan menjadi lebih sehat',
              B: 'Udara menjadi lebih bersih',
              C: 'Saluran air dapat tersumbat dan menyebabkan banjir',
              D: 'Lingkungan menjadi lebih nyaman',
            },
            correctOption: 'C',
          },
          {
            id: 'A4',
            number: 4,
            type: 'mcq',
            prompt: 'Mengapa sampah perlu dipilah sebelum diolah?',
            options: {
              A: 'Agar semua sampah tercampur',
              B: 'Agar sampah lebih mudah dikelola dan didaur ulang',
              C: 'Agar sampah semakin banyak',
              D: 'Agar tempat sampah cepat penuh',
            },
            correctOption: 'B',
          },
          {
            id: 'A5',
            number: 5,
            type: 'mcq',
            prompt: 'Salah satu solusi untuk mengurangi sampah plastik adalah ....',
            options: {
              A: 'Menggunakan plastik sekali pakai sebanyak mungkin agar tidak repot membawa pulang kembali plastik yang digunakan',
              B: 'Membuang plastik ke sungai agar menjadi salah satu penyebab utama terjadinya banjir',
              C: 'Membakar semua sampah plastik agar sampah bersih tanpa sisa',
              D: 'Mengurangi penggunaan plastik sekali pakai dan memanfaatkan kembali sampah menjadi ecobrik',
            },
            correctOption: 'D',
          },
          {
            id: 'A6',
            number: 6,
            type: 'essay',
            prompt: 'Sebutkan dua permasalahan sampah yang pernah kamu temukan di lingkungan sekolah!',
            placeholder: 'Tuliskan dua permasalahan sampah yang kamu temukan di sekolah...',
          },
          {
            id: 'A7',
            number: 7,
            type: 'essay',
            prompt: 'Tuliskan dua solusi yang kamu usulkan untuk mengatasi permasalahan sampah di sekolah!',
            placeholder: 'Tuliskan dua solusi yang menurutmu paling tepat...',
          },
        ],
      },
      {
        id: 'sub-b',
        code: 'B',
        title: 'B. BSAN (Budaya Sekolah Aman dan Nyaman)',
        questions: [
          {
            id: 'B1',
            number: 1,
            type: 'mcq',
            prompt: 'Apa kepanjangan dari BSAN?',
            options: {
              A: 'Budaya Sekolah Aman dan Nyaman',
              B: 'Belajar Sekolah Aktif dan Nyata',
              C: 'Bersama Siswa Aman Nasional',
              D: 'Belajar Santun Aman Nyaman',
            },
            correctOption: 'A',
          },
          {
            id: 'B2',
            number: 2,
            type: 'mcq',
            prompt: 'Tujuan utama budaya sekolah aman dan nyaman adalah ....',
            options: {
              A: 'Membuat siswa takut terhadap aturan',
              B: 'Menciptakan lingkungan yang melindungi dan menghargai seluruh warga sekolah',
              C: 'Membatasi pertemanan antarsiswa',
              D: 'Membuat siswa hanya fokus pada nilai',
            },
            correctOption: 'B',
          },
          {
            id: 'B3',
            number: 3,
            type: 'mcq',
            prompt: 'Jika melihat teman mengalami perundungan (bullying), tindakan yang tepat adalah ....',
            options: {
              A: 'Ikut menertawakan',
              B: 'Merekam dan menyebarkannya',
              C: 'Menolong dengan aman dan melapor kepada guru',
              D: 'Membiarkannya',
            },
            correctOption: 'C',
          },
          {
            id: 'B4',
            number: 4,
            type: 'mcq',
            prompt: 'Contoh perilaku yang menciptakan sekolah nyaman adalah ....',
            options: {
              A: 'Mengejek kekurangan teman',
              B: 'Mengucilkan teman',
              C: 'Mengancam teman',
              D: 'Menghargai perbedaan dan berbicara dengan sopan',
            },
            correctOption: 'D',
          },
          {
            id: 'B5',
            number: 5,
            type: 'mcq',
            prompt: 'Melalui permainan atau game BSAN, siswa diharapkan dapat ....',
            options: {
              A: 'Memahami dan menerapkan perilaku aman, nyaman, serta saling menghargai',
              B: 'Menghindari semua teman',
              C: 'Mengabaikan aturan sekolah',
              D: 'Menyelesaikan permainan tanpa memahami materinya',
            },
            correctOption: 'A',
          },
          {
            id: 'B6',
            number: 6,
            type: 'essay',
            prompt: 'Sebutkan dua contoh perilaku yang dapat membuat lingkungan sekolah menjadi aman dan nyaman!',
            placeholder: 'Tuliskan dua contoh perilaku positif di sekolah...',
          },
          {
            id: 'B7',
            number: 7,
            type: 'essay',
            prompt: 'Apa yang akan kamu lakukan jika melihat teman diejek, dikucilkan, atau mengalami bullying?',
            placeholder: 'Jelaskan tindakan nyata yang akan kamu lakukan...',
          },
        ],
      },
      {
        id: 'sub-c',
        code: 'C',
        title: 'C. Kegiatan Hari Pahlawan',
        questions: [
          {
            id: 'C1',
            number: 1,
            type: 'mcq',
            prompt: 'Hari Pahlawan diperingati setiap tanggal ....',
            options: {
              A: '1 Juni',
              B: '10 November',
              C: '17 Agustus',
              D: '28 Oktober',
            },
            correctOption: 'B',
          },
          {
            id: 'C2',
            number: 2,
            type: 'mcq',
            prompt: 'Salah satu tujuan memperingati Hari Pahlawan adalah ....',
            options: {
              A: 'Mengenang perjuangan dan jasa para pahlawan',
              B: 'Mengadakan perlombaan saja',
              C: 'Mengisi waktu luang',
              D: 'Menghindari kegiatan belajar',
            },
            correctOption: 'A',
          },
          {
            id: 'C3',
            number: 3,
            type: 'mcq',
            prompt: 'Kegiatan cosplay pahlawan bertujuan untuk ....',
            options: {
              A: 'Meniru pakaian tanpa memahami sejarah',
              B: 'Menunjukkan pakaian paling mahal',
              C: 'Mengenal tokoh pahlawan melalui kostum dan karakter yang diperankan',
              D: 'Menentukan siswa yang paling terkenal',
            },
            correctOption: 'C',
          },
          {
            id: 'C4',
            number: 4,
            type: 'mcq',
            prompt: 'Dalam lomba menggambar kolase pahlawan nasional, satu tim terdiri dari ....',
            options: {
              A: 'Dua orang',
              B: 'Tiga orang',
              C: 'Empat orang',
              D: 'Lima orang',
            },
            correctOption: 'B',
          },
          {
            id: 'C5',
            number: 5,
            type: 'mcq',
            prompt: 'Sikap yang dapat diteladani dari para pahlawan adalah ....',
            options: {
              A: 'Mudah menyerah',
              B: 'Mementingkan diri sendiri',
              C: 'Tidak peduli terhadap lingkungan',
              D: 'Berani, rela berkorban, dan cinta tanah air',
            },
            correctOption: 'D',
          },
          {
            id: 'C6',
            number: 6,
            type: 'essay',
            prompt: 'Siapa perwakilan dari teman kalian yang mengikuti 3 lomba hari pahlawan disekolah?',
            placeholder: 'Tuliskan nama teman perwakilan kelasmu beserta lombanya...',
          },
          {
            id: 'C7',
            number: 7,
            type: 'essay',
            prompt: 'Apa pengalaman atau pelajaran paling berkesan yang kamu dapatkan dari lomba puisi, cosplay pahlawan, atau kolase pahlawan nasional?',
            placeholder: 'Ceritakan pengalaman atau pelajaran yang paling berkesan...',
          },
        ],
      },
    ],
  },
  {
    id: 'bagian-2',
    shortTitle: 'Bagian 2',
    title: 'BAGIAN 2 – REFLEKSI PERSIAPAN DAN PEMAHAMAN PEMBUATAN ECOBRICK',
    subSections: [
      {
        id: 'sub-d',
        code: 'D',
        title: 'D. Identifikasi dan Pengecekan Alat serta Bahan',
        questions: [
          {
            id: 'D1',
            number: 1,
            type: 'mcq',
            prompt: 'Mengapa alat dan bahan perlu diperiksa sebelum kegiatan pembuatan ecobrick?',
            options: {
              A: 'Agar kegiatan dapat berjalan dengan baik dan lancar',
              B: 'Agar kegiatan menjadi lebih lama',
              C: 'Agar alat tidak digunakan',
              D: 'Agar bahan terbuang sia-sia',
            },
            correctOption: 'A',
          },
          {
            id: 'D2',
            number: 2,
            type: 'mcq',
            prompt: 'Berikut ini yang termasuk bahan utama pembuatan ecobrick adalah ....',
            options: {
              A: 'plastik dan campuran tanah',
              B: 'plastik dan ranting ranting pohon',
              C: 'Plastik bekas yang bersih dan kering',
              D: 'plastik basah dan plastik kering',
            },
            correctOption: 'C',
          },
          {
            id: 'D3',
            number: 3,
            type: 'mcq',
            prompt: 'Botol plastik yang digunakan untuk membuat ecobrick sebaiknya dalam kondisi ....',
            options: {
              A: 'Kotor dan basah',
              B: 'Bersih dan kering',
              C: 'Berisi air',
              D: 'Rusak dan berlubang',
            },
            correctOption: 'B',
          },
          {
            id: 'D4',
            number: 4,
            type: 'mcq',
            prompt: 'Alat yang digunakan untuk memotong plastik bekas adalah ....',
            options: {
              A: 'silet',
              B: 'cutter',
              C: 'pisau',
              D: 'Gunting',
            },
            correctOption: 'D',
          },
          {
            id: 'D5',
            number: 5,
            type: 'mcq',
            prompt: 'Apa yang harus dilakukan jika ada alat atau bahan yang belum tersedia?',
            options: {
              A: 'Melaporkan kepada guru dan mencari solusi',
              B: 'Menghentikan kegiatan tanpa memberi tahu',
              C: 'Membiarkan kelompok lain bekerja',
              D: 'Menggunakan alat yang tidak sesuai',
            },
            correctOption: 'A',
          },
          {
            id: 'D6',
            number: 6,
            type: 'essay',
            prompt: 'Sebutkan alat - alat dan bahan yang diperlukan untuk membuat ecobrick!',
            placeholder: 'Tuliskan daftar alat dan bahan pembuatan ecobrick...',
          },
          {
            id: 'D7',
            number: 7,
            type: 'essay',
            prompt: 'Mengapa kita harus memastikan alat dan bahan dalam keadaan lengkap dan layak digunakan sebelum memulai kegiatan?',
            placeholder: 'Jelaskan alasan pentingnya mengecek kelengkapan dan kelayakan alat/bahan...',
          },
        ],
      },
      {
        id: 'sub-e',
        code: 'E',
        title: 'E. Tutorial dan Langkah-Langkah Pembuatan Ecobrick',
        questions: [
          {
            id: 'E1',
            number: 1,
            type: 'mcq',
            prompt: 'Apa yang dimaksud dengan ecobrick?',
            options: {
              A: 'Batu bata yang terbuat dari tanah liat',
              B: 'Botol plastik yang diisi padat dengan plastik bekas yang bersih dan kering',
              C: 'Botol plastik berisi air',
              D: 'Tempat pembakaran sampah',
            },
            correctOption: 'B',
          },
          {
            id: 'E2',
            number: 2,
            type: 'mcq',
            prompt: 'Sebelum plastik dimasukkan ke dalam botol, plastik harus ....',
            options: {
              A: 'Dibiarkan basah',
              B: 'Dicampur dengan sisa makanan',
              C: 'Dibersihkan dan dikeringkan',
              D: 'Dicampur dengan tanah',
            },
            correctOption: 'C',
          },
          {
            id: 'E3',
            number: 3,
            type: 'mcq',
            prompt: 'Mengapa plastik bekas perlu dipotong menjadi bagian-bagian kecil?',
            options: {
              A: 'Agar mudah dimasukkan dan dipadatkan ke dalam botol',
              B: 'Agar plastik mudah terbang',
              C: 'Agar botol cepat rusak',
              D: 'Agar plastik bercampur dengan air',
            },
            correctOption: 'A',
          },
          {
            id: 'E4',
            number: 4,
            type: 'mcq',
            prompt: 'Alat yang digunakan untuk memadatkan plastik di dalam botol adalah ....',
            options: {
              A: 'Sendok makan',
              B: 'Penggaris',
              C: 'Gunting',
              D: 'Tongkat pemadat yang bersih dan kuat',
            },
            correctOption: 'D',
          },
          {
            id: 'E5',
            number: 5,
            type: 'mcq',
            prompt: 'Salah satu ciri ecobrick yang baik adalah ....',
            options: {
              A: 'Botol hanya terisi sedikit',
              B: 'Botol berisi air dan sampah organik',
              C: 'Botol bersih, kering, dan plastik di dalamnya terisi padat',
              D: 'Plastik dimasukkan secara longgar',
            },
            correctOption: 'C',
          },
          {
            id: 'E6',
            number: 6,
            type: 'essay',
            prompt: 'Tuliskan secara berurutan langkah pembuatan ecobrick berdasarkan tutorial / pengalaman yang telah kamu pelajari!',
            placeholder: 'Tuliskan langkah-langkah pembuatan ecobrick secara urut...',
          },
          {
            id: 'E7',
            number: 7,
            type: 'essay',
            prompt: 'Mengapa plastik di dalam botol harus dipadatkan dengan baik? Jelaskan secara singkat!',
            placeholder: 'Jelaskan mengapa pemadatan plastik di dalam botol sangat penting...',
          },
        ],
      },
    ],
  },
  {
    id: 'bagian-3',
    shortTitle: 'Bagian 3',
    title: 'BAGIAN 3 – REFLEKSI PERENCANAAN DAN HASIL KARYA ECOBRICK',
    subSections: [
      {
        id: 'sub-f',
        code: 'F',
        title: 'F. Membuat Sketsa Ide Karya Ecobrick',
        questions: [
          {
            id: 'F1',
            number: 1,
            type: 'mcq',
            prompt: 'Apa tujuan membuat sketsa sebelum membuat karya ecobrick?',
            options: {
              A: 'Menghabiskan waktu',
              B: 'Merencanakan bentuk dan desain karya',
              C: 'Menghindari kegiatan kelompok',
              D: 'Mengurangi penggunaan alat',
            },
            correctOption: 'B',
          },
          {
            id: 'F2',
            number: 2,
            type: 'mcq',
            prompt: 'Sketsa merupakan ....',
            options: {
              A: 'Gambar rancangan awal suatu karya',
              B: 'Hasil akhir sebuah produk',
              C: 'Daftar harga bahan',
              D: 'Catatan kehadiran kelompok',
            },
            correctOption: 'A',
          },
          {
            id: 'F3',
            number: 3,
            type: 'mcq',
            prompt: 'Sebelum membuat sketsa, kelompok sebaiknya ....',
            options: {
              A: 'Langsung membuat produk tanpa rencana',
              B: 'Menunggu kelompok lain',
              C: 'Berdiskusi dan menentukan ide karya',
              D: 'Mengumpulkan semua alat tanpa tujuan',
            },
            correctOption: 'C',
          },
          {
            id: 'F4',
            number: 4,
            type: 'mcq',
            prompt: 'Dalam membuat sketsa karya ecobrick, hal yang perlu diperhatikan adalah ....',
            options: {
              A: 'Warna pakaian anggota kelompok',
              B: 'Jumlah siswa di kelas',
              C: 'Ukuran papan tulis',
              D: 'Bentuk, ukuran, fungsi, dan kebutuhan bahan karya',
            },
            correctOption: 'D',
          },
          {
            id: 'F5',
            number: 5,
            type: 'mcq',
            prompt: 'Kerja sama dalam membuat sketsa penting karena ....',
            options: {
              A: 'Hanya satu siswa yang boleh memberikan ide',
              B: 'Semua anggota dapat menyampaikan pendapat dan ide kreatif',
              C: 'Kelompok tidak perlu berdiskusi',
              D: 'Pekerjaan menjadi tanggung jawab satu orang',
            },
            correctOption: 'B',
          },
          {
            id: 'F6',
            number: 6,
            type: 'essay',
            prompt: 'Karya apa yang ingin dibuat oleh kelompokmu menggunakan ecobrick? Jelaskan ide atau bentuk karya tersebut!',
            placeholder: 'Ceritakan rencana bentuk dan fungsi karya ecobrick kelompokmu...',
          },
          {
            id: 'F7',
            number: 7,
            type: 'essay',
            prompt: 'Bagaimana cara kelompokmu menentukan desain dan membagi tugas saat membuat sketsa?',
            placeholder: 'Jelaskan proses diskusi dan pembagian tugas di kelompokmu...',
          },
        ],
      },
      {
        id: 'sub-g',
        code: 'G',
        title: 'G. Menimbang Ecobrick',
        questions: [
          {
            id: 'G1',
            number: 1,
            type: 'mcq',
            prompt: 'Berapa berat minimal ecobrick yang ditentukan dalam kegiatan ini?',
            options: {
              A: '100 gram',
              B: '150 gram',
              C: '210 gram',
              D: '250 gram',
            },
            correctOption: 'C',
          },
          {
            id: 'G2',
            number: 2,
            type: 'mcq',
            prompt: 'Apa tujuan menimbang ecobrick?',
            options: {
              A: 'Mengetahui apakah berat ecobrick sudah memenuhi ketentuan',
              B: 'Mengubah bentuk botol',
              C: 'Menghitung jumlah anggota kelompok',
              D: 'Menentukan warna plastik',
            },
            correctOption: 'A',
          },
          {
            id: 'G3',
            number: 3,
            type: 'mcq',
            prompt: 'Jika berat ecobrick hanya 180 gram, maka ecobrick tersebut ....',
            options: {
              A: 'Sudah melebihi ketentuan',
              B: 'Sudah memenuhi ketentuan',
              C: 'Tidak perlu diperiksa',
              D: 'Belum memenuhi berat minimal',
            },
            correctOption: 'D',
          },
          {
            id: 'G4',
            number: 4,
            type: 'mcq',
            prompt: 'Alat yang digunakan untuk mengetahui berat ecobrick adalah ....',
            options: {
              A: 'Penggaris',
              B: 'Timbangan',
              C: 'Gunting',
              D: 'Meteran',
            },
            correctOption: 'B',
          },
          {
            id: 'G5',
            number: 5,
            type: 'mcq',
            prompt: 'Jika ecobrick belum mencapai berat minimal 210 gram, tindakan yang tepat adalah ....',
            options: {
              A: 'Membuangnya',
              B: 'Mengabaikan hasil timbangan',
              C: 'Menambahkan plastik bersih dan kering, lalu memadatkannya kembali',
              D: 'Mengisi botol dengan air',
            },
            correctOption: 'C',
          },
          {
            id: 'G6',
            number: 6,
            type: 'essay',
            prompt: 'Jika ecobrick kelompokmu memiliki berat 195 gram, berapa gram lagi yang dibutuhkan agar mencapai berat minimal 210 gram?',
            placeholder: 'Tuliskan perhitungan singkat dan hasilnya dalam gram...',
          },
          {
            id: 'G7',
            number: 7,
            type: 'essay',
            prompt: 'Mengapa setiap kelompok perlu mencatat hasil penimbangan ecobrick? Jelaskan secara singkat!',
            placeholder: 'Jelaskan pentingnya mencatat hasil penimbangan ecobrick...',
          },
        ],
      },
    ],
  },
  {
    id: 'refleksi-akhir',
    shortTitle: 'Refleksi Akhir',
    title: 'REFLEKSI AKHIR DIRI',
    description: 'Tuliskan jawabanmu berdasarkan seluruh kegiatan kokurikuler yang telah dilaksanakan.',
    subSections: [
      {
        id: 'sub-akhir',
        code: 'Akhir',
        title: 'Pertanyaan Refleksi Diri',
        questions: [
          {
            id: 'R1',
            number: 1,
            type: 'essay',
            prompt: 'Kegiatan apa yang paling berkesan bagimu? Mengapa?',
            placeholder: 'Ceritakan kegiatan yang paling berkesan beserta alasannya...',
          },
          {
            id: 'R2',
            number: 2,
            type: 'essay',
            prompt: 'Pengetahuan atau keterampilan baru apa yang kamu peroleh?',
            placeholder: 'Tuliskan pengetahuan atau keterampilan baru yang kamu dapatkan...',
          },
          {
            id: 'R3',
            number: 3,
            type: 'essay',
            prompt: 'Apa kontribusi yang sudah kamu berikan kepada kelompok?',
            placeholder: 'Ceritakan peran dan bantuan yang kamu berikan dalam kelompok...',
          },
          {
            id: 'R4',
            number: 4,
            type: 'essay',
            prompt: 'Apa hal yang masih perlu kamu perbaiki dalam kegiatan berikutnya?',
            placeholder: 'Tuliskan evaluasi diri untuk kegiatan selanjutnya...',
          },
          {
            id: 'R5',
            number: 5,
            type: 'essay',
            prompt: 'Apa tindakan nyata yang akan kamu lakukan untuk mengurangi sampah plastik dan menjaga lingkungan?',
            placeholder: 'Tuliskan komitmen dan aksi nyatamu sehari-hari...',
          },
        ],
      },
    ],
  },
];

export const ALL_QUESTIONS: QuestionItem[] = REFLECTION_PARTS.flatMap((part) =>
  part.subSections.flatMap((sub) => sub.questions)
);

export const ALL_MCQ_QUESTIONS: McqQuestion[] = ALL_QUESTIONS.filter(
  (q): q is McqQuestion => q.type === 'mcq'
);
