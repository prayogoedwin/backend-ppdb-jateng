import { check, validationResult } from 'express-validator';
import DataPendaftars from "../../models/service/DataPendaftarModel.js";
import DataPerangkingans from "../../models/service/DataPerangkinganModel.js";
import Zonasis from "../../models/service/ZonasiModel.js";
import FileTambahans from "../../models/master/FileTambahanModel.js";
import SekolahTujuan from '../../models/master/SekolahTujuanModel.js';
import JalurPendaftarans from '../../models/master/JalurPendaftaranModel.js';
import WilayahVerDapodik from '../../models/master/WilayahVerDapodikModel.js';
import StatusDomisilis from '../../models/master/StatusDomisiliModel.js';
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { encodeId, decodeId } from '../../middleware/EncodeDecode.js';
import { Op } from 'sequelize';


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

export const getPerangkinganSaya = async (req, res) => {
    try {
        const { id_pendaftar } = req.body;

        // Decode the ID
        const decodedIdPendaftar = decodeId(id_pendaftar);

        // Fetch the data
        const resData = await DataPerangkingans.findAll({
            where: {
                id_pendaftar: decodedIdPendaftar, // Pastikan id_pendaftar adalah string
                is_delete: 0
            },
            include: [
                {
                    model: SekolahTujuan,
                    as: 'sekolah_tujuan',
                    attributes: ['npsn', 'nama']
                },{
                    model: JalurPendaftarans,
                    as: 'jalur_pendaftaran',
                    attributes: ['bentuk_pendidikan_id', 'nama']
                }
            ]
        });

        const resDatas = resData.map(item => {
            const jsonItem = item.toJSON();
            jsonItem.id_perangkingan_ = encodeId(item.id); // Add the encoded ID to the response
            jsonItem.id_pendaftar_ = encodeId(item.id_pendaftar); // Add the encoded ID to the response
            delete jsonItem.id; // Hapus kolom id dari output JSON
            delete jsonItem.id_pendaftar; // Hapus kolom id dari output JSON
           
            return jsonItem;
        });

        // Check if data is found
        if (resData && resData.length > 0) {
            res.status(200).json({
                status: 1,
                message: 'Data berhasil ditemukan',
                data: resDatas
            });
        } else {
            res.status(200).json({
                status: 0,
                message: 'Data kosong',
                data: []
            });
        }
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: 0,
            message: 'Error'
        });
    }
};

