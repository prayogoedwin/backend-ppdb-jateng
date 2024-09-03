import { check, validationResult } from 'express-validator';
import DataPendaftars from "../../models/service/DataPendaftarModel.js";
import DataPerangkingans from "../../models/service/DataPerangkinganModel.js";
import SekolahTujuan from "../../models/master/SekolahTujuanModel.js"; // Import model SekolahTujuan
import WilayahVerDapodik from '../../models/master/WilayahVerDapodikModel.js';
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';

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
    { name: 'dok_piagam', maxCount: 1 }
]);

//Generate Verification Code
const generateVerificationCode = async () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    let exists = true;

    while (exists) {
        code = '';
        for (let i = 0; i < 10; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            code += characters[randomIndex];
        }

        const existingCode = await DataPendaftars.findOne({ where: { kode_verifikasi: code } });
        exists = !!existingCode;
    }

    return code;
};


// Fungsi untuk menangani permintaan POST
export const createPendaftar = async (req, res) => {
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
                    // nilai_raport,
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
                    is_diterima
                } = req.body;

                // Cek apakah NISN sudah terdaftar dan belum dihapus
                const existingPendaftar = await DataPendaftars.findOne({
                    where: {
                        nisn,
                        [Op.or]: [
                            { is_delete: 0 }, // Entri yang belum dihapus
                            { is_delete: null } // Entri yang belum diatur
                        ]
                    }
                });

                if (existingPendaftar) {
                    return res.status(400).json({ status: 0, message: 'NISN sudah terdaftar' });
                }

                let nilai_raport = {
                    "pendidikan_agama": 85,
                    "pkn": 78,
                    "bahasa_indonesia": 82,
                    "matematika": 82,
                    "ipa":90,
                    "ips": 90,
                    "bahasa_inggris": 78,
                    "pjok": 80,
                    "seni_budaya": 80
                  }

                nilai_raport = JSON.stringify(nilai_raport);

                // Menghasilkan kode verifikasi unik
                const kode_verifikasi = await generateVerificationCode();
                const hashedPassword = await bcrypt.hash('Admin123#=', 10);

                // Get file paths
                const files = req.files;
                const dok_pakta_integritas = files.dok_pakta_integritas ? files.dok_pakta_integritas[0].filename : null;
                const dok_kk = files.dok_kk ? files.dok_kk[0].filename : null;
                const dok_suket_nilai_raport = files.dok_suket_nilai_raport ? files.dok_suket_nilai_raport[0].filename : null;
                const dok_piagam = files.dok_piagam ? files.dok_piagam[0].filename : null;

                // Membuat entri baru dalam tabel ez_pendaftar
                const newPendaftar = await DataPendaftars.create({
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
                    tanggal_cetak_kk: tanggal_cetak_kk ? new Date(tanggal_cetak_kk) : null,
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
                    is_pip,
                    kode_verifikasi,
                    created_by: req.ip,
                    password_:hashedPassword
                });

                // Menyaring data yang akan dikirim sebagai respons
                const responseData = {
                    nisn: newPendaftar.nisn,
                    nama_lengkap: newPendaftar.nama_lengkap,
                    kode_verifikasi: newPendaftar.kode_verifikasi,
        
                };

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
                }
            ],

        });

        if (resData) { // Check if resData is not null
            res.status(200).json({
                'status': 1,
                'message': 'Data berhasil ditemukan',
                'data': resData // Return the found data
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

export const getPendaftarDetail_BAK = async (req, res) => {
    try {
        const resData = await DataPendaftars.findOne({
            where: {
                nisn: req.body.nisn,
                is_delete: 0
            }
        });

        if (resData) { // Check if resData is not null
            res.status(200).json({
                'status': 1,
                'message': 'Data berhasil ditemukan',
                'data': resData // Return the found data

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

// User aktivasi
export const aktivasiAkunPendaftar2 = async (req, res) => {

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

// User aktivasi
export const aktivasiAkunPendaftar = async (req, res) => {
        const { nisn, kode_verifikasi, password } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        try {
            const resData = await DataPendaftars.findOne({
                where: {
                    nisn,
                    kode_verifikasi,
                    is_verified: 1,
                    is_delete: 0
                }
            });

            if (!resData) {
                return res.status(200).json({ status: 0, message: 'Data aktivasi salah, atau belum di verifikasi' });
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