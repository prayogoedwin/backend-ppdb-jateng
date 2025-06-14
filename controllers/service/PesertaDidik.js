// controllers/PesertaDidik.js
import DataPesertaDidiks from '../../models/service/DataPesertaDidikModel.js';
import { getIntegratorSatuan, parseKodeWilayah, checkMaintenancePublicStatus } from '../../helpers/HelpHelper.js';
import DataPesertaDidiksAts from '../../models/service/DataPesertaDidikAtsModel.js';
import DataPesertaDidikSmaSmks from '../../models/service/DataPesertaDidikSmaSmkModel.js';
import DataAnakKkos from '../../models/service/DataAnakKkoModel.js';
import PemadananDukcapil from '../../models/service/PemadananDukcapilModel.js';
import DataAnakPantis from '../../models/service/DataAnakPantiModel.js';
import DataAnakMiskins from '../../models/service/DataAnakMiskinModel.js';
import DataAnakGuru from '../../models/service/DataAnakGuruModel.js';
import EzAnakPondokKemenag from '../../models/service/ezAnakPondokKemenagModel.js';
import Sekolah from '../../models/master/SekolahModel.js';
import BentukPendidikan from '../../models/master/BentukPendidikanModel.js';
import WilayahVerDapodik from '../../models/master/WilayahVerDapodikModel.js';
import SekolahTujuanModel from '../../models/master/SekolahTujuanModel.js';
import DataUsers from '../../models/service/DataUsersModel.js';
import { encodeId, decodeId } from '../../middleware/EncodeDecode.js';
import { redisGet, redisSet } from '../../redis.js'; // Import the Redis functions



import axios from 'axios';
import https from 'https';

import DataPendaftars from "../../models/service/DataPendaftarModel.js";
import { Op } from 'sequelize';


// import getDataWilayah from '../service/WilayahService.js';
import { getProvinsi, getKabupatenKota, getKecamatan, getDesaKelurahan } from '../service/WilayahService.js';
import { response } from 'express';

