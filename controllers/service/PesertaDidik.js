// controllers/PesertaDidik.js
import DataPesertaDidiks from '../../models/service/DataPesertaDidikModel.js';
import DataAnakMiskins from '../../models/service/DataAnakMiskinModel.js';
import DataAnakPantis from '../../models/service/DataAnakPantiModel.js';
import DataAnakGuru from '../../models/service/DataAnakGuruModel.js';
import Sekolah from '../../models/master/SekolahModel.js';
import BentukPendidikan from '../../models/master/BentukPendidikanModel.js';
import WilayahVerDapodik from '../../models/master/WilayahVerDapodikModel.js';

import DataPendaftars from "../../models/service/DataPendaftarModel.js";
import { Op } from 'sequelize';


// import getDataWilayah from '../service/WilayahService.js';
import { getProvinsi, getKabupatenKota, getKecamatan, getDesaKelurahan } from '../service/WilayahService.js';

// Service function
const getPesertaDidikByNisn = async (nisn) => {
    try {
        const pesertaDidik = await DataPesertaDidiks.findOne({
            where: { nisn },
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

const getPesertaDidikByNisnTgkNamaIbu = async (nisn, tgl_lahir, nama_ibu) => {
    try {
        const pesertaDidik = await DataPesertaDidiks.findOne({

            where: {
                        nisn: nisn,
                        tanggal_lahir: tgl_lahir,
                        // nama_ibu_kandung: nama_ibu,
                        nama_ibu_kandung: {
                            [Op.iLike]: nama_ibu
                        },
                        // is_delete: 0
                    },
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
    const { nisn, tgl_lahir, nama_ibu } = req.body;
    try {
        if (!nisn) {
            return res.status(400).json({
                status: 0,
                message: 'NISN wajib diisi',
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

        const pesertaDidik = await getPesertaDidikByNisnTgkNamaIbu(nisn, tgl_lahir, nama_ibu);

        if (!pesertaDidik) {
            return res.status(200).json({
                status: 0,
                message: 'NISN tidak ditemukan'
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

export const getPesertaDidikByNisnHandler = async (req, res) => {
    const { nisn } = req.body;
    try {
        if (!nisn) {
            return res.status(400).json({
                status: 0,
                message: 'NISN is required',
            });
        }

        const cekPendaftar = await DataPendaftars.findOne({
            where: {
                nisn: nisn,
                is_delete: 0
            },
        });

        if (cekPendaftar) {
            return res.status(200).json({
                status: 2,
                message: 'NISN Sudah Terdaftar Sebelumnya'
            });
        }

        const pesertaDidik = await getPesertaDidikByNisn(nisn);

        if (!pesertaDidik) {
            return res.status(200).json({
                status: 0,
                message: 'NISN tidak ditemukan'
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
    const { nik, nisn } = req.body;
    try {
        if (!nik) {
            return res.status(400).json({
                status: 0,
                message: 'NIK is required',
            });
        }

        // Fetch data anak miskin and data anak panti by NIK
        // const //anakMiskin = await DataAnakMiskins.findOne({ where: { nik: nisn } });
        const anakMiskin = await DataAnakMiskins.findOne({
            where: {
                [Op.or]: [
                    { nik: nisn }, // Condition where nik equals nisn
                    { nik: nik } // Condition where nik equals a specific nik
                ]
            }
        });
        const anakPanti = await DataAnakPantis.findOne({ where: { nik } });
        const anakPondok = null;
        const anakGuru = await DataAnakGuru.findOne({  where: { nisn_cpd: nisn } });
        

        let dataAnakMiskin = {};
        let dataAnakPanti = {};
        let dataAnakPondok = {};
        let dataAnakGuru = {};

        if (anakMiskin) {
            dataAnakMiskin = {
                anak_miskin: 1,
                data_anak_miskin: anakMiskin.toJSON()
            };
        } else {
            dataAnakMiskin = {
                anak_miskin: 0,
                data_anak_miskin: []
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

        if (anakPondok) {
            dataAnakPondok = {
                anak_pondok: 1,
                data_anak_pondok: anakPondok.toJSON()
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

        res.status(200).json({
            status: 1,
            message: 'Data berhasil ditemukan',
            data: {
                ...dataAnakMiskin,
                ...dataAnakPanti,
                ...dataAnakPondok,
                ...dataAnakGuru
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

