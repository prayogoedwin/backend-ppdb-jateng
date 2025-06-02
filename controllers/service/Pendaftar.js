import { check, validationResult } from 'express-validator';
import DataPendaftars from "../../models/service/DataPendaftarModel.js";
import DataPerangkingans from "../../models/service/DataPerangkinganModel.js";
import PemadananDukcapil from '../../models/service/PemadananDukcapilModel.js';
import SekolahTujuan from "../../models/master/SekolahTujuanModel.js";
import SekolahAsalWilayah from "../../models/master/SekolahAsalModel.js";
import StatusDomisili from "../../models/master/StatusDomisiliModel.js";
import JenisKejuaraans from '../../models/master/JenisKejuaraanModel.js';
import GeoJsons from "../../models/master/GeoJsonModel.js";
import WilayahVerDapodik from '../../models/master/WilayahVerDapodikModel.js';
import { getTimelineSatuan } from '../../helpers/HelpHelper.js';
import Timelines from "../../models/service/TimelineModel.js";
import DataUsers from '../../models/service/DataUsersModel.js';
import DataPesertaDidikSmaSmks from '../../models/service/DataPesertaDidikSmaSmkModel.js';
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { fileURLToPath } from 'url';
import { redisGet, redisSet } from '../../redis.js'; // Import the Redis functions

// Mendapatkan __filename dan __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer storage
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            const uploadPath = `upload/berkas/${req.body.nisn}`;
            
            // Asynchronously create the directory if it does not exist
            fs.promises.mkdir(uploadPath, { recursive: true })
                .then(() => cb(null, uploadPath))
                .catch(err => cb(err));
        } catch (err) {
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        const hash = crypto.createHash('md5').update(file.originalname + Date.now().toString()).digest('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${hash}${ext}`);
    }
});

const upload = multer({ storage });

// Middleware for handling file uploads
const uploadFiles = upload.fields([
    { name: 'dok_pakta_integritas', maxCount: 1 },
    { name: 'dok_kk', maxCount: 1 },
    { name: 'dok_suket_nilai_raport', maxCount: 1 },
    { name: 'dok_piagam', maxCount: 1 },
    { name: 'dok_pto', maxCount: 1 }
]);

//Generate Verification Code
const generateVerificationCode = async () => {
    const characters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ3456789';
    let code;
    let exists = true;

    while (exists) {
        code = '';
        for (let i = 0; i < 8; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            code += characters[randomIndex];
        }

        const existingCode = await DataPendaftars.findOne({ where: { kode_verifikasi: code } });
        exists = !!existingCode;
    }

    return code;
};

// export const createPendaftar = async (req, res) => {
//   const timeoutPromise = new Promise((_, reject) => 
//       setTimeout(() => reject(new Error('Pendaftaran melebihi batas waktu 30 detik')), 30000)
//   );

//   try {
//       const result = await Promise.race([
//           handleCreatePendaftar(req, res),
//           timeoutPromise
//       ]);
//       return result;
//   } catch (error) {
//       console.error('Error pendaftaran:', error);
//       return res.status(500).json({
//           status: 0,
//           message: error.message || 'Terjadi kesalahan saat proses daftar'
//       });
//   }
// };


