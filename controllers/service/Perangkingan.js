import { check, validationResult } from 'express-validator';
import DataPendaftars from "../../models/service/DataPendaftarModel.js";
import DataPerangkingans from "../../models/service/DataPerangkinganModel.js";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = `upload/berkas/${req.body.nisn}`;
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
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
const generatePendaftaranNumber = async () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    let exists = true;

    while (exists) {
        code = '';
        for (let i = 0; i < 10; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            code += characters[randomIndex];
        }

        const existingCode = await DataPerangkingans.findOne({ where: { no_pendaftaran: code } });
        exists = !!existingCode;
    }

    return code;
};

// Function to handle POST request
export const createPerangkingan = [
    async (req, res) => {
        // // Handle validation results
        // const errors = validationResult(req);
        // if (!errors.isEmpty()) {
        //     return res.status(400).json({ status: 0, errors: errors.array() });
        // }

        try {
            const {
                id_pendaftar,
                bentuk_pendidikan_id,
                jalur_pendaftaran_id,
                sekolah_tujuan_id,
                jurusan_id,
                nisn,
            } = req.body;

             // Retrieve data from DataPendaftarModel
             const pendaftar = await DataPendaftars.findOne({
                where: {
                    id: id_pendaftar,
                    is_delete: 0
                }
            });

            if (!pendaftar) {
                return res.status(400).json({ status: 0, message: 'Pendaftar tidak ditemukan' });
            }

            // Hitung nilai_akhir sebagai penjumlahan dari nilai_raport_rata dan nilai_prestasi
            const nilai_akhir = (pendaftar.nilai_raport_rata || 0) + (pendaftar.nilai_prestasi || 0);

            // Count existing entries with the same NISN that are not deleted
            const count = await DataPerangkingans.count({
                where: {
                    nisn,
                    is_delete: 0
                }
            });

            if (count >= 2) {
                return res.status(400).json({ status: 0, message: 'NISN sudah terdaftar lebih dari 2 kali' });
            }

            const no_pendaftaran = await generatePendaftaranNumber();



            // Create a new entry in the ez_perangkingan table
            const newPerangkingan = await DataPerangkingans.create({
                id_pendaftar,
                no_pendaftaran,
                bentuk_pendidikan_id,
                jalur_pendaftaran_id,
                sekolah_tujuan_id,
                jurusan_id,
                nisn,

                nik: pendaftar.nik,
                nama_lengkap: pendaftar.nama_lengkap,
                tanggal_lahir: new Date(pendaftar.tanggal_lahir),
                umur: pendaftar.umur ? pendaftar.umur : 0,
                tahun_lulus: pendaftar.tahun_lulus ? pendaftar.tahun_lulus : 0,
                umur_sertifikat: pendaftar.umur_sertifikat ? pendaftar.umur_sertifikat : 0,

                jarak: 20,

                nilai_raport: pendaftar.nilai_raport_rata,
                nilai_prestasi: pendaftar.nilai_prestasi,
                nilai_akhir,

                is_tidak_sekolah: pendaftar.is_tidak_sekolah,
                is_anak_panti: pendaftar.is_anak_panti,
                is_anak_keluarga_tidak_mampu: pendaftar.is_anak_keluarga_tidak_mampu,
                is_anak_guru_jateng: pendaftar.is_anak_guru_jateng,
                is_pip: pendaftar.is_pip,

                created_by: id_pendaftar,
                created_by_ip: req.ip
            });

            // Filter the data to be sent as a response
            const responseData = {
                nisn: newPerangkingan.nisn,
                nama_lengkap: newPerangkingan.nama_lengkap
            };

            // Send success response
            res.status(201).json({
                status: 1,
                message: 'Perangkingan berhasil dibuat',
                data: responseData
            });
        } catch (error) {
            console.error('Error perangkingan:', error);
            res.status(500).json({
                status: 0,
                message: error.message || 'Terjadi kesalahan saat proses perangkingan'
            });
        }
    }
];


// Fungsi untuk menangani permintaan POST
export const createPendaftar = [
    async (req, res) => {
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
                        is_delete: null
                    }
                });

                if (existingPendaftar) {
                    return res.status(400).json({ status: 0, message: 'NISN sudah terdaftar' });
                }

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
    }
];

export const getPendaftarforCetak = async (req, res) => {
    try {
        const resData = await DataPendaftars.findOne({
            where: {
                kode_verifikasi: req.body.kode_verifikasi,
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
