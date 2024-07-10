import { check, validationResult } from 'express-validator';
import DataPesertaDidiks from "../../models/service/DataPendaftarModel.js";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";

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

        const existingCode = await DataPesertaDidiks.findOne({ where: { kode_verifikasi: code } });
        exists = !!existingCode;
    }

    return code;
};


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

                // Menghasilkan kode verifikasi unik
                const kode_verifikasi = await generateVerificationCode();

                // Get file paths
                const files = req.files;
                const dok_pakta_integritas = files.dok_pakta_integritas ? files.dok_pakta_integritas[0].filename : null;
                const dok_kk = files.dok_kk ? files.dok_kk[0].filename : null;
                const dok_suket_nilai_raport = files.dok_suket_nilai_raport ? files.dok_suket_nilai_raport[0].filename : null;
                const dok_piagam = files.dok_piagam ? files.dok_piagam[0].filename : null;

                // Membuat entri baru dalam tabel ez_pendaftar
                const newPendaftar = await DataPesertaDidiks.create({
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
                    kejuaraan_id,
                    nama_kejuaraan,
                    tanggal_sertifikat: tanggal_sertifikat ? new Date(tanggal_sertifikat) : null,
                    umur_sertifikat,
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
                    created_by: req.ip
                });

                // Menyaring data yang akan dikirim sebagai respons
                const responseData = {
                    // id: newPendaftar.id,
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