// Service function
const getPesertaDidikByNisn = async (nisn, nik) => {
    try {
        const pesertaDidik = await DataPesertaDidiks.findOne({
            where: { 
                nisn,
                // nik, 
            },
            include: [
                {
                model: Sekolah,
                as: 'data_sekolah', // Tambahkan alias di sini
                attributes: ['npsn', 'nama', 'bentuk_pendidikan_id', 'lat', 'lng', 'kode_wilayah'],
                include: [{
                    model: BentukPendidikan,
                    as: 'bentuk_pendidikan',
                    attributes: ['id','nama']
                }]
            },
            {
                model: WilayahVerDapodik,
                as: 'data_wilayah',
                attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
            }
            ],
         
        });

        if (!pesertaDidik) {

            return false;

        }

        return pesertaDidik;
        
    } catch (error) {
        console.error(error);
        throw error;
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
                // include: [
                //     {
                //     model: Sekolah,
                //     as: 'data_sekolah', // Tambahkan alias di sini
                //     attributes: ['npsn', 'nama', 'bentuk_pendidikan_id', 'lat', 'lng', 'kode_wilayah'],
                //     include: [{
                //         model: BentukPendidikan,
                //         as: 'bentuk_pendidikan',
                //         attributes: ['id','nama']
                //     }]
                // },
                // {
                //     model: WilayahVerDapodik,
                //     as: 'data_wilayah',
                //     attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
                // }
                //],
            
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

const getPesertaKkoByNisn = async (nisn, nik) => {
    try {

        const redis_key = `DataKkoAll`;
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
               attributes: ['nisn', 'nik' ,'nama'],  
                where: { 
                    nisn,
                    nik, 
                },
                // include: [
                //     {
                //     model: Sekolah,
                //     as: 'data_sekolah', // Tambahkan alias di sini
                //     attributes: ['npsn', 'nama', 'bentuk_pendidikan_id', 'lat', 'lng', 'kode_wilayah'],
                //     include: [{
                //         model: BentukPendidikan,
                //         as: 'bentuk_pendidikan',
                //         attributes: ['id','nama']
                //     }]
                // },
                // {
                //     model: WilayahVerDapodik,
                //     as: 'data_wilayah',
                //     attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
                // }
                //],
            
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
export const getPesertaDidikSmaSmkAll = async (req, res) => {
    try {

        // const redis_key = `DataAllAnakSMASMK`;
        // const cached = await redisGet(redis_key);

        // const pesertaDidikAll = await DataPesertaDidikSmaSmks.findAll({
        //     attributes: ['nisn', 'nik' ,'nama', 'nama_sekolah']        
        // });

        // // Simpan semua data ke cache dengan expiry time
        // await redisSet(redis_key, JSON.stringify(pesertaDidikAll), 31536000);
        // console.log(`[DB] Data disimpan ke DB: ${redis_key}`);
        return res.status(200).json({
            status: 1,
            message: 'Berhasil generate cache siswa sma smk dengan key: DataAllAnakSMASMK'
        });
        
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const getKkoAll = async (req, res) => {
    try {

        const redis_key = `DataKkoAll`;
        // const cached = await redisGet(redis_key);

        const pesertaDidikAll = await DataAnakKkos.findAll({
            attributes: ['nisn', 'nik' ,'nama_calon_murid_baru']        
        });

        // Simpan semua data ke cache dengan expiry time
        await redisSet(redis_key, JSON.stringify(pesertaDidikAll), 31536000);
        console.log(`[DB] Data disimpan ke DB: ${redis_key}`);
        return res.status(200).json({
            status: 0,
            message: 'Berhasil generate cache siswa kko dengan key: DataKkoAll'
        });
        
    } catch (error) {
        console.error(error);
        throw error;
    }
};

const getPesertaDidikSmaSmkByNisnTanpaZRedis = async (nisn, nik) => {
    try {

            

            const pesertaDidikSmaSmk = await DataPesertaDidikSmaSmks.findOne({
                attributes: ['nisn', 'nik' ,'nama', 'nama_sekolah'],
                where: { 
                    nisn,
                    nik, 
                },
                // include: [
                //     {
                //     model: Sekolah,
                //     as: 'data_sekolah', // Tambahkan alias di sini
                //     attributes: ['npsn', 'nama', 'bentuk_pendidikan_id', 'lat', 'lng', 'kode_wilayah'],
                //     include: [{
                //         model: BentukPendidikan,
                //         as: 'bentuk_pendidikan',
                //         attributes: ['id','nama']
                //     }]
                // },
                // {
                //     model: WilayahVerDapodik,
                //     as: 'data_wilayah',
                //     attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
                // }
                //],
            
            });

            if (!pesertaDidikSmaSmk) {

                return false;

            }
            return pesertaDidikSmaSmk;
    

    
        
    } catch (error) {
        console.error(error);
        throw error;
    }
};

// Service function
const getPesertaDidikByNisnTok = async (nisn) => {
    try {
        const pesertaDidik = await DataPesertaDidiks.findOne({
            where: { 
                nisn
            },
            include: [
                {
                model: Sekolah,
                as: 'data_sekolah', // Tambahkan alias di sini
                attributes: ['npsn', 'nama', 'bentuk_pendidikan_id', 'lat', 'lng', 'kode_wilayah'],
                include: [{
                    model: BentukPendidikan,
                    as: 'bentuk_pendidikan',
                    attributes: ['id','nama']
                }]
            },
            {
                model: WilayahVerDapodik,
                as: 'data_wilayah',
                attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
            }
            ],
         
        });

        if (!pesertaDidik) {

            return false;

        }

        return pesertaDidik;
        
    } catch (error) {
        console.error(error);
        throw error;
    }
};

// Service function
const getPesertaDidikByNikTok = async (nik) => {
    try {
        const pesertaDidik = await DataPesertaDidiks.findOne({
            where: { 
                nik
            },
            include: [
                {
                model: Sekolah,
                as: 'data_sekolah', // Tambahkan alias di sini
                attributes: ['npsn', 'nama', 'bentuk_pendidikan_id', 'lat', 'lng', 'kode_wilayah'],
                include: [{
                    model: BentukPendidikan,
                    as: 'bentuk_pendidikan',
                    attributes: ['id','nama']
                }]
            },
            {
                model: WilayahVerDapodik,
                as: 'data_wilayah',
                attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
            }
            ],
         
        });

        if (!pesertaDidik) {

            return false;

        }

        return pesertaDidik;
        
    } catch (error) {
        console.error(error);
        throw error;
    }
};


const getPesertaDidikAtsByNisn = async (nisn, nik) => {
    try {
        const pesertaDidik = await DataPesertaDidiksAts.findOne({
            where: { 
                nisn,
                nik, 
            },
            include: [
                {
                model: Sekolah,
                as: 'data_sekolah', // Tambahkan alias di sini
                attributes: ['npsn', 'nama', 'bentuk_pendidikan_id', 'lat', 'lng'],
                include: [{
                    model: BentukPendidikan,
                    as: 'bentuk_pendidikan',
                    attributes: ['id','nama']
                }]
            },
            {
                model: WilayahVerDapodik,
                as: 'data_wilayah',
                attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
            }
            ],
         
        });

        if (!pesertaDidik) {

            return false;

        }

        return pesertaDidik;
        
    } catch (error) {
        console.error(error);
        throw error;
    }
};


const getPesertaDidikAtsByNisnTok = async (nisn) => {
    try {
        const pesertaDidik = await DataPesertaDidiksAts.findOne({
            where: { 
                nisn
            },
            include: [
                {
                model: Sekolah,
                as: 'data_sekolah', // Tambahkan alias di sini
                attributes: ['npsn', 'nama', 'bentuk_pendidikan_id', 'lat', 'lng'],
                include: [{
                    model: BentukPendidikan,
                    as: 'bentuk_pendidikan',
                    attributes: ['id','nama']
                }]
            },
            {
                model: WilayahVerDapodik,
                as: 'data_wilayah',
                attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
            }
            ],
         
        });

        if (!pesertaDidik) {

            return false;

        }

        return pesertaDidik;
        
    } catch (error) {
        console.error(error);
        throw error;
    }
};

const getPesertaDidikAtsByNikTok = async (nik) => {
    try {
        const pesertaDidik = await DataPesertaDidiksAts.findOne({
            where: { 
                nik
            },
            include: [
                {
                model: Sekolah,
                as: 'data_sekolah', // Tambahkan alias di sini
                attributes: ['npsn', 'nama', 'bentuk_pendidikan_id', 'lat', 'lng'],
                include: [{
                    model: BentukPendidikan,
                    as: 'bentuk_pendidikan',
                    attributes: ['id','nama']
                }]
            },
            {
                model: WilayahVerDapodik,
                as: 'data_wilayah',
                attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
            }
            ],
         
        });

        if (!pesertaDidik) {

            return false;

        }

        return pesertaDidik;
        
    } catch (error) {
        console.error(error);
        throw error;
    }
};

const getPesertaDidikByNisnTgkNamaIbu = async (nisn, nik, tgl_lahir, nama_ibu) => {
    try {
        const pesertaDidik = await DataPesertaDidiks.findOne({

            where: {
                        nisn: nisn,
                        nik: nik,
                        tanggal_lahir: tgl_lahir,
                        // nama_ibu_kandung: nama_ibu,
                        nama_ibu_kandung: {
                            [Op.iLike]: nama_ibu
                        },
                        // is_delete: 0
            },
            // attributes: ['nik', 'nisn'],
            // attributes: {
            //     exclude: ['nisn', 'nik', 'tanggal_lahir', 'nama_ibu_kandung']
            // },
            include: [
                {
                model: Sekolah,
                as: 'data_sekolah', // Tambahkan alias di sini
                attributes: ['npsn', 'nama', 'bentuk_pendidikan_id'],
                include: [{
                    model: BentukPendidikan,
                    as: 'bentuk_pendidikan',
                    attributes: ['id','nama']
                }]
            },
            {
                model: WilayahVerDapodik,
                as: 'data_wilayah',
                attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
            }
            ],
         
        });

        if (!pesertaDidik) {

            // res.status(200).json({
            //     status: 0,
            //     message: 'NISN tidak ditemukan',
            // });
            return false;

        }

        return pesertaDidik;

        // if (!pesertaDidik) {
        //     pesertaDidik = await DataPesertaDidiks.findOne({
        //         where: { nik: nik },
        //         include: [
        //             {
        //                 model: Sekolah,
        //                 as: 'data_sekolah', // Tambahkan alias di sini
        //                 attributes: ['npsn', 'nama', 'bentuk_pendidikan_id'],
        //                 include: [{
        //                     model: BentukPendidikan,
        //                     as: 'bentuk_pendidikan',
        //                     attributes: ['id','nama']
        //                 }]
        //             },
        //             {
        //                 model: WilayahVerDapodik,
        //                 as: 'data_wilayah',
        //                 attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
        //             }
        //         ],
        //     });
        // }

      
        
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const getPesertaDidikByNisnNamaNamaNamaIbuHandler = async (req, res) => {
    const { nisn, nik, tgl_lahir, nama_ibu } = req.body;
    try {
        if (!nisn) {
            return res.status(400).json({
                status: 0,
                message: 'NISN wajib diisi',
            });
        }

        if (!nik) {
            return res.status(400).json({
                status: 0,
                message: 'NIK wajib diisi',
            });
        }

        if (!tgl_lahir) {
            return res.status(400).json({
                status: 0,
                message: 'Tanggal Lahir wajib di isi',
            });
        }

        if (!nama_ibu) {
            return res.status(400).json({
                status: 0,
                message: 'Nama ibu wajib di isi',
            });
        }

        // const cekPendaftar = await DataPendaftars.findOne({
        //     where: {
        //         nisn: nisn,
        //         tanggal_lahir: tgl_lahir,
        //         nama_ibu_kandung: nama_ibu,
        //         // nama_ibu_kandung: {
        //         //     [Op.ilike]: nama_ibu
        //         // },
        //         is_delete: 0
        //     },
        // });

        // if (cekPendaftar) {
        //     return res.status(200).json({
        //         status: 2,
        //         message: 'NISN Sudah Terdaftar Sebelumnya'
        //     });
        // }

        const pesertaDidik = await getPesertaDidikByNisnTgkNamaIbu(nisn, nik, tgl_lahir, nama_ibu);

        if (!pesertaDidik) {
            return res.status(200).json({
                status: 0,
                message: 'Peserta Didik tidak ditemukan'
            });
        }

        // Update kolom no_pkh menjadi 1
        await DataPesertaDidiks.update(
            { 
                is_checked: 1, // Data yang akan diupdate
                checked_at: new Date() // Menambahkan timestamp saat ini
            },
            {
                where: {
                    nisn: nisn,
                    nik: nik,
                    tanggal_lahir: tgl_lahir,
                    nama_ibu_kandung: {
                        [Op.iLike]: nama_ibu
                    }
                }
            }
        );

        // const dataKec = await getKecamatan(pesertaDidik.data_wilayah.mst_kode_wilayah);
        // const dataKabKota = await getKabupatenKota(dataKec.data_wilayah.mst_kode_wilayah);

        let dataKec = {};
        let dataKabKota = {};
        let dataProvinsi = {};

        if (pesertaDidik.data_wilayah) {
            dataKec = await getKecamatan(pesertaDidik.data_wilayah.mst_kode_wilayah);
        }

        if (dataKec.mst_kode_wilayah) {
            dataKabKota = await getKabupatenKota(dataKec.mst_kode_wilayah);
        }

        if (dataKabKota.mst_kode_wilayah) {
            dataProvinsi = await getProvinsi(dataKabKota.mst_kode_wilayah);
        }
        

        res.status(200).json({
            status: 1,
            message: 'Data berhasil ditemukan',
            // ss: dataKec,
            data: {
                ...pesertaDidik.toJSON(),
                data_wilayah_kec: dataKec, // Masukkan data wilayah ke dalam respons
                data_wilayah_kabkota: dataKabKota, // Masukkan data wilayah ke dalam respons
                data_wilayah_provinsi: dataProvinsi // Masukkan data wilayah ke dalam respons
            }
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: 0,
            message: err.message || 'Terjadi kesalahan saat mengambil data'
        });
    }
};

function toPlainObject(data) {
    try {
        return JSON.parse(JSON.stringify(data));
    } catch (err) {
        return {};
    }
}

export const getPesertaDidikByNisnHandlerTes = async (req, res) => {
    try {
        // Fungsi untuk menunda selama 30 detik
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        console.log("Menunggu 30 detik sebelum memberikan respons...");
        await delay(30000); // 30.000 ms = 30 detik
        
        // Setelah 30 detik, kirim respons
        res.status(200).json({
            status: 1,
            message: "Data peserta didik",
            data: null // Anda bisa mengganti dengan data yang sesuai
        });
    } catch (error) {
        console.error("Terjadi kesalahan:", error);
        res.status(500).json({
            status: 0,
            message: "Terjadi kesalahan server",
            error: error.message
        });
    }
};

export const getPesertaDidikByNisnHandler = async (req, res) => {
    const {nisn,nik} = req.body;
    try {

        const apiKey = 'maintenis_publik';
        const maintenanceData = await checkMaintenancePublicStatus(apiKey);

        if(maintenanceData == 1){

            return res.status(200).json({
                status: 2,
                message: 'Saat ini sistem sedang dalam masa perbaikan : ',
                data: 1
            });

        }


        if (!nisn) {
            return res.status(400).json({
                status: 0,
                message: 'NISN wajib diisi',
            });
        }

        if (!nik) {
            return res.status(400).json({
                status: 0,
                message: 'NIK wajib diisi',
            });
        }

        const cekPendaftar = await DataPendaftars.findOne({
            where: {
                nisn: nisn,
                nik: nik,
                is_delete: 0
            },
            attributes: ['id', 'kode_verifikasi', 'nisn', 'is_verified'],
        });

        // console.log("Request body:", req.body);

        // if (cekPendaftar.is_verified == 2) {
        //     return res.status(200).json({
        //         status: 2,
        //         message: 'NISN Sudah Terdaftar Sebelumnya',
        //         data: cekPendaftar.kode_verifikasi
        //     });
        // }


        if (cekPendaftar) {

            const baseUrlDefault = null; // Ganti dengan URL dasar yang diinginkan

            
            if(cekPendaftar.is_verified == 2){

                      //ini revisi biasa

                const pendaftarDetail = await DataPendaftars.findOne({
                   
                    attributes: {
                        exclude: [
                            'created_at', 'created_by', 'updated_at', 'updated_by', 
                            'activated_at', 'activated_by', 'is_active', 'verified_at', 
                            'verified_by', 'is_verified', 'deleted_at', 'deleted_by', 
                            'is_delete', 'saved_at', 'saved_by', 'is_saved', 'no_urut', 
                            'is_diterima', 'password_', 'access_token', 'access_token_refresh',
                            'verifikasikan_disdukcapil', 'is_verified_disdukcapil',
                            'disdukcapil_by', 'disdukcapil_at', 'otp_expiration', 'opened_by'
                        ]
                    },

                    where: {
                        id: cekPendaftar.id
                    },
                    include: [
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kec',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kot',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_prov',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: DataUsers,
                            as: 'diverifikasi_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_verifikator',
                                    attributes: ['id', 'nama']
                                }
                            ],
                        },
                        {
                            model: DataUsers,
                            as: 'sedang_diproses_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_admin',
                                    attributes: ['id', 'nama']
                                }
                            ]
                        },
                    ]
                });

                const baseUrl = `${process.env.BASE_URL}download/${pendaftarDetail.nisn}/`; // Ganti dengan URL dasar yang diinginkan 
  
                const data = {  
                    id_: encodeId(pendaftarDetail.id),    
                    ...pendaftarDetail.toJSON(), // Convert Sequelize instance to plain object  
                    data_sekolah: pendaftarDetail.data_sekolah || { // Tambahkan struktur data_sekolah
                        npsn: null,
                        nama: null,
                        bentuk_pendidikan_id: null,
                        bentuk_pendidikan: {
                            id: null,
                            nama: null
                        }
                    }
                };  
                delete data.id; // Remove original ID from the response  
      
                // Custom value for dok_piagam and dok_kk  
                // Custom value for dok_piagam and dok_kk  
                if (data.dok_kk) {  
                    data.dok_kk = baseUrl + data.dok_kk;  
                }else{
                    data.dok_kk = baseUrlDefault; 
                }
                if (data.dok_pakta_integritas) {  
                    data.dok_pakta_integritas = baseUrl + data.dok_pakta_integritas;  
                }else{
                    data.dok_pakta_integritas = baseUrlDefault; 
                } 

                if (data.dok_suket_nilai_raport) {  
                    data.dok_suket_nilai_raport = baseUrl + data.dok_suket_nilai_raport;  
                }else{
                    data.dok_suket_nilai_raport = baseUrlDefault; 
                }

                if (data.dok_piagam) {  
                    data.dok_piagam = baseUrl + data.dok_piagam;  
                }else{
                    data.dok_piagam = baseUrlDefault; 
                }  

                if (data.dok_pto) {  
                    data.dok_pto = baseUrl + data.dok_pto;  
                }else{
                    data.dok_pto = baseUrlDefault; 
                }
      
      
                // Proses file tambahan dengan downloadable URL  
                if (data.file_tambahan && Array.isArray(data.file_tambahan)) {  
                    data.file_tambahan = data.file_tambahan.map(file => {  
                        return {  
                            ...file,  
                            downloadable: baseUrl + file.filename // Tambahkan URL downloadable  
                        };  
                    });  
                }  
        
                return res.status(200).json({
                    status: 3,
                    message: 'Anda diperbolehkan untuk revisi data sementara',
                    data: data
                });

            };

            if(cekPendaftar.is_verified == 99){

                //ini FM bisa buka semua
                const pendaftarDetail = await DataPendaftars.findOne({
                   
                    attributes: {
                        exclude: [
                            'created_at', 'created_by', 'updated_at', 'updated_by', 
                            'activated_at', 'activated_by', 'is_active', 'verified_at', 
                            'verified_by', 'is_verified', 'deleted_at', 'deleted_by', 
                            'is_delete', 'saved_at', 'saved_by', 'is_saved', 'no_urut', 
                            'is_diterima', 'password_', 'access_token', 'access_token_refresh',
                            'verifikasikan_disdukcapil', 'is_verified_disdukcapil',
                            'disdukcapil_by', 'disdukcapil_at', 'otp_expiration', 'opened_by'
                        ]
                    },

                    where: {
                        id: cekPendaftar.id
                    },
                    include: [
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kec',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kot',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_prov',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: DataUsers,
                            as: 'diverifikasi_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_verifikator',
                                    attributes: ['id', 'nama']
                                }
                            ],
                        },
                        {
                            model: DataUsers,
                            as: 'sedang_diproses_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_admin',
                                    attributes: ['id', 'nama']
                                }
                            ]
                        },
                    ]
                });

                const baseUrl = `${process.env.BASE_URL}download/${pendaftarDetail.nisn}/`; // Ganti dengan URL dasar yang diinginkan 
  
                const data = {  
                    id_: encodeId(pendaftarDetail.id),    
                    ...pendaftarDetail.toJSON(), // Convert Sequelize instance to plain object  
                    data_sekolah: pendaftarDetail.data_sekolah || { // Tambahkan struktur data_sekolah
                        npsn: null,
                        nama: null,
                        bentuk_pendidikan_id: null,
                        bentuk_pendidikan: {
                            id: null,
                            nama: null
                        }
                    }
                };  
                delete data.id; // Remove original ID from the response  
      
                // Custom value for dok_piagam and dok_kk  
                 // Custom value for dok_piagam and dok_kk  
                if (data.dok_kk) {  
                    data.dok_kk = baseUrl + data.dok_kk;  
                }else{
                    data.dok_kk = baseUrlDefault; 
                }
                if (data.dok_pakta_integritas) {  
                    data.dok_pakta_integritas = baseUrl + data.dok_pakta_integritas;  
                }else{
                    data.dok_pakta_integritas = baseUrlDefault; 
                } 

                if (data.dok_suket_nilai_raport) {  
                    data.dok_suket_nilai_raport = baseUrl + data.dok_suket_nilai_raport;  
                }else{
                    data.dok_suket_nilai_raport = baseUrlDefault; 
                }

                if (data.dok_piagam) {  
                    data.dok_piagam = baseUrl + data.dok_piagam;  
                }else{
                    data.dok_piagam = baseUrlDefault; 
                }  

                if (data.dok_pto) {  
                    data.dok_pto = baseUrl + data.dok_pto;  
                }else{
                    data.dok_pto = baseUrlDefault; 
                }
      
      
                // Proses file tambahan dengan downloadable URL  
                if (data.file_tambahan && Array.isArray(data.file_tambahan)) {  
                    data.file_tambahan = data.file_tambahan.map(file => {  
                        return {  
                            ...file,  
                            downloadable: baseUrl + file.filename // Tambahkan URL downloadable  
                        };  
                    });  
                }  
        
                return res.status(200).json({
                    status: 99,
                    message: 'Anda diperbolehkan untuk mengubah data kebutuhan force majeure',
                    data: data
                });

            };

            if(cekPendaftar.is_verified == 98){

                //ini FM bisa buka semua
                const pendaftarDetail = await DataPendaftars.findOne({
                   
                    attributes: {
                        exclude: [
                            'created_at', 'created_by', 'updated_at', 'updated_by', 
                            'activated_at', 'activated_by', 'is_active', 'verified_at', 
                            'verified_by', 'is_verified', 'deleted_at', 'deleted_by', 
                            'is_delete', 'saved_at', 'saved_by', 'is_saved', 'no_urut', 
                            'is_diterima', 'password_', 'access_token', 'access_token_refresh',
                            'verifikasikan_disdukcapil', 'is_verified_disdukcapil',
                            'disdukcapil_by', 'disdukcapil_at', 'otp_expiration', 'opened_by'
                        ]
                    },

                    where: {
                        id: cekPendaftar.id
                    },
                    include: [
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kec',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kot',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_prov',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: DataUsers,
                            as: 'diverifikasi_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_verifikator',
                                    attributes: ['id', 'nama']
                                }
                            ],
                        },
                        {
                            model: DataUsers,
                            as: 'sedang_diproses_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_admin',
                                    attributes: ['id', 'nama']
                                }
                            ]
                        },
                    ]
                });

                const baseUrl = `${process.env.BASE_URL}download/${pendaftarDetail.nisn}/`; // Ganti dengan URL dasar yang diinginkan 
  
                const data = {  
                    id_: encodeId(pendaftarDetail.id),    
                    ...pendaftarDetail.toJSON(), // Convert Sequelize instance to plain object  
                    data_sekolah: pendaftarDetail.data_sekolah || { // Tambahkan struktur data_sekolah
                        npsn: null,
                        nama: null,
                        bentuk_pendidikan_id: null,
                        bentuk_pendidikan: {
                            id: null,
                            nama: null
                        }
                    }
                };  
                delete data.id; // Remove original ID from the response  
      
                // Custom value for dok_piagam and dok_kk  
                if (data.dok_kk) {  
                    data.dok_kk = baseUrl + data.dok_kk;  
                }else{
                    data.dok_kk = baseUrlDefault; 
                }
                if (data.dok_pakta_integritas) {  
                    data.dok_pakta_integritas = baseUrl + data.dok_pakta_integritas;  
                }else{
                    data.dok_pakta_integritas = baseUrlDefault; 
                } 

                if (data.dok_suket_nilai_raport) {  
                    data.dok_suket_nilai_raport = baseUrl + data.dok_suket_nilai_raport;  
                }else{
                    data.dok_suket_nilai_raport = baseUrlDefault; 
                }

                if (data.dok_piagam) {  
                    data.dok_piagam = baseUrl + data.dok_piagam;  
                }else{
                    data.dok_piagam = baseUrlDefault; 
                }  

                if (data.dok_pto) {  
                    data.dok_pto = baseUrl + data.dok_pto;  
                }else{
                    data.dok_pto = baseUrlDefault; 
                }
      
                // Proses file tambahan dengan downloadable URL  
                if (data.file_tambahan && Array.isArray(data.file_tambahan)) {  
                    data.file_tambahan = data.file_tambahan.map(file => {  
                        return {  
                            ...file,  
                            downloadable: baseUrl + file.filename // Tambahkan URL downloadable  
                        };  
                    });  
                }  
        
                return res.status(200).json({
                    status: 98,
                    message: 'Anda diperbolehkan untuk mengubah data alamat dan wilayah',
                    data: data
                });

            };

            if(cekPendaftar.is_verified == 97){

                //ini FM bisa buka semua
                const pendaftarDetail = await DataPendaftars.findOne({
                   
                    attributes: {
                        exclude: [
                            'created_at', 'created_by', 'updated_at', 'updated_by', 
                            'activated_at', 'activated_by', 'is_active', 'verified_at', 
                            'verified_by', 'is_verified', 'deleted_at', 'deleted_by', 
                            'is_delete', 'saved_at', 'saved_by', 'is_saved', 'no_urut', 
                            'is_diterima', 'password_', 'access_token', 'access_token_refresh',
                            'verifikasikan_disdukcapil', 'is_verified_disdukcapil',
                            'disdukcapil_by', 'disdukcapil_at', 'otp_expiration', 'opened_by'
                        ]
                    },

                    where: {
                        id: cekPendaftar.id
                    },
                    include: [
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kec',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kot',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_prov',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: DataUsers,
                            as: 'diverifikasi_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_verifikator',
                                    attributes: ['id', 'nama']
                                }
                            ],
                        },
                        {
                            model: DataUsers,
                            as: 'sedang_diproses_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_admin',
                                    attributes: ['id', 'nama']
                                }
                            ]
                        },
                    ]
                });

                const baseUrl = `${process.env.BASE_URL}download/${pendaftarDetail.nisn}/`; // Ganti dengan URL dasar yang diinginkan 
  
                const data = {  
                    id_: encodeId(pendaftarDetail.id),    
                    ...pendaftarDetail.toJSON(), // Convert Sequelize instance to plain object  
                    data_sekolah: pendaftarDetail.data_sekolah || { // Tambahkan struktur data_sekolah
                        npsn: null,
                        nama: null,
                        bentuk_pendidikan_id: null,
                        bentuk_pendidikan: {
                            id: null,
                            nama: null
                        }
                    }
                };  
                delete data.id; // Remove original ID from the response  
      
                // Custom value for dok_piagam and dok_kk  
                 // Custom value for dok_piagam and dok_kk  
                 if (data.dok_kk) {  
                    data.dok_kk = baseUrl + data.dok_kk;  
                }else{
                    data.dok_kk = baseUrlDefault; 
                }
                if (data.dok_pakta_integritas) {  
                    data.dok_pakta_integritas = baseUrl + data.dok_pakta_integritas;  
                }else{
                    data.dok_pakta_integritas = baseUrlDefault; 
                } 

                if (data.dok_suket_nilai_raport) {  
                    data.dok_suket_nilai_raport = baseUrl + data.dok_suket_nilai_raport;  
                }else{
                    data.dok_suket_nilai_raport = baseUrlDefault; 
                }

                if (data.dok_piagam) {  
                    data.dok_piagam = baseUrl + data.dok_piagam;  
                }else{
                    data.dok_piagam = baseUrlDefault; 
                }  

                if (data.dok_pto) {  
                    data.dok_pto = baseUrl + data.dok_pto;  
                }else{
                    data.dok_pto = baseUrlDefault; 
                }
      
      
                // Proses file tambahan dengan downloadable URL  
                if (data.file_tambahan && Array.isArray(data.file_tambahan)) {  
                    data.file_tambahan = data.file_tambahan.map(file => {  
                        return {  
                            ...file,  
                            downloadable: baseUrl + file.filename // Tambahkan URL downloadable  
                        };  
                    });  
                }  
        
                return res.status(200).json({
                    status: 97,
                    message: 'Anda diperbolehkan untuk mengubah data koordinat tanpa batas wilayah karena alasan teknis',
                    data: data
                });

            };

            if(cekPendaftar.is_verified == 96){

                //ini FM bisa updare NIK
                const pendaftarDetail = await DataPendaftars.findOne({
                   
                    attributes: {
                        exclude: [
                            'created_at', 'created_by', 'updated_at', 'updated_by', 
                            'activated_at', 'activated_by', 'is_active', 'verified_at', 
                            'verified_by', 'is_verified', 'deleted_at', 'deleted_by', 
                            'is_delete', 'saved_at', 'saved_by', 'is_saved', 'no_urut', 
                            'is_diterima', 'password_', 'access_token', 'access_token_refresh',
                            'verifikasikan_disdukcapil', 'is_verified_disdukcapil',
                            'disdukcapil_by', 'disdukcapil_at', 'otp_expiration', 'opened_by'
                        ]
                    },

                    where: {
                        id: cekPendaftar.id
                    },
                    include: [
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kec',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kot',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_prov',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: DataUsers,
                            as: 'diverifikasi_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_verifikator',
                                    attributes: ['id', 'nama']
                                }
                            ],
                        },
                        {
                            model: DataUsers,
                            as: 'sedang_diproses_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_admin',
                                    attributes: ['id', 'nama']
                                }
                            ]
                        },
                    ]
                });

                const baseUrl = `${process.env.BASE_URL}download/${pendaftarDetail.nisn}/`; // Ganti dengan URL dasar yang diinginkan 
  
                const data = {  
                    id_: encodeId(pendaftarDetail.id),    
                    ...pendaftarDetail.toJSON(), // Convert Sequelize instance to plain object  
                    data_sekolah: pendaftarDetail.data_sekolah || { // Tambahkan struktur data_sekolah
                        npsn: null,
                        nama: null,
                        bentuk_pendidikan_id: null,
                        bentuk_pendidikan: {
                            id: null,
                            nama: null
                        }
                    }
                };  
                delete data.id; // Remove original ID from the response  
      
                // Custom value for dok_piagam and dok_kk  
                 // Custom value for dok_piagam and dok_kk  
                 if (data.dok_kk) {  
                    data.dok_kk = baseUrl + data.dok_kk;  
                }else{
                    data.dok_kk = baseUrlDefault; 
                }
                if (data.dok_pakta_integritas) {  
                    data.dok_pakta_integritas = baseUrl + data.dok_pakta_integritas;  
                }else{
                    data.dok_pakta_integritas = baseUrlDefault; 
                } 

                if (data.dok_suket_nilai_raport) {  
                    data.dok_suket_nilai_raport = baseUrl + data.dok_suket_nilai_raport;  
                }else{
                    data.dok_suket_nilai_raport = baseUrlDefault; 
                }

                if (data.dok_piagam) {  
                    data.dok_piagam = baseUrl + data.dok_piagam;  
                }else{
                    data.dok_piagam = baseUrlDefault; 
                }  

                if (data.dok_pto) {  
                    data.dok_pto = baseUrl + data.dok_pto;  
                }else{
                    data.dok_pto = baseUrlDefault; 
                }
      
      
                // Proses file tambahan dengan downloadable URL  
                if (data.file_tambahan && Array.isArray(data.file_tambahan)) {  
                    data.file_tambahan = data.file_tambahan.map(file => {  
                        return {  
                            ...file,  
                            downloadable: baseUrl + file.filename // Tambahkan URL downloadable  
                        };  
                    });  
                }  
        
                return res.status(200).json({
                    status: 96,
                    message: 'Anda diperbolehkan untuk mengubah data NIK, silahkan rubah dengan bertanggung jawab!',
                    data: data
                });

            };

            if(cekPendaftar.is_verified != 2 || cekPendaftar.is_verified != 99 || cekPendaftar.is_verified != 98 || cekPendaftar.is_verified != 97 || cekPendaftar.is_verified != 96){
                return res.status(200).json({
                    status: 2,
                    message: 'NISN Sudah Terdaftar Sebelumnya',
                    data: cekPendaftar
                 });
            }
        }

         
        const pesetaDidikSmaSmk = await getPesertaDidikSmaSmkByNisn(nisn, nik);
        if (pesetaDidikSmaSmk) {   
            
            return res.status(200).json({
                status: 0,
                message: 'Maaf tidak bisa pengajuan akun, nisn anda masih terdaftar di data kelas SMA/SMK'
            });

        }

        const pesetaKko = await getPesertaKkoByNisn(nisn, nik);
        if (pesetaKko) {   
            
            return res.status(200).json({
                status: 0,
                message: 'Maaf tidak bisa pengajuan akun, nisn anda sudah terdaftar di data CMB KKO, konfirmasi ke operator'
            });

        }

        


        let pesertaDidik = await getPesertaDidikByNisn(nisn, nik);
        
        if(pesertaDidik && pesertaDidik.nik != nik){

            return res.status(200).json({
                status: 0,
                message: 'Data yang diinputkan tidak sesuai'
            });

        }

        

        let is_tidak_sekolah = 0;
        if (!pesertaDidik) {

            const pesertaDidikAts = await getPesertaDidikAtsByNisn(nisn, nik);
            is_tidak_sekolah = 0;

            if(!pesertaDidikAts){

                is_tidak_sekolah = 0;
                return res.status(200).json({
                    status: 0,
                    message: 'NISN tidak ditemukan pada data peserta didik maupun data ATS'
                });
               
                
            }else{
                
                // pesertaDidik = pesertaDidikAts;
                // is_tidak_sekolah = 1;

                // pesertaDidik = {
                //     ...pesertaDidikAts,
                //     data_sekolah: {
                //       nama: 'Terdaftar Sebagai Siswa ATS',
                //       npsn: '-----'
                //     }
                // };

                pesertaDidik = {
                    ...(typeof pesertaDidikAts.toJSON === 'function'
                      ? pesertaDidikAts.toJSON()
                      : pesertaDidikAts),
                    data_sekolah: {
                      nama: 'Terdaftar Sebagai ATS | Sekolah Asal:'+ pesertaDidikAts.nama_sekolah,
                      npsn: '-----'
                    }
                  };

                is_tidak_sekolah = 1;

            }

           
        }

        let is_pondok;
        let lat_pondok;
        let lng_pondok;
        let kode_wilayah_pondok;
        let kecamatan_pondok;
        let kabupaten_pondok;
        let provinsi_pondok;
        //jika peserta didik ada di pondok ketika SMP atau sudah terdaftar di pondok oleh kemenag
        if ([56, 68, 71].includes(pesertaDidik.bentuk_pendidikan_id)) {

            const dataAnakKemenag = await EzAnakPondokKemenag.findOne({
                where: {
                    nisn: pesertaDidik.nisn
                }
            });

            if (dataAnakKemenag) {
                
                const wilayah = parseKodeWilayah(dataAnakKemenag.kode_wilayah);

                is_pondok = 1;
                lat_pondok = dataAnakKemenag.lintang_pondok?.toString() || null;
                lng_pondok = dataAnakKemenag.bujur_pondok?.toString() || null;
                kode_wilayah_pondok = dataAnakKemenag.kode_wilayah?.toString() || null;
                kecamatan_pondok = wilayah.kode_kecamatan?.toString() || null;
                kabupaten_pondok = wilayah.kode_kabupaten?.toString() || null;
                provinsi_pondok = wilayah.kode_provinsi?.toString() || null;


            }else{

                is_pondok = 0;
                lat_pondok = null;
                lng_pondok = null;
                kode_wilayah_pondok= null;
                kecamatan_pondok = null;
                kabupaten_pondok = null;
                provinsi_pondok = null;

            }

            // lat_pondok = pesertaDidik.data_sekolah?.lat?.toString() || null;
            // lng_pondok = pesertaDidik.data_sekolah?.lng?.toString() || null;
            // kode_wilayah_pondok = pesertaDidik.data_sekolah?.kode_wilayah?.toString() || null;
    
          
            // const sekolah_id = pesertaDidik.sekolah_id;
            // const cariPondok = await Sekolah.findOne({
            //     attributes: ['id', 'npsn', 'nama', 'bentuk_pendidikan_id', 'lat', 'lng'],
            //     where: { 
            //         id:sekolah_id
            //     },
            // });

            // if (cariPondok) {
            //     pesertaDidik.lat = pesertaDidik.data_sekolah.lat
            //     pesertaDidik.lng = pesertaDidik.data_sekolah.lng;
            //     is_pondok = 1;
            // }else{
            //     is_pondok = 0;
            // }

            // console.log( pesertaDidik.lng_lainnya); 

        }else{

            is_pondok = 0;
            lat_pondok = null;
            lng_pondok = null;
            kode_wilayah_pondok= null;
            kecamatan_pondok = null;
            kabupaten_pondok = null;
            provinsi_pondok = null;
    
        }

        // const dataKec = await getKecamatan(pesertaDidik.data_wilayah.mst_kode_wilayah);
        // const dataKabKota = await getKabupatenKota(dataKec.data_wilayah.mst_kode_wilayah);

        let dataKec = {};
        let dataKabKota = {};
        let dataProvinsi = {};

        if (pesertaDidik.data_wilayah) {
            dataKec = await getKecamatan(pesertaDidik.data_wilayah.mst_kode_wilayah);
        }

        if (dataKec.mst_kode_wilayah) {
            dataKabKota = await getKabupatenKota(dataKec.mst_kode_wilayah);
        }

        if (dataKabKota.mst_kode_wilayah) {
            dataProvinsi = await getProvinsi(dataKabKota.mst_kode_wilayah);
        }
        
        // Jika pesertaDidik berasal dari model Sequelize, gunakan .toJSON()
        const finalPeserta = typeof pesertaDidik.toJSON === 'function'
        ? toPlainObject(pesertaDidik.toJSON())
        : toPlainObject(pesertaDidik);

        res.status(200).json({
            status: 1,
            message: 'Data berhasil ditemukan',
            // ss: dataKec,
            data: {
                // ...pesertaDidik.toJSON(),
                // ...(typeof pesertaDidik.toJSON === 'function' ? pesertaDidik.toJSON() : pesertaDidik),
                ...finalPeserta,
                data_wilayah_kec: dataKec, // Masukkan data wilayah ke dalam respons
                data_wilayah_kot: dataKabKota, // Masukkan data wilayah ke dalam respons
                data_wilayah_prov: dataProvinsi, // Masukkan data wilayah ke dalam respons
                anak_pondok: is_pondok,
                ats:  is_tidak_sekolah,
                lat_pondok: lat_pondok,
                lng_pondok: lng_pondok,
                kode_wilayah_pondok: kode_wilayah_pondok,
                kode_kecamatan_pondok: kecamatan_pondok,
                kode_kabupaten_pondok: kabupaten_pondok,
                kode_provinsi_pondok: provinsi_pondok

            }
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: 0,
            message: err.message || 'Terjadi kesalahan saat mengambil data'
        });
    }
};

