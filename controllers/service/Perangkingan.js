import { check, validationResult } from 'express-validator';
import DataPendaftars from "../../models/service/DataPendaftarModel.js";
import DataPerangkingans from "../../models/service/DataPerangkinganModel.js";
import FileTambahans from "../../models/master/FileTambahanModel.js";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { encodeId, decodeId } from '../../middleware/EncodeDecode.js';


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

const calculateAge = (birthdate) => {
    const today = new Date();
    const birthDate = new Date(birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    // Jika bulan ulang tahun belum terjadi, kurangi umur satu tahun
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
};

export const getPerangkingan = async (req, res) => {

    try {

        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            jurusan_id,
            nisn,
        } = req.body;
        
        if(jalur_pendaftaran_id == 1){
            //Jalur Zonasi Reguler SMA
            const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0
                },
                order: [
                    ['jarak', 'ASC'], //jarak terendah
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] //daftar sekolah terawal
                ]
                
            });
        }else if(jalur_pendaftaran_id == 2){
            //Jalur Zonasi KHUSUS SMA
            const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0
                },
                order: [
                    ['umur', 'DESC'], //umur tertua
                    ['nilai', 'DESC'], //jarak terendah
                    ['created_at', 'ASC'] //daftar sekolah terawal
                ]
            });
        }else if(jalur_pendaftaran_id == 3){
             //Jalur Prestasi SMA
             const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0
                },
                order: [
                    ['nilai_akhir', 'DESC'], //nilai tertinggi
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] // daftar sekolah terawal
                ]
               
            });
        }else if(jalur_pendaftaran_id == 4){
            //Jalur PTO SMA
            const resData = await DataPerangkingans.findAll({
               where: {
                   jalur_pendaftaran_id,
                   sekolah_tujuan_id,
                   is_delete: 0
               },
               
           });
       }else if(jalur_pendaftaran_id == 5){
        //Jalur Afirmasi SMA
        const resData = await DataPerangkingans.findAll({
           where: {
               jalur_pendaftaran_id,
               sekolah_tujuan_id,
               is_delete: 0
           },
           
       });
   }

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

// Function to handle POST request
export const cekPerangkingan = async (req, res) => {
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
                    id: decodeId(id_pendaftar),
                    is_delete: 0
                }
            });

            if (!pendaftar) {
                return res.status(200).json({ status: 0, message: 'Pendaftar tidak ditemukan' });
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
                return res.status(200).json({ status: 0, message: 'NISN sudah terdaftar lebih dari 2 kali' });
            }

             // Count existing entries with the same NISN that are not deleted
            const cari = await DataPerangkingans.findOne({
            where: {
                nisn,
                is_delete: 0
            }
            });

            if(cari != null){

                if (cari.jalur_pendaftaran_id == jalur_pendaftaran_id) {
                    return res.status(200).json({ status: 0, message: 'Hanya boleh mendaftar 1 jalur pendaftaran di masing-masing jalur pendaftaran' });
                }
    
                if (cari.sekolah_tujuan_id == sekolah_tujuan_id) {
                    return res.status(200).json({ status: 0, message: 'Hanya boleh mendaftar 1 sekolah di masing-masing sekolah' });
                }
    
                if (bentuk_pendidikan_id == 15) {
                    if(cari.jurusan_id == jurusan_id){
                        return res.status(200).json({ status: 0, message: 'Hanya boleh mendaftar 1 jurusan di masing-masing jurusan' });
                    }
                }       

            }

             

            const data_file_tambahan = await FileTambahans.findAll({
                where: {
                    id_jalur_pendaftaran: jalur_pendaftaran_id,
                    is_active: 1
                }
            });


            const newPerangkingan = {
                id_pendaftar,
                //no_pendaftaran,
                bentuk_pendidikan_id,
                jalur_pendaftaran_id,
                sekolah_tujuan_id,
                jurusan_id,
                nisn,

                nik: pendaftar.nik,
                nama_lengkap: pendaftar.nama_lengkap,
                tanggal_lahir: new Date(pendaftar.tanggal_lahir),
                umur: calculateAge(pendaftar.tanggal_lahir),
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
            };


            // Filter the data to be sent as a response
            // const responseData = {
            //     nisn: newPerangkingan.nisn,
            //     nama_lengkap: newPerangkingan.nama_lengkap
            // };

            

            const data = {
                id_: id_pendaftar, 
                ...newPerangkingan, 
                data_file_tambahan: data_file_tambahan // tambahkan properti baru
            };
            delete data.id_pendaftar; //

            // Send success response
            res.status(201).json({
                status: 1,
                message: 'Hasil pengecekan',
                data: data
            });
        } catch (error) {
            console.error('Error pengecekan:', error);
            res.status(500).json({
                status: 0,
                message: error.message || 'Terjadi kesalahan saat proses pengecekan'
            });
        }
}

