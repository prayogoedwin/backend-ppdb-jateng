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

// Fungsi untuk menangani permintaan POST
export const createPendaftar = [
    // Validasi input
    check('nisn').notEmpty().withMessage('NISN is required')
        .custom(async (value) => {
            const existing = await DataPesertaDidiks.findOne({ where: { nisn: value } });
            if (existing) {
                throw new Error('NISN already exists');
            }
        }),
    check('no_wa').notEmpty().withMessage('No WA is required')
        .matches(/^(0|62)\d+/).withMessage('No WA must start with 0 or 62')
        .custom(async (value) => {
            const existing = await DataPesertaDidiks.findOne({ where: { no_wa: value } });
            if (existing) {
                throw new Error('No WA already exists');
            }
        }),
    check('nik').notEmpty().withMessage('NIK is required')
        .custom(async (value) => {
            const existing = await DataPesertaDidiks.findOne({ where: { nik: value } });
            if (existing) {
                throw new Error('NIK already exists');
            }
        }),
    // Fungsi handler
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
                    kode_verifikasi,
                    created_by,
                    saved_by,
                    is_saved,
                    no_urut,
                    is_diterima
                } = req.body;

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
                    id: newPendaftar.id,
                    nisn: newPendaftar.nisn,
                    sekolah_asal_id: newPendaftar.sekolah_asal_id,
                    jenis_lulusan_id: newPendaftar.jenis_lulusan_id,
                    tahun_lulus: newPendaftar.tahun_lulus,
                    nama_sekolah_asal: newPendaftar.nama_sekolah_asal,
                    nik: newPendaftar.nik,
                    nama_lengkap: newPendaftar.nama_lengkap,
                    jenis_kelamin: newPendaftar.jenis_kelamin,
                    tanggal_lahir: newPendaftar.tanggal_lahir,
                    tempat_lahir: newPendaftar.tempat_lahir,
                    status_domisili: newPendaftar.status_domisili,
                    alamat: newPendaftar.alamat,
                    provinsi_id: newPendaftar.provinsi_id,
                    kabkota_id: newPendaftar.kabkota_id,
                    kecamatan_id: newPendaftar.kecamatan_id,
                    kelurahan_id: newPendaftar.kelurahan_id,
                    rt: newPendaftar.rt,
                    rw: newPendaftar.rw,
                    lat: newPendaftar.lat,
                    lng: newPendaftar.lng,
                    no_wa: newPendaftar.no_wa,
                    tanggal_cetak_kk: newPendaftar.tanggal_cetak_kk,
                    kejuaraan_id: newPendaftar.kejuaraan_id,
                    nama_kejuaraan: newPendaftar.nama_kejuaraan,
                    tanggal_sertifikat: newPendaftar.tanggal_sertifikat,
                    umur_sertifikat: newPendaftar.umur_sertifikat,
                    nomor_sertifikat: newPendaftar.nomor_sertifikat,
                    nilai_prestasi: newPendaftar.nilai_prestasi,
                    dok_pakta_integritas: newPendaftar.dok_pakta_integritas,
                    dok_kk: newPendaftar.dok_kk,
                    dok_suket_nilai_raport: newPendaftar.dok_suket_nilai_raport,
                    dok_piagam: newPendaftar.dok_piagam,
                    is_tidak_sekolah: newPendaftar.is_tidak_sekolah,
                    is_anak_panti: newPendaftar.is_anak_panti,
                    is_anak_keluarga_tidak_mampu: newPendaftar.is_anak_keluarga_tidak_mampu,
                    is_anak_guru_jateng: newPendaftar.is_anak_guru_jateng,
                    is_pip: newPendaftar.is_pip,
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




// Fungsi untuk menangani permintaan POST
export const createPendaftarBAK = async (req, res) => {
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
                kode_verifikasi,
                created_by,
                saved_by,
                is_saved,
                no_urut,
                is_diterima
            } = req.body;


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
                created_by: req.ip
            });

            // Menyaring data yang akan dikirim sebagai respons
            const responseData = {
                nisn: newPendaftar.nisn,
                nama_lengkap: newPendaftar.nama_lengkap,
                kode_verifikasi: newPendaftar.nisn,
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