export const getPesertaDidikByNisnHandlerUntukRevisi = async (req, res) => {
    const {nisn,nik} = req.body;
    try {

        const apiKey = 'maintenis_publik';
        const maintenanceData = await checkMaintenancePublicStatus(apiKey);

        if(maintenanceData == 1){

            return res.status(200).json({
                status: 2,
                message: 'Saat ini sistem sedang dalam masa perbaikan : ',
                data: 1
            });

        }


        if (!nisn) {
            return res.status(400).json({
                status: 0,
                message: 'NISN wajib diisi',
            });
        }

        if (!nik) {
            return res.status(400).json({
                status: 0,
                message: 'NIK wajib diisi',
            });
        }

        const cekPendaftar = await DataPendaftars.findOne({
            where: {
                nisn: nisn,
                nik: nik,
                is_delete: 0
            },
            attributes: ['id', 'kode_verifikasi', 'nisn', 'is_verified'],
        });

        // console.log("Request body:", req.body);

        // if (cekPendaftar.is_verified == 2) {
        //     return res.status(200).json({
        //         status: 2,
        //         message: 'NISN Sudah Terdaftar Sebelumnya',
        //         data: cekPendaftar.kode_verifikasi
        //     });
        // }


        if (cekPendaftar) {

            const baseUrlDefault = null; // Ganti dengan URL dasar yang diinginkan

            
            if(cekPendaftar.is_verified == 2){

                      //ini revisi biasa

                const pendaftarDetail = await DataPendaftars.findOne({
                   
                    attributes: {
                        exclude: [
                            'created_at', 'created_by', 'updated_at', 'updated_by', 
                            'activated_at', 'activated_by', 'is_active', 'verified_at', 
                            'verified_by', 'is_verified', 'deleted_at', 'deleted_by', 
                            'is_delete', 'saved_at', 'saved_by', 'is_saved', 'no_urut', 
                            'is_diterima', 'password_', 'access_token', 'access_token_refresh',
                            'verifikasikan_disdukcapil', 'is_verified_disdukcapil',
                            'disdukcapil_by', 'disdukcapil_at', 'otp_expiration', 'opened_by'
                        ]
                    },

                    where: {
                        id: cekPendaftar.id
                    },
                    include: [
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kec',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kot',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_prov',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: DataUsers,
                            as: 'diverifikasi_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_verifikator',
                                    attributes: ['id', 'nama']
                                }
                            ],
                        },
                        {
                            model: DataUsers,
                            as: 'sedang_diproses_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_admin',
                                    attributes: ['id', 'nama']
                                }
                            ]
                        },
                    ]
                });

                const baseUrl = `${process.env.BASE_URL}download/${pendaftarDetail.nisn}/`; // Ganti dengan URL dasar yang diinginkan 
  
                const data = {  
                    id_: encodeId(pendaftarDetail.id),    
                    ...pendaftarDetail.toJSON(), // Convert Sequelize instance to plain object  
                    data_sekolah: pendaftarDetail.data_sekolah || { // Tambahkan struktur data_sekolah
                        npsn: null,
                        nama: null,
                        bentuk_pendidikan_id: null,
                        bentuk_pendidikan: {
                            id: null,
                            nama: null
                        }
                    }
                };  
                delete data.id; // Remove original ID from the response  
      
                // Custom value for dok_piagam and dok_kk  
                // Custom value for dok_piagam and dok_kk  
                if (data.dok_kk) {  
                    data.dok_kk = baseUrl + data.dok_kk;  
                }else{
                    data.dok_kk = baseUrlDefault; 
                }
                if (data.dok_pakta_integritas) {  
                    data.dok_pakta_integritas = baseUrl + data.dok_pakta_integritas;  
                }else{
                    data.dok_pakta_integritas = baseUrlDefault; 
                } 

                if (data.dok_suket_nilai_raport) {  
                    data.dok_suket_nilai_raport = baseUrl + data.dok_suket_nilai_raport;  
                }else{
                    data.dok_suket_nilai_raport = baseUrlDefault; 
                }

                if (data.dok_piagam) {  
                    data.dok_piagam = baseUrl + data.dok_piagam;  
                }else{
                    data.dok_piagam = baseUrlDefault; 
                }  

                if (data.dok_pto) {  
                    data.dok_pto = baseUrl + data.dok_pto;  
                }else{
                    data.dok_pto = baseUrlDefault; 
                }
      
      
                // Proses file tambahan dengan downloadable URL  
                if (data.file_tambahan && Array.isArray(data.file_tambahan)) {  
                    data.file_tambahan = data.file_tambahan.map(file => {  
                        return {  
                            ...file,  
                            downloadable: baseUrl + file.filename // Tambahkan URL downloadable  
                        };  
                    });  
                }  
        
                return res.status(200).json({
                    status: 3,
                    message: 'Anda diperbolehkan untuk revisi data sementara',
                    data: data
                });

            };

            if(cekPendaftar.is_verified == 99){

                //ini FM bisa buka semua
                const pendaftarDetail = await DataPendaftars.findOne({
                   
                    attributes: {
                        exclude: [
                            'created_at', 'created_by', 'updated_at', 'updated_by', 
                            'activated_at', 'activated_by', 'is_active', 'verified_at', 
                            'verified_by', 'is_verified', 'deleted_at', 'deleted_by', 
                            'is_delete', 'saved_at', 'saved_by', 'is_saved', 'no_urut', 
                            'is_diterima', 'password_', 'access_token', 'access_token_refresh',
                            'verifikasikan_disdukcapil', 'is_verified_disdukcapil',
                            'disdukcapil_by', 'disdukcapil_at', 'otp_expiration', 'opened_by'
                        ]
                    },

                    where: {
                        id: cekPendaftar.id
                    },
                    include: [
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kec',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kot',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_prov',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: DataUsers,
                            as: 'diverifikasi_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_verifikator',
                                    attributes: ['id', 'nama']
                                }
                            ],
                        },
                        {
                            model: DataUsers,
                            as: 'sedang_diproses_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_admin',
                                    attributes: ['id', 'nama']
                                }
                            ]
                        },
                    ]
                });

                const baseUrl = `${process.env.BASE_URL}download/${pendaftarDetail.nisn}/`; // Ganti dengan URL dasar yang diinginkan 
  
                const data = {  
                    id_: encodeId(pendaftarDetail.id),    
                    ...pendaftarDetail.toJSON(), // Convert Sequelize instance to plain object  
                    data_sekolah: pendaftarDetail.data_sekolah || { // Tambahkan struktur data_sekolah
                        npsn: null,
                        nama: null,
                        bentuk_pendidikan_id: null,
                        bentuk_pendidikan: {
                            id: null,
                            nama: null
                        }
                    }
                };  
                delete data.id; // Remove original ID from the response  
      
                // Custom value for dok_piagam and dok_kk  
                 // Custom value for dok_piagam and dok_kk  
                if (data.dok_kk) {  
                    data.dok_kk = baseUrl + data.dok_kk;  
                }else{
                    data.dok_kk = baseUrlDefault; 
                }
                if (data.dok_pakta_integritas) {  
                    data.dok_pakta_integritas = baseUrl + data.dok_pakta_integritas;  
                }else{
                    data.dok_pakta_integritas = baseUrlDefault; 
                } 

                if (data.dok_suket_nilai_raport) {  
                    data.dok_suket_nilai_raport = baseUrl + data.dok_suket_nilai_raport;  
                }else{
                    data.dok_suket_nilai_raport = baseUrlDefault; 
                }

                if (data.dok_piagam) {  
                    data.dok_piagam = baseUrl + data.dok_piagam;  
                }else{
                    data.dok_piagam = baseUrlDefault; 
                }  

                if (data.dok_pto) {  
                    data.dok_pto = baseUrl + data.dok_pto;  
                }else{
                    data.dok_pto = baseUrlDefault; 
                }
      
      
                // Proses file tambahan dengan downloadable URL  
                if (data.file_tambahan && Array.isArray(data.file_tambahan)) {  
                    data.file_tambahan = data.file_tambahan.map(file => {  
                        return {  
                            ...file,  
                            downloadable: baseUrl + file.filename // Tambahkan URL downloadable  
                        };  
                    });  
                }  
        
                return res.status(200).json({
                    status: 99,
                    message: 'Anda diperbolehkan untuk mengubah data kebutuhan force majeure',
                    data: data
                });

            };

            if(cekPendaftar.is_verified == 98){

                //ini FM bisa buka semua
                const pendaftarDetail = await DataPendaftars.findOne({
                   
                    attributes: {
                        exclude: [
                            'created_at', 'created_by', 'updated_at', 'updated_by', 
                            'activated_at', 'activated_by', 'is_active', 'verified_at', 
                            'verified_by', 'is_verified', 'deleted_at', 'deleted_by', 
                            'is_delete', 'saved_at', 'saved_by', 'is_saved', 'no_urut', 
                            'is_diterima', 'password_', 'access_token', 'access_token_refresh',
                            'verifikasikan_disdukcapil', 'is_verified_disdukcapil',
                            'disdukcapil_by', 'disdukcapil_at', 'otp_expiration', 'opened_by'
                        ]
                    },

                    where: {
                        id: cekPendaftar.id
                    },
                    include: [
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kec',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kot',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_prov',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: DataUsers,
                            as: 'diverifikasi_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_verifikator',
                                    attributes: ['id', 'nama']
                                }
                            ],
                        },
                        {
                            model: DataUsers,
                            as: 'sedang_diproses_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_admin',
                                    attributes: ['id', 'nama']
                                }
                            ]
                        },
                    ]
                });

                const baseUrl = `${process.env.BASE_URL}download/${pendaftarDetail.nisn}/`; // Ganti dengan URL dasar yang diinginkan 
  
                const data = {  
                    id_: encodeId(pendaftarDetail.id),    
                    ...pendaftarDetail.toJSON(), // Convert Sequelize instance to plain object  
                    data_sekolah: pendaftarDetail.data_sekolah || { // Tambahkan struktur data_sekolah
                        npsn: null,
                        nama: null,
                        bentuk_pendidikan_id: null,
                        bentuk_pendidikan: {
                            id: null,
                            nama: null
                        }
                    }
                };  
                delete data.id; // Remove original ID from the response  
      
                // Custom value for dok_piagam and dok_kk  
                if (data.dok_kk) {  
                    data.dok_kk = baseUrl + data.dok_kk;  
                }else{
                    data.dok_kk = baseUrlDefault; 
                }
                if (data.dok_pakta_integritas) {  
                    data.dok_pakta_integritas = baseUrl + data.dok_pakta_integritas;  
                }else{
                    data.dok_pakta_integritas = baseUrlDefault; 
                } 

                if (data.dok_suket_nilai_raport) {  
                    data.dok_suket_nilai_raport = baseUrl + data.dok_suket_nilai_raport;  
                }else{
                    data.dok_suket_nilai_raport = baseUrlDefault; 
                }

                if (data.dok_piagam) {  
                    data.dok_piagam = baseUrl + data.dok_piagam;  
                }else{
                    data.dok_piagam = baseUrlDefault; 
                }  

                if (data.dok_pto) {  
                    data.dok_pto = baseUrl + data.dok_pto;  
                }else{
                    data.dok_pto = baseUrlDefault; 
                }
      
                // Proses file tambahan dengan downloadable URL  
                if (data.file_tambahan && Array.isArray(data.file_tambahan)) {  
                    data.file_tambahan = data.file_tambahan.map(file => {  
                        return {  
                            ...file,  
                            downloadable: baseUrl + file.filename // Tambahkan URL downloadable  
                        };  
                    });  
                }  
        
                return res.status(200).json({
                    status: 98,
                    message: 'Anda diperbolehkan untuk mengubah data alamat dan wilayah',
                    data: data
                });

            };

            if(cekPendaftar.is_verified == 97){

                //ini FM bisa buka semua
                const pendaftarDetail = await DataPendaftars.findOne({
                   
                    attributes: {
                        exclude: [
                            'created_at', 'created_by', 'updated_at', 'updated_by', 
                            'activated_at', 'activated_by', 'is_active', 'verified_at', 
                            'verified_by', 'is_verified', 'deleted_at', 'deleted_by', 
                            'is_delete', 'saved_at', 'saved_by', 'is_saved', 'no_urut', 
                            'is_diterima', 'password_', 'access_token', 'access_token_refresh',
                            'verifikasikan_disdukcapil', 'is_verified_disdukcapil',
                            'disdukcapil_by', 'disdukcapil_at', 'otp_expiration', 'opened_by'
                        ]
                    },

                    where: {
                        id: cekPendaftar.id
                    },
                    include: [
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kec',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kot',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_prov',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: DataUsers,
                            as: 'diverifikasi_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_verifikator',
                                    attributes: ['id', 'nama']
                                }
                            ],
                        },
                        {
                            model: DataUsers,
                            as: 'sedang_diproses_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_admin',
                                    attributes: ['id', 'nama']
                                }
                            ]
                        },
                    ]
                });

                const baseUrl = `${process.env.BASE_URL}download/${pendaftarDetail.nisn}/`; // Ganti dengan URL dasar yang diinginkan 
  
                const data = {  
                    id_: encodeId(pendaftarDetail.id),    
                    ...pendaftarDetail.toJSON(), // Convert Sequelize instance to plain object  
                    data_sekolah: pendaftarDetail.data_sekolah || { // Tambahkan struktur data_sekolah
                        npsn: null,
                        nama: null,
                        bentuk_pendidikan_id: null,
                        bentuk_pendidikan: {
                            id: null,
                            nama: null
                        }
                    }
                };  
                delete data.id; // Remove original ID from the response  
      
                // Custom value for dok_piagam and dok_kk  
                 // Custom value for dok_piagam and dok_kk  
                 if (data.dok_kk) {  
                    data.dok_kk = baseUrl + data.dok_kk;  
                }else{
                    data.dok_kk = baseUrlDefault; 
                }
                if (data.dok_pakta_integritas) {  
                    data.dok_pakta_integritas = baseUrl + data.dok_pakta_integritas;  
                }else{
                    data.dok_pakta_integritas = baseUrlDefault; 
                } 

                if (data.dok_suket_nilai_raport) {  
                    data.dok_suket_nilai_raport = baseUrl + data.dok_suket_nilai_raport;  
                }else{
                    data.dok_suket_nilai_raport = baseUrlDefault; 
                }

                if (data.dok_piagam) {  
                    data.dok_piagam = baseUrl + data.dok_piagam;  
                }else{
                    data.dok_piagam = baseUrlDefault; 
                }  

                if (data.dok_pto) {  
                    data.dok_pto = baseUrl + data.dok_pto;  
                }else{
                    data.dok_pto = baseUrlDefault; 
                }
      
      
                // Proses file tambahan dengan downloadable URL  
                if (data.file_tambahan && Array.isArray(data.file_tambahan)) {  
                    data.file_tambahan = data.file_tambahan.map(file => {  
                        return {  
                            ...file,  
                            downloadable: baseUrl + file.filename // Tambahkan URL downloadable  
                        };  
                    });  
                }  
        
                return res.status(200).json({
                    status: 97,
                    message: 'Anda diperbolehkan untuk mengubah data koordinat tanpa batas wilayah karena alasan teknis',
                    data: data
                });

            };

            if(cekPendaftar.is_verified == 96){

                //ini FM bisa updare NIK
                const pendaftarDetail = await DataPendaftars.findOne({
                   
                    attributes: {
                        exclude: [
                            'created_at', 'created_by', 'updated_at', 'updated_by', 
                            'activated_at', 'activated_by', 'is_active', 'verified_at', 
                            'verified_by', 'is_verified', 'deleted_at', 'deleted_by', 
                            'is_delete', 'saved_at', 'saved_by', 'is_saved', 'no_urut', 
                            'is_diterima', 'password_', 'access_token', 'access_token_refresh',
                            'verifikasikan_disdukcapil', 'is_verified_disdukcapil',
                            'disdukcapil_by', 'disdukcapil_at', 'otp_expiration', 'opened_by'
                        ]
                    },

                    where: {
                        id: cekPendaftar.id
                    },
                    include: [
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kec',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kot',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_prov',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: DataUsers,
                            as: 'diverifikasi_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_verifikator',
                                    attributes: ['id', 'nama']
                                }
                            ],
                        },
                        {
                            model: DataUsers,
                            as: 'sedang_diproses_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_admin',
                                    attributes: ['id', 'nama']
                                }
                            ]
                        },
                    ]
                });

                const baseUrl = `${process.env.BASE_URL}download/${pendaftarDetail.nisn}/`; // Ganti dengan URL dasar yang diinginkan 
  
                const data = {  
                    id_: encodeId(pendaftarDetail.id),    
                    ...pendaftarDetail.toJSON(), // Convert Sequelize instance to plain object  
                    data_sekolah: pendaftarDetail.data_sekolah || { // Tambahkan struktur data_sekolah
                        npsn: null,
                        nama: null,
                        bentuk_pendidikan_id: null,
                        bentuk_pendidikan: {
                            id: null,
                            nama: null
                        }
                    }
                };  
                delete data.id; // Remove original ID from the response  
      
                // Custom value for dok_piagam and dok_kk  
                 // Custom value for dok_piagam and dok_kk  
                 if (data.dok_kk) {  
                    data.dok_kk = baseUrl + data.dok_kk;  
                }else{
                    data.dok_kk = baseUrlDefault; 
                }
                if (data.dok_pakta_integritas) {  
                    data.dok_pakta_integritas = baseUrl + data.dok_pakta_integritas;  
                }else{
                    data.dok_pakta_integritas = baseUrlDefault; 
                } 

                if (data.dok_suket_nilai_raport) {  
                    data.dok_suket_nilai_raport = baseUrl + data.dok_suket_nilai_raport;  
                }else{
                    data.dok_suket_nilai_raport = baseUrlDefault; 
                }

                if (data.dok_piagam) {  
                    data.dok_piagam = baseUrl + data.dok_piagam;  
                }else{
                    data.dok_piagam = baseUrlDefault; 
                }  

                if (data.dok_pto) {  
                    data.dok_pto = baseUrl + data.dok_pto;  
                }else{
                    data.dok_pto = baseUrlDefault; 
                }
      
      
                // Proses file tambahan dengan downloadable URL  
                if (data.file_tambahan && Array.isArray(data.file_tambahan)) {  
                    data.file_tambahan = data.file_tambahan.map(file => {  
                        return {  
                            ...file,  
                            downloadable: baseUrl + file.filename // Tambahkan URL downloadable  
                        };  
                    });  
                }  
        
                return res.status(200).json({
                    status: 96,
                    message: 'Anda diperbolehkan untuk mengubah data NIK, silahkan rubah dengan bertanggung jawab!',
                    data: data
                });

            };

            // if(cekPendaftar.is_verified != 2 || cekPendaftar.is_verified != 99 || cekPendaftar.is_verified != 98 || cekPendaftar.is_verified != 97 || cekPendaftar.is_verified != 96 || cekPendaftar.is_verified != 95){
            //     return res.status(200).json({
            //         status: 2,
            //         message: 'NISN Sudah Terdaftar Sebelumnya',
            //         data: cekPendaftar
            //      });
            // }
        }else{

            return res.status(200).json({
                status: 0,
                message: 'NISN Tidak Terdaftar, Ini Hanya Untuk Pengecekan NISN yang sudah terdaftar status revisi!',
                data: ''
            });

        }

         
       

       
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: 0,
            message: err.message || 'Terjadi kesalahan saat mengambil data'
        });
    }
};