// Fungsi untuk menangani permintaan POST
export const createPendaftar = async (req, res) => {  

      const resTm = await Timelines.findOne({  
        where: { id: 1 }, // Find the timeline by ID  
        attributes: ['id', 'nama', 'status']  
      });  

      if (resTm.status != 1) {  
          return res.status(200).json({ status: 0, message: 'Pendaftaran Belum Dibuka :)' });
      }

        // Menangani hasil validasi
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: 0, errors: errors.array() });
        }

        uploadFiles(req, res, async (err) => {
            if (err) {
                return res.status(500).json({ status: 0, message: 'File upload error', error: err.message });
            }

            try {
                const {
                    nisn,
                    sekolah_asal_id,
                    jenis_lulusan_id,
                    tahun_lulus,
                    nama_sekolah_asal,
                    nik,
                    nama_lengkap,
                    jenis_kelamin,
                    tanggal_lahir,
                    tempat_lahir,
                    status_domisili,
                    alamat,
                    provinsi_id,
                    kabkota_id,
                    kecamatan_id,
                    kelurahan_id,
                    rt,
                    rw,
                    lat,
                    lng,
                    no_wa,
                    tanggal_cetak_kk,
                    kejuaraan_id,
                    nama_kejuaraan,
                    tanggal_sertifikat,
                    umur_sertifikat,
                    nomor_sertifikat,
                    nilai_raport,
                    nilai_raport_rata,
                    nilai_prestasi,
                    is_tidak_sekolah,
                    is_anak_panti,
                    is_anak_keluarga_tidak_mampu,
                    is_anak_guru_jateng,
                    is_pip,
                    created_by,
                    saved_by,
                    is_saved,
                    no_urut,
                    is_diterima,
                    email,
                    is_big_unregistered,
                    tanggal_kedatangan,
                    is_buta_warna,
                    organisasi_id,
                    nilai_organisasi,
                    kebutuhan_khusus_id,
                    kebutuhan_khusus,
            
                } = req.body;

                // Cek apakah NISN sudah terdaftar dan belum dihapus
                const existingPendaftar = await DataPendaftars.findOne({
                    where: {
                        nisn,
                        is_delete: 0
                        // [Op.or]: [
                        //     { is_delete: 0 }, // Entri yang belum dihapus
                        //     { is_delete: null } // Entri yang belum diatur
                        // ]
                    }
                });

                if (existingPendaftar) {
                    return res.status(400).json({ status: 0, message: 'NISN sudah terdaftar' });
                }

                // let nilai_raport = {
                //     "pendidikan_agama": 85,
                //     "pkn": 78,
                //     "bahasa_indonesia": 82,
                //     "matematika": 82,
                //     "ipa":90,
                //     "ips": 90,
                //     "bahasa_inggris": 78,
                //     "pjok": 80,
                //     "seni_budaya": 80
                //   }

                // nilai_raport = JSON.stringify(nilai_raport);

                // Menghasilkan kode verifikasi unik
                const kode_verifikasi = await generateVerificationCode();
                const hashedPassword = await bcrypt.hash('CPD123#=', 10);

                // Get file paths
                const files = req.files;
                const dok_pakta_integritas = files.dok_pakta_integritas ? files.dok_pakta_integritas[0].filename : null;
                const dok_kk = files.dok_kk ? files.dok_kk[0].filename : null;
                const dok_suket_nilai_raport = files.dok_suket_nilai_raport ? files.dok_suket_nilai_raport[0].filename : null;
                const dok_piagam = files.dok_piagam ? files.dok_piagam[0].filename : null;

                const insertData = {
                    nisn,
                    sekolah_asal_id,
                    jenis_lulusan_id,
                    tahun_lulus,
                    nama_sekolah_asal,
                    nik,
                    nama_lengkap,
                    jenis_kelamin,
                    tanggal_lahir: new Date(tanggal_lahir),
                    tempat_lahir,
                    status_domisili,
                    alamat,
                    provinsi_id,
                    kabkota_id,
                    kecamatan_id,
                    kelurahan_id,
                    rt,
                    rw,
                    lat,
                    lng,
                    no_wa,
                    tanggal_cetak_kk: new Date(tanggal_cetak_kk),
                    kejuaraan_id: kejuaraan_id ? kejuaraan_id : 0,
                    nama_kejuaraan,
                    tanggal_sertifikat: tanggal_sertifikat ? new Date(tanggal_sertifikat) : null,
                    umur_sertifikat: umur_sertifikat ? umur_sertifikat : 0,
                    nomor_sertifikat,
                    nilai_prestasi,
                    nilai_raport,
                    nilai_raport_rata,
                    dok_pakta_integritas,
                    dok_kk,
                    dok_suket_nilai_raport,
                    dok_piagam,
                    is_tidak_sekolah,
                    is_anak_panti,
                    is_anak_keluarga_tidak_mampu,
                    is_anak_guru_jateng,
                    kode_verifikasi,
                    created_by: req.ip,
                    password_:hashedPassword,
                    email,
                    is_big_unregistered,
                    is_buta_warna,
                    organisasi_id,
                    nilai_organisasi,
                    is_disabilitas : 0,
                    kebutuhan_khusus_id,
                    kebutuhan_khusus,
         
              };

              //ini code kocak yak, tp ini untuk handla krn local sm server beda null wkwkwk
              if (tanggal_kedatangan == 'null' || tanggal_kedatangan == null) {

              }else{

                  insertData.tanggal_kedatangan = tanggal_kedatangan;
              }

              // if (req.body.tanggal_kedatangan != null) {
              //   insertData.tanggal_kedatangan = req.body.tanggal_kedatangan;
              // }

              const newPendaftar = await DataPendaftars.create(insertData);
      

                // Membuat entri baru dalam tabel ez_pendaftar
                // const newPendaftar = await DataPendaftars.create({
                //     nisn,
                //     sekolah_asal_id,
                //     jenis_lulusan_id,
                //     tahun_lulus,
                //     nama_sekolah_asal,
                //     nik,
                //     nama_lengkap,
                //     jenis_kelamin,
                //     tanggal_lahir: new Date(tanggal_lahir),
                //     tempat_lahir,
                //     status_domisili,
                //     alamat,
                //     provinsi_id,
                //     kabkota_id,
                //     kecamatan_id,
                //     kelurahan_id,
                //     rt,
                //     rw,
                //     lat,
                //     lng,
                //     no_wa,
                //     tanggal_cetak_kk: new Date(tanggal_cetak_kk),
                //     kejuaraan_id: kejuaraan_id ? kejuaraan_id : 0,
                //     nama_kejuaraan,
                //     tanggal_sertifikat: tanggal_sertifikat ? new Date(tanggal_sertifikat) : null,
                //     umur_sertifikat: umur_sertifikat ? umur_sertifikat : 0,
                //     nomor_sertifikat,
                //     nilai_prestasi,
                //     nilai_raport,
                //     nilai_raport_rata,
                //     dok_pakta_integritas,
                //     dok_kk,
                //     dok_suket_nilai_raport,
                //     dok_piagam,
                //     is_tidak_sekolah,
                //     is_anak_panti,
                //     is_anak_keluarga_tidak_mampu,
                //     is_anak_guru_jateng,
                //     kode_verifikasi,
                //     created_by: req.ip,
                //     password_:hashedPassword,
                //     email,
                //     is_big_unregistered,
                //     tanggal_kedatangan
                // });

                // Menyaring data yang akan dikirim sebagai respons
                const responseData = {
                    nisn: newPendaftar.nisn,
                    nama_lengkap: newPendaftar.nama_lengkap,
                    kode_verifikasi: newPendaftar.kode_verifikasi,
        
                };

                 
                // Send OTP via WhatsApp
                // const otpMessage = `Berikut KODE VERFIKASI PPDB JATENG anda ${newPendaftar.kode_verifikasi}`;
                // const whatsappResponse = await sendOtpToWhatsapp(no_wa, otpMessage);

                // Mengirim respons berhasil
                res.status(201).json({
                    status: 1,
                    message: 'Pendaftaran berhasil',
                    data: responseData
                });
            } catch (error) {
                console.error('Error pendaftaran:', error);
                res.status(500).json({
                    status: 0,
                    message: error.message || 'Terjadi kesalahan saat proses daftar'
                });
            }
        });
};

