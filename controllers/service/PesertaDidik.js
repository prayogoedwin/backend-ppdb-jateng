// controllers/PesertaDidik.js
import DataPesertaDidiks from '../../models/service/DataPesertaDidikModel.js';
import DataPesertaDidiksAts from '../../models/service/DataPesertaDidikAtsModel.js';
import DataAnakMiskins from '../../models/service/DataAnakMiskinModel.js';
import DataAnakPantis from '../../models/service/DataAnakPantiModel.js';
import DataAnakGuru from '../../models/service/DataAnakGuruModel.js';
import Sekolah from '../../models/master/SekolahModel.js';
import BentukPendidikan from '../../models/master/BentukPendidikanModel.js';
import WilayahVerDapodik from '../../models/master/WilayahVerDapodikModel.js';
import SekolahTujuanModel from '../../models/master/SekolahTujuanModel.js';
import DataUsers from '../../models/service/DataUsersModel.js';
import { encodeId, decodeId } from '../../middleware/EncodeDecode.js';

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

export const getPesertaDidikByNisnHandler = async (req, res) => {
    const {nisn,nik} = req.body;
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
            if(cekPendaftar.is_verified == 2){

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
                    status: 3,
                    message: 'NISN diperbolehkan untuk revisi data sementara',
                    data: data
                });

            };

            if(cekPendaftar.is_verified != 2){
                return res.status(200).json({
                    status: 2,
                    message: 'NISN Sudah Terdaftar Sebelumnya',
                    data: cekPendaftar
                 });
            }
        }

            


        let pesertaDidik = await getPesertaDidikByNisn(nisn, nik);

        

        let is_tidak_sekolah = 0;
        if (!pesertaDidik) {

            const pesertaDidikAts = await getPesertaDidikAtsByNisn(nisn, nik);
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
                      nama: 'Terdaftar Sebagai ATS',
                      npsn: '-----'
                    }
                  };

                is_tidak_sekolah = 1;

            }

           
        }

        let is_pondok;
        //jika peserta didik ada di pondok ketika SMP atau sudah terdaftar di pondok oleh kemenag
        if ([56, 68, 71].includes(pesertaDidik.bentuk_pendidikan_id)) {

            pesertaDidik.lat = pesertaDidik.data_sekolah?.lat?.toString() || null;
            pesertaDidik.lng = pesertaDidik.data_sekolah?.lng?.toString() || null;
            is_pondok = 1;
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

        }else{

            is_pondok = 0;

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


        //Melakukan permintaan ke API untuk mendapatkan data anak miskin
        const anakMiskin = await axios.post('https://dtjateng.dinsos.jatengprov.go.id/api/disdik/cek-data-nik', {
            username: process.env.API_USERNAME, // Ambil username dari variabel lingkungan
            password: process.env.API_PASSWORD ,
            nik: nik // Mengirimkan NIK dalam format JSON
        });

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
        if (anakMiskin === false) {

            dataAnakMiskin = {
                anak_miskin: 0,
                data_anak_miskin: []
            };

        } else {

            if (anakMiskin.data.status != false) {
                dataAnakMiskin = {
                    anak_miskin: 1,
                    data_anak_miskin: anakMiskin.data // Mengambil data dari respons API
                };
            }else{
                dataAnakMiskin = {
                    anak_miskin: 0,
                    data_anak_miskin: []
                };
            }
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