export const getPesertaDidikByNisnTokHendler = async (req, res) => {
    const {nisn} = req.body;
    try {
        if (!nisn) {
            return res.status(400).json({
                status: 0,
                message: 'NISN wajib diisi',
            });
        }

        const cekPendaftar = await DataPendaftars.findOne({
            where: {
                nisn: nisn,
                is_delete: 0
            },
            attributes: ['id', 'kode_verifikasi', 'nisn', 'is_verified'],
        });

        // console.log("Request body:", req.body);

        // if (cekPendaftar.is_verified == 2) {
        //     return res.status(200).json({
        //         status: 2,
        //         message: 'NISN Sudah Terdaftar Sebelumnya',
        //         data: cekPendaftar.kode_verifikasi
        //     });
        // }


        if (cekPendaftar) {

        

                //ini FM bisa buka semua
                const pendaftarDetail = await DataPendaftars.findOne({
                   
                    // attributes: {
                    //     exclude: [
                    //         'created_at', 'created_by', 'updated_at', 'updated_by', 
                    //         'activated_at', 'activated_by', 'is_active', 'verified_at', 
                    //         'verified_by', 'is_verified', 'deleted_at', 'deleted_by', 
                    //         'is_delete', 'saved_at', 'saved_by', 'is_saved', 'no_urut', 
                    //         'is_diterima', 'password_', 'access_token', 'access_token_refresh',
                    //         'verifikasikan_disdukcapil', 'is_verified_disdukcapil',
                    //         'disdukcapil_by', 'disdukcapil_at', 'otp_expiration', 'opened_by'
                    //     ]
                    // },

                    where: {
                        id: cekPendaftar.id
                    },
                    include: [
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kec',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kot',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_prov',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: DataUsers,
                            as: 'diverifikasi_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_verifikator',
                                    attributes: ['id', 'nama']
                                }
                            ],
                        },
                        {
                            model: DataUsers,
                            as: 'sedang_diproses_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_admin',
                                    attributes: ['id', 'nama']
                                }
                            ]
                        },
                    ]
                });

                const baseUrl = `${process.env.BASE_URL}download/${pendaftarDetail.nisn}/`; // Ganti dengan URL dasar yang diinginkan 
  
                const data = {  
                    id_: encodeId(pendaftarDetail.id),    
                    ...pendaftarDetail.toJSON(), // Convert Sequelize instance to plain object  
                    data_sekolah: pendaftarDetail.data_sekolah || { // Tambahkan struktur data_sekolah
                        npsn: null,
                        nama: null,
                        bentuk_pendidikan_id: null,
                        bentuk_pendidikan: {
                            id: null,
                            nama: null
                        }
                    }
                };  
                delete data.id; // Remove original ID from the response  
      
                // Custom value for dok_piagam and dok_kk  
                if (data.dok_kk) {  
                    data.dok_kk = baseUrl + data.dok_kk;  
                }  
                if (data.dok_pakta_integritas) {  
                    data.dok_pakta_integritas = baseUrl + data.dok_pakta_integritas;  
                }  
                if (data.dok_suket_nilai_raport) {  
                    data.dok_suket_nilai_raport = baseUrl + data.dok_suket_nilai_raport;  
                }  
                if (data.dok_piagam) {  
                    data.dok_piagam = baseUrl + data.dok_piagam;  
                }  
      
                // Proses file tambahan dengan downloadable URL  
                if (data.file_tambahan && Array.isArray(data.file_tambahan)) {  
                    data.file_tambahan = data.file_tambahan.map(file => {  
                        return {  
                            ...file,  
                            downloadable: baseUrl + file.filename // Tambahkan URL downloadable  
                        };  
                    });  
                }  
        
                return res.status(200).json({
                    status: 99,
                    message: 'NISN SUDAH MELAKUKAN PENDAFTARAN!',
                    data: data
                });

        }

            


        let pesertaDidik = await getPesertaDidikByNisnTok(nisn);

        

        let is_tidak_sekolah = 0;
        if (!pesertaDidik) {

            const pesertaDidikAts = await getPesertaDidikAtsByNisnTok(nisn);
            is_tidak_sekolah = 0;

            if(!pesertaDidikAts){

                is_tidak_sekolah = 0;
                return res.status(200).json({
                    status: 0,
                    message: 'NISN tidak ditemukan'
                });
               
                
            }else{
                
                // pesertaDidik = pesertaDidikAts;
                // is_tidak_sekolah = 1;

                // pesertaDidik = {
                //     ...pesertaDidikAts,
                //     data_sekolah: {
                //       nama: 'Terdaftar Sebagai Siswa ATS',
                //       npsn: '-----'
                //     }
                // };

                pesertaDidik = {
                    ...(typeof pesertaDidikAts.toJSON === 'function'
                      ? pesertaDidikAts.toJSON()
                      : pesertaDidikAts),
                    data_sekolah: {
                      nama: 'Terdaftar Sebagai ATS | Sekolah Asal:'+ pesertaDidikAts.nama_sekolah,
                      npsn: '-----'
                    }
                  };

                is_tidak_sekolah = 1;

            }

           
        }

        let is_pondok;
        let lat_pondok;
        let lng_pondok;
        let kode_wilayah_pondok;
        let kecamatan_pondok;
        let kabupaten_pondok;
        let provinsi_pondok;
        //jika peserta didik ada di pondok ketika SMP atau sudah terdaftar di pondok oleh kemenag
        if ([56, 68, 71].includes(pesertaDidik.bentuk_pendidikan_id)) {

            const dataAnakKemenag = await EzAnakPondokKemenag.findOne({
                where: {
                    nisn: pesertaDidik.nisn
                }
            });

            if (dataAnakKemenag) {
                
                const wilayah = parseKodeWilayah(dataAnakKemenag.kode_wilayah);

                is_pondok = 1;
                lat_pondok = dataAnakKemenag.lintang_pondok?.toString() || null;
                lng_pondok = dataAnakKemenag.bujur_pondok?.toString() || null;
                kode_wilayah_pondok = dataAnakKemenag.kode_wilayah?.toString() || null;
                kecamatan_pondok = wilayah.kode_kecamatan?.toString() || null;
                kabupaten_pondok = wilayah.kode_kabupaten?.toString() || null;
                provinsi_pondok = wilayah.kode_provinsi?.toString() || null;


            }else{

                is_pondok = 0;
                lat_pondok = null;
                lng_pondok = null;
                kode_wilayah_pondok= null;
                kecamatan_pondok = null;
                kabupaten_pondok = null;
                provinsi_pondok = null;

            }

            // lat_pondok = pesertaDidik.data_sekolah?.lat?.toString() || null;
            // lng_pondok = pesertaDidik.data_sekolah?.lng?.toString() || null;
            // kode_wilayah_pondok = pesertaDidik.data_sekolah?.kode_wilayah?.toString() || null;
    
          
            // const sekolah_id = pesertaDidik.sekolah_id;
            // const cariPondok = await Sekolah.findOne({
            //     attributes: ['id', 'npsn', 'nama', 'bentuk_pendidikan_id', 'lat', 'lng'],
            //     where: { 
            //         id:sekolah_id
            //     },
            // });

            // if (cariPondok) {
            //     pesertaDidik.lat = pesertaDidik.data_sekolah.lat
            //     pesertaDidik.lng = pesertaDidik.data_sekolah.lng;
            //     is_pondok = 1;
            // }else{
            //     is_pondok = 0;
            // }

            // console.log( pesertaDidik.lng_lainnya); 

        }else{

            is_pondok = 0;
            lat_pondok = null;
            lng_pondok = null;
            kode_wilayah_pondok= null;
            kecamatan_pondok = null;
            kabupaten_pondok = null;
            provinsi_pondok = null;
    
        }

        // const dataKec = await getKecamatan(pesertaDidik.data_wilayah.mst_kode_wilayah);
        // const dataKabKota = await getKabupatenKota(dataKec.data_wilayah.mst_kode_wilayah);

        let dataKec = {};
        let dataKabKota = {};
        let dataProvinsi = {};

        if (pesertaDidik.data_wilayah) {
            dataKec = await getKecamatan(pesertaDidik.data_wilayah.mst_kode_wilayah);
        }

        if (dataKec.mst_kode_wilayah) {
            dataKabKota = await getKabupatenKota(dataKec.mst_kode_wilayah);
        }

        if (dataKabKota.mst_kode_wilayah) {
            dataProvinsi = await getProvinsi(dataKabKota.mst_kode_wilayah);
        }
        
        // Jika pesertaDidik berasal dari model Sequelize, gunakan .toJSON()
        const finalPeserta = typeof pesertaDidik.toJSON === 'function'
        ? toPlainObject(pesertaDidik.toJSON())
        : toPlainObject(pesertaDidik);

        const dataDukung = getDataDukungByNIKTok(pesertaDidik.nik, nisn, is_pondok, is_tidak_sekolah)

        res.status(200).json({
            status: 1,
            message: 'Data berhasil ditemukan',
            // ss: dataKec,
            data: {
                // ...pesertaDidik.toJSON(),
                // ...(typeof pesertaDidik.toJSON === 'function' ? pesertaDidik.toJSON() : pesertaDidik),
                ...finalPeserta,
                data_wilayah_kec: dataKec, // Masukkan data wilayah ke dalam respons
                data_wilayah_kot: dataKabKota, // Masukkan data wilayah ke dalam respons
                data_wilayah_prov: dataProvinsi, // Masukkan data wilayah ke dalam respons
                anak_pondok: is_pondok,
                ats:  is_tidak_sekolah,
                lat_pondok: lat_pondok,
                lng_pondok: lng_pondok,
                kode_wilayah_pondok: kode_wilayah_pondok,
                kode_kecamatan_pondok: kecamatan_pondok,
                kode_kabupaten_pondok: kabupaten_pondok,
                kode_provinsi_pondok: provinsi_pondok,
                data_dukung: dataDukung

            }
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: 0,
            message: err.message || 'Terjadi kesalahan saat mengambil data'
        });
    }
};