// Function to handle POST request
export const createPerangkingan = async (req, res) => {
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
            return res.status(200).json({ status: 0, message: 'Pendaftar tidak ditemukan' });
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
            return res.status(200).json({ status: 0, message: 'NISN sudah terdaftar lebih dari 2 kali' });
        }

        const no_pendaftaran = await generatePendaftaranNumber();



        // Create a new entry in the ez_perangkingan table
        // const newPerangkingan = await DataPerangkingans.create({
        //     id_pendaftar,
        //     no_pendaftaran,
        //     bentuk_pendidikan_id,
        //     jalur_pendaftaran_id,
        //     sekolah_tujuan_id,
        //     jurusan_id,
        //     nisn,

        //     nik: pendaftar.nik,
        //     nama_lengkap: pendaftar.nama_lengkap,
        //     tanggal_lahir: new Date(pendaftar.tanggal_lahir),
        //     umur: calculateAge(pendaftar.tanggal_lahir),
        //     tahun_lulus: pendaftar.tahun_lulus ? pendaftar.tahun_lulus : 0,
        //     umur_sertifikat: pendaftar.umur_sertifikat ? pendaftar.umur_sertifikat : 0,

        //     jarak: 20,

        //     nilai_raport: pendaftar.nilai_raport_rata,
        //     nilai_prestasi: pendaftar.nilai_prestasi,
        //     nilai_akhir,

        //     is_tidak_sekolah: pendaftar.is_tidak_sekolah,
        //     is_anak_panti: pendaftar.is_anak_panti,
        //     is_anak_keluarga_tidak_mampu: pendaftar.is_anak_keluarga_tidak_mampu,
        //     is_anak_guru_jateng: pendaftar.is_anak_guru_jateng,
        //     is_pip: pendaftar.is_pip,

        //     created_by: id_pendaftar,
        //     created_by_ip: req.ip
        // });

        const newPerangkingan = {
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
            umur: calculateAge(pendaftar.tanggal_lahir),
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
        };

        // Filter the data to be sent as a response
        // const responseData = {
        //     nisn: newPerangkingan.nisn,
        //     nama_lengkap: newPerangkingan.nama_lengkap
        // };

        // Send success response
        res.status(201).json({
            status: 1,
            message: 'Perangkingan berhasil dibuat',
            data: newPerangkingan
        });
    } catch (error) {
        console.error('Error perangkingan:', error);
        res.status(500).json({
            status: 0,
            message: error.message || 'Terjadi kesalahan saat proses perangkingan'
        });
    }
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            const uploadPath = `upload/berkas/${req.body.nisn}`;
            await fs.promises.mkdir(uploadPath, { recursive: true });
            cb(null, uploadPath);
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

// Fungsi untuk mendapatkan konfigurasi upload berdasarkan nama file
const getUploadFields = async (jalur_pendaftaran_id) => {
    // if (!jalur_pendaftaran_id) {
    //     throw new Error('ID Jalur Pendaftaran tidak valid');
    // }

    const data_file_tambahan = await FileTambahans.findAll({
        where: {
            id_jalur_pendaftaran: jalur_pendaftaran_id,
            is_active: 1
        }
    });

    const uploadFields = data_file_tambahan.map(file => ({
        name: file.nama_file,
        maxCount: 1
    }));

    return uploadFields;
};

// Function to handle POST request
export const createPerangkinganBAK = async (req, res) => {

      // Menangani hasil validasi
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.status(400).json({ status: 0, errors: errors.array() });
      }

    try {
        const jalur_pendaftaran_id = req.body.jalur_pendaftaran_id;

        console.log('Text data:', req.body);
        console.log('Files:', req.files);

        // if (!jalur_pendaftaran_id) {
        //     return res.status(400).json({ status: 0, message: 'ID Jalur Pendaftaran tidak diberikan' });
        // }

        // Dapatkan konfigurasi upload fields
        const uploadFields = await getUploadFields(jalur_pendaftaran_id);

        // Handle file uploads
        upload.fields(uploadFields)(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ status: 0, message: err.message });
            }

            // Debugging: Print form data and files
            console.log('Text data:', req.body);
            console.log('Files:', req.files);

            try {
                const {
                    id_pendaftar,
                    bentuk_pendidikan_id,
                    sekolah_tujuan_id,
                    jurusan_id,
                    nisn,
                } = req.body;

                const pendaftar = await DataPendaftars.findOne({
                    where: {
                        id: decodeId(id_pendaftar),
                        is_delete: 0
                    }
                });

                if (!pendaftar) {
                    return res.status(200).json({ status: 0, message: 'Pendaftar tidak ditemukan' });
                }

                const nilai_akhir = (pendaftar.nilai_raport_rata || 0) + (pendaftar.nilai_prestasi || 0);

                const count = await DataPerangkingans.count({
                    where: {
                        nisn,
                        is_delete: 0
                    }
                });

                if (count >= 2) {
                    return res.status(200).json({ status: 0, message: 'NISN sudah terdaftar lebih dari 2 kali' });
                }

                const no_pendaftaran = await generatePendaftaranNumber();

                const uploadedFiles = [];
                if (req.files) {
                    for (const [key, value] of Object.entries(req.files)) {
                        uploadedFiles.push({
                            nama_file: key,
                            nama_file_with_extension: value[0].filename
                        });
                    }
                }

                const newPerangkinganData = {
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
                    umur: calculateAge(pendaftar.tanggal_lahir),
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
                    created_by_ip: req.ip,
                    file_tambahan: JSON.stringify(uploadedFiles)
                };

                // const newPerangkingan = await DataPerangkingans.create(newPerangkinganData);

                res.status(201).json({
                    status: 1,
                    message: 'Perangkingan berhasil dibuat',
                    data: newPerangkinganData
                });
            } catch (error) {
                console.error('Error perangkingan:', error);
                res.status(500).json({
                    status: 0,
                    message: error.message || 'Terjadi kesalahan saat proses perangkingan'
                });
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 0,
            message: error.message || 'Terjadi kesalahan pada server'
        });
    }
};