//fungi untuk daftar akun tanpa upload file
export const createPendaftarTanpaFile = async (req, res) => {
  try {
      //Cek apakah pendaftaran sudah dibuka
      // const resTm = await Timelines.findOne({
      //     where: { id: 1 },
      //     attributes: ["id", "nama", "status"],
      // });
      const resTm = await getTimelineSatuan(1);

      if (resTm.status != 1) {
          return res.status(400).json({ status: 0, message: "Pendaftaran belum dibuka." });
      }

      // Validasi input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.status(400).json({ status: 0, errors: errors.array() });
      }

      // Cek apakah NISN sudah terdaftar
      const {
          nisn,
          sekolah_asal_id,
          jenis_lulusan_id,
          tahun_lulus,
          nama_sekolah_asal,
          nik,
          nama_lengkap,
          jenis_kelamin,
          tanggal_lahir,
          tempat_lahir,
          status_domisili,
          alamat,
          provinsi_id,
          kabkota_id,
          kecamatan_id,
          kelurahan_id,
          rt,
          rw,
          lat,
          lng,
          no_wa,
          tanggal_cetak_kk,
          kejuaraan_id,
          nama_kejuaraan,
          tanggal_sertifikat,
          umur_sertifikat,
          nomor_sertifikat,
          nilai_raport,
          nilai_raport_rata,
          nilai_prestasi,
          is_tidak_sekolah,
          is_anak_panti,
          is_anak_keluarga_tidak_mampu,
          is_anak_guru_jateng,
          is_anak_pondok,
          is_pip,
          created_by,
          saved_by,
          is_saved,
          no_urut,
          is_diterima,
          email,
          is_big_unregistered,
          tanggal_kedatangan,
          organisasi_id,
          nilai_organisasi,
          kebutuhan_khusus_id,
          kebutuhan_khusus,
          npsn_anak_guru

      } = req.body;

      const existingPendaftar = await DataPendaftars.findOne({
          where: { nisn, is_delete: 0 },
      });

      if (existingPendaftar) {
          return res.status(400).json({ status: 0, message: "NISN sudah terdaftar." });
      }

     

      // Generate kode verifikasi dan hash password
      const kode_verifikasi = await generateVerificationCode();
      const hashedPassword = await bcrypt.hash("CPD123#=", 10);

      // Siapkan data untuk insert ke database
      // const insertData = {
      //     ...req.body,
      //     kode_verifikasi,
      //     password_: hashedPassword,
      //     tanggal_lahir: new Date(req.body.tanggal_lahir),
      //     tanggal_cetak_kk: new Date(req.body.tanggal_cetak_kk),
      //     tanggal_sertifikat: req.body.tanggal_sertifikat ? new Date(req.body.tanggal_sertifikat) : null,
      //     umur_sertifikat: req.body.umur_sertifikat ? req.body.umur_sertifikat : 0,
      //     created_by: req.ip,
      // };
      const insertData = {
            nisn,
            sekolah_asal_id,
            jenis_lulusan_id,
            tahun_lulus,
            nama_sekolah_asal,
            nik,
            nama_lengkap,
            jenis_kelamin,
            tanggal_lahir: new Date(tanggal_lahir),
            tempat_lahir,
            status_domisili,
            alamat,
            provinsi_id,
            kabkota_id,
            kecamatan_id,
            kelurahan_id,
            rt,
            rw,
            lat,
            lng,
            no_wa,
            tanggal_cetak_kk: new Date(tanggal_cetak_kk),
            kejuaraan_id: kejuaraan_id ? kejuaraan_id : 0,
            nama_kejuaraan,
            tanggal_sertifikat: tanggal_sertifikat ? new Date(tanggal_sertifikat) : null,
            umur_sertifikat: umur_sertifikat ? umur_sertifikat : 0,
            nomor_sertifikat,
            nilai_prestasi,
            nilai_raport,
            nilai_raport_rata,
            is_tidak_sekolah,
            is_anak_panti,
            is_anak_keluarga_tidak_mampu,
            is_anak_guru_jateng,
            npsn_anak_guru, 
            kode_verifikasi,
            created_by: req.ip,
            password_:hashedPassword,
            email,
            is_big_unregistered,
            organisasi_id,
            nilai_organisasi,
            is_disabilitas: kebutuhan_khusus_id && kebutuhan_khusus_id != 0 ? 1 : 0,
            kebutuhan_khusus_id,
            kebutuhan_khusus,
            created_at: new Date(), // Set the current date and time
      };

      const dataCapil = await PemadananDukcapil.findOne({
        where: { nik },
      });

      //ini tanggaal kedatangan lama
      // if (tanggal_kedatangan !== "null" && tanggal_kedatangan !== null) {
      //     insertData.tanggal_kedatangan = tanggal_kedatangan;
      // }

      if (dataCapil) {

          // if (dataCapil.status_kepindahan_anak !== 0) {
          //     insertData.status_kepindahan = dataCapil.status_kepindahan_anak;
      
          //     // Convert tgl_kepindahan_anak to Date format YMD
          //     // const date = new Date(dataCapil.tgl_kepindahan_anak); // Assuming tgl_kepindahan_anak is a valid date string
          //     // const formattedDate = date.toISOString().split('T')[0]; // Converts to YYYY-MM-DD
          //     // const [day, month, year] = dataCapil.tgl_kepindahan_anak.split('/');
          //     // const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

          //     let formattedDate = null; // atau nilai default lain
          //     if (dataCapil.tgl_kepindahan_anak) {
          //       const [day, month, year] = dataCapil.tgl_kepindahan_anak.split('/');
          //       formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          //     }
      
          //     insertData.tanggal_kedatangan = formattedDate;
          // }

          if (dataCapil.status_kepindahan_anak !== 0) {
            insertData.status_kepindahan = dataCapil.status_kepindahan_anak;
            
            if (dataCapil.tgl_kepindahan_anak) {
                const dateParts = String(dataCapil.tgl_kepindahan_anak).split('/');
                if (dateParts.length === 3 && dateParts[0] && dateParts[1] && dateParts[2]) {
                    insertData.tanggal_kedatangan = 
                        `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
                }
            }
          }


          // if (dataCapil.status_kepindahan_ibu !== 0) {
          //    insertData.status_kepindahan_ibu = dataCapil.status_kepindahan_ibu;
    
          //   // Convert tgl_kepindahan_anak to Date format YMD
          //   // const date = new Date(dataCapil.tgl_kepindahan_ibu); // Assuming tgl_kepindahan_anak is a valid date string
          //   // const formattedDateIbu = date.toISOString().split('T')[0]; // Converts to YYYY-MM-DD
          //   // const [day, month, year] = dataCapil.tgl_kepindahan_ibu.split('/');
          //   // const formattedDateIbu = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

          //   let formattedDateIbu = null; // atau nilai default lain
          //     if (dataCapil.tgl_kepindahan_ibu) {
          //       const [day, month, year] = dataCapil.tgl_kepindahan_ibu.split('/');
          //       formattedDateIbu = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          //     }
    
          //   insertData.tanggal_kedatangan_ibu = formattedDateIbu;
          // }

          if (dataCapil.status_kepindahan_ibu !== 0) {
              insertData.status_kepindahan_ibu = dataCapil.status_kepindahan_ibu;
            
            // Coba format tanggal
            if (dataCapil.tanggal_kedatangan_ibu) {
                const dateParts = String(dataCapil.tanggal_kedatangan_ibu).split('/');
                if (dateParts.length === 3 && dateParts[0] && dateParts[1] && dateParts[2]) {
                    insertData.tanggal_kedatangan_ibu = 
                        `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
                }
            }
          }

          // if (dataCapil.status_kepindahan_ayah !== 0) {
          //    insertData.status_kepindahan_ayah = dataCapil.status_kepindahan_ayah;
    
          //   // Convert tgl_kepindahan_anak to Date format YMD
          //   // const date = new Date(dataCapil.tgl_kepindahan_ayah); // Assuming tgl_kepindahan_anak is a valid date string
          //   // const formattedDateAyah = date.toISOString().split('T')[0]; // Converts to YYYY-MM-DD
          //   // const [day, month, year] = dataCapil.tgl_kepindahan_ayah.split('/');
          //   // const formattedDateAyah = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

          //     let formattedDateAyah = null; // atau nilai default lain
          //     if (dataCapil.tgl_kepindahan_ayah) {
          //       const [day, month, year] = dataCapil.tgl_kepindahan_ayah.split('/');
          //       formattedDateAyah = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          //     }
    
          //   insertData.tanggal_kedatangan_ayah = formattedDateAyah;
          // }

          if (dataCapil.status_kepindahan_ayah !== 0) {
            insertData.status_kepindahan_ayah = dataCapil.status_kepindahan_ayah;
            
            // Coba format tanggal
            if (dataCapil.tanggal_kedatangan_ayah) {
                const dateParts = String(dataCapil.tanggal_kedatangan_ayah).split('/');
                if (dateParts.length === 3 && dateParts[0] && dateParts[1] && dateParts[2]) {
                    insertData.tanggal_kedatangan_ayah = 
                        `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
                }
            }
          }


      }


       //ini code kocak yak, tp ini untuk handla krn local sm server beda null wkwkwk
      //  if (tanggal_kedatangan == 'null' || tanggal_kedatangan == null) {
      //  }else{
      //      insertData.tanggal_kedatangan = tanggal_kedatangan;
      //  }

      // Simpan data pendaftar
      const newPendaftar = await DataPendaftars.create(insertData);

      const responseData = {
        id: newPendaftar.id,
        nisn: newPendaftar.nisn,
        nama_lengkap: newPendaftar.nama_lengkap,
        kode_verifikasi: newPendaftar.kode_verifikasi,
      };

      // Kembalikan ID dan NISN
      res.status(201).json({
          status: 1,
          message: "Pengajuan akun berhasil.",
          data: responseData
          // data: {
          //     id: newPendaftar.id,
          //     nisn: newPendaftar.nisn,
          //     nama_lengkap: newPendaftar.nama_lengkap,
          //     kode_verifikasi: newPendaftar.kode_verifikasi,
          // },
      });
  } catch (error) {
      console.error("Error pendaftaran:", error);
      res.status(500).json({ status: 0, message: "Terjadi kesalahan saat pendaftaran." });
  }
};

export const uploadPendaftarFiles = async (req, res) => {
  // Jalankan middleware uploadFiles terlebih dahulu
  uploadFiles(req, res, async (err) => {

        if (err) {
          console.error("Multer Error:", err);
          return res.status(400).json({ status: 0, message: err.message });
      }

      console.log("FILES RECEIVED:", req.files); // Cek apakah semua file diterima oleh multer

      // if (err) {
      //     return res.status(400).json({ status: 0, message: err.message });
      // }

      try {


          // Periksa apakah ID dan NISN tersedia di dalam req.body
          const { id, nisn } = req.body;
          if (!id || !nisn) {
              return res.status(400).json({ status: 0, message: "ID dan NISN diperlukan." });
          }

          // Periksa apakah pendaftar ada
          const pendaftar = await DataPendaftars.findOne({ where: { id, nisn } });
          if (!pendaftar) {
              return res.status(404).json({ status: 0, message: "Pendaftar tidak ditemukan." });
          }

          // Ambil file yang diunggah
          const files = req.files;
          const dok_pakta_integritas = files?.dok_pakta_integritas?.[0]?.filename ?? null;
          const dok_kk = files?.dok_kk?.[0]?.filename ?? null;
          const dok_suket_nilai_raport = files?.dok_suket_nilai_raport?.[0]?.filename ?? null;
          const dok_piagam = files?.dok_piagam?.[0]?.filename ?? null;
          const dok_pto = files?.dok_pto?.[0]?.filename ?? null;

          // Update database dengan file baru
          await pendaftar.update({
              dok_pakta_integritas,
              dok_kk,
              dok_suket_nilai_raport,
              dok_piagam,
              dok_pto
          });

          res.status(200).json({
              status: 1,
              message: "Upload berhasil.",
              data: {
                  dok_pakta_integritas,
                  dok_kk,
                  dok_suket_nilai_raport,
                  dok_piagam,
                  dok_pto
              }
          });
      } catch (error) {
          console.error("Error upload file:", error);
          res.status(500).json({ status: 0, message: "Terjadi kesalahan saat upload file." });
      }
  });
};

export const getPendaftarforCetak = async (req, res) => {
    try {
        const resData = await DataPendaftars.findOne({
            where: {
                kode_verifikasi: req.body.kode_verifikasi,
                is_delete: 0
            },
            include: [
                {
                    model: WilayahVerDapodik,
                    as: 'data_wilayah',
                    attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
                },
                {
                    model: WilayahVerDapodik,
                    as: 'data_wilayah_kec',
                    attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
                },
                {
                    model: WilayahVerDapodik,
                    as: 'data_wilayah_kot',
                    attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
                },
                {
                    model: WilayahVerDapodik,
                    as: 'data_wilayah_prov',
                    attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
                },
                {
                  model: SekolahAsalWilayah,
                  as: 'wilayah_sekolah_asal',
                  attributes: ['id','nama']
                },
                {
                  model: StatusDomisili,
                  as: 'status_domisili_name',
                  attributes: ['id','nama']
                },
                {
                    model: DataUsers,
                    as: 'diverifikasi_oleh',
                    attributes: ['id', 'nama']
                }
            ],

        });

  
        
      

        if (resData) { // Check if resData is not null

            const data = {  
              // id_: id,  
              ...resData.toJSON(), // Convert Sequelize instance to plain object  
            };  
            // delete data.id; // Remove original ID from the response 

            data.nik = '*'.repeat(16); // Masking nik jadi 16 bintang
            res.status(200).json({
                'status': 1,
                'message': 'Data berhasil ditemukan',
                'data': data // Return the found data
            });
        } else {
            res.status(200).json({
                'status': 0,
                'message': 'Data kosong',
                'data': null // Return null or an appropriate value when data is not found
            });
        }

    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({ // Use 500 for server error
            'status': 0,
            'message': 'Error'
        });
    }
}

export const getPendaftarDetail = async (req, res) => {
    try {
      // Ambil data pendaftar berdasarkan NISN
      const profil = await DataPendaftars.findOne({
        where: {
          nisn: req.body.nisn,
          is_delete: 0
        },
        include: [
          {
              model: WilayahVerDapodik,
              as: 'data_wilayah',
              attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
          },
          {
              model: WilayahVerDapodik,
              as: 'data_wilayah_kec',
              attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
          },
          {
              model: WilayahVerDapodik,
              as: 'data_wilayah_kot',
              attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
          },
          {
              model: WilayahVerDapodik,
              as: 'data_wilayah_prov',
              attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
          },
          {
            model: SekolahAsalWilayah,
            as: 'wilayah_sekolah_asal',
            attributes: ['id','nama']
          },
          {
            model: StatusDomisili,
            as: 'status_domisili_name',
            attributes: ['id','nama']
          },{
            model: JenisKejuaraans,
            as: 'jenis_kejuaraan',
            attributes: ['nama']
          }
      ],

      });
  
      if (profil) {
        // Ambil detail pendaftaran sekolah
        const pendaftaranSekolahDetails = await DataPerangkingans.findAll({
          where: {
            nisn: req.body.nisn,
            is_delete: 0,
          },
          attributes: ['sekolah_tujuan_id'] // Ambil atribut yang diperlukan
        });
  
        // Ambil detail daftar ulang
        const daftarUlangDetails = await DataPerangkingans.findAll({
          where: {
            nisn: req.body.nisn,
            is_delete: 0,
            is_daftar_ulang: 1 // Hanya yang is_daftar_ulang = 1
          },
          attributes: ['sekolah_tujuan_id', 'is_daftar_ulang'] // Ambil atribut yang diperlukan
        });
  
        let pendaftaranSekolah = [];
        let daftarUlang = [];
  
        // Loop melalui pendaftaranSekolahDetails untuk mendapatkan detail sekolah
        for (const detail of pendaftaranSekolahDetails) {
          const sekolahDetail = await SekolahTujuan.findOne({
            where: {
              id: detail.sekolah_tujuan_id
            },
            attributes: ['nama'] // Ambil atribut yang diperlukan dari SekolahTujuan
          });
  
          if (sekolahDetail) {
            pendaftaranSekolah.push(sekolahDetail);
          }
        }
  
        // Loop melalui daftarUlangDetails untuk mendapatkan detail sekolah daftar ulang
        for (const detail of daftarUlangDetails) {
          const sekolahDetail = await SekolahTujuan.findOne({
            where: {
              id: detail.sekolah_tujuan_id
            },
            attributes: ['nama'] // Ambil atribut yang diperlukan dari SekolahTujuan
          });
  
          if (sekolahDetail) {
            daftarUlang.push({
              nama_sekolah: sekolahDetail.nama,
              status_daftar_ulang: detail.is_daftar_ulang,
            //   sekolah_detail: sekolahDetail
            });
          }
        }
  
        // Buat timeline_pendaftar
        const timeline_pendaftar = {
          pendaftaran: 1,
          verifikasi: profil.is_verified, // Asumsi bahwa profil memiliki atribut is_verified
          aktivasi: profil.is_active, // Asumsi bahwa profil memiliki atribut is_active
          pendaftaran_sekolah: pendaftaranSekolah,
          daftar_ulang: daftarUlang
        };
  
        // Masukkan timeline_pendaftar ke dalam profil
        profil.setDataValue('timeline_pendaftar', timeline_pendaftar);
  
        res.status(200).json({
          status: 1,
          message: 'Data berhasil ditemukan',
          data: profil // Data yang ditemukan, termasuk timeline_pendaftar
        });
  
      } else {
        res.status(200).json({
          status: 0,
          message: 'Data kosong',
          data: null
        });
      }
  
    } catch (err) {
      console.error('Error fetching data:', err);
      res.status(500).json({
        status: 0,
        message: 'Error'
      });
    }
}

// User aktivasi
export const aktivasiAkunPendaftar_BAK = async (req, res) => {

        const { nisn, kode_verifkasi, password } = req.body;

        try {
            // Check if user exists
            const hashedPassword = await bcrypt.hash(password, 10);

            const user = await DataPendaftars.findOne({
                where: {
                    nisn,
                    kode_verifkasi,
                    is_verified: 1,
                    is_delete: 0
                }
            });

            if (!user) {
                return res.status(400).json({ status: 0, message: 'Invalid nisn or kode_verifikasi' });
            }

            

             // Generate tokens
             const accessToken = jwt.sign({ userId: user.id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
             const refreshToken = jwt.sign({ userId: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

            // Save tokens to user record
            user.access_token = accessToken;
            user.access_token_refresh = refreshToken;
            await user.save({ fields: ['access_token', 'access_token_refresh', 'updated_at'] });

            res.status(200).json({
                status: 1,
                message: 'Login successful',
                data: {
                    userId: user.id,
                    username: user.username,
                    role: user.role,
                    accessToken,
                    refreshToken
                }
            });
        } catch (error) {
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }
};


const getPesertaDidikSmaSmkByNisn = async (nisn, nik) => {
  try {

      const redis_key = `DataAllAnakSMASMK`;
      const cached = await redisGet(redis_key);

      if (cached) {

          console.log(`[REDIS] Cek dari cache: ${redis_key}`);

          const allPesertaDidik = JSON.parse(cached);
          const pesertaDidik = allPesertaDidik.find(pd => pd.nisn === nisn && pd.nik === nik);

          if (!pesertaDidik) {
              return false;
          }

          return pesertaDidik;


      }else{

          

          const pesertaDidik = await DataPesertaDidikSmaSmks.findOne({
              attributes: ['nisn', 'nik' ,'nama', 'nama_sekolah'],
              where: { 
                  nisn,
                  nik, 
              },
              
          
          });

          if (!pesertaDidik) {

              return false;

          }

          return pesertaDidik;
      
      }

  
      
  } catch (error) {
      console.error(error);
      throw error;
  }
};

// User aktivasi
export const aktivasiAkunPendaftar = async (req, res) => {
        const { nisn, kode_verifikasi, password } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const resTm = await getTimelineSatuan(3);

        // const resTm = await Timelines.findOne({  
        //   where: { id: 3 }, // Find the timeline by ID  
        //   attributes: ['id', 'nama', 'status']  
        // });  

        if (resTm.status != 1) {  
            return res.status(200).json({ status: 0, message: 'Aktivasi Belum Dibuka :)' });
        }

        const pesetaDidikSmaSmk = await getPesertaDidikSmaSmkByNisn(nisn, nik);
        if (pesetaDidikSmaSmk) {   
            
            return res.status(200).json({
                status: 0,
                message: 'Maaf tidak bisa aktivasi akun nisn anda masih terdaftar aktif di data kelas SMA/SMK'
            });

        }

        try {
            const resData = await DataPendaftars.findOne({
                where: {
                    nisn,
                    kode_verifikasi,
                    // is_verified: 1,
                    is_delete: 0
                }
            });

            if (!resData) {
                return res.status(200).json({ status: 0, message: 'Data aktivasi salah' });
            }

            if (resData.is_verified != 1) {
              return res.status(200).json({ status: 0, message: 'Akun belum di verifikasi, silahkan lakukan verifikasi akun ke sekolah' });
            }

            if (resData.is_active == 1) {
              return res.status(200).json({ status: 0, message: 'Akun sudah diaktivasi sebelumnya, silahkan langsung login' });
            }

            await DataPendaftars.update({
                is_active: 1,
                password_: hashedPassword,
                activated_at: new Date(), // Set the current date and time
                activated_by: req.ip
            }, {
                where: {
                    nisn,
                    kode_verifikasi,
                    is_verified: 1,
                    is_delete: 0
                }
            });

            res.status(200).json({
                status: 1,
                message: 'Aktivasi Berhasil',
            });

        } catch (error) {
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }
};

export const getPendaftarLog = async (req, res) => {
    try {
      // Ambil data pendaftar berdasarkan NISN
      const profil = await DataPendaftars.findOne({
        where: {
          nisn: req.body.nisn,
          is_delete: 0
        }
      });
  
      if (profil) {
        // Ambil detail pendaftaran sekolah
        const pendaftaranSekolahDetails = await DataPerangkingans.findAll({
          where: {
            nisn: req.body.nisn,
            is_delete: 0,
          },
          attributes: ['sekolah_tujuan_id'] // Ambil atribut yang diperlukan
        });
  
        // Ambil detail daftar ulang
        const daftarUlangDetails = await DataPerangkingans.findAll({
          where: {
            nisn: req.body.nisn,
            is_delete: 0,
            is_daftar_ulang: 1 // Hanya yang is_daftar_ulang = 1
          },
          attributes: ['sekolah_tujuan_id', 'is_daftar_ulang'] // Ambil atribut yang diperlukan
        });
  
        let pendaftaranSekolah = [];
        let daftarUlang = [];
  
        // Loop melalui pendaftaranSekolahDetails untuk mendapatkan detail sekolah
        for (const detail of pendaftaranSekolahDetails) {
          const sekolahDetail = await SekolahTujuan.findOne({
            where: {
              id: detail.sekolah_tujuan_id
            },
            attributes: ['nama'] // Ambil atribut yang diperlukan dari SekolahTujuan
          });
  
          if (sekolahDetail) {
            pendaftaranSekolah.push(sekolahDetail);
          }
        }
  
        // Loop melalui daftarUlangDetails untuk mendapatkan detail sekolah daftar ulang
        for (const detail of daftarUlangDetails) {
          const sekolahDetail = await SekolahTujuan.findOne({
            where: {
              id: detail.sekolah_tujuan_id
            },
            attributes: ['nama'] // Ambil atribut yang diperlukan dari SekolahTujuan
          });
  
          if (sekolahDetail) {
            daftarUlang.push({
              nama_sekolah: sekolahDetail.nama,
              status_daftar_ulang: detail.is_daftar_ulang,
            //   sekolah_detail: sekolahDetail
            });
          }
        }
  
        // Buat timeline_pendaftar
        const timeline_pendaftar = {
          pendaftaran: 1,
          verifikasi: profil.is_verified, // Asumsi bahwa profil memiliki atribut is_verified
          aktivasi: profil.is_active, // Asumsi bahwa profil memiliki atribut is_active
          pendaftaran_sekolah: pendaftaranSekolah,
          daftar_ulang: daftarUlang
        };
  
        // Masukkan timeline_pendaftar ke dalam profil
        profil.setDataValue('timeline_pendaftar', timeline_pendaftar);
  
        res.status(200).json({
          status: 1,
          message: 'Data berhasil ditemukan',
          data: profil // Data yang ditemukan, termasuk timeline_pendaftar
        });
  
      } else {
        res.status(200).json({
          status: 0,
          message: 'Data kosong',
          data: null
        });
      }
  
    } catch (err) {
      console.error('Error fetching data:', err);
      res.status(500).json({
        status: 0,
        message: 'Error'
      });
    }
}

export const getBatasWlayahBAK = async (req, res) => {
  try {

    if (!req.body.kelurahan) {
      return res.status(400).json({
        status: 0,
        message: 'Kode dapodik (kelurahan) tidak diberikan'
      });
    }

    const json = await GeoJsons.findOne({
      where: {
        kode_dapodik: req.body.kelurahan,
      }
    });

    if (json) {
      res.status(200).json({
        status: 1,
        message: 'Data berhasil ditemukan',
        data: json
      });
    } else {
      res.status(200).json({
        status: 0,
        message: 'Data kosong',
        data: null
      });
    }

  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({
      status: 0,
      message: 'Error'
    });
  }
}


export const getBatasWlayah = async (req, res) => {
  try {
   
    if (!req.body.kelurahan) {
      return res.status(400).json({
        status: 0,
        message: 'Kode dapodik (kelurahan) tidak diberikan'
      });
    }

    const redis_key = 'BatasWilayah'+req.body.kelurahan;
    const cacheNya = await redisGet(redis_key);

      if (cacheNya) {

        res.status(200).json({
          status: 1,
          message: 'Data di ambil dari cache',
          data: JSON.parse(cacheNya)
        });


      }else{

        const json = await GeoJsons.findOne({
          where: {
            kode_dapodik: req.body.kelurahan,
          }
        });

        if (json) {
          res.status(200).json({
            status: 1,
            message: 'Data berhasil ditemukan',
            data: json
          });
        } else {
          res.status(200).json({
            status: 0,
            message: 'Data kosong',
            data: null
          });
        }

    }

  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({
      status: 0,
      message: 'Error'
    });
  }
}