export const getPesertaDidikByNikTokHendler = async (req, res) => {
    const {nik} = req.body;
    try {
        if (!nik) {
            return res.status(400).json({
                status: 0,
                message: 'NIK wajib diisi',
            });
        }

        const cekPendaftar = await DataPendaftars.findOne({
            where: {
                nik: nik,
                is_delete: 0
            },
            attributes: ['id', 'kode_verifikasi', 'nisn', 'is_verified'],
        });

        // console.log("Request body:", req.body);

        // if (cekPendaftar.is_verified == 2) {
        //     return res.status(200).json({
        //         status: 2,
        //         message: 'NISN Sudah Terdaftar Sebelumnya',
        //         data: cekPendaftar.kode_verifikasi
        //     });
        // }


        if (cekPendaftar) {

        

                //ini FM bisa buka semua
                const pendaftarDetail = await DataPendaftars.findOne({
                   
                    // attributes: {
                    //     exclude: [
                    //         'created_at', 'created_by', 'updated_at', 'updated_by', 
                    //         'activated_at', 'activated_by', 'is_active', 'verified_at', 
                    //         'verified_by', 'is_verified', 'deleted_at', 'deleted_by', 
                    //         'is_delete', 'saved_at', 'saved_by', 'is_saved', 'no_urut', 
                    //         'is_diterima', 'password_', 'access_token', 'access_token_refresh',
                    //         'verifikasikan_disdukcapil', 'is_verified_disdukcapil',
                    //         'disdukcapil_by', 'disdukcapil_at', 'otp_expiration', 'opened_by'
                    //     ]
                    // },

                    where: {
                        id: cekPendaftar.id
                    },
                    include: [
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kec',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kot',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_prov',
                            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
                        },
                        {
                            model: DataUsers,
                            as: 'diverifikasi_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_verifikator',
                                    attributes: ['id', 'nama']
                                }
                            ],
                        },
                        {
                            model: DataUsers,
                            as: 'sedang_diproses_oleh',
                            attributes: ['id', 'nama', 'sekolah_id'],
                            include: [
                                {
                                    model: SekolahTujuanModel,
                                    as: 'asal_sekolah_admin',
                                    attributes: ['id', 'nama']
                                }
                            ]
                        },
                    ]
                });

                const baseUrl = `${process.env.BASE_URL}download/${pendaftarDetail.nik}/`; // Ganti dengan URL dasar yang diinginkan 
  
                const data = {  
                    id_: encodeId(pendaftarDetail.id),    
                    ...pendaftarDetail.toJSON(), // Convert Sequelize instance to plain object  
                    data_sekolah: pendaftarDetail.data_sekolah || { // Tambahkan struktur data_sekolah
                        npsn: null,
                        nama: null,
                        bentuk_pendidikan_id: null,
                        bentuk_pendidikan: {
                            id: null,
                            nama: null
                        }
                    }
                };  
                delete data.id; // Remove original ID from the response  
      
                // Custom value for dok_piagam and dok_kk  
                if (data.dok_kk) {  
                    data.dok_kk = baseUrl + data.dok_kk;  
                }  
                if (data.dok_pakta_integritas) {  
                    data.dok_pakta_integritas = baseUrl + data.dok_pakta_integritas;  
                }  
                if (data.dok_suket_nilai_raport) {  
                    data.dok_suket_nilai_raport = baseUrl + data.dok_suket_nilai_raport;  
                }  
                if (data.dok_piagam) {  
                    data.dok_piagam = baseUrl + data.dok_piagam;  
                }  
      
                // Proses file tambahan dengan downloadable URL  
                if (data.file_tambahan && Array.isArray(data.file_tambahan)) {  
                    data.file_tambahan = data.file_tambahan.map(file => {  
                        return {  
                            ...file,  
                            downloadable: baseUrl + file.filename // Tambahkan URL downloadable  
                        };  
                    });  
                }  
        
                return res.status(200).json({
                    status: 99,
                    message: 'NIK SUDAH MELAKUKAN PENDAFTARAN!',
                    data: data
                });

        }

            


        let pesertaDidik = await getPesertaDidikByNikTok(nik);

        

        let is_tidak_sekolah = 0;
        if (!pesertaDidik) {

            const pesertaDidikAts = await getPesertaDidikAtsByNikTok(nik);
            is_tidak_sekolah = 0;

            if(!pesertaDidikAts){

                is_tidak_sekolah = 0;
                return res.status(200).json({
                    status: 0,
                    message: 'NIK tidak ditemukan'
                });
               
                
            }else{
                
                // pesertaDidik = pesertaDidikAts;
                // is_tidak_sekolah = 1;

                // pesertaDidik = {
                //     ...pesertaDidikAts,
                //     data_sekolah: {
                //       nama: 'Terdaftar Sebagai Siswa ATS',
                //       npsn: '-----'
                //     }
                // };

                pesertaDidik = {
                    ...(typeof pesertaDidikAts.toJSON === 'function'
                      ? pesertaDidikAts.toJSON()
                      : pesertaDidikAts),
                    data_sekolah: {
                      nama: 'Terdaftar Sebagai ATS | Sekolah Asal:'+ pesertaDidikAts.nama_sekolah,
                      npsn: '-----'
                    }
                  };

                is_tidak_sekolah = 1;

            }

           
        }

        let is_pondok;
        let lat_pondok;
        let lng_pondok;
        let kode_wilayah_pondok;
        let kecamatan_pondok;
        let kabupaten_pondok;
        let provinsi_pondok;
        //jika peserta didik ada di pondok ketika SMP atau sudah terdaftar di pondok oleh kemenag
        if ([56, 68, 71].includes(pesertaDidik.bentuk_pendidikan_id)) {

            const dataAnakKemenag = await EzAnakPondokKemenag.findOne({
                where: {
                    nisn: pesertaDidik.nisn
                }
            });

            if (dataAnakKemenag) {
                
                const wilayah = parseKodeWilayah(dataAnakKemenag.kode_wilayah);

                is_pondok = 1;
                lat_pondok = dataAnakKemenag.lintang_pondok?.toString() || null;
                lng_pondok = dataAnakKemenag.bujur_pondok?.toString() || null;
                kode_wilayah_pondok = dataAnakKemenag.kode_wilayah?.toString() || null;
                kecamatan_pondok = wilayah.kode_kecamatan?.toString() || null;
                kabupaten_pondok = wilayah.kode_kabupaten?.toString() || null;
                provinsi_pondok = wilayah.kode_provinsi?.toString() || null;


            }else{

                is_pondok = 0;
                lat_pondok = null;
                lng_pondok = null;
                kode_wilayah_pondok= null;
                kecamatan_pondok = null;
                kabupaten_pondok = null;
                provinsi_pondok = null;

            }

            // lat_pondok = pesertaDidik.data_sekolah?.lat?.toString() || null;
            // lng_pondok = pesertaDidik.data_sekolah?.lng?.toString() || null;
            // kode_wilayah_pondok = pesertaDidik.data_sekolah?.kode_wilayah?.toString() || null;
    
          
            // const sekolah_id = pesertaDidik.sekolah_id;
            // const cariPondok = await Sekolah.findOne({
            //     attributes: ['id', 'npsn', 'nama', 'bentuk_pendidikan_id', 'lat', 'lng'],
            //     where: { 
            //         id:sekolah_id
            //     },
            // });

            // if (cariPondok) {
            //     pesertaDidik.lat = pesertaDidik.data_sekolah.lat
            //     pesertaDidik.lng = pesertaDidik.data_sekolah.lng;
            //     is_pondok = 1;
            // }else{
            //     is_pondok = 0;
            // }

            // console.log( pesertaDidik.lng_lainnya); 

        }else{

            is_pondok = 0;
            lat_pondok = null;
            lng_pondok = null;
            kode_wilayah_pondok= null;
            kecamatan_pondok = null;
            kabupaten_pondok = null;
            provinsi_pondok = null;
    
        }

        // const dataKec = await getKecamatan(pesertaDidik.data_wilayah.mst_kode_wilayah);
        // const dataKabKota = await getKabupatenKota(dataKec.data_wilayah.mst_kode_wilayah);

        let dataKec = {};
        let dataKabKota = {};
        let dataProvinsi = {};

        if (pesertaDidik.data_wilayah) {
            dataKec = await getKecamatan(pesertaDidik.data_wilayah.mst_kode_wilayah);
        }

        if (dataKec.mst_kode_wilayah) {
            dataKabKota = await getKabupatenKota(dataKec.mst_kode_wilayah);
        }

        if (dataKabKota.mst_kode_wilayah) {
            dataProvinsi = await getProvinsi(dataKabKota.mst_kode_wilayah);
        }
        
        // Jika pesertaDidik berasal dari model Sequelize, gunakan .toJSON()
        const finalPeserta = typeof pesertaDidik.toJSON === 'function'
        ? toPlainObject(pesertaDidik.toJSON())
        : toPlainObject(pesertaDidik);

        const dataDukung = getDataDukungByNIKTok(nik, pesertaDidik.nisn, is_pondok, is_tidak_sekolah)

        res.status(200).json({
            status: 1,
            message: 'Data berhasil ditemukan',
            // ss: dataKec,
            data: {
                // ...pesertaDidik.toJSON(),
                // ...(typeof pesertaDidik.toJSON === 'function' ? pesertaDidik.toJSON() : pesertaDidik),
                ...finalPeserta,
                data_wilayah_kec: dataKec, // Masukkan data wilayah ke dalam respons
                data_wilayah_kot: dataKabKota, // Masukkan data wilayah ke dalam respons
                data_wilayah_prov: dataProvinsi, // Masukkan data wilayah ke dalam respons
                anak_pondok: is_pondok,
                ats:  is_tidak_sekolah,
                lat_pondok: lat_pondok,
                lng_pondok: lng_pondok,
                kode_wilayah_pondok: kode_wilayah_pondok,
                kode_kecamatan_pondok: kecamatan_pondok,
                kode_kabupaten_pondok: kabupaten_pondok,
                kode_provinsi_pondok: provinsi_pondok,
                data_dukung: dataDukung

            }
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: 0,
            message: err.message || 'Terjadi kesalahan saat mengambil data'
        });
    }
};