export const getPerangkinganDetail = async (req, res) => {
    try {
        const { id_pendaftar } = req.body;

        // Decode the ID
        const decodedIdPendaftar = decodeId(id_pendaftar);

        // Fetch the data
        const resData = await DataPerangkingans.findAll({
            where: {
                id_pendaftar: decodedIdPendaftar, // Pastikan id_pendaftar adalah string
                is_delete: 0
            },
            include: [
                {
                    model: SekolahTujuan,
                    as: 'sekolah_tujuan',
                    attributes: ['npsn', 'nama']
                },{
                    model: JalurPendaftarans,
                    as: 'jalur_pendaftaran',
                    attributes: ['bentuk_pendidikan_id', 'nama']
                }
            ]
        });

        const resDatas = resData.map(item => {
            const jsonItem = item.toJSON();
            jsonItem.id_perangkingan_ = encodeId(item.id); // Add the encoded ID to the response
            jsonItem.id_pendaftar_ = encodeId(item.id_pendaftar); // Add the encoded ID to the response
            delete jsonItem.id; // Hapus kolom id dari output JSON
            delete jsonItem.id_pendaftar; // Hapus kolom id dari output JSON
           
            return jsonItem;
        });

        // Check if data is found
        if (resData && resData.length > 0) {
            res.status(200).json({
                status: 1,
                message: 'Data berhasil ditemukan',
                data: resDatas
            });
        } else {
            res.status(200).json({
                status: 0,
                message: 'Data kosong',
                data: []
            });
        }
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: 0,
            message: 'Error'
        });
    }
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
                    'data': [] // Return null or an appropriate value when data is not found
                });
            }

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
                    ['nilai_akhir', 'DESC'], //jarak terendah
                    ['created_at', 'ASC'] //daftar sekolah terawal
                ]
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
                    'data': [] // Return null or an appropriate value when data is not found
                });
            }

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
                    'data': [] // Return null or an appropriate value when data is not found
                });
            }


        }else if(jalur_pendaftaran_id == 4){
            //Jalur PTO SMA
            const resData = await DataPerangkingans.findAll({
               where: {
                   jalur_pendaftaran_id,
                   sekolah_tujuan_id,
                   is_delete: 0
               },
               
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
                    'data': [] // Return null or an appropriate value when data is not found
                });
            }

        }else if(jalur_pendaftaran_id == 5){
        //Jalur Afirmasi SMA
            const resData = await DataPerangkingans.findAll({
            where: {
                jalur_pendaftaran_id,
                sekolah_tujuan_id,
                is_delete: 0
            },
           
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
                    'data': [] // Return null or an appropriate value when data is not found
                });
            }
        }else if(jalur_pendaftaran_id == 6){
            //Jalur Afirmasi SMK Terdekat
                const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0
                }, order: [
                    ['jarak', 'ASC'], //nilai tertinggi
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] // daftar sekolah terawal
                ]
               
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
                        'data': [] // Return null or an appropriate value when data is not found
                    });
                }
            }else{
                //Jalur Afirmasi SMK Terdekat
                    const resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0
                    }, order: [
                        ['jarak', 'ASC'], //nilai tertinggi
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] // daftar sekolah terawal
                    ]
                   
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
                            'data': [] // Return null or an appropriate value when data is not found
                        });
                    }
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

                //tidak boleh sma - smk
                if(cari.bentuk_pendidikan_id != bentuk_pendidikan_id){
                    return res.status(200).json({ status: 0, message: 'Hanya boleh mendaftar 1 jenjang yang sama (Jika sebelumnya sudah mendaftar SMA maka tidak di perbolehkan mendaftar SMK, begitu juga sebaliknya)' });
                }

                //tidak boleh sama jalur
                if (cari.jalur_pendaftaran_id == jalur_pendaftaran_id) {
                    return res.status(200).json({ status: 0, message: 'Hanya boleh mendaftar 1 jalur pendaftaran di masing-masing jalur pendaftaran' });
                }

                //cari zonasi untuk SMA
                if(jalur_pendaftaran_id == 1){


                    const kecPendaftar = pendaftar.kecamatan_id;

                    //tidak boleh jika tidak dalam zonasi
                    const cariZonasis = await Zonasis.findAll({
                        where: {
                          sekolah_tujuan_id
                        }
                      });
                
                      let isInZonasis = false;
                      
                      cariZonasis.forEach(zonasi => {
                        if (zonasi.kode_kecamatan_dapodik === kecPendaftar) {
                          isInZonasis = true;
                        }
                      });
                
                      if (!isInZonasis) {
                        return res.status(200).json({
                            status: 0,
                          message: "Domisili Anda tidak termasuk dalam zonasi Sekolah Yang Anda Daftar.",
                        });
                      }


                     // Get all zonasi for the pendaftar's kecamatan
                    const allZonasisForKecamatan = await Zonasis.findAll({
                        where: {
                            kode_kecamatan_dapodik: kecPendaftar
                        }
                    });

                    const zonasiSekolahIds = allZonasisForKecamatan.map(zonasi => zonasi.sekolah_tujuan_id);

                    // Check if the pendaftar has registered in any of the zonasi sekolah using any other path except zonasi
                    const previousRegistrations = await DataPerangkingans.findAll({
                        where: {
                        id_pendaftar: decodeId(id_pendaftar),
                        sekolah_tujuan_id: {
                            [Op.in]: zonasiSekolahIds // In the zonasi sekolah IDs
                        },
                        jalur_pendaftaran_id: {
                            [Op.ne]: 1 // Not using zonasi path
                        },
                        is_delete: {
                            [Op.or]: [null, 0]
                        }
                        }
                    });

                    if (previousRegistrations.length > 0) {
                        return res.status(200).json({
                            status: 0,
                        message: "Anda sudah mendaftar di sekolah yang berada di zonasi ini melalui jalur lain. Jalur zonasi tidak bisa digunakan.",
                        });
                    }


                }
    
                //hanya boleh daftar 1 sekolah di masing2 jalur
                if (cari.sekolah_tujuan_id == sekolah_tujuan_id) {
                    return res.status(200).json({ status: 0, message: 'Hanya boleh mendaftar 1 sekolah di masing-masing jalur' });
                }
    

                //hanya boleh daftar 1 jurusan saja untuk SMK
                if (bentuk_pendidikan_id == 15) {
                    if(cari.jurusan_id != 0 && cari.jurusan_id == jurusan_id){
                        return res.status(200).json({ status: 0, message: 'Hanya boleh mendaftar 1 jurusan di masing-masing jurusan' });
                    }
                }   


            }

            if(cari == null){
                //cari zonasi untuk SMA
                if(jalur_pendaftaran_id == 1){


                    const kecPendaftar = pendaftar.kecamatan_id;

                    //tidak boleh jika tidak dalam zonasi
                    const cariZonasis = await Zonasis.findAll({
                        where: {
                          id_sekolah: sekolah_tujuan_id
                        }
                      });
                
                      let isInZonasis = false;
                      
                      cariZonasis.forEach(zonasi => {
                        if (zonasi.kode_kecamatan_dapodik === kecPendaftar) {
                          isInZonasis = true;
                        }
                      });
                
                      if (!isInZonasis) {
                        return res.status(200).json({
                          status: 0,
                          message: "Domisili Anda tidak termasuk dalam zonasi Sekolah Yang Anda Daftar.",
                        });
                      }


                     // Get all zonasi for the pendaftar's kecamatan
                    const allZonasisForKecamatan = await Zonasis.findAll({
                        where: {
                            kode_kecamatan_dapodik: kecPendaftar
                        }
                    });

                    const zonasiSekolahIds = allZonasisForKecamatan.map(zonasi => zonasi.sekolah_tujuan_id);

                    // Check if the pendaftar has registered in any of the zonasi sekolah using any other path except zonasi
                    const previousRegistrations = await DataPerangkingans.findAll({
                        where: {
                        id_pendaftar: decodeId(id_pendaftar),
                        sekolah_tujuan_id: {
                            [Op.in]: zonasiSekolahIds // In the zonasi sekolah IDs
                        },
                        jalur_pendaftaran_id: {
                            [Op.ne]: 1 // Not using zonasi path
                        },
                        is_delete: {
                            [Op.or]: [null, 0]
                        }
                        }
                    });

                    if (previousRegistrations.length > 0) {
                        return res.status(200).json({
                        status: 0,
                        message: "Anda sudah mendaftar di sekolah yang berada di zonasi ini melalui jalur lain. Jalur zonasi tidak bisa digunakan.",
                        });
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

    try {
        const {
            id_pendaftar,
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            jurusan_id,
            jarak,
            nisn,
        } = req.body;

        let id_pendaftar_decode = decodeId(id_pendaftar);

         // Retrieve data from DataPendaftarModel
         const pendaftar = await DataPendaftars.findOne({
            where: {
                id: id_pendaftar_decode,
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

        const newPerangkinganData = {
            id_pendaftar: id_pendaftar_decode,
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
            jarak,
            nilai_raport: pendaftar.nilai_raport_rata,
            nilai_prestasi: pendaftar.nilai_prestasi,
            nilai_akhir,
            is_tidak_sekolah: pendaftar.is_tidak_sekolah,
            is_anak_panti: pendaftar.is_anak_panti,
            is_anak_keluarga_tidak_mampu: pendaftar.is_anak_keluarga_tidak_mampu,
            is_anak_guru_jateng: pendaftar.is_anak_guru_jateng,
            is_pip: pendaftar.is_pip,
            created_by: id_pendaftar_decode,
            created_by_ip: req.ip,
        };

        const newPerangkingan = await DataPerangkingans.create(newPerangkinganData);

        const datas = {
            ...newPerangkinganData,
            id_pendaftar_: id_pendaftar, // Menambahkan ID ke dalam data yang dikembalikan
            id_perangkingan_: encodeId(newPerangkingan.id), // Menambahkan ID ke dalam data yang dikembalikan

           
        }
        delete datas.id_pendaftar; 

        res.status(201).json({
            status: 1,
            message: 'Daftar berhasil dibuat',
            data: datas
        });
    } catch (error) {
        console.error('Error daftar:', error);
        res.status(500).json({
            status: 0,
            message: error.message || 'Terjadi kesalahan saat proses daftar'
        });
    }
}

// Function to handle POST request
export const cetakBuktiPerangkingan = async (req, res) => {

    try {
        const {
            id_pendaftar,
            id_perangkingan,
            nisn
        } = req.body;

        let id_pendaftar_decode = decodeId(id_pendaftar);
        let id_perangkingan_decode = decodeId(id_perangkingan);

         // Retrieve data from DataPendaftarModel
         const pendaftar = await DataPendaftars.findOne({
            where: {
                id: id_pendaftar_decode,
                is_delete: 0
            },
            include: [
                {
                    model: StatusDomisilis,
                    as: 'status_domisili',
                    attributes: ['id','nama']
                },
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

        if (!pendaftar) {
            return res.status(200).json({ status: 0, message: 'Data tidak ditemukan' });
        }

         // Retrieve data from DataPendaftarModel
         const perangkingan = await DataPerangkingans.findOne({
            where: {
                id: id_perangkingan_decode,
                is_delete: 0
            }
        });

        if (!perangkingan) {
            return res.status(200).json({ status: 0, message: 'Data tidak ditemukan' });
        }

        // Convert Sequelize model instance to a plain object
        const perangkinganData = perangkingan.toJSON();

    
        const sekolah_tujuan = {
            npsn : '12345678',
            nama : 'SMA / SMK Dummy'
        }

        // Add `sekolah_tujuan` to the plain object
        perangkinganData.sekolah_tujuan = sekolah_tujuan;

        const datas = {
            pendaftar: pendaftar,
            perangkingan: perangkinganData,
            id_pendaftar_: id_pendaftar, // Menambahkan ID ke dalam data yang dikembalikan
            id_perangkingan_: id_perangkingan, // Menambahkan ID ke dalam data yang dikembalikan
        };
        delete pendaftar.id; 
        delete perangkingan.id; 

        res.status(200).json({
            status: 1,
            message: 'Data ditemukan',
            data: datas
        });
    } catch (error) {
        console.error('Error daftar:', error);
        res.status(500).json({
            status: 0,
            message: error.message || 'Terjadi kesalahan saat mengambil data'
        });
    }
}

// Function to handle DELETE request
export const daftarUlangPerangkingan = async (req, res) => {
    try {
        const { id_perangkingan } = req.body;

        // Decode the ID
        const id_perangkingan_decode = decodeId(id_perangkingan);

        // Find the record to be updated
        const perangkingan = await DataPerangkingans.findOne({
            where: {
                id: id_perangkingan_decode,
                is_delete: 0
            }
        });

        if (!perangkingan) {
            return res.status(200).json({ status: 0, message: 'Data tidak ditemukan' });
        }

        // Update the record to set is_delete to 1
        await DataPerangkingans.update(
            { 
                is_daftar_ulang: 1,
                daftar_ulang_at: new Date(),
             },
            { where: { id: id_perangkingan_decode } }
        );

        res.status(200).json({
            status: 1,
            message: 'Data berhasil diupdate'
        });
    } catch (error) {
        console.error('Error hapus:', error);
        res.status(500).json({
            status: 0,
            message: error.message || 'Terjadi kesalahan saat update data'
        });
    }
}

// Function to handle DELETE request
export const softDeletePerangkingan = async (req, res) => {
    try {
        const { id_perangkingan } = req.body;

        // Decode the ID
        const id_perangkingan_decode = decodeId(id_perangkingan);

        // Find the record to be updated
        const perangkingan = await DataPerangkingans.findOne({
            where: {
                id: id_perangkingan_decode,
                is_delete: 0
            }
        });

        if (!perangkingan) {
            return res.status(200).json({ status: 0, message: 'Data tidak ditemukan' });
        }

        // Update the record to set is_delete to 1
        await DataPerangkingans.update(
            { 
                is_delete: 1,
                deleted_at: new Date(),
                deleted_by: perangkingan.id_pendaftar
             },
            { where: { id: id_perangkingan_decode } }
        );

        res.status(200).json({
            status: 1,
            message: 'Data berhasil dihapus'
        });
    } catch (error) {
        console.error('Error hapus:', error);
        res.status(500).json({
            status: 0,
            message: error.message || 'Terjadi kesalahan saat menghapus data'
        });
    }
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            const uploadPath = `upload/berkas/${req.params.nisn}`;
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
const getUploadFields = async (id_jalur_pendaftaran) => {
    const data_file_tambahan = await FileTambahans.findAll({
        where: {
            id_jalur_pendaftaran: id_jalur_pendaftaran,
            is_active: 1
        }
    });

    return data_file_tambahan.map(file => ({
        name: file.nama_file,
        maxCount: 1
    }));
};

// Function to handle POST request
export const uploadFileTambahan = async (req, res) => {
    try {

        const {
            id_jalur_pendaftaran,
            id_pendaftar,
        } = req.params;



        const decode_id_pendaftar =  decodeId(id_pendaftar)
        // Get upload fields dynamically
        const uploadFields = await getUploadFields(id_jalur_pendaftaran);
        const uploadFiles = upload.fields(uploadFields);

        // Handle file uploads
        uploadFiles(req, res, async (err) => {
            if (err) {
                return res.status(500).json({ status: 0, message: 'File upload error', error: err.message });
            }

            try {

                // Collect uploaded file data
                const uploadedFiles = [];
                if (req.files) {
                    for (const [fieldname, files] of Object.entries(req.files)) {
                        files.forEach(file => {
                            uploadedFiles.push({
                                fieldname: fieldname,
                                originalname: file.originalname,
                                filename: file.filename
                            });
                        });
                    }
                }
                
               // Find pendaftar
               const pendaftar = await DataPendaftars.findOne({
                where: {
                    id: decode_id_pendaftar,
                }
                });

                if (!pendaftar) {
                    return res.status(404).json({ status: 0, message: decode_id_pendaftar + ' Pendaftar tidak ditemukan' });
                }

                const updateData = {
                    file_tambahan: uploadedFiles,
                };

                // Update pendaftar
                const updated = await pendaftar.update(updateData);

                if (!updated) {
                    return res.status(404).json({ status: 0, message: decode_id_pendaftar + ' Gagal Update' });
                }
                
                // Mengirim respons berhasil
                res.status(200).json({
                    status: 1,
                    message: 'File tambahan berhasil diperbarui',
                    data: updateData,
                    
             
                });
            } catch (error) {
                console.error('Error updating pendaftar:', error);
                res.status(500).json({
                    status: 0,
                    message: error.message || 'Terjadi kesalahan saat proses pembaruan pendaftar'
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