export const getPesertaDidikByNisnHandlerRevisi = async (req, res) => {
    const { nisn, nik } = req.body;
    try {
        if (!nisn) {
            return res.status(400).json({
                status: 0,
                message: 'NISN wajib diisi',
            });
        }

        if (!nik) {
            return res.status(400).json({
                status: 0,
                message: 'NIK wajib diisi',
            });
        }

        const cekPendaftar = await DataPendaftars.findOne({
            where: {
                nisn: nisn,
                nik: nik,
                is_verified: 2,
                is_delete: 0
            },
        });

        if (!cekPendaftar) {
            return res.status(200).json({
                status: 2,
                message: 'NISN tidak memiliki akses untuk update data saat ini',
                data: cekPendaftar.kode_verifikasi
            });
        }

        if (cekPendaftar) {
            return res.status(200).json({
                status: 2,
                message: 'NISN ditemukan',
                data: cekPendaftar.kode_verifikasi
            });
        }

        // const dataKec = await getKecamatan(pesertaDidik.data_wilayah.mst_kode_wilayah);
        // const dataKabKota = await getKabupatenKota(dataKec.data_wilayah.mst_kode_wilayah);

        let dataKec = {};
        let dataKabKota = {};
        let dataProvinsi = {};

        if (pesertaDidik.data_wilayah) {
            dataKec = await getKecamatan(pesertaDidik.data_wilayah.mst_kode_wilayah);
        }

        if (dataKec.mst_kode_wilayah) {
            dataKabKota = await getKabupatenKota(dataKec.mst_kode_wilayah);
        }

        if (dataKabKota.mst_kode_wilayah) {
            dataProvinsi = await getProvinsi(dataKabKota.mst_kode_wilayah);
        }
        

        res.status(200).json({
            status: 1,
            message: 'Data berhasil ditemukan',
            // ss: dataKec,
            data: {
                ...pesertaDidik.toJSON(),
                data_wilayah_kec: dataKec, // Masukkan data wilayah ke dalam respons
                data_wilayah_kabkota: dataKabKota, // Masukkan data wilayah ke dalam respons
                data_wilayah_provinsi: dataProvinsi // Masukkan data wilayah ke dalam respons
            }
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: 0,
            message: err.message || 'Terjadi kesalahan saat mengambil data'
        });
    }
};

//get anak miskin, get anak panti, get anak pondok by NIK
export const getDataDukungByNIK = async (req, res) => {
    const { nik, nisn, anak_pondok, ats } = req.body;
    try {
        if (!nik) {
            return res.status(400).json({
                status: 0,
                message: 'NIK is required',
            });
        }

        // Fetch data anak miskin and data anak panti by NIK
        // const //anakMiskin = await DataAnakMiskins.findOne({ where: { nik: nisn } });
        // const anakMiskin = await DataAnakMiskins.findOne({
        //     where: {
        //         [Op.or]: [
        //             { nik: nisn }, // Condition where nik equals nisn
        //             { nik: nik } // Condition where nik equals a specific nik
        //         ]
        //     }
        // });

        // Mengambil username dan password dari variabel lingkungan
        // const username = process.env.API_USERNAME;
        // const password = process.env.API_PASSWORD;


        // const integrasi = await getIntegratorSatuan(2);

        // let anakMiskin;

        // if(integrasi?.is_active == 1){

        //      //Melakukan permintaan ke API untuk mendapatkan data anak miskin
        //     // anakMiskin = await axios.post('https://dtjateng.dinsos.jatengprov.go.id/api/disdik/cek-data-nik', {
        //     //     username: process.env.API_USERNAME, // Ambil username dari variabel lingkungan
        //     //     password: process.env.API_PASSWORD ,
        //     //     nik: nik // Mengirimkan NIK dalam format JSON
        //     // });

        //     anakMiskin = false;

        // }else{

        //     // anakMiskin = false;
        //     anakMiskin = await DataAnakMiskins.findOne({ where: { nik } });
            

        // }

       
        // const anakMiskin = await DataAnakMiskins.findOne({ where: { nik } });

        const anakMiskin = await DataAnakMiskins.findOne({
            where: {
              nik,
              prioritas: ['P1', 'P2', 'P3'] // mencari yang prioritas P1, P2, atau P3
            }
          });

        console.log('ini anak miskin:'+anakMiskin);

        // const response = false
        
        const anakPanti = await DataAnakPantis.findOne({ where: { nik } });
        const anakPondok = anak_pondok;
        const anakGuru = await DataAnakGuru.findOne({  where: { nisn_cpd: nisn } });

        const anakTidakSekolah  = ats;
        

        let dataAnakMiskin = {};
        let dataAnakPanti = {};
        let dataAnakPondok = {};
        let dataAnakGuru = {};
        let dataAnakTidakSekolah = {};

        if (anakMiskin) {
            dataAnakMiskin = {
                anak_miskin: 1,
                data_anak_miskin: anakMiskin.toJSON()
            };
        } else {
            dataAnakMiskin = {
                anak_miskin: 0,
                data_anak_miskin: [],

            };
        }


        // if (anakMiskin) {
        //     dataAnakMiskin = {
        //         anak_miskin: 1,
        //         data_anak_miskin: anakMiskin.toJSON()
        //     };
        // } else {
        //     dataAnakMiskin = {
        //         anak_miskin: 0,
        //         data_anak_miskin: []
        //     };
        // }


        // Memeriksa status respons dari API
        // if (response.data.status === false) {
        // if (anakMiskin === false) {

        //     dataAnakMiskin = {
        //         anak_miskin: 0,
        //         data_anak_miskin: []
        //     };

        // } else {

        //     if (anakMiskin.data.status != false) {
        //         if(anakMiskin.data.priortias == '-'){
        //             dataAnakMiskin = {
        //                 anak_miskin: 0,
        //                 data_anak_miskin: []
        //             };
        //         }else{
        //             dataAnakMiskin = {
        //                 anak_miskin: 1,
        //                 data_anak_miskin: anakMiskin.data // Mengambil data dari respons API
        //             };
        //         }
                
        //     }else{
        //         dataAnakMiskin = {
        //             anak_miskin: 0,
        //             data_anak_miskin: []
        //         };
        //     }
        // }

       
        if (anakPanti) {
            dataAnakPanti = {
                anak_panti: 1,
                data_anak_panti: anakPanti.toJSON()
            };
        } else {
            dataAnakPanti = {
                anak_panti: 0,
                data_anak_panti: []
            };
        }

        if (anakPondok == 1) {
            dataAnakPondok = {
                anak_pondok: 1,
                data_anak_pondok: anakPondok
            };
        } else {
            dataAnakPondok = {
                anak_pondok: 0,
                data_anak_pondok: []
            };
        }

        if (anakGuru) {
            dataAnakGuru = {
                anak_guru: 1,
                data_anak_guru: anakGuru.toJSON()
            };
        } else {
            dataAnakGuru = {
                anak_guru: 0,
                data_anak_guru: []
            };
        }

        if (anakTidakSekolah == 1) {
            dataAnakTidakSekolah = {
                ats: 1,
                data_ats: anakTidakSekolah
            };
        } else {
            dataAnakTidakSekolah = {
                ats: 0,
                data_ats: []
            };
        }

        res.status(200).json({
            status: 1,
            message: 'Data berhasil ditemukan',
            data: {
                ...dataAnakMiskin,
                ...dataAnakPanti,
                ...dataAnakPondok,
                ...dataAnakGuru,
                ...dataAnakTidakSekolah
            }
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: 0,
            message: err.message || 'Terjadi kesalahan saat mengambil data'
        });
    }
};

//get anak miskin, get anak panti, get anak pondok by NIK
const getDataDukungByNIKTok = async (nik, nisn, anak_pondok, ats) => {

    try {
        if (!nik) {
            return res.status(400).json({
                status: 0,
                message: 'NIK is required',
            });
        }
       
        // const anakMiskin = await DataAnakMiskins.findOne({ where: { nik } });

        const anakMiskin = await DataAnakMiskins.findOne({
            where: {
              nik,
              prioritas: ['P1', 'P2', 'P3'] // mencari yang prioritas P1, P2, atau P3
            }
          });

        console.log('ini anak miskin:'+anakMiskin);

        // const response = false
        
        const anakPanti = await DataAnakPantis.findOne({ where: { nik } });
        const anakPondok = anak_pondok;
        const anakGuru = await DataAnakGuru.findOne({  where: { nisn_cpd: nisn } });

        const anakTidakSekolah  = ats;
        

        let dataAnakMiskin = {};
        let dataAnakPanti = {};
        let dataAnakPondok = {};
        let dataAnakGuru = {};
        let dataAnakTidakSekolah = {};

        if (anakMiskin) {
            dataAnakMiskin = {
                anak_miskin: 1,
                data_anak_miskin: anakMiskin.toJSON()
            };
        } else {
            dataAnakMiskin = {
                anak_miskin: 0,
                data_anak_miskin: [],

            };
        }
       
        if (anakPanti) {
            dataAnakPanti = {
                anak_panti: 1,
                data_anak_panti: anakPanti.toJSON()
            };
        } else {
            dataAnakPanti = {
                anak_panti: 0,
                data_anak_panti: []
            };
        }

        if (anakPondok == 1) {
            dataAnakPondok = {
                anak_pondok: 1,
                data_anak_pondok: anakPondok
            };
        } else {
            dataAnakPondok = {
                anak_pondok: 0,
                data_anak_pondok: []
            };
        }

        if (anakGuru) {
            dataAnakGuru = {
                anak_guru: 1,
                data_anak_guru: anakGuru.toJSON()
            };
        } else {
            dataAnakGuru = {
                anak_guru: 0,
                data_anak_guru: []
            };
        }

        if (anakTidakSekolah == 1) {
            dataAnakTidakSekolah = {
                ats: 1,
                data_ats: anakTidakSekolah
            };
        } else {
            dataAnakTidakSekolah = {
                ats: 0,
                data_ats: []
            };
        }

        res.status(200).json({
            status: 1,
            message: 'Data berhasil ditemukan',
            data: {
                ...dataAnakMiskin,
                ...dataAnakPanti,
                ...dataAnakPondok,
                ...dataAnakGuru,
                ...dataAnakTidakSekolah
            }
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: 0,
            message: err.message || 'Terjadi kesalahan saat mengambil data'
        });
    }
};

