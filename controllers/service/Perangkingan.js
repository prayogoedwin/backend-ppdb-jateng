import { check, validationResult } from 'express-validator';
import { DomiSmkHelper, DomiNilaiHelper, afirmasiSmkHelper, afirmasiSmaHelper, 
    DomiRegHelper, getTimelineSatuan, getTimelineAll, getFileTambahanByJalurPendaftaran, 
    getSekolahTujuanById, getSekolahJurusanById, SekolahZonasiKhususByNpsn, checkWaktuCachePerangkingan, parseKodeWilayah,
getSekolahTujuanById1, getSekolahJurusanById1, getSekolahTujuanAllWay
} from '../../helpers/HelpHelper.js';
import DataPendaftars from "../../models/service/DataPendaftarModel.js";
import DataPendaftarPrestasiKhusus from "../../models/service/DataPesertaPrestasiKhusus.js";
import DataPerangkingans from "../../models/service/DataPerangkinganModel.js";
import Zonasis from "../../models/service/ZonasiModel.js";
import SekolahZonasis from "../../models/service/SekolahZonasiModel.js";
import EzAnakPondokKemenag from '../../models/service/ezAnakPondokKemenagModel.js';
import FileTambahans from "../../models/master/FileTambahanModel.js";
import SekolahTujuan from '../../models/master/SekolahTujuanModel.js';
import SekolahJurusan from "../../models/master/SekolahJurusanModel.js";
import JalurPendaftarans from '../../models/master/JalurPendaftaranModel.js';
import WilayahVerDapodik from '../../models/master/WilayahVerDapodikModel.js';
import StatusDomisilis from '../../models/master/StatusDomisiliModel.js';
import JenisKejuaraans from '../../models/master/JenisKejuaraanModel.js';
import Timelines from "../../models/service/TimelineModel.js";
// import DataUsers from '../../../models/service/DataUsersModel.js';
import DataUsersModel from '../../models/service/DataUsersModel.js';
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { encodeId, decodeId } from '../../middleware/EncodeDecode.js';
import { Sequelize, Op, literal } from 'sequelize';
import { redisGet, redisSet, redisClearKey } from '../../redis.js'; // Import the Redis functions
import db from '../../config/Database.js'; // sesuaikan path jika beda

import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";

pdfMake.vfs = pdfFonts?.default?.vfs || pdfFonts.vfs;


const generatePendaftaranNumber = async (bentuk_pendidikan_id) => {

    let kodeProv = '03';
    let kodeBentuk = bentuk_pendidikan_id;
    const year = new Date().getFullYear().toString().slice(-2); // Ambil 2 digit terakhir tahun
    let code;
    let exists = true;

    while (exists) {
        let randomNumber = '';
        for (let i = 0; i < 10; i++) {
            randomNumber += Math.floor(Math.random() * 10); // Hanya angka 0-9
        }

        code = `${kodeProv}${kodeBentuk}${year}${randomNumber}`; // Format final

        const existingCode = await DataPerangkingans.findOne({ where: { no_pendaftaran: code } });
        exists = !!existingCode;
    }

    return code;
};

const calculateAge = async (birthdate) => {

    const resTm = await getTimelineSatuan(4);

    // console.log(resTm.tanggal_buka);

    // if (!resTm || !resTm.tanggal_buka) {
    //     console.error('tanggal_buka tidak ditemukan');
    //     return null;
    // }

    
    // const today = new Date();
    const today = new Date(resTm.tanggal_buka);
    const birthDate = new Date(birthdate);

    const diffTime = today - birthDate; // Selisih dalam milidetik
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // Konversi ke hari

    return diffDays;
};

const hitung_pendaftar_diterima_sma_tanpa_redis = async (jalur_pendaftaran_id, sekolah_tujuan_id) => {

    // Hitung total pendaftar prestasi untuk SMK
    const dataPerangkingan = await DataPerangkingans.findAll({  
        attributes: ['nisn', 'is_diterima', 'is_daftar_ulang'],
        where: {  
            jalur_pendaftaran_id,
            sekolah_tujuan_id
        }
    });
    const countDiterima = dataPerangkingan.filter(item => item.is_diterima === 1).length;
    const countDaftarUlang = dataPerangkingan.filter(item => item.is_diterima === 1 && item.is_daftar_ulang === 1).length;
    const countTidakDaftarUlang = countDiterima - countDaftarUlang;

    return {
        diterima: countDiterima,
        daftar_ulang: countDaftarUlang,
        tidak_daftar_ulang: countTidakDaftarUlang
    };
}

const hitung_pendaftar_diterima_sma = async (jalur_pendaftaran_id, sekolah_tujuan_id) => {

    const redis_key = `perangkingan_pengumman_count:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}`;

    // Cek cache terlebih dahulu
    const cached = await redisGet(redis_key);
    if (cached) {
        return JSON.parse(cached); // Langsung return data dari cache
    }

    // Hitung total pendaftar prestasi untuk SMK
    const dataPerangkingan = await DataPerangkingans.findAll({  
        attributes: ['nisn', 'is_diterima', 'is_daftar_ulang'],
        where: {  
            jalur_pendaftaran_id,
            sekolah_tujuan_id
        }
    });
    const countDiterima = dataPerangkingan.filter(item => item.is_diterima === 1).length;
    const countDaftarUlang = dataPerangkingan.filter(item => item.is_diterima === 1 && item.is_daftar_ulang === 1).length;
    const countTidakDaftarUlang = countDiterima - countDaftarUlang;

    const result = {
        diterima: countDiterima,
        daftar_ulang: countDaftarUlang,
        tidak_daftar_ulang: countTidakDaftarUlang
    };

    // Simpan ke cache
    await redisSet(redis_key, JSON.stringify(result), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);

    return result;
}

const hitung_cadangan_sma = async (jalur_pendaftaran_id, sekolah_tujuan_id, no_pendaftaran) => {
    // Pertama, ambil data jumlah pendaftar yang diterima dan tidak daftar ulang
    const { tidak_daftar_ulang } = await hitung_pendaftar_diterima_sma(jalur_pendaftaran_id, sekolah_tujuan_id);
    
    // Ambil data cadangan dengan urutan no_urut ASC dan limit sesuai tidak_daftar_ulang
    const dataCadangan = await DataPerangkingans.findAll({  
        attributes: ['no_pendaftaran'],
        where: {  
            jalur_pendaftaran_id,
            sekolah_tujuan_id, 
            is_diterima: 2
        },
        order: [['no_urut', 'ASC']],
        limit: tidak_daftar_ulang
    });
    
    // Cek apakah no_pendaftaran ada dalam daftar cadangan yang memenuhi syarat
    const isCadanganMemenuhi = dataCadangan.some(item => item.no_pendaftaran === no_pendaftaran);
    
    return isCadanganMemenuhi ? 2 : 3;
}

const hitung_pendaftar_diterima_smk_tanpa_redis = async (jalur_pendaftaran_id, sekolah_tujuan_id, jurusan_id) => {
    // Hitung total pendaftar prestasi untuk SMK
    const dataPerangkingan = await DataPerangkingans.findAll({  
        attributes: ['nisn', 'is_diterima', 'is_daftar_ulang'],
        where: {  
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            jurusan_id,
        }
    });
    const countDiterima = dataPerangkingan.filter(item => item.is_diterima === 1).length;
    const countDaftarUlang = dataPerangkingan.filter(item => item.is_diterima === 1 && item.is_daftar_ulang === 1).length;
    const countTidakDaftarUlang = countDiterima - countDaftarUlang;

    return {
        diterima: countDiterima,
        daftar_ulang: countDaftarUlang,
        tidak_daftar_ulang: countTidakDaftarUlang
    };
}

const hitung_pendaftar_diterima_smk = async (jalur_pendaftaran_id, sekolah_tujuan_id, jurusan_id) => {

    const redis_key = `perangkingan_pengumman_count:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;

    // Cek cache terlebih dahulu
    const cached = await redisGet(redis_key);
    if (cached) {
        return JSON.parse(cached); // Langsung return data dari cache
    }
    
    // Hitung total pendaftar prestasi untuk SMK
    const dataPerangkingan = await DataPerangkingans.findAll({  
        attributes: ['nisn', 'is_diterima', 'is_daftar_ulang'],
        where: {  
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            jurusan_id,
        }
    });
    const countDiterima = dataPerangkingan.filter(item => item.is_diterima === 1).length;
    const countDaftarUlang = dataPerangkingan.filter(item => item.is_diterima === 1 && item.is_daftar_ulang === 1).length;
    const countTidakDaftarUlang = countDiterima - countDaftarUlang;

    const result = {
        diterima: countDiterima,
        daftar_ulang: countDaftarUlang,
        tidak_daftar_ulang: countTidakDaftarUlang
    };

    // Simpan ke cache
    await redisSet(redis_key, JSON.stringify(result), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);

    return result;
}

const hitung_cadangan_smk = async (jalur_pendaftaran_id, sekolah_tujuan_id, jurusan_id, no_pendaftaran) => {
    // Pertama, ambil data jumlah pendaftar yang diterima dan tidak daftar ulang
    const { tidak_daftar_ulang } = await hitung_pendaftar_diterima_smk(jalur_pendaftaran_id, sekolah_tujuan_id, jurusan_id);
    
    // Ambil data cadangan dengan urutan no_urut ASC dan limit sesuai tidak_daftar_ulang
    const dataCadangan = await DataPerangkingans.findAll({  
        attributes: ['no_pendaftaran'],
        where: {  
            jalur_pendaftaran_id,
            sekolah_tujuan_id, 
            jurusan_id, 
            is_diterima: 2
        },
        order: [['no_urut', 'ASC']],
        limit: tidak_daftar_ulang
    });
    
    // Cek apakah no_pendaftaran ada dalam daftar cadangan yang memenuhi syarat
    const isCadanganMemenuhi = dataCadangan.some(item => item.no_pendaftaran === no_pendaftaran);
    
    return isCadanganMemenuhi ? 2 : 3;
}

export const getPerangkinganSaya = async (req, res) => {
    try {
        const { id_pendaftar } = req.body;

        // Decode the ID
        const decodedIdPendaftar = decodeId(id_pendaftar);

        // Fetch the data

        const cekApakahSudahDaftar = await DataPerangkingans.findOne({
            where: {
                id_pendaftar: decodedIdPendaftar,
            },
        });

        // if(cekApakahSudahDaftar > 0){

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
                    },
                    {
                        model: SekolahJurusan,
                        as: 'sekolah_jurusan',
                        attributes: ['id', 'nama_jurusan']
                    },
                    {
                        model: JalurPendaftarans,
                        as: 'jalur_pendaftaran',
                        attributes: ['bentuk_pendidikan_id', 'nama']
                    }
                ],
                order: [['id', 'ASC']]
                // group: ['ez_perangkingan.id']  
                // group: ['ez_perangkingan.id', 'sekolah_tujuan.id', 
                //     'sekolah_tujuan.npsn', 'sekolah_tujuan.nama', 'sekolah_jurusan.id', 
                //     'sekolah_jurusan.nama_jurusan', 'jalur_pendaftaran.id' , 'jalur_pendaftaran.bentuk_pendidikan_id' , 'jalur_pendaftaran.nama']
            });

            const resDatas = resData.map(item => {
                const jsonItem = item.toJSON(); //keluarkan penanda 4 afirmasi
                jsonItem.id_perangkingan_ = encodeId(item.id); // Add the encoded ID to the response
                jsonItem.id_pendaftar_ = encodeId(item.id_pendaftar); // Add the encoded ID to the response
                delete jsonItem.id; // Hapus kolom id dari output JSON
                delete jsonItem.id_pendaftar; // Hapus kolom id dari output JSON
            
                return jsonItem;
            });

        // }else{

        //     const resData = 0;

        // }

        // const resTimeline = await Timelines.findOne({
        //     where: {
        //         id: 4,
        //     },
        // });

        // const allTimelines = await Timelines.findAll();
        const allTimelines = await getTimelineAll();

        const timeline4 = allTimelines.find(t => t.id === 4);
        const timeline5 = allTimelines.find(t => t.id === 5);
        const timeline6 = allTimelines.find(t => t.id === 6);


        // Check if data is found
        if (resData && resData.length > 0) {
            res.status(200).json({
                status: 1,
                message: 'Data berhasil ditemukan',
                data: resDatas,
                timeline4: timeline4 ? { id: timeline4.id, status: timeline4.status } : null,
                timeline5: timeline5 ? { id: timeline5.id, status: timeline5.status } : null,
                timeline6: timeline6 ? { id: timeline6.id, status: timeline6.status } : null
            });
        } else {
            res.status(200).json({
                status: 0,
                message: 'Data kosong',
                data: [],
                timeline4: timeline4 ? { id: timeline4.id, status: timeline4.status } : null,
                timeline5: timeline5 ? { id: timeline5.id, status: timeline5.status } : null,
                timeline6: timeline6 ? { id: timeline6.id, status: timeline6.status } : null
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

export const getPerangkinganSayaUpdateKebutuhanKhusus = async (req, res) => {
    try {
        const { id_pendaftar, penanda_update_jarak } = req.body;

        // Decode the ID
        const decodedIdPendaftar = decodeId(id_pendaftar);

        // cek the data
        if(penanda_update_jarak == 1){

            return  res.status(500).json({
                status: 0,
                message: 'Sudah diupdate jarak nya, tidak perlu cetak',
            });

        }
        const resData = await DataPerangkingans.findOne({
            where: {
                id_pendaftar: decodedIdPendaftar, // Pastikan id_pendaftar adalah string
                is_delete: 0
            }
        });
        if(resData){
            
            const pendaftar = await DataPendaftars.findOne({ where: { id: decodedIdPendaftar  } });

            const sklh = await SekolahTujuan.findOne({
                where: {
                    id: resData.sekolah_tujuan_id
                }
            })

            let lati;
            let longi;

            let latP;
            let lonP;

            if(sklh){

                lati = sklh.lat;
                longi = sklh.lng;

                latP = pendaftar.lat;
                lonP = pendaftar.lng

                function haversineDistance(lat1, lon1, lat2, lon2) {
                    const R = 6371; // Radius bumi dalam kilometer
                    const dLat = (lat2 - lat1) * Math.PI / 180;
                    const dLon = (lon2 - lon1) * Math.PI / 180;
                    const a = 
                        Math.sin(dLat/2) * Math.sin(dLat/2) +
                        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                        Math.sin(dLon/2) * Math.sin(dLon/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    const distanceInKm = R * c;
                    const distanceInMeters = distanceInKm * 1000; // Konversi ke meter
                    return distanceInMeters;
                }

                // const jarak = haversineDistance(latP, lonP, lati, longi);
                const jarak = haversineDistance(latP, lonP, lati, longi).toFixed(2);

                resData.update({
                    jarak: jarak
                });

                pendaftar.update({
                    is_pip: 1,
                });
            }
            
           const id_perangkingan = encodeId(resData.id);
           return res.status(200).json({
                status: 1,
                message: 'Berhasil update jarak, cetak bukti daftar terbaru sekarang',
                data: id_perangkingan,
            });
        } else {
             const pendaftar = await DataPendaftars.findOne({ where: { id: decodedIdPendaftar  } });
              pendaftar.update({
                    is_pip: 1,
                });
            return res.status(200).json({
                status: 0,
                message: 'Data kosong',
                data: [],
            });
        }
    } catch (err) {
        console.error('Error fetching data:', err);
       return  res.status(500).json({
            status: 0,
            message: 'Error'
        });
    }
};

export const getPerangkinganDetail = async (req, res) => {
    try {
        const { id_perangkingan } = req.body;

        // Decode the ID
        const decodedIdPerangkingan = decodeId(id_perangkingan);

        console.log('id decodenya adalah:'+decodedIdPerangkingan);
        console.log('id decodenya adalah:'+decodeId(decodedIdPerangkingan));

        // Fetch the data
        const resData = await DataPerangkingans.findOne({
            where: {
                id: decodedIdPerangkingan, // Pastikan id_pendaftar adalah string
                is_delete: 0
            },
            attributes: ['no_pendaftaran', 'nisn', 'nama_lengkap', 'nilai_akhir', 'jarak', 'id_pendaftar', 'umur'],
            include: [
                {
                    model: SekolahTujuan,
                    as: 'sekolah_tujuan',
                    attributes: ['npsn', 'nama']
                },{
                    model: JalurPendaftarans,
                    as: 'jalur_pendaftaran',
                    attributes: ['bentuk_pendidikan_id', 'nama']
                },
                // {
                //     model: DataPendaftars,
                //     as: 'data_pendaftar',
                //     attributes: [
                //         'nama_kejuaraan', 
                //         'nilai_prestasi', 
                //         'tanggal_sertifikat', 
                //         'umur_sertifikat', 
                //         'nomor_sertifikat', 
                //         'organisasi_id', 
                //         'nilai_organisasi'
                //     ]
                // }
            ]
        });


        // Check if data is found
        if (resData) {

            const profil = await DataPendaftars.findOne({
                where: {
                  id: resData.id_pendaftar,
                  is_delete: 0
                },
                attributes: ['nisn', 'nama_lengkap', 'tempat_lahir', 'jenis_kelamin', 'tanggal_cetak_kk',
                    'nama_kejuaraan', 
                    'nilai_prestasi', 
                    'tanggal_sertifikat', 
                    'umur_sertifikat', 
                    'nomor_sertifikat', 
                    'organisasi_id', 
                    'nilai_organisasi',
                    'nilai_raport_rata',

                ],
                include: [
                    {
                        model: StatusDomisilis,
                        as: 'status_domisili_name',
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
                    },{
                        model: JenisKejuaraans,
                        as: 'jenis_kejuaraan',
                        attributes: ['nama']
                    },
                    {  
                        model: WilayahVerDapodik,  
                        as: 'data_wilayah_mutasi',  
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']  
                    },  
                ],
            });

             // Convert to JSON and remove the id from profil
             const jsonProfil = profil ? profil.toJSON() : null;
            //  if (jsonProfil) {
            //      delete jsonProfil.id;
            //  }

            const jsonItem = resData.toJSON();
            // jsonItem.id_perangkingan_ = encodeId(jsonItem.id); // Add the encoded ID to the response
            jsonItem.data_pendaftar = jsonProfil;
            // jsonItem.id_pendaftar = encodeId(jsonItem.id_pendaftar);
            delete jsonItem.id_pendaftar; // Remove the original ID from the output

            res.status(200).json({
                status: 1,
                message: 'Data berhasil ditemukan',
                data: jsonItem
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

export const getPerangkinganDetailByNisn = async (req, res) => {
    try {
        const { nisn } = req.body;

        // Fetch the data
        let perangkingan = [];
        perangkingan = await DataPerangkingans.findOne({
            where: {
                nisn: nisn, // Pastikan id_pendaftar adalah string
                is_delete: 0
            },
            // attributes: ['no_pendaftaran', 'nisn', 'nama_lengkap', 'nilai_akhir', 'jarak', 'id_pendaftar', 'umur'],
            include: [
                {
                    model: SekolahTujuan,
                    as: 'sekolah_tujuan',
                    attributes: ['npsn', 'nama']
                },{
                    model: JalurPendaftarans,
                    as: 'jalur_pendaftaran',
                    attributes: ['bentuk_pendidikan_id', 'nama']
                },
            ]
        });

        let profil = [];
        profil = await DataPendaftars.findOne({
            where: {
                nisn: nisn,
                is_delete: 0
            },
            include: [
                {
                    model: StatusDomisilis,
                    as: 'status_domisili_name',
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
                },{
                    model: JenisKejuaraans,
                    as: 'jenis_kejuaraan',
                    attributes: ['nama']
                },
                {  
                    model: WilayahVerDapodik,  
                    as: 'data_wilayah_mutasi',  
                    attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']  
                },  
            ],
        });

        const baseUrl = `${process.env.BASE_URL}download/${nisn}/`; // Ganti dengan URL dasar yang diinginkan  
        const baseUrlDefault = `${process.env.BASE_URL}dokumen/not-found/`; // Ganti dengan URL dasar yang diinginkan
       
        return res.status(200).json({
            status: 1,
            message: 'Data berhasil ditemukan',
            profil: profil,
            perangkingan: perangkingan,
            base_url: baseUrl,
            base_url_default: baseUrlDefault,

        });

       
    } catch (err) {
        console.error('Error fetching data:', err);
        return res.status(500).json({
            status: 0,
            message: 'Error'
        });
    }
};


export const getPerangkinganDetailByNisnPengumuman = async (req, res) => {
    try {
        const { nisn } = req.body;

        // Fetch the data
        let msg = '';
        let perangkingan = [];
        perangkingan = await DataPerangkingans.findOne({
            where: {
                nisn: nisn, // Pastikan id_pendaftar adalah string
                is_delete: 0
            },
            // attributes: ['no_pendaftaran', 'nisn', 'nama_lengkap', 'nilai_akhir', 'jarak', 'id_pendaftar', 'umur', ],
            // attributes: {
            //     exclude: ['created_at', 'updated_at', 'nik'],
            //     // include: [
            //     // [sequelize.literal('`no_pendaftaran`'), 'no_pendaftaran'],
            //     // [sequelize.literal('`nisn`'), 'nisn'],
            //     //]
            // },
            include: [
                {
                    model: SekolahTujuan,
                    as: 'sekolah_tujuan',
                    attributes: ['npsn', 'nama'],
                    include: [ // Tambahkan include untuk mengambil data wilayah
                        {
                            model: WilayahVerDapodik,
                            as: 'data_wilayah_kota',
                            attributes: ['nama'] // Ambil nama kabupaten/kota
                        }
                    ]
                },
                {
                    model: SekolahJurusan,
                    as: 'sekolah_jurusan',
                    attributes: ['id', 'nama_jurusan']
                },
                {
                    model: JalurPendaftarans,
                    as: 'jalur_pendaftaran',
                    attributes: ['bentuk_pendidikan_id', 'nama']
                },
            ]
        });

        if(!perangkingan){

            return res.status(200).json({
                status: 99,
                message: 'Anda tidak terdaftar!',
                perangkingan: perangkingan,

            });

        }else{
            let sts = 0;
            if (perangkingan.is_diterima == 1) {
                sts = 1;
               // = 'Selamat! Anda telah diterima di ' + perangkingan.sekolah_tujuan.nama + '. Silakan cek informasi selanjutnya untuk proses daftar ulang.';
                    msg = `Selamat! Anda telah diterima di ${perangkingan.sekolah_tujuan.nama}  (${perangkingan.sekolah_tujuan.data_wilayah_kota.nama}). Silakan cek informasi selanjutnya untuk proses daftar ulang.`;
            } else if (perangkingan.is_diterima == 2) {

                let cekSts = 0;
                if(perangkingan.jurusan_id == 0){
                      cekSts = await hitung_cadangan_sma(perangkingan.jalur_pendaftaran_id, perangkingan.sekolah_tujuan_id, perangkingan.no_pendaftaran);
                }else{
                      cekSts = await hitung_cadangan_smk(perangkingan.jalur_pendaftaran_id, perangkingan.sekolah_tujuan_id, perangkingan.jurusan_id, perangkingan.no_pendaftaran );
                }

              
                if(cekSts == 2){

                     sts = 2;
                     msg = 'Anda masuk dalam daftar cadangan penerimaan dan lolos seleksi. Silahkan daftar ulang.';
                
                }else{

                    sts = 3;
                    msg = 'Anda tidak lolos seleksi';

                }

               
            } else {

                sts = 0;
                msg = 'Maaf, Anda belum berhasil lolos seleksi kali ini. Masih banyak kesempatan lain di jalur atau sekolah lainnya.';
            }

             return res.status(200).json({
                status: sts,
                message: msg,
                perangkingan: perangkingan,

            });

        }

       
       

       
    } catch (err) {
        console.error('Error fetching data:', err);
        return res.status(500).json({
            status: 0,
            message: 'Error'
        });
    }
};




//percobaan untuk akomodir urutan peserta didalam redis
//selain tambah redis, ada perbaikan di jarak terdekat SMK, penambahan 2% untuk anak guru
export const getPerangkinganBackupAsli = async (req, res) => {
    try {
        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id, 
            jurusan_id,
            nisn,
            is_pdf
        } = req.body;

        // Buat Redis key dengan format yang jelas
        // const redis_key = `perangkingan:${jalur_pendaftaran_id}--${sekolah_tujuan_id}--${jurusan_id || 0}`;
        const redis_key = `perangkingan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;
        const redis_key_full = `FULL_perangkingan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;

        // 1. Selalu cek Redis terlebih dahulu untuk semua request
        const cached = await redisGet(redis_key);
        let resultData;
        let fromCache = false;

        const resTimeline = await getTimelineSatuan(6);

        if (cached) {
            resultData = JSON.parse(cached);
            fromCache = true;
            console.log(`[REDIS] Cache ditemukan untuk key: ${redis_key}`);
            
            // jika cache di temukan json / pdf generate disini
            if (is_pdf == 1) {

                const docDefinition = {
                    content: [
                        { text: 'Perangkingan Pendaftaran', style: 'header' },
                        { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                        { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                        { text: 'Data Perangkingan:', style: 'subheader' },
                        {
                            table: {
                                // widths: ['auto', '*', '*', '*', '*', '*'],
                                body: [
                                    ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                    ...modifiedData.map((item, index) => [
                                        index + 1,
                                        item.no_pendaftaran,
                                        item.nama_lengkap,
                                        item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                        item.jarak,
                                    

                                    ])
                                ]
                            }
                        }
                    ],
                    styles: {
                        header: {
                            fontSize: 18,
                            bold: true,
                            margin: [0, 0, 0, 10]
                        },
                        subheader: {
                            fontSize: 14,
                            bold: true,
                            margin: [0, 10, 0, 5]
                        }
                    }
                };
            
                const pdfDoc = pdfMake.createPdf(docDefinition);
            
                // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                pdfDoc.getBase64((data) => {
                    const buffer = Buffer.from(data, 'base64');
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                    res.send(buffer);
                });
               
            }else{

                return res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan (from cache)',
                    'data': resultData,
                    'timeline': resTimeline
                });

            }
        }

        const currentDateTime = new Date().toLocaleString("id-ID", {
            year: "numeric",
            month: "long", 
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

        // Jika data tidak ada di cache atau expired cache nya, proses get dari db lalu set ke redis
        if (!fromCache) {

            if(jalur_pendaftaran_id == 1){
 
                //Jalur Zonasi Reguler SMA
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
    
                let kuota_zonasi_max = resSek.daya_tampung;
                let kuota_zonasi_min = resSek.kuota_zonasi;
    
                 
                let persentase_domisili_nilai = DomiNilaiHelper('nilai');
    
                // Hitung 3% dari kuota_zonasi_min
                // let kuota_zonasi_nilai_min = (persentase_domisili_nilai / 100) * kuota_zonasi_min;
                // let kuota_zonasi_nilai_min = Math.round((persentase_domisili_nilai / 100) * kuota_zonasi_min);
    
                //bulat keatas
                let kuota_zonasi_nilai_min = Math.ceil((persentase_domisili_nilai / 100) * kuota_zonasi_max);
    
    
                console.log('---------');
                console.log('kuota zonasi nilai:'+kuota_zonasi_nilai_min);
    
          
                console.log('---------');
                let zonasi_jarak = kuota_zonasi_min - kuota_zonasi_nilai_min;
    
                console.log('kuota zonasi jarak:'+zonasi_jarak);
                console.log('---------');
                //cari data rangking zonasi reguler (jarak)
                const resDataZonasi = await DataPerangkingans.findAndCountAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Exclude 2 and 3
                    },
                    order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Jarak terendah
                        ['umur', 'DESC'], // Umur tertua
                        ['created_at', 'ASC'] 
                    ],
                    limit: zonasi_jarak
                });
                
                const rowsZonasiReg = resDataZonasi.rows; // Data hasil query
                const totalZonasiReg = rowsZonasiReg.length; // Total jumlah data setelah limit
    
                //hitung total pendaftar prestasi dulu
                const countPrestasi = (await DataPerangkingans.findAll({  
                    attributes: ['nisn'], // Pilih kolom yang diambil
                    where: {  
                        jalur_pendaftaran_id: 3,
                        sekolah_tujuan_id,  
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    limit: resSek.kuota_prestasi
                })).length;
    
                 //hitung total pendaftar afirmasi dulu
                 const countAfirmasi = (await DataPerangkingans.findAll({  
                    where: {  
                        jalur_pendaftaran_id: 5,
                        sekolah_tujuan_id,  
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    limit: resSek.kuota_afirmasi
                })).length;
    
                 //hitung total pendaftar pto dulu
                 const countPto = (await DataPerangkingans.findAll({  
                    where: {  
                        jalur_pendaftaran_id: 4,
                        sekolah_tujuan_id,  
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    limit: resSek.kuota_pto
                })).length;
    
                let countZonasiKhusus = 0;
                if(resSek.kuota_zonasi_khusus > 0){
    
                   //hitung total pendaftar zonasi khusus
                     countZonasiKhusus = (await DataPerangkingans.findAll({  
                        attributes: ['nisn'], // Pilih kolom yang diambil
                        where: {  
                            jalur_pendaftaran_id: 2,
                            sekolah_tujuan_id,  
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Tidak daftar ulang
                        },
                        limit: resSek.kuota_zonasi_khusus
                    })).length;
    
                }else{
    
                     countZonasiKhusus = 0;
                    
                }
    
                // let kuota_zonasi_nilai = kuota_zonasi_max - totalZonasiReg - countZonasiKhusus - countPrestasi - countAfirmasi - countPto;
                // let kuota_zonasi_nilai = kuota_zonasi_max - (totalZonasiReg + countZonasiKhusus) +  countPrestasi + countAfirmasi + countPto;
    
                let kuota_terpakai = totalZonasiReg + countZonasiKhusus +  countPrestasi + countAfirmasi + countPto;


               
                // let kuota_zonasi_nilai = kuota_zonasi_max - kuota_terpakai;
                let kuota_zonasi_nilai = Math.max(0, kuota_zonasi_max - kuota_terpakai);

                console.log('totalZonasiReg :'+totalZonasiReg);
                console.log('-----');

                console.log('countZonasiKhusus :'+countZonasiKhusus);
                console.log('-----');

                console.log('countPrestasi :'+countPrestasi);
                console.log('-----');

                console.log('countAfirmasi :'+countAfirmasi);
                console.log('-----');

                console.log('countPto :'+countPto);
                console.log('-----');

                console.log('kuota_zonasi_max :'+kuota_zonasi_max);
                console.log('-----');
    
                console.log('kuota_terpakai :'+kuota_terpakai);
                console.log('-----');
    

                console.log('kuota_zonasi_nilai akhir:'+kuota_zonasi_nilai)
    
                // const resDataZonasiIds = resDataZonasi.rows.map((item) => item.id);
                const resDataZonasiIds = (resDataZonasi.rows || []).map((item) => item.id);
                const resZonasiNilai = await DataPerangkingans.findAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn', 'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'],
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },  // dinyatakan tidak daftar ulang
                        id: { [Op.notIn]: resDataZonasiIds } // Hindari ID yang sudah ada di resDataZonasi
                    },
                    order: [
                        ['nilai_akhir', 'DESC'],
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        // ['umur', 'DESC'], 
                        ['created_at', 'ASC'] 
                    ],
                    limit: kuota_zonasi_nilai
                });

               
    
                   
                const combinedData = [
                    ...(rowsZonasiReg ? rowsZonasiReg.map(item => ({
                        ...item.toJSON(),
                        order_berdasar: "1"
                    })) : []), // Jika null, gunakan array kosong
                
                    ...(resZonasiNilai ? resZonasiNilai.map(item => ({
                        ...item.toJSON(),
                        order_berdasar: "2"
                    })) : []) // Jika null, gunakan array kosong
                ];
    
                const modifiedData = combinedData.map(item => {
                    const { id_pendaftar, id, ...rest } = item;
                    return { 
                        ...rest, 
                        id: encodeId(id), 
                        id_pendaftar: encodeId(id_pendaftar) 
                    };
                });

                // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);


                const resZonasiNilai99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                        }
                    },
                    order: [
                        ['nilai_akhir', 'DESC'],
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        // ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    // limit: kuota_zonasi
                    limit: KUOTA_CADANGAN
                });

                const modifiedData99 = resZonasiNilai99.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    // return { ...rest, id: encodeId(id) };
                    return { 
                        ...rest, 
                        id: encodeId(id), 
                        id_pendaftar: encodeId(id_pendaftar),
                        status_daftar_sekolah: 0
                    };
                });

                const combinedData99 = [...modifiedData, ...modifiedData99];
                //ini untuk simpan data yang full pendaftar
                await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
                
                if (is_pdf === 1) {
                    // Generate PDF
                    const docDefinition = {
                        content: [
                            { text: 'Perangkingan Pendaftaran', style: 'header' },
                            { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                            { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                            { text: 'Data Perangkingan:', style: 'subheader' },
                            {
                                table: {
                                    // widths: ['auto', '*', '*', '*', '*', '*'],
                                    body: [
                                        ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                        ...modifiedData.map((item, index) => [
                                            index + 1,
                                            item.no_pendaftaran,
                                            item.nama_lengkap,
                                            item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                            item.jarak,
                                        
    
                                        ])
                                    ]
                                }
                            }
                        ],
                        styles: {
                            header: {
                                fontSize: 18,
                                bold: true,
                                margin: [0, 0, 0, 10]
                            },
                            subheader: {
                                fontSize: 14,
                                bold: true,
                                margin: [0, 10, 0, 5]
                            }
                        }
                    };
                
                    const pdfDoc = pdfMake.createPdf(docDefinition);
                
                    // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                    pdfDoc.getBase64((data) => {
                        const buffer = Buffer.from(data, 'base64');
                        res.setHeader('Content-Type', 'application/pdf');
                        res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                        res.send(buffer);
                    });
    
                }else{
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': modifiedData, // Return the found data
                        'timeline': resTimeline
                    });
    
                }
    
    
                // res.status(200).json({
                //     'status': 1,
                //     'message': 'Data berhasil ditemukan',
                //     'data': modifiedData, // Return the found data
                //     'timeline' : resTimeline
                // });
                
    
            }else if(jalur_pendaftaran_id == 2){
                //Jalur Zonasi KHUSUS SMA
    
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
    
                let kuota_zonasi_khusus = resSek.kuota_zonasi_khusus;
    
    
                const resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        
                    },
                    order: [
                        ['umur', 'DESC'], //umur tertua
                        ['nilai_akhir', 'DESC'], //jarak terendah  
                        ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    limit: kuota_zonasi_khusus
                });

                const resData99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                        }
                        
                    },
                    order: [
                        ['umur', 'DESC'], //umur tertua
                        ['nilai_akhir', 'DESC'], //jarak terendah  
                        // ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    // limit: kuota_zonasi_khusus
                    limit: KUOTA_CADANGAN
                });
    
                if (resData) { 
                    // Check if resData is not null
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 1
                        };
                    });

                    //ini untuk simpan data yang pendaftar keterima
                    await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });


                    const combinedData99 = [...modifiedData, ...modifiedData99];
                     //ini untuk simpan data yang full pendaftar
                     await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);

    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData,
                    //     'timeline': resTimeline// Return the found data
                    // });
    
    
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
    
            }else if(jalur_pendaftaran_id == 3){
                 //Jalur Prestasi SMA
    
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
    
                let kuota_prestasi = resSek.kuota_prestasi;
    
                 const resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    order: [
                        ['nilai_akhir', 'DESC'], //nilai tertinggi
                        ['umur', 'DESC'], //umur tertua
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    limit: kuota_prestasi
                   
                });

                const resData99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                        }
                        
                    },
                    order: [
                        ['nilai_akhir', 'DESC'], //nilai tertinggi
                        ['umur', 'DESC'], //umur tertua
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    // limit: kuota_zonasi_khusus
                    limit: KUOTA_CADANGAN
                });
    
                if (resData && resData.length > 0) {
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
                    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                    });

                    // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                    await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);


                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                    //ini untuk simpan data yang full pendaftar
                    await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData,
                    //     'timeline': resTimeline // Return the found data
                    // });
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
    
    
            }else if(jalur_pendaftaran_id == 4){
                //Jalur PTO / MutasiSMA 
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
    
                let kuota_pto = resSek.kuota_pto;
    
                const resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // yang tidak daftar ulang
                    },
                    order: [
                        [literal('is_anak_guru_jateng DESC')], // Prioritaskan yang is_anak_guru_jateng = 1
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                        ['created_at', 'ASC'] // Urutkan berdasarkan waktu pendaftaran (tercepat lebih dulu)
                    ],
                    limit: kuota_pto
                });
    
                const resData99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                        }
                        
                    },
                    order: [
                        [literal('is_anak_guru_jateng DESC')], // Prioritaskan yang is_anak_guru_jateng = 1
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                        ['created_at', 'ASC'] // Urutkan berdasarkan waktu pendaftaran (tercepat lebih dulu)
                    ],
                    // limit: kuota_zonasi_khusus
                    limit: KUOTA_CADANGAN
                });

               if (resData && resData.length > 0) {
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                    });

                     // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                     await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                     const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });


                     const combinedData99 = [...modifiedData, ...modifiedData99];
                     //ini untuk simpan data yang full pendaftar
                     await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData,
                    //     'timeline': resTimeline // Return the found data
                    // });
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
    
            }else if(jalur_pendaftaran_id == 5){
            //Jalur Afirmasi SMA
    
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
                
                let daya_tampung = resSek.daya_tampung;
                let kuota_afirmasi = resSek.kuota_afirmasi;
                let kuota_persentase_ats = afirmasiSmaHelper('is_tidak_sekolah');
                let kuota_persentase_panti = afirmasiSmaHelper('is_anak_panti');
    
                let kuota_ats = Math.ceil((kuota_persentase_ats / 100) * daya_tampung) || 0;
                let kuota_panti = Math.ceil((kuota_persentase_panti / 100) * daya_tampung) || 0;
    
                console.log('kuota ats:'+kuota_ats)
                console.log('kuota panti:'+kuota_panti)
    
                const resDataPanti = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // tidak daftar ulang
                        is_anak_keluarga_tidak_mampu: '0',
                        is_anak_panti: '1',
                        is_tidak_sekolah: '0', 
                    },
                    order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    limit: kuota_panti
                });
    
                const resDataAts = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // tidak daftar ulang
                        is_anak_keluarga_tidak_mampu: '0',
                        is_anak_panti: '0',
                        is_tidak_sekolah: '1', 
                    },
                    order: [
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    limit: kuota_ats
                });
    
                // let kuota_afirmasi_sisa = kuota_afirmasi - (resDataAts.length+resDataPanti.length);
                let kuota_afirmasi_sisa = kuota_afirmasi - (resDataAts.length + resDataPanti.length);
    
                console.log('kuota kuota_afirmasi_sisa:'+kuota_afirmasi_sisa)
    
    
                const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 }, // tidak daftar ulang
                    // is_anak_keluarga_tidak_mampu: '1',
                    [Op.or]: [
                        { is_anak_keluarga_tidak_mampu: '1' },
                        { is_disabilitas: '1' }
                    ],
                    is_anak_panti: '0', // bukan anak panti
                    is_tidak_sekolah: '0', // bukan anak panti
                    // // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    // [Op.or]: [
                    //     { is_anak_keluarga_tidak_mampu: '1' },
                    //     { is_tidak_sekolah: '1' },
                    //     { is_anak_panti: '1' }
                    // ]
                },
                order: [
                    ['is_disabilitas', 'ASC'], //disabilitas 
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    ['created_at', 'ASC'] //daftar sekolah terawal
                ],
                limit: kuota_afirmasi_sisa
               
                });
                if (resData) { 
                    
                    // Check if resData is not null
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
                    const combinedData = [
                        ...(resDataPanti ? resDataPanti.map(item => ({
                            ...item.toJSON(),
                            order_berdasar: "3"
                        })) : []), // Jika null, gunakan array kosong
                    
                        ...(resDataAts ? resDataAts.map(item => ({
                            ...item.toJSON(),
                            order_berdasar: "4"
                        })) : []), // Jika null, gunakan array kosong
    
                        ...(resData ? resData.map(item => ({
                            ...item.toJSON(),
                            order_berdasar: "5"
                        })) : []), // Jika null, gunakan array kosong
                    ];
    
                    const modifiedData = combinedData.map(item => {
                        const { id_pendaftar, id, ...rest } = item;
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar) 
                        };
                    });

                     // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                     await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                     const resData99 = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            is_anak_keluarga_tidak_mampu: '1',
                            is_anak_panti: '0', // bukan anak panti
                            is_tidak_sekolah: '0', // bukan anak panti
                            id: { 
                                [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                            }
                        },
                        order: [
                            ['is_disabilitas', 'ASC'], //disabilitas 
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                            // ['created_at', 'ASC'] //daftar sekolah terawal
                        ],
                        // limit: kuota_zonasi
                        limit: KUOTA_CADANGAN
                    });

                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                    //ini untuk simpan data yang full pendaftar
                    await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);

                    // const modifiedData = resData.map(item => {
                    //     const { id_pendaftar, id, ...rest } = item.toJSON();
                    //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                    //     // return { ...rest, id: encodeId(id) };
                    // });
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData, // Return the found data
                    //     'timeline': resTimeline
                    // });
    
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
            }else if(jalur_pendaftaran_id == 6){
                //Jalur SMK Domisili Terdekat
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
    
                    let persentase_seleksi_terdekat_anak_guru = DomiSmkHelper('anak_guru');
    
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
                    
    
                    let daya_tampung = resJurSek.daya_tampung;
                    let kuota_anak_guru = Math.ceil((persentase_seleksi_terdekat_anak_guru / 100) * daya_tampung);
                    let kuota_jarak_terdekat = resJurSek.kuota_jarak_terdekat;

                    // anak guru
                    const resDataAnakGuru = await DataPerangkingans.findAndCountAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                            is_anak_guru_jateng: '1',
                        }, order: [
                            ['is_anak_guru_jateng', 'DESC'],
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                            // ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        limit: kuota_anak_guru
                        });

                    const rowsAnakGuru = resDataAnakGuru.rows; // Data hasil query
                    const totalAnakGuru = resDataAnakGuru.rows.length || 0; // Total jumlah data setelah limit

                    let kuota_akhir_jarak_terdekat = kuota_jarak_terdekat - totalAnakGuru;
    
                    // murni
                    const resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                    }, order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                        ['umur', 'DESC'], //umur tertua
                        // ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    limit: kuota_akhir_jarak_terdekat
                    });

                    const combinedData = [
                        ...(rowsAnakGuru || []).map(item => ({
                          ...item.toJSON(),
                          order_berdasar: "6"
                        })),
                        ...(resData || []).map(item => ({
                          ...item.toJSON(),
                          order_berdasar: "7"
                        }))
                      ];
    
                    // const modifiedData = resData.map(item => {
                    //     const { id_pendaftar, id, ...rest } = item.toJSON();
                    //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                    // });

                    const modifiedData = combinedData.map(item => {
                        const { id_pendaftar, id, ...rest } = item;
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar) 
                        };
                    });

                    // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                    await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                    const resData99 = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            id: { 
                                [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                            }
                        },
                        order: [
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                            ['umur', 'DESC'], //umur tertua
                            // ['created_at', 'ASC'] //daftar sekolah terawal
                        ],
                        // limit: kuota_zonasi
                        limit: KUOTA_CADANGAN
                    });
    
                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                    //ini untuk simpan data yang full pendaftar
                    await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
                    
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline
                        });
    
                    }
    
            }else if(jalur_pendaftaran_id == 7){
                //Jalur SMK Prestasi
    
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
    
                    let kuota_prestasi_max = resJurSek.daya_tampung;
                    let kuota_prestasi_min = resJurSek.kuota_prestasi;
        
                    //hitung total pendaftar domisili terdekat smk dulu,
                    const countTerdekat = (await DataPerangkingans.findAll({  
                        where: {  
                            jalur_pendaftaran_id: 6,
                            sekolah_tujuan_id,  
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                        },
                        limit: resJurSek.kuota_jarak_terdekat
                    })).length;
    
                    //hitung total pendaftar afirmasi smk dulu,
                    const countAfirmasi = (await DataPerangkingans.findAll({  
                        where: {  
                            jalur_pendaftaran_id: 9,
                            sekolah_tujuan_id,  
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition   
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        },
                        limit: resJurSek.kuota_afirmasi
                    })).length;
    
                     //hitung total pendaftar prestasi khusus
                     const countPrestasiKhusus = (await DataPerangkingans.findAll({  
                        where: {  
                            jalur_pendaftaran_id: 8,
                            sekolah_tujuan_id,  
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                        },
                        limit: resJurSek.kuota_prestasi_khusus
                    })).length;
    
                    // let kuota_prestasi = resJurSek.kuota_prestasi;
                    let kuota_prestasi = kuota_prestasi_max - (countTerdekat + countAfirmasi + countPrestasiKhusus);
    
                
                    let kuota_prestasi_akhir; // Menggunakan let untuk scope blok  
                    if(kuota_prestasi >= kuota_prestasi_min){
                        kuota_prestasi_akhir = kuota_prestasi;
                    }else{
                        kuota_prestasi_akhir = kuota_prestasi_min;
                    }
    
                    const resData = await DataPerangkingans.findAll({
                    where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition  
                        }, order: [
                            ['nilai_akhir', 'DESC'], //nilai tertinggi
                            ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        limit: kuota_prestasi_akhir
                    });


                    const resData99 = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            id: { 
                                [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                            }
                            
                        },
                        order: [
                            ['nilai_akhir', 'DESC'], //nilai tertinggi
                            ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        // limit: kuota_zonasi_khusus
                        limit: KUOTA_CADANGAN
                    });
                    
                    if (resData && resData.length > 0) {
        
                       
                        const modifiedData = resData.map(item => {
                            const { id_pendaftar, id, ...rest } = item.toJSON();
                            return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                            // return { ...rest, id: encodeId(id) };
                        });

                         // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                        await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                        console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                        const modifiedData99 = resData99.map(item => {
                            const { id_pendaftar, id, ...rest } = item.toJSON();
                            // return { ...rest, id: encodeId(id) };
                            return { 
                                ...rest, 
                                id: encodeId(id), 
                                id_pendaftar: encodeId(id_pendaftar),
                                status_daftar_sekolah: 0
                            };
                        });
    
    
                        const combinedData99 = [...modifiedData, ...modifiedData99];
                         //ini untuk simpan data yang full pendaftar
                         await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                         console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
    
                        if (is_pdf === 1) {
                            // Generate PDF
                            const docDefinition = {
                                content: [
                                    { text: 'Perangkingan Pendaftaran', style: 'header' },
                                    { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                    { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                    { text: 'Data Perangkingan:', style: 'subheader' },
                                    {
                                        table: {
                                            // widths: ['auto', '*', '*', '*', '*', '*'],
                                            body: [
                                                ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                                ...modifiedData.map((item, index) => [
                                                    index + 1,
                                                    item.no_pendaftaran,
                                                    item.nama_lengkap,
                                                    item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                    item.jarak,
    
                                                ])
                                            ]
                                        }
                                    }
                                ],
                                styles: {
                                    header: {
                                        fontSize: 18,
                                        bold: true,
                                        margin: [0, 0, 0, 10]
                                    },
                                    subheader: {
                                        fontSize: 14,
                                        bold: true,
                                        margin: [0, 10, 0, 5]
                                    }
                                }
                            };
                        
                            const pdfDoc = pdfMake.createPdf(docDefinition);
                        
                            // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                            pdfDoc.getBase64((data) => {
                                const buffer = Buffer.from(data, 'base64');
                                res.setHeader('Content-Type', 'application/pdf');
                                res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                                res.send(buffer);
                            });
    
                        }else{
    
                            res.status(200).json({
                                'status': 1,
                                'message': 'Data berhasil ditemukan',
                                'data': modifiedData, // Return the found data
                                'timeline': resTimeline
                            });
    
                        }
    
                        
    
                        
                        
        
                       
                    } else {
                        res.status(200).json({
                            'status': 0,
                            'message': 'Data kosong',
                            'data': [], // Return null or an appropriate value when data is not found
                            'timeline': resTimeline // Return the found data
                        });
                    }
            }else if(jalur_pendaftaran_id == 8){
                //Jalur SMK Prestasi Khusus
    
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
    
                    let kuota_prestasi_khusus = resJurSek.kuota_prestasi_khusus;
    
                    const resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    }, order: [
                        // ['nilai_akhir', 'DESC'], //nilai tertinggi
                        // ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    limit: kuota_prestasi_khusus
                    });
                    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                        
                    });

                     // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                     await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);


                     const resData99 = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            id: { 
                                [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                            }
                            
                        },
                        order: [
                            // ['umur', 'DESC'], //umur tertua
                            // ['nilai_akhir', 'DESC'], //jarak terendah  
                            // ['created_at', 'ASC'] //daftar sekolah terawal
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        // limit: kuota_zonasi_khusus
                        limit: KUOTA_CADANGAN
                    });

                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                     //ini untuk simpan data yang full pendaftar
                     await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline
                        });
    
                    }
    
            }else if(jalur_pendaftaran_id == 9){
                //Jalur SMK Afirmasi
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
    
                    let kuota_afirmasi = resJurSek.kuota_afirmasi;
    
                    let miskin = afirmasiSmkHelper('is_anak_keluarga_miskin');
                    let panti = afirmasiSmkHelper('is_anak_panti');
                    let ats = afirmasiSmkHelper('is_tidak_sekolah');
                    let jml = miskin + panti + ats;
    
                    let kuota_panti = Math.round((panti / jml) * kuota_afirmasi) || 0;
                    let kuota_ats = Math.round((ats / jml) * kuota_afirmasi) || 0;
    
                    //ATS
                    const resDataAts = await DataPerangkingans.findAndCountAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                            is_tidak_sekolah: '1',         
                            // [Op.or]: [
                            //     { is_anak_keluarga_tidak_mampu: '1' },
                            //     { is_tidak_sekolah: '1' },
                            //     { is_anak_panti: '1' }
                            // ]               
                        }, order: [
                            ['umur', 'DESC'], //umur tertua
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                            // ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        limit: kuota_panti
                    });
    
                    const rowsAtsR = resDataAts.rows; // Data hasil query
                    const totalAtsL = resDataAts.rows.length || 0; // Total jumlah data setelah limit
    
                    //panti
                    const resDataPanti = await DataPerangkingans.findAndCountAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                            is_anak_panti: '1',          
                        }, order: [
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                            ['umur', 'DESC'], //umur tertua
                            // ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        limit: kuota_ats
                    });
    
                    const rowsPantiR = resDataPanti.rows; // Data hasil query
                    const totalPatntiL = resDataPanti.rows.length || 0; // Total jumlah data setelah limit
    
    
                    let kuota_akhir_afirmasi = kuota_afirmasi - (totalPatntiL + totalAtsL)
                    
                    console.log('---');
                    console.log('total panti:'+totalPatntiL);
                    console.log('---');
                    console.log('total ats:'+totalAtsL);
                    console.log('---');
                    console.log('total akhir:'+kuota_akhir_afirmasi);
                    console.log('---');
    
                    const resAtsIds = (rowsAtsR.rows || []).map((item) => item.id);
                    const resPantiIds = (rowsPantiR.rows || []).map((item) => item.id);
    
                    //afirmasi murni miskin
                    const resDataMiskin = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                        is_anak_keluarga_tidak_mampu: '1',  
                        is_anak_panti: '0', // bukan anak panti
                        is_tidak_sekolah: '0', // bukan anak ats
                        id: { [Op.notIn]: [...resAtsIds, ...resPantiIds] } // Gabungkan ID ATS & Panti
                                    
                    }, order: [
                        ['nilai_akhir', 'DESC'], //nilai tertinggi
                        ['umur', 'DESC'], //umur tertua
                        // ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    limit: kuota_akhir_afirmasi
                    });
    
                        // const modifiedData = [...rowsAtsR, ...rowsPantiR, ...resDataMiskin,].map(item => {
                        //     const { id_pendaftar, id, ...rest } = item.toJSON();
                        //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // });
    
                        // const modifiedData = [...(rowsAtsR || []), ...(rowsPantiR || []), ...(resDataMiskin || [])].map(item => {
                        //     const { id_pendaftar, id, ...rest } = item.toJSON();
                        //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // });
    
                        const combinedData = [
                            ...(rowsPantiR || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "3"
                            })),
                            ...(rowsAtsR || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "4"
                            })),
                            ...(resDataMiskin || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "5"
                            }))
                          ];
                          
    
                          const modifiedData = combinedData.map(item => {
                            const { id_pendaftar, id, ...rest } = item;
                            return { 
                                ...rest, 
                                id: encodeId(id), 
                                id_pendaftar: encodeId(id_pendaftar) 
                            };
                        });

                        // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                        await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                        console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);
                        
                        const resData99 = await DataPerangkingans.findAll({
                            where: {
                                jalur_pendaftaran_id,
                                sekolah_tujuan_id,
                                is_delete: 0,
                                is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                                // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                                is_anak_keluarga_tidak_mampu: '1',
                                is_anak_panti: '0', // bukan anak panti
                                is_tidak_sekolah: '0', // bukan anak ats
                                id: { 
                                    [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                                }
                            },
                            order: [
                                ['nilai_akhir', 'DESC'], //nilai tertinggi
                                ['umur', 'DESC'], //umur tertua
                                // ['created_at', 'ASC'] // daftar sekolah terawal
                            ],
                            limit: KUOTA_CADANGAN
                        });
    
                        const modifiedData99 = resData99.map(item => {
                            const { id_pendaftar, id, ...rest } = item.toJSON();
                            // return { ...rest, id: encodeId(id) };
                            return { 
                                ...rest, 
                                id: encodeId(id), 
                                id_pendaftar: encodeId(id_pendaftar),
                                status_daftar_sekolah: 0
                            };
                        });
    
                        const combinedData99 = [...modifiedData, ...modifiedData99];
                        //ini untuk simpan data yang full pendaftar
                        await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                        console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                        if (is_pdf === 1) {
                            // Generate PDF
                            const docDefinition = {
                                content: [
                                    { text: 'Perangkingan Pendaftaran', style: 'header' },
                                    { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                    { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                    { text: 'Data Perangkingan:', style: 'subheader' },
                                    {
                                        table: {
                                            // widths: ['auto', '*', '*', '*', '*', '*'],
                                            body: [
                                                ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                                ...modifiedData.map((item, index) => [
                                                    index + 1,
                                                    item.no_pendaftaran,
                                                    item.nama_lengkap,
                                                    item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                    item.jarak,
    
                                                ])
                                            ]
                                        }
                                    }
                                ],
                                styles: {
                                    header: {
                                        fontSize: 18,
                                        bold: true,
                                        margin: [0, 0, 0, 10]
                                    },
                                    subheader: {
                                        fontSize: 14,
                                        bold: true,
                                        margin: [0, 10, 0, 5]
                                    }
                                }
                            };
                        
                            const pdfDoc = pdfMake.createPdf(docDefinition);
                        
                            // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                            pdfDoc.getBase64((data) => {
                                const buffer = Buffer.from(data, 'base64');
                                res.setHeader('Content-Type', 'application/pdf');
                                res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                                res.send(buffer);
                            });
    
                        }else{
    
                            res.status(200).json({
                                'status': 1,
                                'message': 'Data berhasil ditemukan',
                                'data': modifiedData, // Return the found data
                                'timeline': resTimeline
                            });
    
                        }
    
            }else{
                          
                res.status(200).json({
                    'status': 0,
                    'message': 'Ada kesalahan, jalur pendaftaran tidak ditemukan',
                    'data': [], // Return null or an appropriate value when data is not found
                    'timeline': resTimeline // Return the found data
                });
    
            }
    
        }

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({
            'status': 0,
            'message': 'Error'
        });
    }
}

//selain tambah redis, ada perbaikan di jarak terdekat SMK, penambahan 2% untuk anak guru
export const getPerangkingan = async (req, res) => {
    try {
        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id, 
            jurusan_id,
            nisn,
            is_pdf
        } = req.body;

        // Buat Redis key dengan format yang jelas
        // const redis_key = `perangkingan:${jalur_pendaftaran_id}--${sekolah_tujuan_id}--${jurusan_id || 0}`;
        const redis_key = `perangkingan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;
        const redis_key_full = `FULL_perangkingan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;


        const WAKTU_CAHCE_JURNAL = await checkWaktuCachePerangkingan();

        // 1. Selalu cek Redis terlebih dahulu untuk semua request
        const cached = await redisGet(redis_key);
        let resultData;
        let fromCache = false;

        const resTimeline = await getTimelineSatuan(6);

        if (cached) {
            resultData = JSON.parse(cached);
            fromCache = true;
            console.log(`[REDIS] Cache ditemukan untuk key: ${redis_key}`);
            
            // jika cache di temukan json / pdf generate disini
            if (is_pdf == 1) {

                const docDefinition = {
                    content: [
                        { text: 'Perangkingan Pendaftaran', style: 'header' },
                        { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                        { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                        { text: 'Data Perangkingan:', style: 'subheader' },
                        {
                            table: {
                                // widths: ['auto', '*', '*', '*', '*', '*'],
                                body: [
                                    ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                    ...modifiedData.map((item, index) => [
                                        index + 1,
                                        item.no_pendaftaran,
                                        item.nama_lengkap,
                                        item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                        item.jarak,
                                    

                                    ])
                                ]
                            }
                        }
                    ],
                    styles: {
                        header: {
                            fontSize: 18,
                            bold: true,
                            margin: [0, 0, 0, 10]
                        },
                        subheader: {
                            fontSize: 14,
                            bold: true,
                            margin: [0, 10, 0, 5]
                        }
                    }
                };
            
                const pdfDoc = pdfMake.createPdf(docDefinition);
            
                // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                pdfDoc.getBase64((data) => {
                    const buffer = Buffer.from(data, 'base64');
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                    res.send(buffer);
                });
               
            }else{

                return res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan (from cache)',
                    'data': resultData,
                    'timeline': resTimeline,
                    'waktu_cache': WAKTU_CAHCE_JURNAL,

                });

            }
        }

        const currentDateTime = new Date().toLocaleString("id-ID", {
            year: "numeric",
            month: "long", 
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

        // Jika data tidak ada di cache atau expired cache nya, proses get dari db lalu set ke redis
        if (!fromCache) {

            if(jalur_pendaftaran_id == 1){
 
                //Jalur Zonasi Reguler SMA
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
    
                let kuota_zonasi_max = resSek.daya_tampung;
                let kuota_zonasi_min = resSek.kuota_zonasi;
    
                 
                let persentase_domisili_nilai = DomiNilaiHelper('nilai');
    
                // Hitung 3% dari kuota_zonasi_min
                // let kuota_zonasi_nilai_min = (persentase_domisili_nilai / 100) * kuota_zonasi_min;
                // let kuota_zonasi_nilai_min = Math.round((persentase_domisili_nilai / 100) * kuota_zonasi_min);
    
                //bulat keatas
                let kuota_zonasi_nilai_min = Math.ceil((persentase_domisili_nilai / 100) * kuota_zonasi_max);
    
    
                console.log('---------');
                console.log('kuota zonasi nilai:'+kuota_zonasi_nilai_min);
    
          
                console.log('---------');
                let zonasi_jarak = kuota_zonasi_min - kuota_zonasi_nilai_min;

                zonasi_jarak = Math.max(0, zonasi_jarak);
    
                console.log('kuota zonasi jarak:'+zonasi_jarak);
                console.log('---------');
                //cari data rangking zonasi reguler (jarak)
                const resDataZonasi = await DataPerangkingans.findAndCountAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Exclude 2 and 3
                    },
                    order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Jarak terendah
                        ['umur', 'DESC'], // Umur tertua
                        ['created_at', 'ASC'] 
                    ],
                    limit: zonasi_jarak
                });
                
                const rowsZonasiReg = resDataZonasi.rows; // Data hasil query
                const totalZonasiReg = rowsZonasiReg.length; // Total jumlah data setelah limit
    
                //hitung total pendaftar prestasi dulu
                const countPrestasi = (await DataPerangkingans.findAll({  
                    attributes: ['nisn'], // Pilih kolom yang diambil
                    where: {  
                        jalur_pendaftaran_id: 3,
                        sekolah_tujuan_id,  
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    limit: resSek.kuota_prestasi
                })).length;
    
                 //hitung total pendaftar afirmasi dulu
                 const countAfirmasi = (await DataPerangkingans.findAll({  
                    where: {  
                        jalur_pendaftaran_id: 5,
                        sekolah_tujuan_id,  
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    limit: resSek.kuota_afirmasi
                })).length;
    
                 //hitung total pendaftar pto dulu
                 const countPto = (await DataPerangkingans.findAll({  
                    where: {  
                        jalur_pendaftaran_id: 4,
                        sekolah_tujuan_id,  
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    limit: resSek.kuota_pto
                
                })).length;
    
                
                let countZonasiKhusus = 0;

                let zonKhData = []; // Untuk menyimpan data per zonasi khusus
                let totalZonasiKhusus = 0; // Untuk menyimpan total keseluruhan
                if(resSek.kuota_zonasi_khusus > 0){

                    const npsn = resSek.npsn;
                    const resZonKh = await SekolahZonasiKhususByNpsn(npsn);


                    for (const zonKh of resZonKh) {
                        // Hitung pendaftar untuk zonasi khusus saat ini
                        const currentCount = (await DataPerangkingans.findAll({  
                            attributes: ['nisn'],
                            where: {  
                                jalur_pendaftaran_id: 2,
                                sekolah_tujuan_id,  
                                kode_kecamatan: zonKh.kode_wilayah_kec,  
                                is_delete: 0,
                                is_daftar_ulang: { [Op.ne]: 2 },
                                // Tambahkan kondisi spesifik zonKh jika diperlukan
                                // contoh: zonasi_khusus_id: zonKh.id
                            },
                            limit: zonKh.kuota_zonasi_khusus
                        })).length;
                
                        // Simpan data per zonasi khusus
                        zonKhData.push({
                            zonasi_khusus_id: zonKh.id,
                            nama_zonasi_khusus: zonKh.nama, // atau field lain yang relevan
                            jumlah_pendaftar: currentCount
                        });
                
                        // Tambahkan ke total
                        totalZonasiKhusus += currentCount;
                    }
    
                    // Set countZonasiKhusus dengan total keseluruhan
                    countZonasiKhusus = totalZonasiKhusus;
                    
                    // Contoh output
                    console.log('Data per zonasi khusus:', zonKhData);
                    console.log('Total pendaftar zonasi khusus:', totalZonasiKhusus);
    
                }else{
    
                     countZonasiKhusus = 0;
                     console.log('Tidak ada kuota zonasi khusus');
                    
                }
    
                // let kuota_zonasi_nilai = kuota_zonasi_max - totalZonasiReg - countZonasiKhusus - countPrestasi - countAfirmasi - countPto;
                // let kuota_zonasi_nilai = kuota_zonasi_max - (totalZonasiReg + countZonasiKhusus) +  countPrestasi + countAfirmasi + countPto;
    
                let kuota_terpakai = totalZonasiReg + countZonasiKhusus +  countPrestasi + countAfirmasi + countPto;


               
                // let kuota_zonasi_nilai = kuota_zonasi_max - kuota_terpakai;
                let kuota_zonasi_nilai = Math.max(0, kuota_zonasi_max - kuota_terpakai);

                console.log('totalZonasiReg :'+totalZonasiReg);
                console.log('-----');

                console.log('countZonasiKhusus :'+countZonasiKhusus);
                console.log('-----');

                console.log('countPrestasi :'+countPrestasi);
                console.log('-----');

                console.log('countAfirmasi :'+countAfirmasi);
                console.log('-----');

                console.log('countPto :'+countPto);
                console.log('-----');

                console.log('kuota_zonasi_max :'+kuota_zonasi_max);
                console.log('-----');
    
                console.log('kuota_terpakai :'+kuota_terpakai);
                console.log('-----');
    

                console.log('kuota_zonasi_nilai akhir:'+kuota_zonasi_nilai)
    
                // const resDataZonasiIds = resDataZonasi.rows.map((item) => item.id);
                const resDataZonasiIds = (resDataZonasi.rows || []).map((item) => item.id);
                const resZonasiNilai = await DataPerangkingans.findAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn', 'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur'],
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },  // dinyatakan tidak daftar ulang
                        id: { [Op.notIn]: resDataZonasiIds } // Hindari ID yang sudah ada di resDataZonasi
                    },
                    order: [
                        ['nilai_akhir', 'DESC'],
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        ['umur', 'DESC'], 
                        ['created_at', 'ASC'] 
                    ],
                    // limit: kuota_zonasi_nilai
                    limit: Math.max(kuota_zonasi_nilai ?? 0, 0)
                });
    
                   
                const combinedData = [
                    ...(rowsZonasiReg ? rowsZonasiReg.map(item => ({
                        ...item.toJSON(),
                        order_berdasar: "1"
                    })) : []), // Jika null, gunakan array kosong
                
                    ...(resZonasiNilai ? resZonasiNilai.map(item => ({
                        ...item.toJSON(),
                        order_berdasar: "2"
                    })) : []) // Jika null, gunakan array kosong
                ];
    
                const modifiedData = combinedData.map(item => {
                    const { id_pendaftar, id, ...rest } = item;
                    return { 
                        ...rest, 
                        id: encodeId(id), 
                        id_pendaftar: encodeId(id_pendaftar) 
                    };
                });

                // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                // await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                
                console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                const resZonasiNilai99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                        }
                    },
                    order: [
                        ['nilai_akhir', 'DESC'],
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        // ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    // limit: kuota_zonasi
                    limit: KUOTA_CADANGAN
                });

                const modifiedData99 = resZonasiNilai99.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    // return { ...rest, id: encodeId(id) };
                    return { 
                        ...rest, 
                        id: encodeId(id), 
                        id_pendaftar: encodeId(id_pendaftar),
                        status_daftar_sekolah: 0
                    };
                });

                const combinedData99 = [...modifiedData, ...modifiedData99];
                //ini untuk simpan data yang full pendaftar
                //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
                
                if (is_pdf === 1) {
                    // Generate PDF
                    const docDefinition = {
                        content: [
                            { text: 'Perangkingan Pendaftaran', style: 'header' },
                            { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                            { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                            { text: 'Data Perangkingan:', style: 'subheader' },
                            {
                                table: {
                                    // widths: ['auto', '*', '*', '*', '*', '*'],
                                    body: [
                                        ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                        ...modifiedData.map((item, index) => [
                                            index + 1,
                                            item.no_pendaftaran,
                                            item.nama_lengkap,
                                            item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                            item.jarak,
                                        
    
                                        ])
                                    ]
                                }
                            }
                        ],
                        styles: {
                            header: {
                                fontSize: 18,
                                bold: true,
                                margin: [0, 0, 0, 10]
                            },
                            subheader: {
                                fontSize: 14,
                                bold: true,
                                margin: [0, 10, 0, 5]
                            }
                        }
                    };
                
                    const pdfDoc = pdfMake.createPdf(docDefinition);
                
                    // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                    pdfDoc.getBase64((data) => {
                        const buffer = Buffer.from(data, 'base64');
                        res.setHeader('Content-Type', 'application/pdf');
                        res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                        res.send(buffer);
                    });
    
                }else{
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': modifiedData, // Return the found data
                        'timeline': resTimeline,
                        'waktu_cache': WAKTU_CAHCE_JURNAL,
                    });
    
                }
    
    
                // res.status(200).json({
                //     'status': 1,
                //     'message': 'Data berhasil ditemukan',
                //     'data': modifiedData, // Return the found data
                //     'timeline' : resTimeline
                // });
                
    
            }else if(jalur_pendaftaran_id == 2){
                //Jalur Zonasi KHUSUS SMA
    
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);

                const npsn = resSek.npsn;
                const resZonKh = await SekolahZonasiKhususByNpsn(npsn);

                let resData = [];

                for (const zonKh of resZonKh) {
                    const resDataQ = await DataPerangkingans.findAll({
                        attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur'], // Pilih kolom yang diambil
                        include: [
                            {
                                model: WilayahVerDapodik,
                                as: 'data_wilayah_kec',
                                attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
                            }
                        ],
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            kode_kecamatan: zonKh.kode_wilayah_kec,  
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },
                            [Op.or]: [
                                { is_tidak_boleh_domisili: { [Op.is]: null } },
                                { is_tidak_boleh_domisili: 0 }
                            ],
                        },
                        order: [
                            ['umur', 'DESC'],
                            ['nilai_akhir', 'DESC'],
                            ['created_at', 'ASC']
                        ],
                        limit: zonKh.kuota_zonasi_khusus
                    });
                
                    // resData = resDataQ.concat(resDataQ);
                    resData = resData.concat(resDataQ);
                }
    
                
                //let kuota_zonasi_khusus = resSek.kuota_zonasi_khusus;    
                // const resData = await DataPerangkingans.findAll({
                //     where: {
                //         jalur_pendaftaran_id,
                //         sekolah_tujuan_id,
                //         is_delete: 0,
                //         is_daftar_ulang: { [Op.ne]: 2 }// dinyatakan tidak daftar ulang
                //         // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        
                //     },
                //     order: [
                //         ['umur', 'DESC'], //umur tertua
                //         ['nilai_akhir', 'DESC'], //jarak terendah  
                //         ['created_at', 'ASC'] //daftar sekolah terawal
                //     ],
                //     limit: kuota_zonasi_khusus
                // });

                const resData99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                        }
                        
                    },
                    order: [
                        ['umur', 'DESC'], //umur tertua
                        ['nilai_akhir', 'DESC'], //jarak terendah  
                        ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    // limit: kuota_zonasi_khusus
                    limit: KUOTA_CADANGAN
                });
    
                if (resData) { 
                    // Check if resData is not null
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 1
                        };
                    });

                    //ini untuk simpan data yang pendaftar keterima
                   // await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                    console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });


                    const combinedData99 = [...modifiedData, ...modifiedData99];
                     //ini untuk simpan data yang full pendaftar
                    //  await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);

    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline,
                            'waktu_cache': WAKTU_CAHCE_JURNAL,
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData,
                    //     'timeline': resTimeline// Return the found data
                    // });
    
    
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
    
            }else if(jalur_pendaftaran_id == 3){
                 //Jalur Prestasi SMA
    
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
    
                let kuota_prestasi = resSek.kuota_prestasi;
    
                 const resData = await DataPerangkingans.findAll({
                     attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'nilai_raport'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    order: [
                        ['nilai_akhir', 'DESC'], //nilai tertinggi
                        ['umur', 'DESC'], //umur tertua
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        // [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    limit: kuota_prestasi
                   
                });

                const resData99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                        }
                        
                    },
                    order: [
                        ['nilai_akhir', 'DESC'], //nilai tertinggi
                        ['umur', 'DESC'], //umur tertua
                        // [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    // limit: kuota_zonasi_khusus
                    limit: KUOTA_CADANGAN
                });
    
                if (resData && resData.length > 0) {
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
                    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                    });

                    // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                    //await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                    console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);


                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                    //ini untuk simpan data yang full pendaftar
                    //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline,
                            'waktu_cache': WAKTU_CAHCE_JURNAL,
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData,
                    //     'timeline': resTimeline // Return the found data
                    // });
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
    
    
            }else if(jalur_pendaftaran_id == 4){
                //Jalur PTO / MutasiSMA 
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
    
                let kuota_pto = resSek.kuota_pto;
    
                const resData = await DataPerangkingans.findAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_anak_guru_jateng'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // yang tidak daftar ulang
                    },
                    order: [
                        [literal('is_anak_guru_jateng DESC')], // Prioritaskan yang is_anak_guru_jateng = 1
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] // Urutkan berdasarkan waktu pendaftaran (tercepat lebih dulu)
                    ],
                    limit: kuota_pto
                });
    
                const resData99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                        }
                        
                    },
                    order: [
                        [literal('is_anak_guru_jateng DESC')], // Prioritaskan yang is_anak_guru_jateng = 1
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] // Urutkan berdasarkan waktu pendaftaran (tercepat lebih dulu)
                    ],
                    // limit: kuota_zonasi_khusus
                    limit: KUOTA_CADANGAN
                });

               if (resData && resData.length > 0) {
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                    });

                     // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                     //await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                     console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                     const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });


                     const combinedData99 = [...modifiedData, ...modifiedData99];
                     //ini untuk simpan data yang full pendaftar
                     //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                     console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline,
                            'waktu_cache': WAKTU_CAHCE_JURNAL,
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData,
                    //     'timeline': resTimeline // Return the found data
                    // });
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
    
            }else if(jalur_pendaftaran_id == 5){
                //Jalur Afirmasi SMA
    
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
                
                let daya_tampung = resSek.daya_tampung;
                let kuota_afirmasi = resSek.kuota_afirmasi;
                let kuota_persentase_ats = afirmasiSmaHelper('is_tidak_sekolah');
                let kuota_persentase_panti = afirmasiSmaHelper('is_anak_panti');
    
                // let kuota_ats = Math.ceil((kuota_persentase_ats / 100) * daya_tampung) || 0;
                // let kuota_panti = Math.ceil((kuota_persentase_panti / 100) * daya_tampung) || 0;
                
                let kuota_ats = Math.max(Math.ceil((kuota_persentase_ats / 100) * daya_tampung) || 0, 0);
                let kuota_panti = Math.max(Math.ceil((kuota_persentase_panti / 100) * daya_tampung) || 0, 0);
    
                console.log('kuota ats:'+kuota_ats)
                console.log('kuota panti:'+kuota_panti)
    
                const resDataPanti = await DataPerangkingans.findAndCountAll({
                     attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_disabilitas', 'is_tidak_sekolah'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // tidak daftar ulang
                        is_anak_keluarga_tidak_mampu: '0',
                        is_anak_panti: '1',
                        is_tidak_sekolah: '0', 
                    },
                    order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    limit: kuota_panti
                });

                const rowsPantiR = resDataPanti.rows; // Data hasil query
                const totalPatntiL = resDataPanti.rows.length || 0; // Total jumlah data setelah limit
    
                const resDataAts = await DataPerangkingans.findAndCountAll({
                     attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_disabilitas', 'is_tidak_sekolah'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // tidak daftar ulang
                        is_anak_keluarga_tidak_mampu: '0',
                        is_anak_panti: '0',
                        is_tidak_sekolah: '1', 
                    },
                    order: [
                        ['umur', 'DESC'], //umur tertua
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                        ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    limit: kuota_ats
                });

                const rowsAtsR = resDataAts.rows; // Data hasil query
                const totalAtsL = resDataAts.rows.length || 0; // Total jumlah data setelah limit
    
                // let kuota_afirmasi_sisa = kuota_afirmasi - (resDataAts.length+resDataPanti.length);
                //let kuota_afirmasi_sisa = kuota_afirmasi - (resDataAts.length + resDataPanti.length);
                let kuota_afirmasi_sisa = kuota_afirmasi - (totalPatntiL + totalAtsL)
    
                console.log('kuota kuota_afirmasi_sisa:'+kuota_afirmasi_sisa)

                const resAtsIds = (rowsAtsR.rows || []).map((item) => item.id);
                const resPantiIds = (rowsPantiR.rows || []).map((item) => item.id);
    
                const resDataMiskin = await DataPerangkingans.findAll({
                     attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_disabilitas', 'is_tidak_sekolah'], // Pilih kolom yang diambil
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 }, // tidak daftar ulang
                    // is_anak_keluarga_tidak_mampu: '1',
                    [Op.or]: [
                        { is_anak_keluarga_tidak_mampu: '1' },
                        { is_disabilitas: '1' }
                    ],
                    is_anak_panti: '0', // bukan anak panti
                    is_tidak_sekolah: '0', // bukan anak panti
                    id: { [Op.notIn]: [...resAtsIds, ...resPantiIds] } // Gabungkan ID ATS & Panti
                    // // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    // [Op.or]: [
                    //     { is_anak_keluarga_tidak_mampu: '1' },
                    //     { is_tidak_sekolah: '1' },
                    //     { is_anak_panti: '1' }
                    // ]
                },
                order: [
                    ['is_disabilitas', 'DESC'], //disabilitas 
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] //daftar sekolah terawal
                ],
                // limit: kuota_afirmasi_sisa
                limit: Math.max(kuota_afirmasi_sisa ?? 0, 0)
               
                });
                if (resDataMiskin) { 
                    
                    // Check if resData is not null
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
                    // const combinedData = [
                    //     ...(resDataPanti ? resDataPanti.map(item => ({
                    //         ...item.toJSON(),
                    //         order_berdasar: "3"
                    //     })) : []), // Jika null, gunakan array kosong
                    
                    //     ...(resDataAts ? resDataAts.map(item => ({
                    //         ...item.toJSON(),
                    //         order_berdasar: "4"
                    //     })) : []), // Jika null, gunakan array kosong
    
                    //     ...(resData ? resData.map(item => ({
                    //         ...item.toJSON(),
                    //         order_berdasar: "5"
                    //     })) : []), // Jika null, gunakan array kosong
                    // ];

                     const combinedData = [
                            ...(rowsPantiR || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "3"
                            })),
                            ...(rowsAtsR || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "4"
                            })),
                            ...(resDataMiskin || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "5"
                            }))
                          ];
    
                    const modifiedData = combinedData.map(item => {
                        const { id_pendaftar, id, ...rest } = item;
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar) 
                        };
                    });

                     // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                     //await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                     console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                     const resData99 = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            is_anak_keluarga_tidak_mampu: '1',
                            is_anak_panti: '0', // bukan anak panti
                            is_tidak_sekolah: '0', // bukan anak panti
                            id: { 
                                [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                            }
                        },
                        order: [
                            // ['is_disabilitas', 'ASC'], //disabilitas 
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                            ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] //daftar sekolah terawal
                        ],
                        // limit: kuota_zonasi
                        limit: KUOTA_CADANGAN
                    });

                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                    //ini untuk simpan data yang full pendaftar
                    //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);

                    // const modifiedData = resData.map(item => {
                    //     const { id_pendaftar, id, ...rest } = item.toJSON();
                    //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                    //     // return { ...rest, id: encodeId(id) };
                    // });
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline,
                            'waktu_cache': WAKTU_CAHCE_JURNAL,
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData, // Return the found data
                    //     'timeline': resTimeline
                    // });
    
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
            }else if(jalur_pendaftaran_id == 6){
                //Jalur SMK Domisili Terdekat
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
    
                    let persentase_seleksi_terdekat_anak_guru = DomiSmkHelper('anak_guru');
    
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);

                    
    
                    let npsnnya = resJurSek.npsn;
                    let daya_tampung = resJurSek.daya_tampung;
                    //let kuota_anak_guru = Math.ceil((persentase_seleksi_terdekat_anak_guru / 100) * daya_tampung);
                    let kuota_anak_guru = Math.max(Math.ceil((persentase_seleksi_terdekat_anak_guru / 100) * daya_tampung) ?? 0, 0);
                    // limit: Math.max(kuota_afirmasi_sisa ?? 0, 0)
                    let kuota_jarak_terdekat = resJurSek.kuota_jarak_terdekat;

                    console.log('ANAKGURU ____ AAAA: '+kuota_anak_guru)

                    // anak guru
                    const resDataAnakGuru = await DataPerangkingans.findAndCountAll({
                         attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_anak_guru_jateng', 'npsn_anak_guru'], // Pilih kolom yang diambil
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                            npsn_anak_guru: npsnnya,
                            is_anak_guru_jateng: '1',

                        }, order: [
                            ['is_anak_guru_jateng', 'DESC'],
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                            // ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        limit: kuota_anak_guru
                        });

                    const rowsAnakGuru = resDataAnakGuru.rows; // Data hasil query
                    const totalAnakGuru = resDataAnakGuru.rows.length || 0; // Total jumlah data setelah limit
                    const excludedNisn = rowsAnakGuru.map(item => item.nisn); // Ambil semua NISN dari hasil anak guru

                    let kuota_akhir_jarak_terdekat = kuota_jarak_terdekat - totalAnakGuru;
    
                    // murni
                    const resData = await DataPerangkingans.findAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_anak_guru_jateng', 'npsn_anak_guru'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                        // is_anak_guru_jateng: { [Op.ne]: '1' },
                        // is_tidak_boleh_domisili: { [Op.ne]: '1' },
                        // is_tidak_boleh_domisili: { [Op.not]: '1' }
                        // Alternatif (lebih panjang, tidak disarankan)
                        [Op.or]: [
                            { is_tidak_boleh_domisili: { [Op.is]: null } },
                            { is_tidak_boleh_domisili: 0 }
                        ],
                        nisn: { [Op.notIn]: excludedNisn } // Exclude NISN yang sudah terpilih di anak guru
                    }, order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                        ['umur', 'DESC'], //umur tertua
                        // ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    //limit: kuota_akhir_jarak_terdekat
                    limit: Math.max(kuota_akhir_jarak_terdekat ?? 0, 0)
                    });

                    const combinedData = [
                        ...(rowsAnakGuru || []).map(item => ({
                          ...item.toJSON(),
                          order_berdasar: "6"
                        })),
                        ...(resData || []).map(item => ({
                          ...item.toJSON(),
                          order_berdasar: "7"
                        }))
                      ];
    
                    // const modifiedData = resData.map(item => {
                    //     const { id_pendaftar, id, ...rest } = item.toJSON();
                    //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                    // });

                    const modifiedData = combinedData.map(item => {
                        const { id_pendaftar, id, ...rest } = item;
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar) 
                        };
                    });

                    // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                    //await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                    console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                    const resData99 = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            id: { 
                                [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                            }
                        },
                        order: [
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                            ['umur', 'DESC'], //umur tertua
                            // ['created_at', 'ASC'] //daftar sekolah terawal
                        ],
                        // limit: kuota_zonasi
                        limit: KUOTA_CADANGAN
                    });
    
                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                    //ini untuk simpan data yang full pendaftar
                    //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
                    
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline,
                            'waktu_cache': WAKTU_CAHCE_JURNAL,
                        });
    
                    }
    
            }else if(jalur_pendaftaran_id == 7){
                //Jalur SMK Prestasi
    
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
    
                    let kuota_prestasi_max = resJurSek.daya_tampung;
                    let kuota_prestasi_min = resJurSek.kuota_prestasi;
        
                    //hitung total pendaftar domisili terdekat smk dulu,
                    const countTerdekat = (await DataPerangkingans.findAll({  
                        where: {  
                            jalur_pendaftaran_id: 6,
                            sekolah_tujuan_id,  
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                        },
                        limit: resJurSek.kuota_jarak_terdekat
                    })).length;
    
                    //hitung total pendaftar afirmasi smk dulu,
                    const countAfirmasi = (await DataPerangkingans.findAll({  
                        where: {  
                            jalur_pendaftaran_id: 9,
                            sekolah_tujuan_id,  
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition   
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        },
                        limit: resJurSek.kuota_afirmasi
                    })).length;
    
                     //hitung total pendaftar prestasi khusus
                     const countPrestasiKhusus = (await DataPerangkingans.findAll({  
                        where: {  
                            jalur_pendaftaran_id: 8,
                            sekolah_tujuan_id,  
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                        },
                        limit: resJurSek.kuota_prestasi_khusus
                    })).length;
    
                    // let kuota_prestasi = resJurSek.kuota_prestasi;
                    let kuota_prestasi = kuota_prestasi_max - (countTerdekat + countAfirmasi + countPrestasiKhusus);
    
                
                    let kuota_prestasi_akhir; // Menggunakan let untuk scope blok  
                    if(kuota_prestasi >= kuota_prestasi_min){
                        kuota_prestasi_akhir = kuota_prestasi;
                    }else{
                        kuota_prestasi_akhir = kuota_prestasi_min;
                    }
    
                    const resData = await DataPerangkingans.findAll({
                         attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'nilai_raport'], // Pilih kolom yang diambil
                    where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition  
                        }, order: [
                            ['nilai_akhir', 'DESC'], //nilai tertinggi
                            ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        // limit: kuota_prestasi_akhir
                        limit: Math.max(kuota_prestasi_akhir ?? 0, 0)
                    });


                    const resData99 = await DataPerangkingans.findAll({
                         attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'], // Pilih kolom yang diambil
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            id: { 
                                [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                            }
                            
                        },
                        order: [
                            ['nilai_akhir', 'DESC'], //nilai tertinggi
                            ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        // limit: kuota_zonasi_khusus
                        limit: KUOTA_CADANGAN
                    });
                    
                    if (resData && resData.length > 0) {
        
                       
                        const modifiedData = resData.map(item => {
                            const { id_pendaftar, id, ...rest } = item.toJSON();
                            return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                            // return { ...rest, id: encodeId(id) };
                        });

                         // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                        //await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                        await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                        console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                        const modifiedData99 = resData99.map(item => {
                            const { id_pendaftar, id, ...rest } = item.toJSON();
                            // return { ...rest, id: encodeId(id) };
                            return { 
                                ...rest, 
                                id: encodeId(id), 
                                id_pendaftar: encodeId(id_pendaftar),
                                status_daftar_sekolah: 0
                            };
                        });
    
    
                        const combinedData99 = [...modifiedData, ...modifiedData99];
                         //ini untuk simpan data yang full pendaftar
                         //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                         await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                         console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
    
                        if (is_pdf === 1) {
                            // Generate PDF
                            const docDefinition = {
                                content: [
                                    { text: 'Perangkingan Pendaftaran', style: 'header' },
                                    { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                    { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                    { text: 'Data Perangkingan:', style: 'subheader' },
                                    {
                                        table: {
                                            // widths: ['auto', '*', '*', '*', '*', '*'],
                                            body: [
                                                ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                                ...modifiedData.map((item, index) => [
                                                    index + 1,
                                                    item.no_pendaftaran,
                                                    item.nama_lengkap,
                                                    item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                    item.jarak,
    
                                                ])
                                            ]
                                        }
                                    }
                                ],
                                styles: {
                                    header: {
                                        fontSize: 18,
                                        bold: true,
                                        margin: [0, 0, 0, 10]
                                    },
                                    subheader: {
                                        fontSize: 14,
                                        bold: true,
                                        margin: [0, 10, 0, 5]
                                    }
                                }
                            };
                        
                            const pdfDoc = pdfMake.createPdf(docDefinition);
                        
                            // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                            pdfDoc.getBase64((data) => {
                                const buffer = Buffer.from(data, 'base64');
                                res.setHeader('Content-Type', 'application/pdf');
                                res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                                res.send(buffer);
                            });
    
                        }else{
    
                            res.status(200).json({
                                'status': 1,
                                'message': 'Data berhasil ditemukan',
                                'data': modifiedData, // Return the found data
                                'timeline': resTimeline,
                                'waktu_cache': WAKTU_CAHCE_JURNAL,
                            });
    
                        }
    
                        
    
                        
                        
        
                       
                    } else {
                        res.status(200).json({
                            'status': 0,
                            'message': 'Data kosong',
                            'data': [], // Return null or an appropriate value when data is not found
                            'timeline': resTimeline // Return the found data
                        });
                    }
            }else if(jalur_pendaftaran_id == 8){
                //Jalur SMK Prestasi Khusus
    
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
    
                    let kuota_prestasi_khusus = resJurSek.kuota_prestasi_khusus;
    
                    const resData = await DataPerangkingans.findAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    }, order: [
                        ['nilai_akhir', 'DESC'], //nilai tertinggi
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    limit: kuota_prestasi_khusus
                    });
                    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                        
                    });

                     // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                     //await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                     console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);


                     const resData99 = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            id: { 
                                [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                            }
                            
                        },
                        order: [
                                ['nilai_akhir', 'DESC'], //nilai tertinggi
                                ['umur', 'DESC'], //umur tertua
                                ['created_at', 'ASC'] // daftar sekolah terawal
                            ],
                        // limit: kuota_zonasi_khusus
                        limit: KUOTA_CADANGAN
                    });

                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                     //ini untuk simpan data yang full pendaftar
                     //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                     console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline,
                            'waktu_cache': WAKTU_CAHCE_JURNAL,
                        });
    
                    }
    
            }else if(jalur_pendaftaran_id == 9){
                //Jalur SMK Afirmasi
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
    
                    let kuota_afirmasi = resJurSek.kuota_afirmasi;
    
                    let miskin = afirmasiSmkHelper('is_anak_keluarga_miskin');
                    let panti = afirmasiSmkHelper('is_anak_panti');
                    let ats = afirmasiSmkHelper('is_tidak_sekolah');
                    let jml = miskin + panti + ats;
    
                    let kuota_panti = Math.round((panti / jml) * kuota_afirmasi) || 0;
                    let kuota_ats = Math.round((ats / jml) * kuota_afirmasi) || 0;
    
                    //ATS
                    const resDataAts = await DataPerangkingans.findAndCountAll({
                          attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_disabilitas', 'is_tidak_sekolah', 'is_anak_keluarga_tidak_mampu', 'nilai_raport'], // Pilih kolom yang diambil
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                            is_tidak_sekolah: '1',         
                            // [Op.or]: [
                            //     { is_anak_keluarga_tidak_mampu: '1' },
                            //     { is_tidak_sekolah: '1' },
                            //     { is_anak_panti: '1' }
                            // ]               
                        }, order: [
                            ['umur', 'DESC'], //umur tertua
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        limit: Math.max(kuota_panti ?? 0, 0)
                    });
    
                    const rowsAtsR = resDataAts.rows; // Data hasil query
                    const totalAtsL = resDataAts.rows.length || 0; // Total jumlah data setelah limit
    
                    //panti
                    const resDataPanti = await DataPerangkingans.findAndCountAll({
                        attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_disabilitas', 'is_tidak_sekolah', 'is_anak_keluarga_tidak_mampu', 'nilai_raport'], // Pilih kolom yang diambil
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                            is_anak_panti: '1',          
                        }, order: [
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                            ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        // limit: kuota_ats
                        limit: Math.max(kuota_ats ?? 0, 0)
                    });
    
                    const rowsPantiR = resDataPanti.rows; // Data hasil query
                    const totalPatntiL = resDataPanti.rows.length || 0; // Total jumlah data setelah limit
    
    
                    let kuota_akhir_afirmasi = kuota_afirmasi - (totalPatntiL + totalAtsL)
                    
                    console.log('---');
                    console.log('total panti:'+totalPatntiL);
                    console.log('---');
                    console.log('total ats:'+totalAtsL);
                    console.log('---');
                    console.log('total akhir:'+kuota_akhir_afirmasi);
                    console.log('---');
    
                    const resAtsIds = (rowsAtsR.rows || []).map((item) => item.id);
                    const resPantiIds = (rowsPantiR.rows || []).map((item) => item.id);
    
                    //afirmasi murni miskin
                    const resDataMiskin = await DataPerangkingans.findAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_disabilitas', 'is_tidak_sekolah', 'is_anak_keluarga_tidak_mampu', 'nilai_raport'], // Pilih kolom yang diambil
                       
                    // attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                        //is_anak_keluarga_tidak_mampu: '1',  
                        [Op.or]: [
                            { is_anak_keluarga_tidak_mampu: '1' },
                            { is_disabilitas: '1' }
                        ],
                        is_anak_panti: '0', // bukan anak panti
                        is_tidak_sekolah: '0', // bukan anak ats
                        id: { [Op.notIn]: [...resAtsIds, ...resPantiIds] } // Gabungkan ID ATS & Panti
                                    
                    }, order: [
                        ['is_disabilitas', 'DESC'], //disabilitas 
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    // limit: kuota_akhir_afirmasi
                    limit: Math.max(kuota_akhir_afirmasi ?? 0, 0)
                    
                    });
    
                        // const modifiedData = [...rowsAtsR, ...rowsPantiR, ...resDataMiskin,].map(item => {
                        //     const { id_pendaftar, id, ...rest } = item.toJSON();
                        //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // });
    
                        // const modifiedData = [...(rowsAtsR || []), ...(rowsPantiR || []), ...(resDataMiskin || [])].map(item => {
                        //     const { id_pendaftar, id, ...rest } = item.toJSON();
                        //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // });
    
                        const combinedData = [
                            ...(rowsPantiR || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "3"
                            })),
                            ...(rowsAtsR || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "4"
                            })),
                            ...(resDataMiskin || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "5"
                            }))
                          ];
                          
    
                          const modifiedData = combinedData.map(item => {
                            const { id_pendaftar, id, ...rest } = item;
                            return { 
                                ...rest, 
                                id: encodeId(id), 
                                id_pendaftar: encodeId(id_pendaftar) 
                            };
                        });

                        // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                        //await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                        await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                        console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);
                        
                        const resData99 = await DataPerangkingans.findAll({
                            where: {
                                jalur_pendaftaran_id,
                                sekolah_tujuan_id,
                                is_delete: 0,
                                is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                                // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                                is_anak_keluarga_tidak_mampu: '1',
                                is_anak_panti: '0', // bukan anak panti
                                is_tidak_sekolah: '0', // bukan anak ats
                                id: { 
                                    [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                                }
                            },
                            order: [
                                [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                                ['umur', 'DESC'], //umur tertua
                                ['created_at', 'ASC'] // daftar sekolah terawal
                            ],
                            limit: KUOTA_CADANGAN
                        });
    
                        const modifiedData99 = resData99.map(item => {
                            const { id_pendaftar, id, ...rest } = item.toJSON();
                            // return { ...rest, id: encodeId(id) };
                            return { 
                                ...rest, 
                                id: encodeId(id), 
                                id_pendaftar: encodeId(id_pendaftar),
                                status_daftar_sekolah: 0
                            };
                        });
    
                        const combinedData99 = [...modifiedData, ...modifiedData99];
                        //ini untuk simpan data yang full pendaftar
                        //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                        await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                        console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                        if (is_pdf === 1) {
                            // Generate PDF
                            const docDefinition = {
                                content: [
                                    { text: 'Perangkingan Pendaftaran', style: 'header' },
                                    { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                    { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                    { text: 'Data Perangkingan:', style: 'subheader' },
                                    {
                                        table: {
                                            // widths: ['auto', '*', '*', '*', '*', '*'],
                                            body: [
                                                ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                                ...modifiedData.map((item, index) => [
                                                    index + 1,
                                                    item.no_pendaftaran,
                                                    item.nama_lengkap,
                                                    item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                    item.jarak,
    
                                                ])
                                            ]
                                        }
                                    }
                                ],
                                styles: {
                                    header: {
                                        fontSize: 18,
                                        bold: true,
                                        margin: [0, 0, 0, 10]
                                    },
                                    subheader: {
                                        fontSize: 14,
                                        bold: true,
                                        margin: [0, 10, 0, 5]
                                    }
                                }
                            };
                        
                            const pdfDoc = pdfMake.createPdf(docDefinition);
                        
                            // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                            pdfDoc.getBase64((data) => {
                                const buffer = Buffer.from(data, 'base64');
                                res.setHeader('Content-Type', 'application/pdf');
                                res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                                res.send(buffer);
                            });
    
                        }else{
    
                            res.status(200).json({
                                'status': 1,
                                'message': 'Data berhasil ditemukan',
                                'data': modifiedData, // Return the found data
                                'timeline': resTimeline,
                                'waktu_cache': WAKTU_CAHCE_JURNAL,
                            });
    
                        }
    
            }else{
                          
                res.status(200).json({
                    'status': 0,
                    'message': 'Ada kesalahan, jalur pendaftaran tidak ditemukan',
                    'data': [], // Return null or an appropriate value when data is not found
                    'timeline': resTimeline, // Return the found data
                    'waktu_cache': WAKTU_CAHCE_JURNAL,
                });
    
            }
    
        }

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({
            'status': 0,
            'message': 'Error'
        });
    }
}

//selain tambah redis, ada perbaikan di jarak terdekat SMK, penambahan 2% untuk anak guru
export const getPerangkinganTanpaRedisMintaNDadakNdadak = async (req, res) => {
    try {
        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id, 
            jurusan_id,
            nisn,
            is_pdf
        } = req.body;

        // Buat Redis key dengan format yang jelas
        // const redis_key = `perangkingan:${jalur_pendaftaran_id}--${sekolah_tujuan_id}--${jurusan_id || 0}`;
        const redis_key = `perangkingan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;
        const redis_key_full = `FULL_perangkingan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;


        const WAKTU_CAHCE_JURNAL = await checkWaktuCachePerangkingan();

        // 1. Selalu cek Redis terlebih dahulu untuk semua request
        // const cached = await redisGet(redis_key);
        const cached = false;
        let resultData;
        let fromCache = false;

        const resTimeline = await getTimelineSatuan(6);

        if (cached) {
            resultData = JSON.parse(cached);
            fromCache = true;
            console.log(`[REDIS] Cache ditemukan untuk key: ${redis_key}`);
            
            // jika cache di temukan json / pdf generate disini
            if (is_pdf == 1) {

                const docDefinition = {
                    content: [
                        { text: 'Perangkingan Pendaftaran', style: 'header' },
                        { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                        { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                        { text: 'Data Perangkingan:', style: 'subheader' },
                        {
                            table: {
                                // widths: ['auto', '*', '*', '*', '*', '*'],
                                body: [
                                    ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                    ...modifiedData.map((item, index) => [
                                        index + 1,
                                        item.no_pendaftaran,
                                        item.nama_lengkap,
                                        item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                        item.jarak,
                                    

                                    ])
                                ]
                            }
                        }
                    ],
                    styles: {
                        header: {
                            fontSize: 18,
                            bold: true,
                            margin: [0, 0, 0, 10]
                        },
                        subheader: {
                            fontSize: 14,
                            bold: true,
                            margin: [0, 10, 0, 5]
                        }
                    }
                };
            
                const pdfDoc = pdfMake.createPdf(docDefinition);
            
                // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                pdfDoc.getBase64((data) => {
                    const buffer = Buffer.from(data, 'base64');
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                    res.send(buffer);
                });
               
            }else{

                return res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan (from cache)',
                    'data': resultData,
                    'timeline': resTimeline,
                    'waktu_cache': WAKTU_CAHCE_JURNAL,

                });

            }
        }

        const currentDateTime = new Date().toLocaleString("id-ID", {
            year: "numeric",
            month: "long", 
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

        // Jika data tidak ada di cache atau expired cache nya, proses get dari db lalu set ke redis
        if (!fromCache) {

            if(jalur_pendaftaran_id == 1){
 
                //Jalur Zonasi Reguler SMA
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
    
                let kuota_zonasi_max = resSek.daya_tampung;
                let kuota_zonasi_min = resSek.kuota_zonasi;
    
                 
                let persentase_domisili_nilai = DomiNilaiHelper('nilai');
    
                // Hitung 3% dari kuota_zonasi_min
                // let kuota_zonasi_nilai_min = (persentase_domisili_nilai / 100) * kuota_zonasi_min;
                // let kuota_zonasi_nilai_min = Math.round((persentase_domisili_nilai / 100) * kuota_zonasi_min);
    
                //bulat keatas
                let kuota_zonasi_nilai_min = Math.ceil((persentase_domisili_nilai / 100) * kuota_zonasi_max);
    
    
                console.log('---------');
                console.log('kuota zonasi nilai:'+kuota_zonasi_nilai_min);
    
          
                console.log('---------');
                let zonasi_jarak = kuota_zonasi_min - kuota_zonasi_nilai_min;

                zonasi_jarak = Math.max(0, zonasi_jarak);
    
                console.log('kuota zonasi jarak:'+zonasi_jarak);
                console.log('---------');
                //cari data rangking zonasi reguler (jarak)
                const resDataZonasi = await DataPerangkingans.findAndCountAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'created_at'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Exclude 2 and 3
                    },
                    order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Jarak terendah
                        ['umur', 'DESC'], // Umur tertua
                        ['created_at', 'ASC'] 
                    ],
                    limit: zonasi_jarak
                });
                
                const rowsZonasiReg = resDataZonasi.rows; // Data hasil query
                const totalZonasiReg = rowsZonasiReg.length; // Total jumlah data setelah limit
    
                //hitung total pendaftar prestasi dulu
                const countPrestasi = (await DataPerangkingans.findAll({  
                    attributes: ['nisn'], // Pilih kolom yang diambil
                    where: {  
                        jalur_pendaftaran_id: 3,
                        sekolah_tujuan_id,  
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    limit: resSek.kuota_prestasi
                })).length;
    
                 //hitung total pendaftar afirmasi dulu
                 const countAfirmasi = (await DataPerangkingans.findAll({  
                    where: {  
                        jalur_pendaftaran_id: 5,
                        sekolah_tujuan_id,  
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    limit: resSek.kuota_afirmasi
                })).length;
    
                 //hitung total pendaftar pto dulu
                 const countPto = (await DataPerangkingans.findAll({  
                    where: {  
                        jalur_pendaftaran_id: 4,
                        sekolah_tujuan_id,  
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    limit: resSek.kuota_pto
                
                })).length;
    
                
                let countZonasiKhusus = 0;

                let zonKhData = []; // Untuk menyimpan data per zonasi khusus
                let totalZonasiKhusus = 0; // Untuk menyimpan total keseluruhan
                if(resSek.kuota_zonasi_khusus > 0){

                    const npsn = resSek.npsn;
                    const resZonKh = await SekolahZonasiKhususByNpsn(npsn);


                    for (const zonKh of resZonKh) {
                        // Hitung pendaftar untuk zonasi khusus saat ini
                        const currentCount = (await DataPerangkingans.findAll({  
                            attributes: ['nisn'],
                            where: {  
                                jalur_pendaftaran_id: 2,
                                sekolah_tujuan_id,  
                                kode_kecamatan: zonKh.kode_wilayah_kec,  
                                is_delete: 0,
                                is_daftar_ulang: { [Op.ne]: 2 },
                                // Tambahkan kondisi spesifik zonKh jika diperlukan
                                // contoh: zonasi_khusus_id: zonKh.id
                            },
                            limit: zonKh.kuota_zonasi_khusus
                        })).length;
                
                        // Simpan data per zonasi khusus
                        zonKhData.push({
                            zonasi_khusus_id: zonKh.id,
                            nama_zonasi_khusus: zonKh.nama, // atau field lain yang relevan
                            jumlah_pendaftar: currentCount
                        });
                
                        // Tambahkan ke total
                        totalZonasiKhusus += currentCount;
                    }
    
                    // Set countZonasiKhusus dengan total keseluruhan
                    countZonasiKhusus = totalZonasiKhusus;
                    
                    // Contoh output
                    console.log('Data per zonasi khusus:', zonKhData);
                    console.log('Total pendaftar zonasi khusus:', totalZonasiKhusus);
    
                }else{
    
                     countZonasiKhusus = 0;
                     console.log('Tidak ada kuota zonasi khusus');
                    
                }
    
                // let kuota_zonasi_nilai = kuota_zonasi_max - totalZonasiReg - countZonasiKhusus - countPrestasi - countAfirmasi - countPto;
                // let kuota_zonasi_nilai = kuota_zonasi_max - (totalZonasiReg + countZonasiKhusus) +  countPrestasi + countAfirmasi + countPto;
    
                let kuota_terpakai = totalZonasiReg + countZonasiKhusus +  countPrestasi + countAfirmasi + countPto;


               
                // let kuota_zonasi_nilai = kuota_zonasi_max - kuota_terpakai;
                let kuota_zonasi_nilai = Math.max(0, kuota_zonasi_max - kuota_terpakai);

                console.log('totalZonasiReg :'+totalZonasiReg);
                console.log('-----');

                console.log('countZonasiKhusus :'+countZonasiKhusus);
                console.log('-----');

                console.log('countPrestasi :'+countPrestasi);
                console.log('-----');

                console.log('countAfirmasi :'+countAfirmasi);
                console.log('-----');

                console.log('countPto :'+countPto);
                console.log('-----');

                console.log('kuota_zonasi_max :'+kuota_zonasi_max);
                console.log('-----');
    
                console.log('kuota_terpakai :'+kuota_terpakai);
                console.log('-----');
    

                console.log('kuota_zonasi_nilai akhir:'+kuota_zonasi_nilai)
    
                // const resDataZonasiIds = resDataZonasi.rows.map((item) => item.id);
                const resDataZonasiIds = (resDataZonasi.rows || []).map((item) => item.id);
                const resZonasiNilai = await DataPerangkingans.findAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn', 'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur'],
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },  // dinyatakan tidak daftar ulang
                        id: { [Op.notIn]: resDataZonasiIds } // Hindari ID yang sudah ada di resDataZonasi
                    },
                    order: [
                        ['nilai_akhir', 'DESC'],
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        // ['umur', 'DESC'], 
                        ['created_at', 'ASC'] 
                    ],
                    // limit: kuota_zonasi_nilai
                    limit: Math.max(kuota_zonasi_nilai ?? 0, 0)
                });
    
                   
                const combinedData = [
                    ...(rowsZonasiReg ? rowsZonasiReg.map(item => ({
                        ...item.toJSON(),
                        order_berdasar: "1"
                    })) : []), // Jika null, gunakan array kosong
                
                    ...(resZonasiNilai ? resZonasiNilai.map(item => ({
                        ...item.toJSON(),
                        order_berdasar: "2"
                    })) : []) // Jika null, gunakan array kosong
                ];
    
                const modifiedData = combinedData.map(item => {
                    const { id_pendaftar, id, ...rest } = item;
                    return { 
                        ...rest, 
                        id: encodeId(id), 
                        id_pendaftar: encodeId(id_pendaftar) 
                    };
                });

                // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                // await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                
                console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                const resZonasiNilai99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                        }
                    },
                    order: [
                        ['nilai_akhir', 'DESC'],
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        // ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    // limit: kuota_zonasi
                    limit: KUOTA_CADANGAN
                });

                const modifiedData99 = resZonasiNilai99.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    // return { ...rest, id: encodeId(id) };
                    return { 
                        ...rest, 
                        id: encodeId(id), 
                        id_pendaftar: encodeId(id_pendaftar),
                        status_daftar_sekolah: 0
                    };
                });

                const combinedData99 = [...modifiedData, ...modifiedData99];
                //ini untuk simpan data yang full pendaftar
                //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
                
                if (is_pdf === 1) {
                    // Generate PDF
                    const docDefinition = {
                        content: [
                            { text: 'Perangkingan Pendaftaran', style: 'header' },
                            { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                            { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                            { text: 'Data Perangkingan:', style: 'subheader' },
                            {
                                table: {
                                    // widths: ['auto', '*', '*', '*', '*', '*'],
                                    body: [
                                        ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                        ...modifiedData.map((item, index) => [
                                            index + 1,
                                            item.no_pendaftaran,
                                            item.nama_lengkap,
                                            item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                            item.jarak,
                                        
    
                                        ])
                                    ]
                                }
                            }
                        ],
                        styles: {
                            header: {
                                fontSize: 18,
                                bold: true,
                                margin: [0, 0, 0, 10]
                            },
                            subheader: {
                                fontSize: 14,
                                bold: true,
                                margin: [0, 10, 0, 5]
                            }
                        }
                    };
                
                    const pdfDoc = pdfMake.createPdf(docDefinition);
                
                    // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                    pdfDoc.getBase64((data) => {
                        const buffer = Buffer.from(data, 'base64');
                        res.setHeader('Content-Type', 'application/pdf');
                        res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                        res.send(buffer);
                    });
    
                }else{
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': modifiedData, // Return the found data
                        'timeline': resTimeline,
                        'waktu_cache': WAKTU_CAHCE_JURNAL,
                    });
    
                }
    
    
                // res.status(200).json({
                //     'status': 1,
                //     'message': 'Data berhasil ditemukan',
                //     'data': modifiedData, // Return the found data
                //     'timeline' : resTimeline
                // });
                
    
            }else if(jalur_pendaftaran_id == 2){
                //Jalur Zonasi KHUSUS SMA
    
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);

                const npsn = resSek.npsn;
                const resZonKh = await SekolahZonasiKhususByNpsn(npsn);

                let resData = [];

                for (const zonKh of resZonKh) {
                    const resDataQ = await DataPerangkingans.findAll({
                        attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'created_at'], // Pilih kolom yang diambil
                        include: [
                            {
                                model: WilayahVerDapodik,
                                as: 'data_wilayah_kec',
                                attributes: ['kode_wilayah','nama', 'mst_kode_wilayah','kode_dagri']
                            }
                        ],
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            kode_kecamatan: zonKh.kode_wilayah_kec,  
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },
                            [Op.or]: [
                                { is_tidak_boleh_domisili: { [Op.is]: null } },
                                { is_tidak_boleh_domisili: 0 }
                            ],
                        },
                        order: [
                            ['umur', 'DESC'],
                            ['nilai_akhir', 'DESC'],
                            ['created_at', 'ASC']
                        ],
                        limit: zonKh.kuota_zonasi_khusus
                    });
                
                    // resData = resDataQ.concat(resDataQ);
                    resData = resData.concat(resDataQ);
                }
    
                
                //let kuota_zonasi_khusus = resSek.kuota_zonasi_khusus;    
                // const resData = await DataPerangkingans.findAll({
                //     where: {
                //         jalur_pendaftaran_id,
                //         sekolah_tujuan_id,
                //         is_delete: 0,
                //         is_daftar_ulang: { [Op.ne]: 2 }// dinyatakan tidak daftar ulang
                //         // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        
                //     },
                //     order: [
                //         ['umur', 'DESC'], //umur tertua
                //         ['nilai_akhir', 'DESC'], //jarak terendah  
                //         ['created_at', 'ASC'] //daftar sekolah terawal
                //     ],
                //     limit: kuota_zonasi_khusus
                // });

                const resData99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                        }
                        
                    },
                    order: [
                        ['umur', 'DESC'], //umur tertua
                        ['nilai_akhir', 'DESC'], //jarak terendah  
                        ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    // limit: kuota_zonasi_khusus
                    limit: KUOTA_CADANGAN
                });
    
                if (resData) { 
                    // Check if resData is not null
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 1
                        };
                    });

                    //ini untuk simpan data yang pendaftar keterima
                   // await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                    console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });


                    const combinedData99 = [...modifiedData, ...modifiedData99];
                     //ini untuk simpan data yang full pendaftar
                    //  await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);

    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline,
                            'waktu_cache': WAKTU_CAHCE_JURNAL,
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData,
                    //     'timeline': resTimeline// Return the found data
                    // });
    
    
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
    
            }else if(jalur_pendaftaran_id == 3){
                 //Jalur Prestasi SMA
    
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
    
                let kuota_prestasi = resSek.kuota_prestasi;
    
                 const resData = await DataPerangkingans.findAll({
                     attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'nilai_raport', 'created_at'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    order: [
                        ['nilai_akhir', 'DESC'], //nilai tertinggi
                        ['umur', 'DESC'], //umur tertua
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        // [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    limit: kuota_prestasi
                   
                });

                const resData99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                        }
                        
                    },
                    order: [
                        ['nilai_akhir', 'DESC'], //nilai tertinggi
                        ['umur', 'DESC'], //umur tertua
                        // [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    // limit: kuota_zonasi_khusus
                    limit: KUOTA_CADANGAN
                });
    
                if (resData && resData.length > 0) {
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
                    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                    });

                    // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                    //await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                    console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);


                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                    //ini untuk simpan data yang full pendaftar
                    //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline,
                            'waktu_cache': WAKTU_CAHCE_JURNAL,
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData,
                    //     'timeline': resTimeline // Return the found data
                    // });
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
    
    
            }else if(jalur_pendaftaran_id == 4){
                //Jalur PTO / MutasiSMA 
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
    
                let kuota_pto = resSek.kuota_pto;
    
                const resData = await DataPerangkingans.findAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_anak_guru_jateng', 'created_at'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // yang tidak daftar ulang
                    },
                    order: [
                        [literal('is_anak_guru_jateng DESC')], // Prioritaskan yang is_anak_guru_jateng = 1
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] // Urutkan berdasarkan waktu pendaftaran (tercepat lebih dulu)
                    ],
                    limit: kuota_pto
                });
    
                const resData99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                        }
                        
                    },
                    order: [
                        [literal('is_anak_guru_jateng DESC')], // Prioritaskan yang is_anak_guru_jateng = 1
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] // Urutkan berdasarkan waktu pendaftaran (tercepat lebih dulu)
                    ],
                    // limit: kuota_zonasi_khusus
                    limit: KUOTA_CADANGAN
                });

               if (resData && resData.length > 0) {
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                    });

                     // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                     //await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                     console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                     const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });


                     const combinedData99 = [...modifiedData, ...modifiedData99];
                     //ini untuk simpan data yang full pendaftar
                     //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                     console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline,
                            'waktu_cache': WAKTU_CAHCE_JURNAL,
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData,
                    //     'timeline': resTimeline // Return the found data
                    // });
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
    
            }else if(jalur_pendaftaran_id == 5){
                //Jalur Afirmasi SMA
    
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
                
                let daya_tampung = resSek.daya_tampung;
                let kuota_afirmasi = resSek.kuota_afirmasi;
                let kuota_persentase_ats = afirmasiSmaHelper('is_tidak_sekolah');
                let kuota_persentase_panti = afirmasiSmaHelper('is_anak_panti');
    
                // let kuota_ats = Math.ceil((kuota_persentase_ats / 100) * daya_tampung) || 0;
                // let kuota_panti = Math.ceil((kuota_persentase_panti / 100) * daya_tampung) || 0;
                
                let kuota_ats = Math.max(Math.ceil((kuota_persentase_ats / 100) * daya_tampung) || 0, 0);
                let kuota_panti = Math.max(Math.ceil((kuota_persentase_panti / 100) * daya_tampung) || 0, 0);
    
                console.log('kuota ats:'+kuota_ats)
                console.log('kuota panti:'+kuota_panti)
    
                const resDataPanti = await DataPerangkingans.findAndCountAll({
                     attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_disabilitas', 'is_tidak_sekolah', 'created_at'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // tidak daftar ulang
                        is_anak_keluarga_tidak_mampu: '0',
                        is_anak_panti: '1',
                        is_tidak_sekolah: '0', 
                    },
                    order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    limit: kuota_panti
                });

                const rowsPantiR = resDataPanti.rows; // Data hasil query
                const totalPatntiL = resDataPanti.rows.length || 0; // Total jumlah data setelah limit
    
                const resDataAts = await DataPerangkingans.findAndCountAll({
                     attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_disabilitas', 'is_tidak_sekolah'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // tidak daftar ulang
                        is_anak_keluarga_tidak_mampu: '0',
                        is_anak_panti: '0',
                        is_tidak_sekolah: '1', 
                    },
                    order: [
                        ['umur', 'DESC'], //umur tertua
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                        ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    limit: kuota_ats
                });

                const rowsAtsR = resDataAts.rows; // Data hasil query
                const totalAtsL = resDataAts.rows.length || 0; // Total jumlah data setelah limit
    
                // let kuota_afirmasi_sisa = kuota_afirmasi - (resDataAts.length+resDataPanti.length);
                //let kuota_afirmasi_sisa = kuota_afirmasi - (resDataAts.length + resDataPanti.length);
                let kuota_afirmasi_sisa = kuota_afirmasi - (totalPatntiL + totalAtsL)
    
                console.log('kuota kuota_afirmasi_sisa:'+kuota_afirmasi_sisa)

                const resAtsIds = (rowsAtsR.rows || []).map((item) => item.id);
                const resPantiIds = (rowsPantiR.rows || []).map((item) => item.id);
    
                const resDataMiskin = await DataPerangkingans.findAll({
                     attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_disabilitas', 'is_tidak_sekolah'], // Pilih kolom yang diambil
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 }, // tidak daftar ulang
                    // is_anak_keluarga_tidak_mampu: '1',
                    [Op.or]: [
                        { is_anak_keluarga_tidak_mampu: '1' },
                        { is_disabilitas: '1' }
                    ],
                    is_anak_panti: '0', // bukan anak panti
                    is_tidak_sekolah: '0', // bukan anak panti
                    id: { [Op.notIn]: [...resAtsIds, ...resPantiIds] } // Gabungkan ID ATS & Panti
                    // // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    // [Op.or]: [
                    //     { is_anak_keluarga_tidak_mampu: '1' },
                    //     { is_tidak_sekolah: '1' },
                    //     { is_anak_panti: '1' }
                    // ]
                },
                order: [
                    ['is_disabilitas', 'DESC'], //disabilitas 
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] //daftar sekolah terawal
                ],
                // limit: kuota_afirmasi_sisa
                limit: Math.max(kuota_afirmasi_sisa ?? 0, 0)
               
                });
                if (resDataMiskin) { 
                    
                    // Check if resData is not null
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
                    // const combinedData = [
                    //     ...(resDataPanti ? resDataPanti.map(item => ({
                    //         ...item.toJSON(),
                    //         order_berdasar: "3"
                    //     })) : []), // Jika null, gunakan array kosong
                    
                    //     ...(resDataAts ? resDataAts.map(item => ({
                    //         ...item.toJSON(),
                    //         order_berdasar: "4"
                    //     })) : []), // Jika null, gunakan array kosong
    
                    //     ...(resData ? resData.map(item => ({
                    //         ...item.toJSON(),
                    //         order_berdasar: "5"
                    //     })) : []), // Jika null, gunakan array kosong
                    // ];

                     const combinedData = [
                            ...(rowsPantiR || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "3"
                            })),
                            ...(rowsAtsR || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "4"
                            })),
                            ...(resDataMiskin || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "5"
                            }))
                          ];
    
                    const modifiedData = combinedData.map(item => {
                        const { id_pendaftar, id, ...rest } = item;
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar) 
                        };
                    });

                     // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                     //await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                     console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                     const resData99 = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            is_anak_keluarga_tidak_mampu: '1',
                            is_anak_panti: '0', // bukan anak panti
                            is_tidak_sekolah: '0', // bukan anak panti
                            id: { 
                                [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                            }
                        },
                        order: [
                            // ['is_disabilitas', 'ASC'], //disabilitas 
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                            ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] //daftar sekolah terawal
                        ],
                        // limit: kuota_zonasi
                        limit: KUOTA_CADANGAN
                    });

                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                    //ini untuk simpan data yang full pendaftar
                    //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);

                    // const modifiedData = resData.map(item => {
                    //     const { id_pendaftar, id, ...rest } = item.toJSON();
                    //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                    //     // return { ...rest, id: encodeId(id) };
                    // });
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline,
                            'waktu_cache': WAKTU_CAHCE_JURNAL,
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData, // Return the found data
                    //     'timeline': resTimeline
                    // });
    
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
            }else if(jalur_pendaftaran_id == 6){
                //Jalur SMK Domisili Terdekat
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
    
                    let persentase_seleksi_terdekat_anak_guru = DomiSmkHelper('anak_guru');
    
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);

                    
    
                    let npsnnya = resJurSek.npsn;
                    let daya_tampung = resJurSek.daya_tampung;
                    //let kuota_anak_guru = Math.ceil((persentase_seleksi_terdekat_anak_guru / 100) * daya_tampung);
                    let kuota_anak_guru = Math.max(Math.ceil((persentase_seleksi_terdekat_anak_guru / 100) * daya_tampung) ?? 0, 0);
                    // limit: Math.max(kuota_afirmasi_sisa ?? 0, 0)
                    let kuota_jarak_terdekat = resJurSek.kuota_jarak_terdekat;

                    console.log('ANAKGURU ____ AAAA: '+kuota_anak_guru)

                    // anak guru
                    const resDataAnakGuru = await DataPerangkingans.findAndCountAll({
                         attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_anak_guru_jateng', 'npsn_anak_guru', 'created_at'], // Pilih kolom yang diambil
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                            npsn_anak_guru: npsnnya,
                            is_anak_guru_jateng: '1',

                        }, order: [
                            ['is_anak_guru_jateng', 'DESC'],
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                            // ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        limit: kuota_anak_guru
                        });

                    const rowsAnakGuru = resDataAnakGuru.rows; // Data hasil query
                    const totalAnakGuru = resDataAnakGuru.rows.length || 0; // Total jumlah data setelah limit
                    const excludedNisn = rowsAnakGuru.map(item => item.nisn); // Ambil semua NISN dari hasil anak guru

                    let kuota_akhir_jarak_terdekat = kuota_jarak_terdekat - totalAnakGuru;
    
                    // murni
                    const resData = await DataPerangkingans.findAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_anak_guru_jateng', 'npsn_anak_guru'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                        // is_anak_guru_jateng: { [Op.ne]: '1' },
                        // is_tidak_boleh_domisili: { [Op.ne]: '1' },
                        // is_tidak_boleh_domisili: { [Op.not]: '1' }
                        // Alternatif (lebih panjang, tidak disarankan)
                        [Op.or]: [
                            { is_tidak_boleh_domisili: { [Op.is]: null } },
                            { is_tidak_boleh_domisili: 0 }
                        ],
                        nisn: { [Op.notIn]: excludedNisn } // Exclude NISN yang sudah terpilih di anak guru
                    }, order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                        ['umur', 'DESC'], //umur tertua
                        // ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    //limit: kuota_akhir_jarak_terdekat
                    limit: Math.max(kuota_akhir_jarak_terdekat ?? 0, 0)
                    });

                    const combinedData = [
                        ...(rowsAnakGuru || []).map(item => ({
                          ...item.toJSON(),
                          order_berdasar: "6"
                        })),
                        ...(resData || []).map(item => ({
                          ...item.toJSON(),
                          order_berdasar: "7"
                        }))
                      ];
    
                    // const modifiedData = resData.map(item => {
                    //     const { id_pendaftar, id, ...rest } = item.toJSON();
                    //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                    // });

                    const modifiedData = combinedData.map(item => {
                        const { id_pendaftar, id, ...rest } = item;
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar) 
                        };
                    });

                    // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                    //await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                    console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                    const resData99 = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            id: { 
                                [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                            }
                        },
                        order: [
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                            ['umur', 'DESC'], //umur tertua
                            // ['created_at', 'ASC'] //daftar sekolah terawal
                        ],
                        // limit: kuota_zonasi
                        limit: KUOTA_CADANGAN
                    });
    
                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                    //ini untuk simpan data yang full pendaftar
                    //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
                    
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline,
                            'waktu_cache': WAKTU_CAHCE_JURNAL,
                        });
    
                    }
    
            }else if(jalur_pendaftaran_id == 7){
                //Jalur SMK Prestasi
    
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
    
                    let kuota_prestasi_max = resJurSek.daya_tampung;
                    let kuota_prestasi_min = resJurSek.kuota_prestasi;
        
                    //hitung total pendaftar domisili terdekat smk dulu,
                    const countTerdekat = (await DataPerangkingans.findAll({  
                        where: {  
                            jalur_pendaftaran_id: 6,
                            sekolah_tujuan_id,  
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                        },
                        limit: resJurSek.kuota_jarak_terdekat
                    })).length;
    
                    //hitung total pendaftar afirmasi smk dulu,
                    const countAfirmasi = (await DataPerangkingans.findAll({  
                        where: {  
                            jalur_pendaftaran_id: 9,
                            sekolah_tujuan_id,  
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition   
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        },
                        limit: resJurSek.kuota_afirmasi
                    })).length;
    
                     //hitung total pendaftar prestasi khusus
                     const countPrestasiKhusus = (await DataPerangkingans.findAll({  
                        where: {  
                            jalur_pendaftaran_id: 8,
                            sekolah_tujuan_id,  
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                        },
                        limit: resJurSek.kuota_prestasi_khusus
                    })).length;
    
                    // let kuota_prestasi = resJurSek.kuota_prestasi;
                    let kuota_prestasi = kuota_prestasi_max - (countTerdekat + countAfirmasi + countPrestasiKhusus);
    
                
                    let kuota_prestasi_akhir; // Menggunakan let untuk scope blok  
                    if(kuota_prestasi >= kuota_prestasi_min){
                        kuota_prestasi_akhir = kuota_prestasi;
                    }else{
                        kuota_prestasi_akhir = kuota_prestasi_min;
                    }
    
                    const resData = await DataPerangkingans.findAll({
                         attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'nilai_raport', 'created_at'], // Pilih kolom yang diambil
                    where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition  
                        }, order: [
                            ['nilai_akhir', 'DESC'], //nilai tertinggi
                            ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        // limit: kuota_prestasi_akhir
                        limit: Math.max(kuota_prestasi_akhir ?? 0, 0)
                    });


                    const resData99 = await DataPerangkingans.findAll({
                         attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'], // Pilih kolom yang diambil
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            id: { 
                                [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                            }
                            
                        },
                        order: [
                            ['nilai_akhir', 'DESC'], //nilai tertinggi
                            ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        // limit: kuota_zonasi_khusus
                        limit: KUOTA_CADANGAN
                    });
                    
                    if (resData && resData.length > 0) {
        
                       
                        const modifiedData = resData.map(item => {
                            const { id_pendaftar, id, ...rest } = item.toJSON();
                            return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                            // return { ...rest, id: encodeId(id) };
                        });

                         // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                        //await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                        await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                        console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                        const modifiedData99 = resData99.map(item => {
                            const { id_pendaftar, id, ...rest } = item.toJSON();
                            // return { ...rest, id: encodeId(id) };
                            return { 
                                ...rest, 
                                id: encodeId(id), 
                                id_pendaftar: encodeId(id_pendaftar),
                                status_daftar_sekolah: 0
                            };
                        });
    
    
                        const combinedData99 = [...modifiedData, ...modifiedData99];
                         //ini untuk simpan data yang full pendaftar
                         //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                         await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                         console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
    
                        if (is_pdf === 1) {
                            // Generate PDF
                            const docDefinition = {
                                content: [
                                    { text: 'Perangkingan Pendaftaran', style: 'header' },
                                    { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                    { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                    { text: 'Data Perangkingan:', style: 'subheader' },
                                    {
                                        table: {
                                            // widths: ['auto', '*', '*', '*', '*', '*'],
                                            body: [
                                                ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                                ...modifiedData.map((item, index) => [
                                                    index + 1,
                                                    item.no_pendaftaran,
                                                    item.nama_lengkap,
                                                    item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                    item.jarak,
    
                                                ])
                                            ]
                                        }
                                    }
                                ],
                                styles: {
                                    header: {
                                        fontSize: 18,
                                        bold: true,
                                        margin: [0, 0, 0, 10]
                                    },
                                    subheader: {
                                        fontSize: 14,
                                        bold: true,
                                        margin: [0, 10, 0, 5]
                                    }
                                }
                            };
                        
                            const pdfDoc = pdfMake.createPdf(docDefinition);
                        
                            // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                            pdfDoc.getBase64((data) => {
                                const buffer = Buffer.from(data, 'base64');
                                res.setHeader('Content-Type', 'application/pdf');
                                res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                                res.send(buffer);
                            });
    
                        }else{
    
                            res.status(200).json({
                                'status': 1,
                                'message': 'Data berhasil ditemukan',
                                'data': modifiedData, // Return the found data
                                'timeline': resTimeline,
                                'waktu_cache': WAKTU_CAHCE_JURNAL,
                            });
    
                        }
    
                        
    
                        
                        
        
                       
                    } else {
                        res.status(200).json({
                            'status': 0,
                            'message': 'Data kosong',
                            'data': [], // Return null or an appropriate value when data is not found
                            'timeline': resTimeline // Return the found data
                        });
                    }
            }else if(jalur_pendaftaran_id == 8){
                //Jalur SMK Prestasi Khusus
    
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
    
                    let kuota_prestasi_khusus = resJurSek.kuota_prestasi_khusus;
    
                    const resData = await DataPerangkingans.findAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'created_at'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    }, order: [
                        ['nilai_akhir', 'DESC'], //nilai tertinggi
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    limit: kuota_prestasi_khusus
                    });
                    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                        
                    });

                     // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                     //await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                     console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);


                     const resData99 = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            id: { 
                                [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                            }
                            
                        },
                        order: [
                                ['nilai_akhir', 'DESC'], //nilai tertinggi
                                ['umur', 'DESC'], //umur tertua
                                ['created_at', 'ASC'] // daftar sekolah terawal
                            ],
                        // limit: kuota_zonasi_khusus
                        limit: KUOTA_CADANGAN
                    });

                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                     //ini untuk simpan data yang full pendaftar
                     //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                     console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline,
                            'waktu_cache': WAKTU_CAHCE_JURNAL,
                        });
    
                    }
    
            }else if(jalur_pendaftaran_id == 9){
                //Jalur SMK Afirmasi
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
    
                    let kuota_afirmasi = resJurSek.kuota_afirmasi;
    
                    let miskin = afirmasiSmkHelper('is_anak_keluarga_miskin');
                    let panti = afirmasiSmkHelper('is_anak_panti');
                    let ats = afirmasiSmkHelper('is_tidak_sekolah');
                    let jml = miskin + panti + ats;
    
                    let kuota_panti = Math.round((panti / jml) * kuota_afirmasi) || 0;
                    let kuota_ats = Math.round((ats / jml) * kuota_afirmasi) || 0;
    
                    //ATS
                    const resDataAts = await DataPerangkingans.findAndCountAll({
                          attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_disabilitas', 'is_tidak_sekolah', 'is_anak_keluarga_tidak_mampu', 'nilai_raport', 'created_at'], // Pilih kolom yang diambil
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                            is_tidak_sekolah: '1',         
                            // [Op.or]: [
                            //     { is_anak_keluarga_tidak_mampu: '1' },
                            //     { is_tidak_sekolah: '1' },
                            //     { is_anak_panti: '1' }
                            // ]               
                        }, order: [
                            ['umur', 'DESC'], //umur tertua
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        limit: Math.max(kuota_panti ?? 0, 0)
                    });
    
                    const rowsAtsR = resDataAts.rows; // Data hasil query
                    const totalAtsL = resDataAts.rows.length || 0; // Total jumlah data setelah limit
    
                    //panti
                    const resDataPanti = await DataPerangkingans.findAndCountAll({
                        attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_disabilitas', 'is_tidak_sekolah', 'is_anak_keluarga_tidak_mampu', 'nilai_raport', 'created_at'], // Pilih kolom yang diambil
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                            is_anak_panti: '1',          
                        }, order: [
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                            ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        // limit: kuota_ats
                        limit: Math.max(kuota_ats ?? 0, 0)
                    });
    
                    const rowsPantiR = resDataPanti.rows; // Data hasil query
                    const totalPatntiL = resDataPanti.rows.length || 0; // Total jumlah data setelah limit
    
    
                    let kuota_akhir_afirmasi = kuota_afirmasi - (totalPatntiL + totalAtsL)
                    
                    console.log('---');
                    console.log('total panti:'+totalPatntiL);
                    console.log('---');
                    console.log('total ats:'+totalAtsL);
                    console.log('---');
                    console.log('total akhir:'+kuota_akhir_afirmasi);
                    console.log('---');
    
                    const resAtsIds = (rowsAtsR.rows || []).map((item) => item.id);
                    const resPantiIds = (rowsPantiR.rows || []).map((item) => item.id);
    
                    //afirmasi murni miskin
                    const resDataMiskin = await DataPerangkingans.findAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_disabilitas', 'is_tidak_sekolah', 'is_anak_keluarga_tidak_mampu', 'nilai_raport', 'created_at'], // Pilih kolom yang diambil
                       
                    // attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                        //is_anak_keluarga_tidak_mampu: '1',  
                        [Op.or]: [
                            { is_anak_keluarga_tidak_mampu: '1' },
                            { is_disabilitas: '1' }
                        ],
                        is_anak_panti: '0', // bukan anak panti
                        is_tidak_sekolah: '0', // bukan anak ats
                        id: { [Op.notIn]: [...resAtsIds, ...resPantiIds] } // Gabungkan ID ATS & Panti
                                    
                    }, order: [
                        ['is_disabilitas', 'DESC'], //disabilitas 
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    // limit: kuota_akhir_afirmasi
                    limit: Math.max(kuota_akhir_afirmasi ?? 0, 0)
                    
                    });
    
                        // const modifiedData = [...rowsAtsR, ...rowsPantiR, ...resDataMiskin,].map(item => {
                        //     const { id_pendaftar, id, ...rest } = item.toJSON();
                        //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // });
    
                        // const modifiedData = [...(rowsAtsR || []), ...(rowsPantiR || []), ...(resDataMiskin || [])].map(item => {
                        //     const { id_pendaftar, id, ...rest } = item.toJSON();
                        //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // });
    
                        const combinedData = [
                            ...(rowsPantiR || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "3"
                            })),
                            ...(rowsAtsR || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "4"
                            })),
                            ...(resDataMiskin || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "5"
                            }))
                          ];
                          
    
                          const modifiedData = combinedData.map(item => {
                            const { id_pendaftar, id, ...rest } = item;
                            return { 
                                ...rest, 
                                id: encodeId(id), 
                                id_pendaftar: encodeId(id_pendaftar) 
                            };
                        });

                        // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                        //await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                        await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                        console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);
                        
                        const resData99 = await DataPerangkingans.findAll({
                            where: {
                                jalur_pendaftaran_id,
                                sekolah_tujuan_id,
                                is_delete: 0,
                                is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                                // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                                is_anak_keluarga_tidak_mampu: '1',
                                is_anak_panti: '0', // bukan anak panti
                                is_tidak_sekolah: '0', // bukan anak ats
                                id: { 
                                    [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                                }
                            },
                            order: [
                                [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                                ['umur', 'DESC'], //umur tertua
                                ['created_at', 'ASC'] // daftar sekolah terawal
                            ],
                            limit: KUOTA_CADANGAN
                        });
    
                        const modifiedData99 = resData99.map(item => {
                            const { id_pendaftar, id, ...rest } = item.toJSON();
                            // return { ...rest, id: encodeId(id) };
                            return { 
                                ...rest, 
                                id: encodeId(id), 
                                id_pendaftar: encodeId(id_pendaftar),
                                status_daftar_sekolah: 0
                            };
                        });
    
                        const combinedData99 = [...modifiedData, ...modifiedData99];
                        //ini untuk simpan data yang full pendaftar
                        //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                        await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                        console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                        if (is_pdf === 1) {
                            // Generate PDF
                            const docDefinition = {
                                content: [
                                    { text: 'Perangkingan Pendaftaran', style: 'header' },
                                    { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                    { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                    { text: 'Data Perangkingan:', style: 'subheader' },
                                    {
                                        table: {
                                            // widths: ['auto', '*', '*', '*', '*', '*'],
                                            body: [
                                                ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                                ...modifiedData.map((item, index) => [
                                                    index + 1,
                                                    item.no_pendaftaran,
                                                    item.nama_lengkap,
                                                    item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                    item.jarak,
    
                                                ])
                                            ]
                                        }
                                    }
                                ],
                                styles: {
                                    header: {
                                        fontSize: 18,
                                        bold: true,
                                        margin: [0, 0, 0, 10]
                                    },
                                    subheader: {
                                        fontSize: 14,
                                        bold: true,
                                        margin: [0, 10, 0, 5]
                                    }
                                }
                            };
                        
                            const pdfDoc = pdfMake.createPdf(docDefinition);
                        
                            // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                            pdfDoc.getBase64((data) => {
                                const buffer = Buffer.from(data, 'base64');
                                res.setHeader('Content-Type', 'application/pdf');
                                res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                                res.send(buffer);
                            });
    
                        }else{
    
                            res.status(200).json({
                                'status': 1,
                                'message': 'Data berhasil ditemukan',
                                'data': modifiedData, // Return the found data
                                'timeline': resTimeline,
                                'waktu_cache': WAKTU_CAHCE_JURNAL,
                            });
    
                        }
    
            }else{
                          
                res.status(200).json({
                    'status': 0,
                    'message': 'Ada kesalahan, jalur pendaftaran tidak ditemukan',
                    'data': [], // Return null or an appropriate value when data is not found
                    'timeline': resTimeline, // Return the found data
                    'waktu_cache': WAKTU_CAHCE_JURNAL,
                });
    
            }
    
        }

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({
            'status': 0,
            'message': 'Error'
        });
    }
}

//selain tambah redis, ada perbaikan di jarak terdekat SMK, penambahan 2% untuk anak guru
export const getPerangkinganKhususAfirmasi = async (req, res) => {
    try {
        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id, 
            jurusan_id,
            nisn,
            is_pdf
        } = req.body;

        // Buat Redis key dengan format yang jelas
        // const redis_key = `perangkingan:${jalur_pendaftaran_id}--${sekolah_tujuan_id}--${jurusan_id || 0}`;
        const redis_key = `perangkingan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;
        const redis_key_full = `FULL_perangkingan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;


        const WAKTU_CAHCE_JURNAL = await checkWaktuCachePerangkingan();

        // 1. Selalu cek Redis terlebih dahulu untuk semua request
        const cached = await redisGet(redis_key);
        let resultData;
        let fromCache = false;

        const resTimeline = await getTimelineSatuan(6);

        if (cached) {
            resultData = JSON.parse(cached);
            fromCache = true;
            console.log(`[REDIS] Cache ditemukan untuk key: ${redis_key}`);
            
            // jika cache di temukan json / pdf generate disini
            if (is_pdf == 1) {

                const docDefinition = {
                    content: [
                        { text: 'Perangkingan Pendaftaran', style: 'header' },
                        { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                        { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                        { text: 'Data Perangkingan:', style: 'subheader' },
                        {
                            table: {
                                // widths: ['auto', '*', '*', '*', '*', '*'],
                                body: [
                                    ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                    ...modifiedData.map((item, index) => [
                                        index + 1,
                                        item.no_pendaftaran,
                                        item.nama_lengkap,
                                        item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                        item.jarak,
                                    

                                    ])
                                ]
                            }
                        }
                    ],
                    styles: {
                        header: {
                            fontSize: 18,
                            bold: true,
                            margin: [0, 0, 0, 10]
                        },
                        subheader: {
                            fontSize: 14,
                            bold: true,
                            margin: [0, 10, 0, 5]
                        }
                    }
                };
            
                const pdfDoc = pdfMake.createPdf(docDefinition);
            
                // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                pdfDoc.getBase64((data) => {
                    const buffer = Buffer.from(data, 'base64');
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                    res.send(buffer);
                });
               
            }else{

                return res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan (from cache)',
                    'data': resultData,
                    'timeline': resTimeline,
                    'waktu_cache': WAKTU_CAHCE_JURNAL,

                });

            }
        }

        const currentDateTime = new Date().toLocaleString("id-ID", {
            year: "numeric",
            month: "long", 
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

        // Jika data tidak ada di cache atau expired cache nya, proses get dari db lalu set ke redis
        if (!fromCache) {

            if(jalur_pendaftaran_id == 5){
                //Jalur Afirmasi SMA
    
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
                
                let daya_tampung = resSek.daya_tampung;
                let kuota_afirmasi = resSek.kuota_afirmasi;
    
                const resDataMiskin = await DataPerangkingans.findAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_disabilitas', 'is_tidak_sekolah'], // Pilih kolom yang diambil
                    where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 }, // tidak daftar ulang
                },
                order: [
                        ['umur', 'DESC'], //umur tertua
                        ['nilai_akhir', 'DESC'],
                        ['created_at', 'ASC'] //daftar sekolah terawal
                ],
                // limit: kuota_afirmasi_sisa
                limit: kuota_afirmasi
               
                });
                if (resDataMiskin) { 

                     const modifiedData = resDataMiskin.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                    });

                     await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                     console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                     const resData99 = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        },
                        order: [
                            ['umur', 'DESC'], //umur tertua
                            ['nilai_akhir', 'DESC'],
                            ['created_at', 'ASC'] //daftar sekolah terawal
                        ],
                        // limit: kuota_zonasi
                        limit: KUOTA_CADANGAN
                    });

                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                    await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline,
                            'waktu_cache': WAKTU_CAHCE_JURNAL,
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData, // Return the found data
                    //     'timeline': resTimeline
                    // });
    
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
            }else if(jalur_pendaftaran_id == 9){
                //Jalur SMK Afirmasi
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
    
                    let daya_tampung = resJurSek.daya_tampung;
                    let kuota_afirmasi = resJurSek.kuota_afirmasi;

                    //afirmasi murni miskin
                    const resDataMiskin = await DataPerangkingans.findAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'umur', 'is_disabilitas', 'is_tidak_sekolah', 'is_anak_keluarga_tidak_mampu', 'nilai_raport'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                                    
                    }, order: [
                        ['umur', 'DESC'], //umur tertua
                        ['nilai_akhir', 'DESC'],
                        ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    // limit: kuota_akhir_afirmasi
                    limit: kuota_afirmasi
                    
                    });
    
                        const modifiedData = resDataMiskin.map(item => {
                            const { id_pendaftar, id, ...rest } = item.toJSON();
                            return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                            // return { ...rest, id: encodeId(id) };
                         });

                        await redisSet(redis_key, JSON.stringify(modifiedData), WAKTU_CAHCE_JURNAL);
                        console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);
                        
                        const resData99 = await DataPerangkingans.findAll({
                            where: {
                                jalur_pendaftaran_id,
                                sekolah_tujuan_id,
                                is_delete: 0,
                                is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            },
                            order: [
                                ['umur', 'DESC'], //umur tertua
                                ['nilai_akhir', 'DESC'],
                                ['created_at', 'ASC'] //daftar sekolah terawal
                            ],
                            limit: KUOTA_CADANGAN
                        });
    
                        const modifiedData99 = resData99.map(item => {
                            const { id_pendaftar, id, ...rest } = item.toJSON();
                            // return { ...rest, id: encodeId(id) };
                            return { 
                                ...rest, 
                                id: encodeId(id), 
                                id_pendaftar: encodeId(id_pendaftar),
                                status_daftar_sekolah: 0
                            };
                        });
    
                        const combinedData99 = [...modifiedData, ...modifiedData99];
                        //ini untuk simpan data yang full pendaftar
                        //await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                        await redisSet(redis_key_full, JSON.stringify(combinedData99), WAKTU_CAHCE_JURNAL);
                        console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                        if (is_pdf === 1) {
                            // Generate PDF
                            const docDefinition = {
                                content: [
                                    { text: 'Perangkingan Pendaftaran', style: 'header' },
                                    { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                    { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                    { text: 'Data Perangkingan:', style: 'subheader' },
                                    {
                                        table: {
                                            // widths: ['auto', '*', '*', '*', '*', '*'],
                                            body: [
                                                ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                                ...modifiedData.map((item, index) => [
                                                    index + 1,
                                                    item.no_pendaftaran,
                                                    item.nama_lengkap,
                                                    item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                    item.jarak,
    
                                                ])
                                            ]
                                        }
                                    }
                                ],
                                styles: {
                                    header: {
                                        fontSize: 18,
                                        bold: true,
                                        margin: [0, 0, 0, 10]
                                    },
                                    subheader: {
                                        fontSize: 14,
                                        bold: true,
                                        margin: [0, 10, 0, 5]
                                    }
                                }
                            };
                        
                            const pdfDoc = pdfMake.createPdf(docDefinition);
                        
                            // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                            pdfDoc.getBase64((data) => {
                                const buffer = Buffer.from(data, 'base64');
                                res.setHeader('Content-Type', 'application/pdf');
                                res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                                res.send(buffer);
                            });
    
                        }else{
    
                            res.status(200).json({
                                'status': 1,
                                'message': 'Data berhasil ditemukan',
                                'data': modifiedData, // Return the found data
                                'timeline': resTimeline,
                                'waktu_cache': WAKTU_CAHCE_JURNAL,
                            });
    
                        }
    
            }else{
                          
                res.status(200).json({
                    'status': 0,
                    'message': 'Ada kesalahan, jalur pendaftaran tidak ditemukan',
                    'data': [], // Return null or an appropriate value when data is not found
                    'timeline': resTimeline, // Return the found data
                    'waktu_cache': WAKTU_CAHCE_JURNAL,
                });
    
            }
    
        }

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({
            'status': 0,
            'message': 'Error'
        });
    }
}


//percobaan untuk akomodir urutan peserta didalam redis
//selain tambah redis, ada perbaikan di jarak terdekat SMK, penambahan 2% untuk anak guru
export const getPerangkinganDenganDataStore = async (req, res) => {
    try {
        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id, 
            jurusan_id,
            nisn,
            is_pdf
        } = req.body;

        // Buat Redis key dengan format yang jelas
        // const redis_key = `perangkingan:${jalur_pendaftaran_id}--${sekolah_tujuan_id}--${jurusan_id || 0}`;
        const redis_key = `perangkingan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;
        const redis_key_full = `FULL_perangkingan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;

        // 1. Selalu cek Redis terlebih dahulu untuk semua request
        const cached = await redisGet(redis_key);
        let resultData;
        let fromCache = false;

        const resTimeline = await getTimelineSatuan(6);

        if (cached) {
            resultData = JSON.parse(cached);
            fromCache = true;
            console.log(`[REDIS] Cache ditemukan untuk key: ${redis_key}`);
            
            // jika cache di temukan json / pdf generate disini
            if (is_pdf == 1) {

                const docDefinition = {
                    content: [
                        { text: 'Perangkingan Pendaftaran', style: 'header' },
                        { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                        { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                        { text: 'Data Perangkingan:', style: 'subheader' },
                        {
                            table: {
                                // widths: ['auto', '*', '*', '*', '*', '*'],
                                body: [
                                    ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                    ...modifiedData.map((item, index) => [
                                        index + 1,
                                        item.no_pendaftaran,
                                        item.nama_lengkap,
                                        item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                        item.jarak,
                                    

                                    ])
                                ]
                            }
                        }
                    ],
                    styles: {
                        header: {
                            fontSize: 18,
                            bold: true,
                            margin: [0, 0, 0, 10]
                        },
                        subheader: {
                            fontSize: 14,
                            bold: true,
                            margin: [0, 10, 0, 5]
                        }
                    }
                };
            
                const pdfDoc = pdfMake.createPdf(docDefinition);
            
                // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                pdfDoc.getBase64((data) => {
                    const buffer = Buffer.from(data, 'base64');
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                    res.send(buffer);
                });
               
            }else{

                return res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan (from cache)',
                    'data': resultData,
                    'timeline': resTimeline
                });

            }
        }

        const currentDateTime = new Date().toLocaleString("id-ID", {
            year: "numeric",
            month: "long", 
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

        // Jika data tidak ada di cache atau expired cache nya, proses get dari db lalu set ke redis
        if (!fromCache) {

            if(jalur_pendaftaran_id == 1){
 
                //Jalur Zonasi Reguler SMA
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
    
                let kuota_zonasi_max = resSek.daya_tampung;
                let kuota_zonasi_min = resSek.kuota_zonasi;
    
                 
                let persentase_domisili_nilai = DomiNilaiHelper('nilai');
    
                // Hitung 3% dari kuota_zonasi_min
                // let kuota_zonasi_nilai_min = (persentase_domisili_nilai / 100) * kuota_zonasi_min;
                // let kuota_zonasi_nilai_min = Math.round((persentase_domisili_nilai / 100) * kuota_zonasi_min);
    
                //bulat keatas
                let kuota_zonasi_nilai_min = Math.ceil((persentase_domisili_nilai / 100) * kuota_zonasi_max);
    
    
                console.log('---------');
                console.log('kuota zonasi nilai:'+kuota_zonasi_nilai_min);
    
          
                console.log('---------');
                let zonasi_jarak = kuota_zonasi_min - kuota_zonasi_nilai_min;
    
                console.log('kuota zonasi jarak:'+zonasi_jarak);
                console.log('---------');
                //cari data rangking zonasi reguler (jarak)
                const resDataZonasi = await DataPerangkingans.findAndCountAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'], // Pilih kolom yang diambil
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Exclude 2 and 3
                    },
                    order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Jarak terendah
                        ['umur', 'DESC'], // Umur tertua
                        ['created_at', 'ASC'] 
                    ],
                    limit: zonasi_jarak
                });
                
                const rowsZonasiReg = resDataZonasi.rows; // Data hasil query
                const totalZonasiReg = rowsZonasiReg.length; // Total jumlah data setelah limit
    
                //hitung total pendaftar prestasi dulu
                const countPrestasi = (await DataPerangkingans.findAll({  
                    attributes: ['nisn'], // Pilih kolom yang diambil
                    where: {  
                        jalur_pendaftaran_id: 3,
                        sekolah_tujuan_id,  
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    limit: resSek.kuota_prestasi
                })).length;
    
                 //hitung total pendaftar afirmasi dulu
                 const countAfirmasi = (await DataPerangkingans.findAll({  
                    where: {  
                        jalur_pendaftaran_id: 5,
                        sekolah_tujuan_id,  
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    limit: resSek.kuota_afirmasi
                })).length;
    
                 //hitung total pendaftar pto dulu
                 const countPto = (await DataPerangkingans.findAll({  
                    where: {  
                        jalur_pendaftaran_id: 4,
                        sekolah_tujuan_id,  
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    limit: resSek.kuota_afirmasi
                })).length;
    
                let countZonasiKhusus = 0;
                if(resSek.kuota_zonasi_khusus > 0){
    
                   //hitung total pendaftar zonasi khusus
                     countZonasiKhusus = (await DataPerangkingans.findAll({  
                        attributes: ['nisn'], // Pilih kolom yang diambil
                        where: {  
                            jalur_pendaftaran_id: 2,
                            sekolah_tujuan_id,  
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Tidak daftar ulang
                        },
                        limit: resSek.kuota_zonasi_khusus
                    })).length;
    
                }else{
    
                     countZonasiKhusus = 0;
                    
                }
    
                // let kuota_zonasi_nilai = kuota_zonasi_max - totalZonasiReg - countZonasiKhusus - countPrestasi - countAfirmasi - countPto;
                // let kuota_zonasi_nilai = kuota_zonasi_max - (totalZonasiReg + countZonasiKhusus) +  countPrestasi + countAfirmasi + countPto;
    
                let kuota_terpakai = totalZonasiReg + countZonasiKhusus +  countPrestasi + countAfirmasi + countPto;
    
                // let kuota_zonasi_nilai = kuota_zonasi_max - kuota_terpakai;
                let kuota_zonasi_nilai = Math.max(0, kuota_zonasi_max - kuota_terpakai);
    
                // const resDataZonasiIds = resDataZonasi.rows.map((item) => item.id);
                const resDataZonasiIds = (resDataZonasi.rows || []).map((item) => item.id);
                const resZonasiNilai = await DataPerangkingans.findAll({
                    attributes: ['id', 'no_pendaftaran', 'nisn', 'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'],
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },  // dinyatakan tidak daftar ulang
                        id: { [Op.notIn]: resDataZonasiIds } // Hindari ID yang sudah ada di resDataZonasi
                    },
                    order: [
                        ['nilai_akhir', 'DESC'],
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        // ['umur', 'DESC'], 
                        ['created_at', 'ASC'] 
                    ],
                    limit: kuota_zonasi_nilai
                });

               
    
                   
                const combinedData = [
                    ...(rowsZonasiReg ? rowsZonasiReg.map(item => ({
                        ...item.toJSON(),
                        order_berdasar: "1"
                    })) : []), // Jika null, gunakan array kosong
                
                    ...(resZonasiNilai ? resZonasiNilai.map(item => ({
                        ...item.toJSON(),
                        order_berdasar: "2"
                    })) : []) // Jika null, gunakan array kosong
                ];
    
                const modifiedData = combinedData.map(item => {
                    const { id_pendaftar, id, ...rest } = item;
                    return { 
                        ...rest, 
                        id: encodeId(id), 
                        id_pendaftar: encodeId(id_pendaftar) 
                    };
                });

                const dataToStore = {
                    data: modifiedData,
                    metadata: {
                        savedAt: new Date().toLocaleString('id-ID') // Waktu penyimpanan
                        // Bisa tambahkan info lain seperti:
                        // source: "perangkingan",
                        // expireTime: process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN
                    }
                };

                await redisSet(redis_key, JSON.stringify(dataToStore), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);


                const resZonasiNilai99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                        }
                    },
                    order: [
                        ['nilai_akhir', 'DESC'],
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        // ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    // limit: kuota_zonasi
                });

                const modifiedData99 = resZonasiNilai99.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    // return { ...rest, id: encodeId(id) };
                    return { 
                        ...rest, 
                        id: encodeId(id), 
                        id_pendaftar: encodeId(id_pendaftar),
                        status_daftar_sekolah: 0
                    };
                });

                const combinedData99 = [...modifiedData, ...modifiedData99];
                //ini untuk simpan data yang full pendaftar
                // await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                // console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);

                const dataToStore99 = {
                    data: combinedData99,
                    metadata: {
                        savedAt: new Date().toLocaleString('id-ID') // Waktu penyimpanan
                        // Bisa tambahkan info lain seperti:
                        // source: "perangkingan",
                        // expireTime: process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN
                    }
                };

                // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                // await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                await redisSet(redis_key, JSON.stringify(dataToStore99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key}`);
                
                if (is_pdf === 1) {
                    // Generate PDF
                    const docDefinition = {
                        content: [
                            { text: 'Perangkingan Pendaftaran', style: 'header' },
                            { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                            { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                            { text: 'Data Perangkingan:', style: 'subheader' },
                            {
                                table: {
                                    // widths: ['auto', '*', '*', '*', '*', '*'],
                                    body: [
                                        ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                        ...modifiedData.map((item, index) => [
                                            index + 1,
                                            item.no_pendaftaran,
                                            item.nama_lengkap,
                                            item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                            item.jarak,
                                        
    
                                        ])
                                    ]
                                }
                            }
                        ],
                        styles: {
                            header: {
                                fontSize: 18,
                                bold: true,
                                margin: [0, 0, 0, 10]
                            },
                            subheader: {
                                fontSize: 14,
                                bold: true,
                                margin: [0, 10, 0, 5]
                            }
                        }
                    };
                
                    const pdfDoc = pdfMake.createPdf(docDefinition);
                
                    // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                    pdfDoc.getBase64((data) => {
                        const buffer = Buffer.from(data, 'base64');
                        res.setHeader('Content-Type', 'application/pdf');
                        res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                        res.send(buffer);
                    });
    
                }else{
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': modifiedData, // Return the found data
                        'timeline': resTimeline
                    });
    
                }
    
    
                // res.status(200).json({
                //     'status': 1,
                //     'message': 'Data berhasil ditemukan',
                //     'data': modifiedData, // Return the found data
                //     'timeline' : resTimeline
                // });
                
    
            }else if(jalur_pendaftaran_id == 2){
                //Jalur Zonasi KHUSUS SMA
    
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
    
                let kuota_zonasi_khusus = resSek.kuota_zonasi_khusus;
    
    
                const resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        
                    },
                    order: [
                        ['umur', 'DESC'], //umur tertua
                        ['nilai_akhir', 'DESC'], //jarak terendah  
                        ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    limit: kuota_zonasi_khusus
                });

                const resData99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                        }
                        
                    },
                    order: [
                        ['umur', 'DESC'], //umur tertua
                        ['nilai_akhir', 'DESC'], //jarak terendah  
                        // ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    // limit: kuota_zonasi_khusus
                });
    
                if (resData) { 
                    // Check if resData is not null
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 1
                        };
                    });

                    const dataToStore = {
                        data: modifiedData,
                        metadata: {
                            savedAt: new Date().toLocaleString('id-ID') // Waktu penyimpanan
                            // Bisa tambahkan info lain seperti:
                            // source: "perangkingan",
                            // expireTime: process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN
                        }
                    };
    
                    // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                    // await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    await redisSet(redis_key, JSON.stringify(dataToStore), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                    //ini untuk simpan data yang pendaftar keterima
                    // await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    // console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });


                    const combinedData99 = [...modifiedData, ...modifiedData99];
                     //ini untuk simpan data yang full pendaftar
                    //  await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    //  console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);

                     const dataToStore99 = {
                        data: combinedData99,
                        metadata: {
                            savedAt: new Date().toLocaleString('id-ID') // Waktu penyimpanan
                            // Bisa tambahkan info lain seperti:
                            // source: "perangkingan",
                            // expireTime: process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN
                        }
                    };
                    await redisSet(redis_key, JSON.stringify(dataToStore99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key}`);

    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData,
                    //     'timeline': resTimeline// Return the found data
                    // });
    
    
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
    
            }else if(jalur_pendaftaran_id == 3){
                 //Jalur Prestasi SMA
    
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
    
                let kuota_prestasi = resSek.kuota_prestasi;
    
                 const resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    },
                    order: [
                        ['nilai_akhir', 'DESC'], //nilai tertinggi
                        ['umur', 'DESC'], //umur tertua
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    limit: kuota_prestasi
                   
                });

                const resData99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                        }
                        
                    },
                    order: [
                        ['nilai_akhir', 'DESC'], //nilai tertinggi
                        ['umur', 'DESC'], //umur tertua
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    // limit: kuota_zonasi_khusus
                });
    
                if (resData && resData.length > 0) {
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
                    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                    });

                    // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                    // await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    // console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                    const dataToStore = {
                        data: modifiedData,
                        metadata: {
                            savedAt: new Date().toLocaleString('id-ID') // Waktu penyimpanan
                            // Bisa tambahkan info lain seperti:
                            // source: "perangkingan",
                            // expireTime: process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN
                        }
                    };
    
                    await redisSet(redis_key, JSON.stringify(dataToStore), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);


                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                    //ini untuk simpan data yang full pendaftar
                    // await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    // console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);

                    const dataToStore99 = {
                        data: combinedData99,
                        metadata: {
                            savedAt: new Date().toLocaleString('id-ID') // Waktu penyimpanan
                            // Bisa tambahkan info lain seperti:
                            // source: "perangkingan",
                            // expireTime: process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN
                        }
                    };
    
                    await redisSet(redis_key, JSON.stringify(dataToStore99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key}`);
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData,
                    //     'timeline': resTimeline // Return the found data
                    // });
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
    
    
            }else if(jalur_pendaftaran_id == 4){
                //Jalur PTO / MutasiSMA 
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
    
                let kuota_pto = resSek.kuota_pto;
    
                const resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // yang tidak daftar ulang
                    },
                    order: [
                        [literal('is_anak_guru_jateng DESC')], // Prioritaskan yang is_anak_guru_jateng = 1
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                        ['created_at', 'ASC'] // Urutkan berdasarkan waktu pendaftaran (tercepat lebih dulu)
                    ],
                    limit: kuota_pto
                });
    
                const resData99 = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        id: { 
                            [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                        }
                        
                    },
                    order: [
                        [literal('is_anak_guru_jateng DESC')], // Prioritaskan yang is_anak_guru_jateng = 1
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                        ['created_at', 'ASC'] // Urutkan berdasarkan waktu pendaftaran (tercepat lebih dulu)
                    ],
                    // limit: kuota_zonasi_khusus
                });

               if (resData && resData.length > 0) {
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                    });

                     // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                     await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                     const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });


                     const combinedData99 = [...modifiedData, ...modifiedData99];
                     //ini untuk simpan data yang full pendaftar
                     await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData,
                    //     'timeline': resTimeline // Return the found data
                    // });
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
    
            }else if(jalur_pendaftaran_id == 5){
            //Jalur Afirmasi SMA
    
                // const resSek = await SekolahTujuan.findOne({
                //     where: {
                //         id : sekolah_tujuan_id,
                //     }
                // });
                const resSek = await getSekolahTujuanById(sekolah_tujuan_id);
                
                let daya_tampung = resSek.daya_tampung;
                let kuota_afirmasi = resSek.kuota_afirmasi;
                let kuota_persentase_ats = afirmasiSmaHelper('is_tidak_sekolah');
                let kuota_persentase_panti = afirmasiSmaHelper('is_anak_panti');
    
                let kuota_ats = Math.ceil((kuota_persentase_ats / 100) * daya_tampung) || 0;
                let kuota_panti = Math.ceil((kuota_persentase_panti / 100) * daya_tampung) || 0;
    
                console.log('kuota ats:'+kuota_ats)
                console.log('kuota panti:'+kuota_panti)
    
                const resDataPanti = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // tidak daftar ulang
                        is_anak_keluarga_tidak_mampu: '0',
                        is_anak_panti: '1',
                        is_tidak_sekolah: '0', 
                    },
                    order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    limit: kuota_panti
                });
    
                const resDataAts = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // tidak daftar ulang
                        is_anak_keluarga_tidak_mampu: '0',
                        is_anak_panti: '0',
                        is_tidak_sekolah: '1', 
                    },
                    order: [
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    limit: kuota_ats
                });
    
                // let kuota_afirmasi_sisa = kuota_afirmasi - (resDataAts.length+resDataPanti.length);
                let kuota_afirmasi_sisa = kuota_afirmasi - (resDataAts.length + resDataPanti.length);
    
                console.log('kuota kuota_afirmasi_sisa:'+kuota_afirmasi_sisa)
    
    
                const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 }, // tidak daftar ulang
                    is_anak_keluarga_tidak_mampu: '1',
                    is_anak_panti: '0', // bukan anak panti
                    is_tidak_sekolah: '0', // bukan anak panti
                    // // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    // [Op.or]: [
                    //     { is_anak_keluarga_tidak_mampu: '1' },
                    //     { is_tidak_sekolah: '1' },
                    //     { is_anak_panti: '1' }
                    // ]
                },
                order: [
                    ['is_disabilitas', 'ASC'], //disabilitas 
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    // ['created_at', 'ASC'] //daftar sekolah terawal
                ],
                limit: kuota_afirmasi_sisa
               
                });
                if (resData) { 
                    
                    // Check if resData is not null
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
    
                    const combinedData = [
                        ...(resDataPanti ? resDataPanti.map(item => ({
                            ...item.toJSON(),
                            order_berdasar: "3"
                        })) : []), // Jika null, gunakan array kosong
                    
                        ...(resDataAts ? resDataAts.map(item => ({
                            ...item.toJSON(),
                            order_berdasar: "4"
                        })) : []), // Jika null, gunakan array kosong
    
                        ...(resData ? resData.map(item => ({
                            ...item.toJSON(),
                            order_berdasar: "5"
                        })) : []), // Jika null, gunakan array kosong
                    ];
    
                    const modifiedData = combinedData.map(item => {
                        const { id_pendaftar, id, ...rest } = item;
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar) 
                        };
                    });

                     // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                     await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                     const resData99 = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            is_anak_keluarga_tidak_mampu: '1',
                            is_anak_panti: '0', // bukan anak panti
                            is_tidak_sekolah: '0', // bukan anak panti
                            id: { 
                                [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                            }
                        },
                        order: [
                            ['is_disabilitas', 'ASC'], //disabilitas 
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                            // ['created_at', 'ASC'] //daftar sekolah terawal
                        ],
                        // limit: kuota_zonasi
                    });

                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                    //ini untuk simpan data yang full pendaftar
                    await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);

                    // const modifiedData = resData.map(item => {
                    //     const { id_pendaftar, id, ...rest } = item.toJSON();
                    //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                    //     // return { ...rest, id: encodeId(id) };
                    // });
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline
                        });
    
                    }
    
    
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': modifiedData, // Return the found data
                    //     'timeline': resTimeline
                    // });
    
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
            }else if(jalur_pendaftaran_id == 6){
                //Jalur SMK Domisili Terdekat
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
    
                    let persentase_seleksi_terdekat_anak_guru = DomiSmkHelper('anak_guru');
    
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
                    
    
                    let daya_tampung = resJurSek.daya_tampung;
                    let kuota_anak_guru = Math.ceil((persentase_seleksi_terdekat_anak_guru / 100) * daya_tampung);
                    let kuota_jarak_terdekat = resJurSek.kuota_jarak_terdekat;

                    // anak guru
                    const resDataAnakGuru = await DataPerangkingans.findAndCountAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                            is_anak_guru_jateng: '1',
                        }, order: [
                            ['is_anak_guru_jateng', 'DESC'],
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                            // ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        limit: kuota_anak_guru
                        });

                    const rowsAnakGuru = resDataAnakGuru.rows; // Data hasil query
                    const totalAnakGuru = resDataAnakGuru.rows.length || 0; // Total jumlah data setelah limit

                    let kuota_akhir_jarak_terdekat = kuota_jarak_terdekat - totalAnakGuru;
    
                    // murni
                    const resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                    }, order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                        ['umur', 'DESC'], //umur tertua
                        // ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    limit: kuota_akhir_jarak_terdekat
                    });

                    const combinedData = [
                        ...(rowsAnakGuru || []).map(item => ({
                          ...item.toJSON(),
                          order_berdasar: "6"
                        })),
                        ...(resData || []).map(item => ({
                          ...item.toJSON(),
                          order_berdasar: "7"
                        }))
                      ];
    
                    // const modifiedData = resData.map(item => {
                    //     const { id_pendaftar, id, ...rest } = item.toJSON();
                    //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                    // });

                    const modifiedData = combinedData.map(item => {
                        const { id_pendaftar, id, ...rest } = item;
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar) 
                        };
                    });

                    // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                    await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                    const resData99 = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            id: { 
                                [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                            }
                        },
                        order: [
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                            ['umur', 'DESC'], //umur tertua
                            // ['created_at', 'ASC'] //daftar sekolah terawal
                        ],
                        // limit: kuota_zonasi
                    });
    
                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                    //ini untuk simpan data yang full pendaftar
                    await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
                    
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline
                        });
    
                    }
    
            }else if(jalur_pendaftaran_id == 7){
                //Jalur SMK Prestasi
    
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
    
                    let kuota_prestasi_max = resJurSek.daya_tampung;
                    let kuota_prestasi_min = resJurSek.kuota_prestasi;
        
                    //hitung total pendaftar domisili terdekat smk dulu,
                    const countTerdekat = (await DataPerangkingans.findAll({  
                        where: {  
                            jalur_pendaftaran_id: 6,
                            sekolah_tujuan_id,  
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                        },
                        limit: resJurSek.kuota_jarak_terdekat
                    })).length;
    
                    //hitung total pendaftar afirmasi smk dulu,
                    const countAfirmasi = (await DataPerangkingans.findAll({  
                        where: {  
                            jalur_pendaftaran_id: 9,
                            sekolah_tujuan_id,  
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition   
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                        },
                        limit: resJurSek.kuota_afirmasi
                    })).length;
    
                     //hitung total pendaftar prestasi khusus
                     const countPrestasiKhusus = (await DataPerangkingans.findAll({  
                        where: {  
                            jalur_pendaftaran_id: 8,
                            sekolah_tujuan_id,  
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                        },
                        limit: resJurSek.kuota_prestasi_khusus
                    })).length;
    
                    // let kuota_prestasi = resJurSek.kuota_prestasi;
                    let kuota_prestasi = kuota_prestasi_max - (countTerdekat + countAfirmasi + countPrestasiKhusus);
    
                
                    let kuota_prestasi_akhir; // Menggunakan let untuk scope blok  
                    if(kuota_prestasi >= kuota_prestasi_min){
                        kuota_prestasi_akhir = kuota_prestasi;
                    }else{
                        kuota_prestasi_akhir = kuota_prestasi_min;
                    }
    
                    const resData = await DataPerangkingans.findAll({
                    where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition  
                        }, order: [
                            ['nilai_akhir', 'DESC'], //nilai tertinggi
                            ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        limit: kuota_prestasi_akhir
                    });


                    const resData99 = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            id: { 
                                [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                            }
                            
                        },
                        order: [
                            ['nilai_akhir', 'DESC'], //nilai tertinggi
                            ['umur', 'DESC'], //umur tertua
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        // limit: kuota_zonasi_khusus
                    });
                    
                    if (resData && resData.length > 0) {
        
                       
                        const modifiedData = resData.map(item => {
                            const { id_pendaftar, id, ...rest } = item.toJSON();
                            return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                            // return { ...rest, id: encodeId(id) };
                        });

                         // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                        await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                        console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);

                        const modifiedData99 = resData99.map(item => {
                            const { id_pendaftar, id, ...rest } = item.toJSON();
                            // return { ...rest, id: encodeId(id) };
                            return { 
                                ...rest, 
                                id: encodeId(id), 
                                id_pendaftar: encodeId(id_pendaftar),
                                status_daftar_sekolah: 0
                            };
                        });
    
    
                        const combinedData99 = [...modifiedData, ...modifiedData99];
                         //ini untuk simpan data yang full pendaftar
                         await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                         console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
    
                        if (is_pdf === 1) {
                            // Generate PDF
                            const docDefinition = {
                                content: [
                                    { text: 'Perangkingan Pendaftaran', style: 'header' },
                                    { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                    { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                    { text: 'Data Perangkingan:', style: 'subheader' },
                                    {
                                        table: {
                                            // widths: ['auto', '*', '*', '*', '*', '*'],
                                            body: [
                                                ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                                ...modifiedData.map((item, index) => [
                                                    index + 1,
                                                    item.no_pendaftaran,
                                                    item.nama_lengkap,
                                                    item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                    item.jarak,
    
                                                ])
                                            ]
                                        }
                                    }
                                ],
                                styles: {
                                    header: {
                                        fontSize: 18,
                                        bold: true,
                                        margin: [0, 0, 0, 10]
                                    },
                                    subheader: {
                                        fontSize: 14,
                                        bold: true,
                                        margin: [0, 10, 0, 5]
                                    }
                                }
                            };
                        
                            const pdfDoc = pdfMake.createPdf(docDefinition);
                        
                            // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                            pdfDoc.getBase64((data) => {
                                const buffer = Buffer.from(data, 'base64');
                                res.setHeader('Content-Type', 'application/pdf');
                                res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                                res.send(buffer);
                            });
    
                        }else{
    
                            res.status(200).json({
                                'status': 1,
                                'message': 'Data berhasil ditemukan',
                                'data': modifiedData, // Return the found data
                                'timeline': resTimeline
                            });
    
                        }
    
                        
    
                        
                        
        
                       
                    } else {
                        res.status(200).json({
                            'status': 0,
                            'message': 'Data kosong',
                            'data': [], // Return null or an appropriate value when data is not found
                            'timeline': resTimeline // Return the found data
                        });
                    }
            }else if(jalur_pendaftaran_id == 8){
                //Jalur SMK Prestasi Khusus
    
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
    
                    let kuota_prestasi_khusus = resJurSek.kuota_prestasi_khusus;
    
                    const resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    }, order: [
                        // ['nilai_akhir', 'DESC'], //nilai tertinggi
                        // ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    limit: kuota_prestasi_khusus
                    });
                    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                        
                    });

                     // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                     await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);


                     const resData99 = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                            id: { 
                                [Op.notIn]: resData.map(item => item.id) // Exclude yang sudah diterima
                            }
                            
                        },
                        order: [
                            // ['umur', 'DESC'], //umur tertua
                            // ['nilai_akhir', 'DESC'], //jarak terendah  
                            // ['created_at', 'ASC'] //daftar sekolah terawal
                            ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        // limit: kuota_zonasi_khusus
                    });

                    const modifiedData99 = resData99.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        // return { ...rest, id: encodeId(id) };
                        return { 
                            ...rest, 
                            id: encodeId(id), 
                            id_pendaftar: encodeId(id_pendaftar),
                            status_daftar_sekolah: 0
                        };
                    });

                    const combinedData99 = [...modifiedData, ...modifiedData99];
                     //ini untuk simpan data yang full pendaftar
                     await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                {
                                    table: {
                                        // widths: ['auto', '*', '*', '*', '*', '*'],
                                        body: [
                                            ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                            ...modifiedData.map((item, index) => [
                                                index + 1,
                                                item.no_pendaftaran,
                                                item.nama_lengkap,
                                                item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                item.jarak,
    
                                            ])
                                        ]
                                    }
                                }
                            ],
                            styles: {
                                header: {
                                    fontSize: 18,
                                    bold: true,
                                    margin: [0, 0, 0, 10]
                                },
                                subheader: {
                                    fontSize: 14,
                                    bold: true,
                                    margin: [0, 10, 0, 5]
                                }
                            }
                        };
                    
                        const pdfDoc = pdfMake.createPdf(docDefinition);
                    
                        // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                        pdfDoc.getBase64((data) => {
                            const buffer = Buffer.from(data, 'base64');
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                            res.send(buffer);
                        });
    
                    }else{
    
                        res.status(200).json({
                            'status': 1,
                            'message': 'Data berhasil ditemukan',
                            'data': modifiedData, // Return the found data
                            'timeline': resTimeline
                        });
    
                    }
    
            }else if(jalur_pendaftaran_id == 9){
                //Jalur SMK Afirmasi
                    // const resJurSek = await SekolahJurusan.findOne({
                    //     where: {
                    //         id_sekolah_tujuan : sekolah_tujuan_id,
                    //         id : jurusan_id,
                    //     }
                    // });
                    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
    
                    let kuota_afirmasi = resJurSek.kuota_afirmasi;
    
                    let miskin = afirmasiSmkHelper('is_anak_keluarga_miskin');
                    let panti = afirmasiSmkHelper('is_anak_panti');
                    let ats = afirmasiSmkHelper('is_tidak_sekolah');
                    let jml = miskin + panti + ats;
    
                    let kuota_panti = Math.round((panti / jml) * kuota_afirmasi) || 0;
                    let kuota_ats = Math.round((ats / jml) * kuota_afirmasi) || 0;
    
                    //ATS
                    const resDataAts = await DataPerangkingans.findAndCountAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                            is_tidak_sekolah: '1',         
                            // [Op.or]: [
                            //     { is_anak_keluarga_tidak_mampu: '1' },
                            //     { is_tidak_sekolah: '1' },
                            //     { is_anak_panti: '1' }
                            // ]               
                        }, order: [
                            ['umur', 'DESC'], //umur tertua
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                            // ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        limit: kuota_panti
                    });
    
                    const rowsAtsR = resDataAts.rows; // Data hasil query
                    const totalAtsL = resDataAts.rows.length || 0; // Total jumlah data setelah limit
    
                    //panti
                    const resDataPanti = await DataPerangkingans.findAndCountAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            jurusan_id,
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                            is_anak_panti: '1',          
                        }, order: [
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                            ['umur', 'DESC'], //umur tertua
                            // ['created_at', 'ASC'] // daftar sekolah terawal
                        ],
                        limit: kuota_ats
                    });
    
                    const rowsPantiR = resDataPanti.rows; // Data hasil query
                    const totalPatntiL = resDataPanti.rows.length || 0; // Total jumlah data setelah limit
    
    
                    let kuota_akhir_afirmasi = kuota_afirmasi - (totalPatntiL + totalAtsL)
                    
                    console.log('---');
                    console.log('total panti:'+totalPatntiL);
                    console.log('---');
                    console.log('total ats:'+totalAtsL);
                    console.log('---');
                    console.log('total akhir:'+kuota_akhir_afirmasi);
                    console.log('---');
    
                    const resAtsIds = (rowsAtsR.rows || []).map((item) => item.id);
                    const resPantiIds = (rowsPantiR.rows || []).map((item) => item.id);
    
                    //afirmasi murni miskin
                    const resDataMiskin = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                        is_anak_keluarga_tidak_mampu: '1',  
                        is_anak_panti: '0', // bukan anak panti
                        is_tidak_sekolah: '0', // bukan anak ats
                        id: { [Op.notIn]: [...resAtsIds, ...resPantiIds] } // Gabungkan ID ATS & Panti
                                    
                    }, order: [
                        ['nilai_akhir', 'DESC'], //nilai tertinggi
                        ['umur', 'DESC'], //umur tertua
                        // ['created_at', 'ASC'] // daftar sekolah terawal
                    ],
                    limit: kuota_akhir_afirmasi
                    });
    
                        // const modifiedData = [...rowsAtsR, ...rowsPantiR, ...resDataMiskin,].map(item => {
                        //     const { id_pendaftar, id, ...rest } = item.toJSON();
                        //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // });
    
                        // const modifiedData = [...(rowsAtsR || []), ...(rowsPantiR || []), ...(resDataMiskin || [])].map(item => {
                        //     const { id_pendaftar, id, ...rest } = item.toJSON();
                        //     return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // });
    
                        const combinedData = [
                            ...(rowsPantiR || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "3"
                            })),
                            ...(rowsAtsR || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "4"
                            })),
                            ...(resDataMiskin || []).map(item => ({
                              ...item.toJSON(),
                              order_berdasar: "5"
                            }))
                          ];
                          
    
                          const modifiedData = combinedData.map(item => {
                            const { id_pendaftar, id, ...rest } = item;
                            return { 
                                ...rest, 
                                id: encodeId(id), 
                                id_pendaftar: encodeId(id_pendaftar) 
                            };
                        });

                        // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                        await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                        console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);
                        
                        const resData99 = await DataPerangkingans.findAll({
                            where: {
                                jalur_pendaftaran_id,
                                sekolah_tujuan_id,
                                is_delete: 0,
                                is_daftar_ulang: { [Op.ne]: 2 },// dinyatakan tidak daftar ulang
                                // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                                is_anak_keluarga_tidak_mampu: '1',
                                is_anak_panti: '0', // bukan anak panti
                                is_tidak_sekolah: '0', // bukan anak ats
                                id: { 
                                    [Op.notIn]: combinedData.map(item => item.id) // Exclude yang sudah diterima
                                }
                            },
                            order: [
                                ['nilai_akhir', 'DESC'], //nilai tertinggi
                                ['umur', 'DESC'], //umur tertua
                                // ['created_at', 'ASC'] // daftar sekolah terawal
                            ],
                            // limit: kuota_zonasi
                        });
    
                        const modifiedData99 = resData99.map(item => {
                            const { id_pendaftar, id, ...rest } = item.toJSON();
                            // return { ...rest, id: encodeId(id) };
                            return { 
                                ...rest, 
                                id: encodeId(id), 
                                id_pendaftar: encodeId(id_pendaftar),
                                status_daftar_sekolah: 0
                            };
                        });
    
                        const combinedData99 = [...modifiedData, ...modifiedData99];
                        //ini untuk simpan data yang full pendaftar
                        await redisSet(redis_key_full, JSON.stringify(combinedData99), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                        console.log(`[DB] Data 99 disimpan ke cache untuk key: ${redis_key_full}`);
    
                        if (is_pdf === 1) {
                            // Generate PDF
                            const docDefinition = {
                                content: [
                                    { text: 'Perangkingan Pendaftaran', style: 'header' },
                                    { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                    { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
                                    { text: 'Data Perangkingan:', style: 'subheader' },
                                    {
                                        table: {
                                            // widths: ['auto', '*', '*', '*', '*', '*'],
                                            body: [
                                                ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                                                ...modifiedData.map((item, index) => [
                                                    index + 1,
                                                    item.no_pendaftaran,
                                                    item.nama_lengkap,
                                                    item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                                                    item.jarak,
    
                                                ])
                                            ]
                                        }
                                    }
                                ],
                                styles: {
                                    header: {
                                        fontSize: 18,
                                        bold: true,
                                        margin: [0, 0, 0, 10]
                                    },
                                    subheader: {
                                        fontSize: 14,
                                        bold: true,
                                        margin: [0, 10, 0, 5]
                                    }
                                }
                            };
                        
                            const pdfDoc = pdfMake.createPdf(docDefinition);
                        
                            // Menggunakan `getBase64` agar bisa dikirim sebagai response buffer
                            pdfDoc.getBase64((data) => {
                                const buffer = Buffer.from(data, 'base64');
                                res.setHeader('Content-Type', 'application/pdf');
                                res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
                                res.send(buffer);
                            });
    
                        }else{
    
                            res.status(200).json({
                                'status': 1,
                                'message': 'Data berhasil ditemukan',
                                'data': modifiedData, // Return the found data
                                'timeline': resTimeline
                            });
    
                        }
    
            }else{
                          
                res.status(200).json({
                    'status': 0,
                    'message': 'Ada kesalahan, jalur pendaftaran tidak ditemukan',
                    'data': [], // Return null or an appropriate value when data is not found
                    'timeline': resTimeline // Return the found data
                });
    
            }
    
        }

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({
            'status': 0,
            'message': 'Error'
        });
    }
}

export const getInfoParam = async (req, res) => {

    try {

        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            jurusan_id,
            nisn,
        } = req.body;

        const resJalur = await JalurPendaftarans.findOne({
            where: {
                id: jalur_pendaftaran_id,
            },
            attributes: ['id', 'nama'] // Ambil atribut yang diperlukan
        });
        
        const resSekolah = await SekolahTujuan.findOne({
            where: {
                id: sekolah_tujuan_id,
            },
            attributes: ['id', 'npsn','nama'] // Ambil atribut yang diperlukan
        });

        if(jurusan_id != 0){
            const resJurusan = await SekolahJurusan.findOne({
                where: {
                    id: jurusan_id,
                },
                attributes: ['id','nama_jurusan'] // Ambil atribut yang diperlukan
            });

              // Memeriksa apakah data ditemukan  
              if (!resJalur) {  
                return res.status(404).json({  
                    status: 0,  
                    message: 'Jalur pendaftaran tidak ditemukan',  
                });  
                }  
        
                if (!resSekolah) {  
                    return res.status(404).json({  
                        status: 0,  
                        message: 'Sekolah tujuan tidak ditemukan',  
                    });  
                }  

                if (!resJurusan) {  
                    return res.status(404).json({  
                        status: 0,  
                        message: 'Jurusan tujuan tidak ditemukan',  
                    });  
                }  
    
                 // Jika semua data ditemukan, kirimkan respons dengan data  
                res.status(200).json({  
                    status: 1,  
                    message: 'Data berhasil ditemukan',  
                    data: {  
                        jalur: resJalur,  
                        sekolah: resSekolah,  
                        jurusan: resJurusan,  
                    },  
                });
    

        }else{

              // Memeriksa apakah data ditemukan  
            if (!resJalur) {  
            return res.status(404).json({  
                status: 0,  
                message: 'Jalur pendaftaran tidak ditemukan',  
            });  
            }  
    
            if (!resSekolah) {  
                return res.status(404).json({  
                    status: 0,  
                    message: 'Sekolah tujuan tidak ditemukan',  
                });  
            }  

             // Jika semua data ditemukan, kirimkan respons dengan data  
            res.status(200).json({  
                status: 1,  
                message: 'Data berhasil ditemukan',  
                data: {  
                    jalur: resJalur,  
                    sekolah: resSekolah,  
                    jurusan: null,  
                },  
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
 
export const getPerangkinganHasil = async (req, res) => {

    try {

        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            jurusan_id,
            nisnxw,
        } = req.body;

        const sekoahData = await SekolahTujuan.findOne({
            where: {
                id: sekolah_tujuan_id
            }
        });

        let kuota_zonasi = sekoahData.kuota_zonasi;
        let kuota_prestasi = sekoahData.kuota_prestasi;
        
        if(jalur_pendaftaran_id == 1){
 
            //Jalur Zonasi Reguler SMA
            const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0
                },
                order: [
                    // ['jarak', 'ASC'], //jarak terendah
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] //daftar sekolah terawal
                ],
                limit: kuota_zonasi // Add the limit option here  
                
            });

            if (resData && resData.length > 0) {

                const modifiedData = resData.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    return { ...rest, id: encodeId(id) };
                });

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': modifiedData // Return the found data
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
                // res.status(200).json({
                //     'status': 1,
                //     'message': 'Data berhasil ditemukan',
                //     'data': resData // Return the found data
                // });

                const modifiedData = resData.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    return { ...rest, id: encodeId(id) };
                });

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': modifiedData // Return the found data
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
                ],
                limit: kuota_zonasi // Add the limit option here  
               
            });

            if (resData && resData.length > 0) {
                // res.status(200).json({
                //     'status': 1,
                //     'message': 'Data berhasil ditemukan',
                //     'data': resData // Return the found data
                // });
                const modifiedData = resData.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    return { ...rest, id: encodeId(id) };
                });

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': modifiedData // Return the found data
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

           if (resData && resData.length > 0) {
                // res.status(200).json({
                //     'status': 1,
                //     'message': 'Data berhasil ditemukan',
                //     'data': resData // Return the found data
                // });
                const modifiedData = resData.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    return { ...rest, id: encodeId(id) };
                });

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': modifiedData // Return the found data
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
                // res.status(200).json({
                //     'status': 1,
                //     'message': 'Data berhasil ditemukan',
                //     'data': resData // Return the found data
                // });
                const modifiedData = resData.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    return { ...rest, id: encodeId(id) };
                });

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': modifiedData // Return the found data
                });
            } else {
                res.status(200).json({
                    'status': 0,
                    'message': 'Data kosong',
                    'data': [] // Return null or an appropriate value when data is not found
                });
            }
        }else if(jalur_pendaftaran_id == 6){
            //Jalur SMK Terdekat
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
                if (resData && resData.length > 0) {
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id) };
                    });
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': modifiedData // Return the found data
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
                if (resData && resData.length > 0) {
                    // res.status(200).json({
                    //     'status': 1,
                    //     'message': 'Data berhasil ditemukan',
                    //     'data': resData // Return the found data
                    // });
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id) };
                    });
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': modifiedData // Return the found data
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

export const generatePendaftarPrestasiKhususCache = async (req, res) => {
    try {
        const redis_key = `DataPendaftarPrestasiKhususByNisn`;
        
        // Ambil data langsung dari database (tanpa cek cache)
        const pendaftarPrestasi = await DataPendaftarPrestasiKhusus.findAll({
            attributes: ['nisn', 'sekolah_pilihan_npsn'],
        });

        // Simpan data baru ke cache dengan expiry time
        await redisSet(redis_key, JSON.stringify(pendaftarPrestasi), 31536000);
        console.log(`[DB] Data baru disimpan ke Redis: ${redis_key}`);
        
        return res.status(200).json({
            status: 1,
            message: 'Berhasil generate cache pendaftar prestasi khusus',
            data: {
                redis_key: redis_key,
                record_count: pendaftarPrestasi.length,
                expiry: 31536000
            }
        });
        
    } catch (error) {
        console.error('Error in generatePendaftarPrestasiKhususCache:', error);
        return res.status(500).json({
            status: 0,
            message: 'Gagal generate cache pendaftar prestasi khusus',
            error: error.message
        });
    }
};

export const getPendaftarPrestasiKhususByNisn = async () => {
    try {
        const redis_key = `DataPendaftarPrestasiKhususByNisn`;
        const cached = await redisGet(redis_key);

        // Jika data sudah ada di cache, langsung return
        if (cached) {
            console.log(`[Redis] Data diambil dari cache: ${redis_key}`);
            return JSON.parse(cached);
        }else{
            return 0;
        }

        // Jika tidak ada di cache, ambil dari database
        // const pendaftarPrestasi = await DataPendaftarPrestasiKhusus.findAll({
        //     attributes: ['nisn', 'sekolah_pilihan_npsn'],
        // });

        // // Simpan data ke cache dengan expiry time
        // await redisSet(redis_key, JSON.stringify(pendaftarPrestasi), 31536000);
        // console.log(`[DB] Data disimpan ke Redis: ${redis_key}`);
        
        // return pendaftarPrestasi;
        
    } catch (error) {
        console.error('Error in getPendaftarPrestasiKhususByNisn:', error);
        throw error;
    }
};

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

        // const resTm = await Timelines.findOne({  
        //     where: { id: 4 }, // Find the timeline by ID  
        //     attributes: ['id', 'nama', 'status']  
        // }); 
        
        const resTm = await getTimelineSatuan(4);

        // console.log(resTm);

        if (resTm?.status != 1) {  
            return res.status(200).json({ status: 0, message: 'Pendaftaran Belum Dibuka' });
        }
        
        const count = await DataPerangkingans.count({
            where: {
                nisn,
                is_delete: 0
            }
        });
        if(count >= 1){
            //hanya boleh daftar 1 sekolah di masing2 jalur
            return res.status(200).json({ status: 0, message: 'Hanya boleh mendaftar 1 pilihan' });
        }

        // Retrieve data from DataPendaftarModel
        const pendaftar = await DataPendaftars.findOne({
            where: {
                id: decodeId(id_pendaftar),
                is_delete: 0
            },
            attributes: ['id', 'status_domisili', 'kecamatan_id', 'nisn', 'nama_lengkap', 'lat', 'lng',
                 'is_tidak_sekolah', 'is_anak_panti', 'is_anak_keluarga_tidak_mampu', 'is_anak_pondok', 
                 'is_tidak_boleh_domisili', 'tanggal_lahir',
                 'nilai_raport_rata', 'nilai_prestasi', 'nilai_organisasi', 'is_disabilitas', 'is_anak_guru_jateng',
                 'npsn_anak_guru','is_boleh_prestasi_khusus'
                ] 
        });

        if (!pendaftar) {
            return res.status(200).json({ status: 0, message: 'Pendaftar tidak ditemukan' });
        }

        if (pendaftar.is_anak_panti == 1 && (jalur_pendaftaran_id != 5 && jalur_pendaftaran_id != 9)) {
            return res.status(200).json({ status: 0, message: 'Saat ini anda terdata sebagai anak panti, hanya diperbolehkan daftar di jalur Afirmas SMA / seleksi Afirmasi SMK' });
        }

        if (!pendaftar.is_verified == 2) {
            return res.status(200).json({ status: 0, message: 'Status anda sedang diminta untuk revisi, tidak dapat mendaftar sekolah sekarang!' });
        }

         if(jalur_pendaftaran_id == 8){
            // const anak_prestasi_khusus = await getPendaftarPrestasiKhususByNisn();

            const pendaftarPrestasi = await DataPendaftarPrestasiKhusus.findOne({
                where: {
                    nisn: nisn,
                    jurusan_id: jurusan_id,
                }
            });

            if(!pendaftarPrestasi){
                return res.status(200).json({ 
                    status: 0, 
                    message: 'Anda tidak memiliki rekomendasi untuk daftar seleksi prestasi khusus' 
                });

            }
        }

        //jika status domisili "Menggunakan Surat Perpindahan Tugas Ortu/Wali" maka
        if(pendaftar.status_domisili == 2){
            //tidak boleh daftar jalur selain jalur mutasi dan prestasi, prestasi smk
            if(jalur_pendaftaran_id != 4 && jalur_pendaftaran_id != 3 && jalur_pendaftaran_id != 6 && jalur_pendaftaran_id != 8 && jalur_pendaftaran_id != 7){
                return res.status(200).json({ status: 0, message: 'Saat ini sistem membaca bahwa status domisili anda adalah "Sesuai Surat Mutasi Ortu/Wali" status domisili tersebut hanya di perbolehkan mendaftar jalur mutasi dan prestasi' });
            }

            if(pendaftar.is_anak_guru_jateng == 1){
               
                    const npsn_sekolah = await SekolahTujuan.findOne({
                        where: {
                            id: sekolah_tujuan_id,
                        },
                        attributes: ['npsn'] 
                    });

                    if(jalur_pendaftaran_id == 4){

                        if(pendaftar.npsn_anak_guru != npsn_sekolah.npsn){ {
                            return res.status(200).json({ status: 0, message: 'Anda terdaftar sebagai anak guru jateng  dan saat ini daftar di jalur mutasi, silahkan mendaftar di sekolah yang sesuai dengan sekolah tempat orang tua anda mengajar (yang sudah terdata sebelumnya)' });
                            }
                        }
                    }    
            }
        }

        //jika status domisili TIDAK "Menggunakan Surat Perpindahan Tugas Ortu/Wali" maka
        if(pendaftar.status_domisili != 2){

            if(pendaftar.is_anak_guru_jateng == 1){
                
                    // const npsn_sekolah = await SekolahTujuan.findOne({
                    //     where: {
                    //         id: sekolah_tujuan_id,
                    //     },
                    //     attributes: ['npsn' 
                    //         ] 
                    // });

                    if(jalur_pendaftaran_id == 4){

                        return res.status(200).json({ status: 0, message: 'Saat ini sistem membaca bahwa Anda adalah Anak Guru namun status domisili anda adalah tidak "Menggunakan Surat Mutasi Ortu/Wali", Anda tidak diperbolehkan daftar jalur mutasi (SMA)' });

                        // if(pendaftar.npsn_anak_guru != npsn_sekolah.npsn){ {
                        //     return res.status(200).json({ status: 0, message: 'Anda terdaftar sebagai anak guru jateng  dan saat ini daftar di jalur mutasi, silahkan mendaftar di sekolah yang sesuai dengan sekolah tempat orang tua anda mengajar (yang sudah terdata sebelumnya)' });
                        //     }
                        // }
                    }    
            }

            //if(jalur_pendaftaran_id == 4 && pendaftar.is_anak_guru_jateng != 1){
            if(jalur_pendaftaran_id == 4){
             return res.status(200).json({ status: 0, message: 'Saat ini sistem membaca bahwa status domisili anda adalah `bukan` "Menggunakan Surat Mutasi Ortu/Wali", Anda tidak diperbolehkan daftar jalur mutasi (SMA)' });
            }

            if(pendaftar.is_tidak_sekolah == 0 && pendaftar.is_anak_panti == 0 && pendaftar.is_anak_keluarga_tidak_mampu == 0 && pendaftar.is_disabilitas == 0){
                // return res.status(200).json({ status: 0, message: 'BB' });
                if(jalur_pendaftaran_id == 5 || jalur_pendaftaran_id == 9){
                    return res.status(200).json({ status: 0, message: '1. Anda tidak bisa mendaftar jalur ini karena anda tidak termasuk salah satu dari kategori afirmasi: (ATS, Anak Panti, Anak Keluarga Tidak Mampu yang terdaftar  pada BDT Jateng)' });
                }
    
            }
        }


        // if(pendaftar.is_tidak_sekolah == 1){
        //     if(jalur_pendaftaran_id != 5 && jalur_pendaftaran_id != 9){
        //         return res.status(200).json({ status: 0, message: 'Anda terdaftar sebagai ATS, anda hanya bisa daftar jalur / seleksi Afirmasi' });
        //     }
        // }

       

        if(jalur_pendaftaran_id == 1){

            let kecPendaftar = 0;

            console.log('is_tidak_boleh_domisili:'+pendaftar.is_tidak_boleh_domisili);

            if(pendaftar.is_tidak_boleh_domisili == 1){
                return res.status(200).json({ status: 0, message: 'Anda tidak diperbolehkan mendaftar jalur domisili karena alasan shdk, umur domisili, dan nama orang tua' });
            }

            kecPendaftar = pendaftar.kecamatan_id.toString();
            console.log('KECMATAN:'+kecPendaftar);

            console.log('STS DOM:'+pendaftar.status_domisili);

            console.log('anak pondok:'+pendaftar.is_anak_pondok);
            if(pendaftar.status_domisili == 3){

                const dataAnakKemenag = await EzAnakPondokKemenag.findOne({
                    where: {
                        nisn: pendaftar.nisn
                    }
                });

                let wilayah = 0;
                if(dataAnakKemenag){
                    wilayah = parseKodeWilayah(dataAnakKemenag.kode_wilayah);
                    kecPendaftar = wilayah.kode_kecamatan?.toString() || null;
                    console.log('KECMATAN-PONDO:'+kecPendaftar);
                }

                const cariZonasis = await SekolahZonasis.findOne({
                    where: {
                    id_sekolah: sekolah_tujuan_id,
                    kode_wilayah_kec: kecPendaftar,
                    }
                });
            
                if (!cariZonasis) {
                    return res.status(200).json({
                    status: 0,
                    message: "Domisili Anda tidak termasuk dalam wlayah domisili Sekolah Yang Anda Daftar. ",
                    });
                }
            }

            const cariZonasis = await SekolahZonasis.findOne({
                where: {
                id_sekolah: sekolah_tujuan_id,
                kode_wilayah_kec: kecPendaftar,
                }
            });
        
            if (!cariZonasis) {
                return res.status(200).json({
                status: 0,
                message: "Domisili Anda tidak termasuk dalam wlayah domisili Sekolah Yang Anda Daftar. ",
                });
            }

        }

        if(jalur_pendaftaran_id == 2){


            console.log('is_tidak_boleh_domisili:'+pendaftar.is_tidak_boleh_domisili);

            if(pendaftar.is_tidak_boleh_domisili == 1){
                return res.status(200).json({ status: 0, message: 'Anda tidak diperbolehkan mendaftar jalur domisili khusus karena alasan shdk, umur domisili, dan nama orang tua' });
            }

        }

        if(jalur_pendaftaran_id == 6){

            console.log('is_tidak_boleh_domisili:'+pendaftar.is_tidak_boleh_domisili);

            if(pendaftar.is_tidak_boleh_domisili == 1){
                return res.status(200).json({ status: 0, message: 'Anda tidak diperbolehkan mendaftar seleksi domisili terdekat karena alasan shdk, umur domisili, dan nama orang tua' });
            }

        }

        

        let data_file_tambahan_var = null;

        // console.log('jalur pendaftaran: '+data_file_tambahan);

        const data_file_tambahan = await getFileTambahanByJalurPendaftaran(jalur_pendaftaran_id);
        // const data_file_tambahan = await FileTambahans.findAll({
        //     where: {
        //         id_jalur_pendaftaran: jalur_pendaftaran_id,
        //         is_active: 1
        //     }
        // });

        //pendaftaran
        data_file_tambahan_var = data_file_tambahan;

        console.log('tgl lahir:'+pendaftar.tanggal_lahir)
        const umur = await calculateAge(pendaftar.tanggal_lahir);
        const nilai_akhir = (pendaftar.nilai_raport_rata || 0) + (pendaftar.nilai_prestasi || 0)  + (pendaftar.nilai_organisasi || 0);


        const newPerangkingan = {
            id_pendaftar,
            nisn,
            nama_lengkap: pendaftar.nama_lengkap,
            umur: umur,
            nilai_akhir: nilai_akhir

        };

        const data = {
            id_: id_pendaftar, 
            ...newPerangkingan, 
            data_file_tambahan: data_file_tambahan_var // tambahkan properti baru
        };

        // Send success response
        return res.status(201).json({
            status: 1,
            message: 'Hasil pengecekan',
            data: data
        });

    } catch (error) {
        console.error('Error pengecekan:', error);
        return res.status(500).json({
            status: 0,
            message: error.message || 'Terjadi kesalahan saat proses pengecekan'
        });
    }
}

// Function to handle POST request
export const createPerangkinganBAK = async (req, res) => {

    try {
        const {
            id_pendaftar,
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            jurusan_id,
            jarak,
            nisn,
            is_buta_warna,
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


        if (!pendaftar.is_verified == 2) {
            return res.status(200).json({ status: 0, message: 'Status anda sedang diminta untuk revisi, tidak dapat mendaftar sekolah sekarang!' });
        }

        // Hitung nilai_akhir sebagai penjumlahan dari nilai_raport_rata dan nilai_prestasi
        const nilai_akhir = (pendaftar.nilai_raport_rata || 0) + (pendaftar.nilai_prestasi || 0)  + (pendaftar.nilai_organisasi || 0);

        // Count existing entries with the same NISN that are not deleted
        const count = await DataPerangkingans.count({
            where: {
                nisn,
                is_delete: 0
            }
        });   
        
        if(count >= 1){
               return res.status(200).json({ status: 0, message: 'Hanya boleh mendaftar 1 pilihan' });
        }

        const no_pendaftaran = await generatePendaftaranNumber(bentuk_pendidikan_id);

        const umur = await calculateAge(pendaftar.tanggal_lahir);

        let anak_tidak_mampu = pendaftar.is_anak_keluarga_tidak_mampu;
        let anak_panti = pendaftar.is_anak_panti;
        let anak_disabilitas =  pendaftar.is_disabilitas;
        let anak_tidak_sekolah = pendaftar.is_tidak_sekolah;
        let is_anak_guru_jateng= pendaftar.is_anak_guru_jateng;

        if(jalur_pendaftaran_id == 5 || jalur_pendaftaran_id == 9){
            if(pendaftar.status_domisili == 1 && pendaftar.is_anak_keluarga_tidak_mampu == 1){
                anak_tidak_mampu = 1;
                anak_panti = 0;
                anak_disabilitas = 0;
                anak_tidak_sekolah = 0;
                is_anak_guru_jateng = 0;
            }

            if(pendaftar.status_domisili == 4 && pendaftar.is_anak_panti == 1){
                anak_tidak_mampu = 0;
                anak_panti = 1;
                anak_disabilitas = 0;
                anak_tidak_sekolah = 0;
                is_anak_guru_jateng = 0;
            }

            if(pendaftar.status_domisili == 1 && pendaftar.is_disabilitas == 1){
                anak_tidak_mampu = 0;
                anak_panti = 0;
                anak_disabilitas = 1;
                anak_tidak_sekolah = 0;
                is_anak_guru_jateng = 0;
            }

            if(pendaftar.status_domisili == 1 && pendaftar.is_tidak_sekolah == 1){
                anak_tidak_mampu = 0;
                anak_panti = 0;
                anak_disabilitas = 0;
                anak_tidak_sekolah = 1;
                is_anak_guru_jateng = 0;
            }
        }else{

            anak_tidak_mampu = 0;
            anak_panti = 0;
            anak_disabilitas = pendaftar.is_disabilitas;
            anak_tidak_sekolah = 0;
            is_anak_guru_jateng = pendaftar.is_anak_guru_jateng;

        }
        
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
            umur: umur,
            tahun_lulus: pendaftar.tahun_lulus ? pendaftar.tahun_lulus : 0,
            umur_sertifikat: pendaftar.umur_sertifikat ? pendaftar.umur_sertifikat : 0,
            jarak,
            nilai_raport: pendaftar.nilai_raport_rata,
            nilai_prestasi: pendaftar.nilai_prestasi,
            nilai_organisasi: pendaftar.nilai_organisasi,
            nilai_akhir,
            is_tidak_sekolah: anak_tidak_sekolah,
            is_anak_panti: anak_panti,
            is_anak_keluarga_tidak_mampu: anak_tidak_mampu,
            is_anak_guru_jateng: pendaftar.is_anak_guru_jateng,
            is_pip: pendaftar.is_pip,
            is_disabilitas: anak_disabilitas,
            is_buta_warna,
            npsn_anak_guru: pendaftar.npsn_anak_guru,
            created_at: new Date(), // Set the current date and time
            created_by: id_pendaftar_decode,
            created_by_ip: req.ip,
            daftar_ulang_by: 0,
            order_berdasar: 0,
            kode_kecamatan: pendaftar.kecamatan_id
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
            is_buta_warna,
            anak_tidak_mampu,
            anak_panti,
            anak_disabilitas,
            anak_tidak_sekolah,
            is_anak_guru_jateng,
            // anak_pondok,
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


        if (!pendaftar.is_verified == 2) {
            return res.status(200).json({ status: 0, message: 'Status anda sedang diminta untuk revisi, tidak dapat mendaftar sekolah sekarang!' });
        }

        // Hitung nilai_akhir sebagai penjumlahan dari nilai_raport_rata dan nilai_prestasi
        const nilai_akhir = (pendaftar.nilai_raport_rata || 0) + (pendaftar.nilai_prestasi || 0)  + (pendaftar.nilai_organisasi || 0);

        // Count existing entries with the same NISN that are not deleted
        const count = await DataPerangkingans.count({
            where: {
                nisn,
                is_delete: 0
            }
        });   
        
        if(count >= 1){
               return res.status(200).json({ status: 0, message: 'Hanya boleh mendaftar 1 pilihan' });
        }

        const no_pendaftaran = await generatePendaftaranNumber(bentuk_pendidikan_id);

        const umur = await calculateAge(pendaftar.tanggal_lahir);

        // let anak_tidak_mampu = pendaftar.is_anak_keluarga_tidak_mampu;
        // let anak_panti = pendaftar.is_anak_panti;
        // let anak_disabilitas =  pendaftar.is_disabilitas;
        // let anak_tidak_sekolah = pendaftar.is_tidak_sekolah;
        // let is_anak_guru_jateng= pendaftar.is_anak_guru_jateng;

        // if(jalur_pendaftaran_id == 5 || jalur_pendaftaran_id == 9){
        //     if(pendaftar.status_domisili == 1 && pendaftar.is_anak_keluarga_tidak_mampu == 1){
        //         anak_tidak_mampu = 1;
        //         anak_panti = 0;
        //         anak_disabilitas = 0;
        //         anak_tidak_sekolah = 0;
        //         is_anak_guru_jateng = 0;
        //     }

        //     if(pendaftar.status_domisili == 4 && pendaftar.is_anak_panti == 1){
        //         anak_tidak_mampu = 0;
        //         anak_panti = 1;
        //         anak_disabilitas = 0;
        //         anak_tidak_sekolah = 0;
        //         is_anak_guru_jateng = 0;
        //     }

        //     if(pendaftar.status_domisili == 1 && pendaftar.is_disabilitas == 1){
        //         anak_tidak_mampu = 0;
        //         anak_panti = 0;
        //         anak_disabilitas = 1;
        //         anak_tidak_sekolah = 0;
        //         is_anak_guru_jateng = 0;
        //     }

        //     if(pendaftar.status_domisili == 1 && pendaftar.is_tidak_sekolah == 1){
        //         anak_tidak_mampu = 0;
        //         anak_panti = 0;
        //         anak_disabilitas = 0;
        //         anak_tidak_sekolah = 1;
        //         is_anak_guru_jateng = 0;
        //     }
        // }else{

        //     anak_tidak_mampu = 0;
        //     anak_panti = 0;
        //     anak_disabilitas = pendaftar.is_disabilitas;
        //     anak_tidak_sekolah = 0;
        //     is_anak_guru_jateng = pendaftar.is_anak_guru_jateng;

        // }
        
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
            umur: umur,
            tahun_lulus: pendaftar.tahun_lulus ? pendaftar.tahun_lulus : 0,
            umur_sertifikat: pendaftar.umur_sertifikat ? pendaftar.umur_sertifikat : 0,
            jarak,
            nilai_raport: pendaftar.nilai_raport_rata,
            nilai_prestasi: pendaftar.nilai_prestasi,
            nilai_organisasi: pendaftar.nilai_organisasi,
            nilai_akhir,
            is_tidak_sekolah: anak_tidak_sekolah,
            is_anak_panti: anak_panti,
            is_anak_keluarga_tidak_mampu: anak_tidak_mampu,
            is_disabilitas: anak_disabilitas,
            is_anak_guru_jateng: pendaftar.is_anak_guru_jateng,
            npsn_anak_guru: pendaftar.npsn_anak_guru,
            // is_pip: pendaftar.is_pip,
            is_buta_warna,
            created_at: new Date(), // Set the current date and time
            created_by: id_pendaftar_decode,
            created_by_ip: req.ip,
            daftar_ulang_by: 0,
            order_berdasar: 0,
            kode_kecamatan: pendaftar.kecamatan_id
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
                    as: 'status_domisili_name',
                    attributes: ['nama']
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
                },
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
            },
            include: [
                {
                    model: SekolahTujuan,
                    as: 'sekolah_tujuan',
                    attributes: ['nama']
                },
                {
                    model: SekolahJurusan,
                    as: 'sekolah_jurusan',
                    attributes: ['id', 'nama_jurusan']
                },
                {
                    model: JalurPendaftarans,
                    as: 'jalur_pendaftaran',
                    attributes: ['nama']
                }
            ]
        });

        if (!perangkingan) {
            return res.status(200).json({ status: 0, message: 'Data tidak ditemukan' });
        }

        // Convert Sequelize model instance to a plain object
        const perangkinganData = perangkingan.toJSON();

    
        // const sekolah_tujuan = {
        //     npsn : '12345678',
        //     nama : 'SMA / SMK Dummy'
        // }

        // // Add `sekolah_tujuan` to the plain object
        // perangkinganData.sekolah_tujuan = sekolah_tujuan;

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

// Function to handle POST request
export const CariPengumumanByNoPendaftaran = async (req, res) => {

    try {
        const {
            no_pendaftaran,
        } = req.body;

         // Retrieve data from DataPendaftarModel
         const perangkingan = await DataPerangkingans.findOne({
            attributes: ['no_pendaftaran', 'is_saved', 'is_diterima','no_urut','nama_lengkap', 'nisn'],
            where: {
                no_pendaftaran,
                is_delete: 0
            },
            include: [
                {
                    model: SekolahTujuan,
                    as: 'sekolah_tujuan',
                    attributes: ['nama']
                },
                {
                    model: SekolahJurusan,
                    as: 'sekolah_jurusan',
                    attributes: ['id', 'nama_jurusan']
                },
                {
                    model: JalurPendaftarans,
                    as: 'jalur_pendaftaran',
                    attributes: ['nama']
                }
            ]
        });

        if (!perangkingan) {
            return res.status(200).json({ status: 0, message: 'Data tidak ditemukan' });
        }

        // Convert Sequelize model instance to a plain object
        const perangkinganData = perangkingan.toJSON();

    
        // const sekolah_tujuan = {
        //     npsn : '12345678',
        //     nama : 'SMA / SMK Dummy'
        // }

        // // Add `sekolah_tujuan` to the plain object
        // perangkinganData.sekolah_tujuan = sekolah_tujuan;

        const datas = {
            perangkingan: perangkinganData,
        };

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

// Function to handle POST request
export const cetakBuktiPerangkinganAdmin = async (req, res) => {

    try {
        const {
            no_pendaftaran,
        } = req.body;

       

        // Retrieve data from DataPendaftarModel
        const perangkingan = await DataPerangkingans.findOne({
            where: {
                no_pendaftaran: no_pendaftaran,
                is_delete: 0
            },
            include: [
                {
                    model: SekolahTujuan,
                    as: 'sekolah_tujuan',
                    attributes: ['nama']
                },
                 {
                        model: SekolahJurusan,
                        as: 'sekolah_jurusan',
                        attributes: ['id', 'nama_jurusan']
                    },
                {
                    model: JalurPendaftarans,
                    as: 'jalur_pendaftaran',
                    attributes: ['nama']
                },
                {  
                    model: DataUsersModel,  
                    as: 'daftarulang_oleh',  
                    attributes: ['id', 'nama']
                }  
            ]
        });

        if (!perangkingan) {
            return res.status(200).json({ status: 0, message: 'Data tidak ditemukan' });
        }

          // Retrieve data from DataPendaftarModel
          const pendaftar = await DataPendaftars.findOne({
            where: {
                id: perangkingan.id_pendaftar,
                is_delete: 0
            },
            include: [
                {
                    model: StatusDomisilis,
                    as: 'status_domisili_name',
                    attributes: ['nama']
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
                },
            ],

        });

        if (!pendaftar) {
            return res.status(200).json({ status: 0, message: 'Data tidak ditemukan' });
        }

        // Convert Sequelize model instance to a plain object
        const perangkinganData = perangkingan.toJSON();

    
        // const sekolah_tujuan = {
        //     npsn : '12345678',
        //     nama : 'SMA / SMK Dummy'
        // }

        // // Add `sekolah_tujuan` to the plain object
        // perangkinganData.sekolah_tujuan = sekolah_tujuan;

        const datas = {
            pendaftar: pendaftar,
            perangkingan: perangkinganData,
            id_pendaftar_: encodeId(perangkingan.id_pendaftar), // Menambahkan ID ke dalam data yang dikembalikan
            id_perangkingan_: encodeId(perangkingan.id), // Menambahkan ID ke dalam data yang dikembalikan
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

// Function to handle  request
export const daftarUlangPerangkingan = async (req, res) => {
    try {
        const { id_perangkingan } = req.body;

        // Decode the ID
        const id_perangkingan_decode = decodeId(id_perangkingan);

        // const resTm = await Timelines.findOne({  
        //     where: { id: 6 }, // Find the timeline by ID  
        //     attributes: ['id', 'nama', 'status']  
        // });  
        const resTm = await getTimelineSatuan(6);

        if (resTm?.status != 1) {  
            return res.status(200).json({ status: 0, message: 'Daftar Ulang Belum Dibuka :)' });
        }

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

        //untuk cek apakah sudah ada yang dia daftar dan sudah daftar ulang
        // const perangkingan2 = await DataPerangkingans.findOne({
        //     where: {
        //         nisn: perangkingan.nisn,
        //         is_daftar_ulang: 1,
        //         is_delete: 0
        //     }
        // });

        // if (perangkingan2) {
        //     return res.status(200).json({ status: 0, message: 'Anda sudah pernah melakukan daftar ulang, daftar ulang hanya bisa di lakukan 1 kali' });
        // }


        // Update the record to set is_delete to 1
        const perangkingan3 = await DataPerangkingans.update(
            { 
                is_daftar_ulang: 1,
                daftar_ulang_by: req.user.userId,
                daftar_ulang_at: new Date(),
             },
            { where: { id: id_perangkingan_decode } }
        );

        const sekolah_tujuan_id = perangkingan.sekolah_tujuan_id;
        const jalur_pendaftaran_id = perangkingan.jalur_pendaftaran_id;
        const jurusan_id = perangkingan.jurusan_id;
         
        const key_satuan = `perangkingan_daftar_ulang:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id}`;
        await redisClearKey(key_satuan);

        const key_satuan2 = `perangkingan_daftar_ulang_cadangan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id}`;
        await redisClearKey(key_satuan2);

        // if (perangkingan3) {
        //     const perangkingan4 = await DataPerangkingans.findAll({
        //         where: {
        //             nisn: perangkingan.nisn, // Condition for specific NISN
        //             id: { [Op.ne]: id_perangkingan_decode }, // Condition for id not equal to id_perangkingan_decode
        //             is_delete: 0 // Condition for is_delete being 0
        //         }
        //     });

        //     await DataPerangkingans.update(
        //         { 
        //             is_daftar_ulang: 2,
        //             daftar_ulang_at: new Date(),
        //          },
        //         { 
        //             where: {
        //                 nisn: perangkingan.nisn, // Condition for specific NISN
        //                 id: { [Op.ne]: id_perangkingan_decode }, // Condition for id not equal to id_perangkingan_decode
        //                 is_delete: 0 // Condition for is_delete being 0
        //             }
        //          }
        //     );
        // }

        if(perangkingan3){

            res.status(200).json({
                status: 1,
                message: 'Data berhasil diupdate'
            });

        }

        
    } catch (error) {
        console.error('Error hapus:', error);
        res.status(500).json({
            status: 0,
            message: error.message || 'Terjadi kesalahan saat update data'
        });
    }
}

export const daftarUlangPerangkinganBatal = async (req, res) => {
    try {
        const { id_perangkingan } = req.body;

        // Decode the ID
        const id_perangkingan_decode = decodeId(id_perangkingan);

        // const resTm = await Timelines.findOne({  
        //     where: { id: 6 }, // Find the timeline by ID  
        //     attributes: ['id', 'nama', 'status']  
        // });  
        const resTm = await getTimelineSatuan(6);

        if (resTm?.status != 1) {  
            return res.status(200).json({ status: 0, message: 'Daftar Ulang Belum Dibuka :)' });
        }

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

        //untuk cek apakah sudah ada yang dia daftar dan sudah daftar ulang
        // const perangkingan2 = await DataPerangkingans.findOne({
        //     where: {
        //         nisn: perangkingan.nisn,
        //         is_daftar_ulang: 1,
        //         is_delete: 0
        //     }
        // });

        // if (perangkingan2) {
        //     return res.status(200).json({ status: 0, message: 'Anda sudah pernah melakukan daftar ulang, daftar ulang hanya bisa di lakukan 1 kali' });
        // }


        // Update the record to set is_delete to 1
        const perangkingan3 = await DataPerangkingans.update(
            { 
                is_daftar_ulang: 0,
                daftar_ulang_by: req.user.userId,
                daftar_ulang_at: new Date(),
             },
            { where: { id: id_perangkingan_decode } }
        );

        const sekolah_tujuan_id = perangkingan.sekolah_tujuan_id;
        const jalur_pendaftaran_id = perangkingan.jalur_pendaftaran_id;
        const jurusan_id = perangkingan.jurusan_id;
         
        const key_satuan = `perangkingan_daftar_ulang:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id}`;
        await redisClearKey(key_satuan);

        // if (perangkingan3) {
        //     const perangkingan4 = await DataPerangkingans.findAll({
        //         where: {
        //             nisn: perangkingan.nisn, // Condition for specific NISN
        //             id: { [Op.ne]: id_perangkingan_decode }, // Condition for id not equal to id_perangkingan_decode
        //             is_delete: 0 // Condition for is_delete being 0
        //         }
        //     });

        //     await DataPerangkingans.update(
        //         { 
        //             is_daftar_ulang: 2,
        //             daftar_ulang_at: new Date(),
        //          },
        //         { 
        //             where: {
        //                 nisn: perangkingan.nisn, // Condition for specific NISN
        //                 id: { [Op.ne]: id_perangkingan_decode }, // Condition for id not equal to id_perangkingan_decode
        //                 is_delete: 0 // Condition for is_delete being 0
        //             }
        //          }
        //     );
        // }

        if(perangkingan3){

            res.status(200).json({
                status: 1,
                message: 'Data berhasil diupdate'
            });

        }

        
    } catch (error) {
        console.error('Error hapus:', error);
        res.status(500).json({
            status: 0,
            message: error.message || 'Terjadi kesalahan saat update data'
        });
    }
}

// Function to handle  request
export const daftarUlangPerangkinganCadangan = async (req, res) => {
    try {
        const { id_perangkingan } = req.body;

        // Decode the ID
        const id_perangkingan_decode = decodeId(id_perangkingan);

        // const resTm = await Timelines.findOne({  
        //     where: { id: 6 }, // Find the timeline by ID  
        //     attributes: ['id', 'nama', 'status']  
        // });  
        const resTm = await getTimelineSatuan(8);

        if (resTm?.status != 1) {  
            return res.status(200).json({ status: 0, message: 'Daftar Ulang Cadangan Belum Dibuka :)' });
        }

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

        //untuk cek apakah sudah ada yang dia daftar dan sudah daftar ulang
        // const perangkingan2 = await DataPerangkingans.findOne({
        //     where: {
        //         nisn: perangkingan.nisn,
        //         is_daftar_ulang: 1,
        //         is_delete: 0
        //     }
        // });

        // if (perangkingan2) {
        //     return res.status(200).json({ status: 0, message: 'Anda sudah pernah melakukan daftar ulang, daftar ulang hanya bisa di lakukan 1 kali' });
        // }


        // Update the record to set is_delete to 1
        const perangkingan3 = await DataPerangkingans.update(
            { 
                is_daftar_ulang: 1,
                daftar_ulang_by: req.user.userId,
                daftar_ulang_at: new Date(),
             },
            { where: { id: id_perangkingan_decode } }
        );

        const sekolah_tujuan_id = perangkingan.sekolah_tujuan_id;
        const jalur_pendaftaran_id = perangkingan.jalur_pendaftaran_id;
        const jurusan_id = perangkingan.jurusan_id;
 

        const key_satuan = `perangkingan_daftar_ulang_cadangan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id}`;
        const key_satuan2 = `perangkingan_cadangan_diterima_:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id}`;
        
        await redisClearKey(key_satuan);
        await redisClearKey(key_satuan2);

        // if (perangkingan3) {
        //     const perangkingan4 = await DataPerangkingans.findAll({
        //         where: {
        //             nisn: perangkingan.nisn, // Condition for specific NISN
        //             id: { [Op.ne]: id_perangkingan_decode }, // Condition for id not equal to id_perangkingan_decode
        //             is_delete: 0 // Condition for is_delete being 0
        //         }
        //     });

        //     await DataPerangkingans.update(
        //         { 
        //             is_daftar_ulang: 2,
        //             daftar_ulang_at: new Date(),
        //          },
        //         { 
        //             where: {
        //                 nisn: perangkingan.nisn, // Condition for specific NISN
        //                 id: { [Op.ne]: id_perangkingan_decode }, // Condition for id not equal to id_perangkingan_decode
        //                 is_delete: 0 // Condition for is_delete being 0
        //             }
        //          }
        //     );
        // }

        if(perangkingan3){ 

            res.status(200).json({
                status: 1,
                message: 'Data berhasil diupdate'
            });

        }

        
    } catch (error) {
        console.error('Error hapus:', error);
        res.status(500).json({
            status: 0,
            message: error.message || 'Terjadi kesalahan saat update data'
        });
    }
}

export const daftarUlangPerangkinganCadanganBatal = async (req, res) => {
    try {
        const { id_perangkingan } = req.body;

        // Decode the ID
        const id_perangkingan_decode = decodeId(id_perangkingan);

        // const resTm = await Timelines.findOne({  
        //     where: { id: 6 }, // Find the timeline by ID  
        //     attributes: ['id', 'nama', 'status']  
        // });  
        const resTm = await getTimelineSatuan(8);

        if (resTm?.status != 1) {  
            return res.status(200).json({ status: 0, message: 'Daftar Ulang Cadangan Belum Dibuka :)' });
        }

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

        //untuk cek apakah sudah ada yang dia daftar dan sudah daftar ulang
        // const perangkingan2 = await DataPerangkingans.findOne({
        //     where: {
        //         nisn: perangkingan.nisn,
        //         is_daftar_ulang: 1,
        //         is_delete: 0
        //     }
        // });

        // if (perangkingan2) {
        //     return res.status(200).json({ status: 0, message: 'Anda sudah pernah melakukan daftar ulang, daftar ulang hanya bisa di lakukan 1 kali' });
        // }


        // Update the record to set is_delete to 1
        const perangkingan3 = await DataPerangkingans.update(
            { 
                is_daftar_ulang: 0,
                daftar_ulang_by: req.user.userId,
                daftar_ulang_at: new Date(),
             },
            { where: { id: id_perangkingan_decode } }
        );

        const sekolah_tujuan_id = perangkingan.sekolah_tujuan_id;
        const jalur_pendaftaran_id = perangkingan.jalur_pendaftaran_id;
        const jurusan_id = perangkingan.jurusan_id;
         
        const key_satuan = `perangkingan_daftar_ulang_cadangan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id}`;
        const key_satuan2 = `perangkingan_cadangan_diterima_:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id}`;
        
        await redisClearKey(key_satuan);
        await redisClearKey(key_satuan2);

        // if (perangkingan3) {
        //     const perangkingan4 = await DataPerangkingans.findAll({
        //         where: {
        //             nisn: perangkingan.nisn, // Condition for specific NISN
        //             id: { [Op.ne]: id_perangkingan_decode }, // Condition for id not equal to id_perangkingan_decode
        //             is_delete: 0 // Condition for is_delete being 0
        //         }
        //     });

        //     await DataPerangkingans.update(
        //         { 
        //             is_daftar_ulang: 2,
        //             daftar_ulang_at: new Date(),
        //          },
        //         { 
        //             where: {
        //                 nisn: perangkingan.nisn, // Condition for specific NISN
        //                 id: { [Op.ne]: id_perangkingan_decode }, // Condition for id not equal to id_perangkingan_decode
        //                 is_delete: 0 // Condition for is_delete being 0
        //             }
        //          }
        //     );
        // }

        if(perangkingan3){

            res.status(200).json({
                status: 1,
                message: 'Data berhasil diupdate'
            });

        }

        
    } catch (error) {
        console.error('Error hapus:', error);
        res.status(500).json({
            status: 0,
            message: error.message || 'Terjadi kesalahan saat update data'
        });
    }
}

// Function to handle DELETE request
export const softDeletePerangkingan_ = async (req, res) => {
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

export const softDeletePerangkingan = async (req, res) => {
    try {
        const { id_perangkingan } = req.body;
        //return res.status(200).json({ status: 0, message: 'Perangkingan ditutup' });
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


export const automasiPerangkingan = async (req, res) => {
    // Dapatkan transaction dari sequelize instance
    // const transaction = await Sequelize.transaction();
    const transaction = await db.transaction();
    
    try {
        console.log('Memulai proses automasi perangkingan...');
        
        // 1. Ambil semua jalur pendaftaran yang aktif
        const allJalur = await JalurPendaftarans.findAll({
            // where: { 
            //     id: 5,
            // },
            attributes: ['id'],
            order: [['id', 'ASC']],
            transaction
        });

        if (!allJalur || allJalur.length === 0) {
            await transaction.commit();
            return res.status(200).json({
                'status': 0,
                'message': 'Tidak ada jalur pendaftaran aktif'
            });
        }

        // 2. Loop melalui setiap jalur pendaftaran
        for (const jalur of allJalur) {
            const jalur_pendaftaran_id = jalur.id;
            console.log(`\nMemproses jalur ${jalur_pendaftaran_id}`);

            // 3. Ambil semua sekolah tujuan yang aktif
            const allSekolah = await SekolahTujuan.findAll({
                attributes: ['id', 'npsn'],
                // where: { 
                //     id: 243,
                // },
                order: [['id', 'ASC']],
                transaction
            });

            if (!allSekolah || allSekolah.length === 0) {
                console.log(`Tidak ada sekolah aktif untuk jalur ${jalur_pendaftaran_id}`);
                continue;
            }

            // 4. Loop melalui setiap sekolah tujuan
            for (const sekolah of allSekolah) {
                const sekolah_tujuan_id = sekolah.id;
                console.log(`Memproses sekolah ${sekolah_tujuan_id}`);

                try {
                    // 5. Cek apakah jalur ini membutuhkan jurusan (6,7,8,9)
                    if ([6, 7, 8, 9].includes(jalur_pendaftaran_id)) {
                        // 6. Ambil semua jurusan untuk sekolah ini
                        const allJurusan = await SekolahJurusan.findAll({
                            where: { 
                                id_sekolah_tujuan: sekolah_tujuan_id,
                            },
                            attributes: ['id', 'npsn'],
                            order: [['id', 'ASC']],
                            transaction
                        });

                        if (!allJurusan || allJurusan.length === 0) {
                            console.log(`Tidak ada jurusan aktif untuk sekolah ${sekolah_tujuan_id}`);
                            continue;
                        }

                        // 7. Loop melalui setiap jurusan
                        for (const jurusan of allJurusan) {
                            const jurusan_id = jurusan.id;
                            console.log(`Memproses jurusan ${jurusan_id}`);
                            
                            try {
                                await prosesPerangkinganDanUpdate(
                                    jalur_pendaftaran_id,
                                    sekolah_tujuan_id,
                                    jurusan_id,
                                    transaction
                                );
                            } catch (err) {
                                console.error(`Gagal memproses jurusan ${jurusan_id}:`, err.message);
                                continue;
                            }
                        }
                    } else {
                        // Jalur yang tidak membutuhkan jurusan
                        try {
                            await prosesPerangkinganDanUpdate(
                                jalur_pendaftaran_id,
                                sekolah_tujuan_id,
                                null,
                                transaction
                            );
                        } catch (err) {
                            console.error(`Gagal memproses sekolah ${sekolah_tujuan_id}:`, err.message);
                            continue;
                        }
                    }
                } catch (err) {
                    console.error(`Gagal memproses sekolah ${sekolah_tujuan_id}:`, err.message);
                    continue;
                }
            }
        }

        await transaction.commit();
        res.status(200).json({
            'status': 1,
            'message': 'Automasi perangkingan selesai'
        });

    } catch (err) {
        await transaction.rollback();
        console.error('Error utama dalam automasi perangkingan:', err);
        res.status(500).json({
            'status': 0,
            'message': 'Error dalam automasi perangkingan',
            'error': err.message
        });
    }
};

// Fungsi untuk update data perangkingan ke database
// async function updateDatabasePerangkingan(data, jalur_pendaftaran_id, sekolah_tujuan_id, jurusan_id, transaction) {
//     try {
//         // 1. Reset semua is_saved untuk kombinasi ini
//         await DataPerangkingans.update(
//             { is_saved: 0, no_urut: null },
//             {
//                 where: {
//                     jalur_pendaftaran_id,
//                     sekolah_tujuan_id,
//                     jurusan_id: jurusan_id || null,
//                     is_delete: 0
//                 },
//                 transaction
//             }
//         );

//         // 2. Update data dengan is_saved = 1 dan no_urut
//         for (let i = 0; i < data.length; i++) {
//             const item = data[i];
//             await DataPerangkingans.update(
//                 { 
//                     is_saved: 1,
//                     no_urut: i + 1,
//                     is_diterima: 1
//                 },
//                 {
//                     where: { id: decodeId(item.id) },
//                     transaction
//                 }
//             );
//         }

//         console.log(`Berhasil update ${data.length} peserta`);

//     } catch (err) {
//         console.error('Gagal update database:', err);
//         throw err;
//     }
// }

// Update fungsi updateDatabasePerangkingan tetap sama seperti sebelumnya
async function updateDatabasePerangkingan(data, jalur_pendaftaran_id, sekolah_tujuan_id, jurusan_id, transaction) {
    try {

        console.log('sekolah id: '+sekolah_tujuan_id);
        console.log('----');
        console.log('jalur id: '+jalur_pendaftaran_id);

        // 1. Reset semua is_saved untuk kombinasi ini
        await DataPerangkingans.update(
            { is_saved: 0, no_urut: null, is_diterima: null,  order_berdasar: null  },
            {
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    jurusan_id: jurusan_id || null,
                    is_delete: 0
                },
                transaction
            }
        );

        let counter = 1;
        for (const item of data) {
            if (item.is_delete === 0 && item.is_daftar_ulang !== 2) {
                await DataPerangkingans.update(
                    {
                        is_saved: 1,
                        no_urut: counter++, // Increment hanya jika data valid
                        is_diterima: item.is_diterima || 1,
                        order_berdasar: item.order_berdasar ?? '0'
                    },
                    {
                        where: { id: decodeId(item.id) },
                        transaction
                    }
                );
            }
        }


        // 2. Update data dengan is_saved = 1, no_urut, is_diterima, dan order_berdasar
        // for (let i = 0; i < data.length; i++) {
        //     const item = data[i];
            
        //     const updateData = {
        //         is_saved: 1,
        //         no_urut: i + 1,
        //         is_diterima: item.is_diterima || 1,
        //         order_berdasar: item.order_berdasar ?? '0' // Gunakan '0' hanya jika order_berdasar null atau undefined
        //     };

        //     await DataPerangkingans.update(
        //         updateData,
        //         {
        //             where: { id: decodeId(item.id) },
        //             transaction
        //         }
        //     );
        // }

        console.log(`Berhasil update ${data.length} peserta`);

    } catch (err) {
        console.error('Gagal update database:', err);
        throw err;
    }
}

// Fungsi untuk memproses semua jalur pendaftaran
async function prosesPerangkinganDanUpdate(jalur_pendaftaran_id, sekolah_tujuan_id, jurusan_id, transaction) {
    let resultData = [];

    try {
        console.log(`Memproses perangkingan untuk: 
          Jalur: ${jalur_pendaftaran_id}, 
          Sekolah: ${sekolah_tujuan_id}, 
          Jurusan: ${jurusan_id || 'tidak ada'}`);

        switch(jalur_pendaftaran_id) {
            case 1: // Zonasi Reguler SMA
                resultData = await prosesJalurZonasiReguler(sekolah_tujuan_id, transaction);
                break;
                
            case 2: // Zonasi Khusus SMA
                resultData = await prosesJalurZonasiKhusus(sekolah_tujuan_id, transaction);
                break;
                
            case 3: // Prestasi SMA
                resultData = await prosesJalurPrestasi(sekolah_tujuan_id, transaction);
                break;
                
            case 4: // PTO/Mutasi SMA
                resultData = await prosesJalurPTO(sekolah_tujuan_id, transaction);
                break;
                
            case 5: // Afirmasi SMA
                resultData = await prosesJalurAfirmasi(sekolah_tujuan_id, transaction);
                break;
                
            case 6: // SMK Domisili Terdekat
                resultData = await prosesJalurSMKDomisili(sekolah_tujuan_id, jurusan_id, transaction);
                break;
                
            case 7: // SMK Prestasi
                resultData = await prosesJalurSMKPrestasi(sekolah_tujuan_id, jurusan_id, transaction);
                break;
                
            case 8: // SMK Prestasi Khusus
                resultData = await prosesJalurSMKPrestasiKhusus(sekolah_tujuan_id, jurusan_id, transaction);
                break;
                
            case 9: // SMK Afirmasi
                resultData = await prosesJalurSMKAfirmasi(sekolah_tujuan_id, jurusan_id, transaction);
                break;
                
            default:
                throw new Error(`Jalur pendaftaran ${jalur_pendaftaran_id} tidak dikenali`);
        }

        await updateDatabasePerangkingan(resultData, jalur_pendaftaran_id, sekolah_tujuan_id, jurusan_id, transaction);

    } catch (err) {
        console.error(`Gagal memproses perangkingan:`, err);
        throw err;
    }
}

const KUOTA_CADANGAN = parseInt(process.env.KUOTA_CADANGAN) || 0; // Default to 20 if not set


// Update the prosesJalurZonasiReguler function
async function prosesJalurZonasiReguler_BAK(sekolah_tujuan_id, transaction) {
    const resSek = await getSekolahTujuanById(sekolah_tujuan_id, transaction);

    let kuota_zonasi_max = resSek.daya_tampung;
    let kuota_zonasi_min = resSek.kuota_zonasi;
    let persentase_domisili_nilai = DomiNilaiHelper('nilai');
    let kuota_zonasi_nilai_min = Math.ceil((persentase_domisili_nilai / 100) * kuota_zonasi_min);
    let zonasi_jarak = kuota_zonasi_min - kuota_zonasi_nilai_min;

    // Data berdasarkan jarak terdekat
    const resDataZonasi = await DataPerangkingans.findAndCountAll({
        attributes: ['id', 'no_pendaftaran', 'nisn', 'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'],
        where: {
            jalur_pendaftaran_id: 1,
            sekolah_tujuan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        order: [
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['umur', 'DESC']
        ],
        limit: zonasi_jarak,
        transaction
    });
    
    const rowsZonasiReg = resDataZonasi.rows;
    const totalZonasiReg = rowsZonasiReg.length;

    // Hitung total pendaftar jalur lainnya
    const countPrestasi = (await DataPerangkingans.findAll({  
        attributes: ['nisn'],
        where: {  
            jalur_pendaftaran_id: 3,
            sekolah_tujuan_id,  
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        limit: resSek.kuota_prestasi
    })).length;

    const countAfirmasi = (await DataPerangkingans.findAll({  
        where: {  
            jalur_pendaftaran_id: 5,
            sekolah_tujuan_id,  
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        limit: resSek.kuota_afirmasi
    })).length;

    const countPto = (await DataPerangkingans.findAll({  
        where: {  
            jalur_pendaftaran_id: 4,
            sekolah_tujuan_id,  
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        limit: resSek.kuota_pto
    })).length;

    let countZonasiKhusus = 0;
    if(resSek.kuota_zonasi_khusus > 0){
        countZonasiKhusus = (await DataPerangkingans.findAll({  
            attributes: ['nisn'],
            where: {  
                jalur_pendaftaran_id: 2,
                sekolah_tujuan_id,  
                is_delete: 0,
                is_daftar_ulang: { [Op.ne]: 2 }
            },
            limit: resSek.kuota_zonasi_khusus
        })).length;
    }

    let kuota_terpakai = totalZonasiReg + countZonasiKhusus + countPrestasi + countAfirmasi + countPto;
    let kuota_zonasi_nilai = Math.max(0, kuota_zonasi_max - kuota_terpakai);
    
    // Gunakan KUOTA_CADANGAN dari environment
    const kuota_zonasi_nilai_dengan_cadangan = kuota_zonasi_nilai + KUOTA_CADANGAN;

    const resDataZonasiIds = (resDataZonasi.rows || []).map((item) => item.id);
    const resZonasiNilai = await DataPerangkingans.findAll({
        attributes: ['id', 'no_pendaftaran', 'nisn', 'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'],
        where: {
            jalur_pendaftaran_id: 1,
            sekolah_tujuan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 },
            id: { [Op.notIn]: resDataZonasiIds }
        },
        order: [
            ['nilai_akhir', 'DESC'],
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
        ],
        limit: kuota_zonasi_nilai_dengan_cadangan,
        transaction
    });

    // Gabungkan data dan tambahkan flag untuk cadangan
    const combinedData = [
        ...(rowsZonasiReg ? rowsZonasiReg.map(item => ({
            ...item.toJSON(),
            order_berdasar: 1,
            is_cadangan: false
        })) : []),
        
        ...(resZonasiNilai ? resZonasiNilai.map((item, index) => ({
            ...item.toJSON(),
            order_berdasar: 2,
            is_cadangan: index >= kuota_zonasi_nilai // Tandai sebagai cadangan jika melebihi kuota normal
        })) : [])
    ];

    return combinedData.map(item => ({
        ...item,
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: item.is_cadangan ? 2 : 1
    }));
    
    // return combinedData.map(item => {
    //     const { id_pendaftar, id, is_cadangan, ...rest } = item;
    //     return { 
    //         ...rest, 
    //         id: encodeId(id), 
    //         id_pendaftar: encodeId(id_pendaftar),
    //         status_daftar_sekolah: 1,
    //         is_diterima: is_cadangan ? 2 : 1 // 1 untuk diterima, 2 untuk cadangan
    //     };
    // });
}

async function prosesJalurZonasiReguler_(sekolah_tujuan_id, transaction) {
    const resSek = await getSekolahTujuanById(sekolah_tujuan_id, transaction);

    let kuota_zonasi_max = resSek.daya_tampung;
    let kuota_zonasi_min = resSek.kuota_zonasi;
    let persentase_domisili_nilai = DomiNilaiHelper('nilai');
    let kuota_zonasi_nilai_min = Math.ceil((persentase_domisili_nilai / 100) * kuota_zonasi_min);
    let zonasi_jarak = kuota_zonasi_min - kuota_zonasi_nilai_min;

    // Data berdasarkan jarak terdekat
    const resDataZonasi = await DataPerangkingans.findAndCountAll({
        attributes: ['id', 'no_pendaftaran', 'nisn', 'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'],
        where: {
            jalur_pendaftaran_id: 1,
            sekolah_tujuan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        order: [
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['umur', 'DESC'],
            ['created_at', 'ASC'] 
        ],
        limit: zonasi_jarak,
        transaction
    });
    
    const rowsZonasiReg = resDataZonasi.rows;
    const totalZonasiReg = rowsZonasiReg.length;

    // Hitung total pendaftar jalur lainnya
    const countPrestasi = (await DataPerangkingans.findAll({  
        attributes: ['nisn'],
        where: {  
            jalur_pendaftaran_id: 3,
            sekolah_tujuan_id,  
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        limit: resSek.kuota_prestasi
    })).length;

    const countAfirmasi = (await DataPerangkingans.findAll({  
        where: {  
            jalur_pendaftaran_id: 5,
            sekolah_tujuan_id,  
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        limit: resSek.kuota_afirmasi
    })).length;

    const countPto = (await DataPerangkingans.findAll({  
        where: {  
            jalur_pendaftaran_id: 4,
            sekolah_tujuan_id,  
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        limit: resSek.kuota_pto
    })).length;

    let countZonasiKhusus = 0;
    //let zonKhData = []; // Untuk menyimpan data per zonasi khusus
    let totalZonasiKhusus = 0; // Untuk menyimpan total keseluruhan
    if(resSek.kuota_zonasi_khusus > 0){
        
        const npsn = resSek.npsn;
        const resZonKh = await SekolahZonasiKhususByNpsn(npsn);

        for (const zonKh of resZonKh) {
            countZonasiKhusus = (await DataPerangkingans.findAll({  
                attributes: ['nisn'],
                where: {  
                    jalur_pendaftaran_id: 2,
                    sekolah_tujuan_id,  
                    kode_kecamatan: zonKh.kode_wilayah_kec,  
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 }
                },
                limit: resSek.kuota_zonasi_khusus
            })).length;

            // Tambahkan ke total
            totalZonasiKhusus += currentCount;

        }

         // Set countZonasiKhusus dengan total keseluruhan
         countZonasiKhusus = totalZonasiKhusus;
    }

    let kuota_terpakai = totalZonasiReg + countZonasiKhusus + countPrestasi + countAfirmasi + countPto;
    let kuota_zonasi_nilai = Math.max(0, kuota_zonasi_max - kuota_terpakai);
    
    // Gunakan KUOTA_CADANGAN dari environment
    const kuota_zonasi_nilai_dengan_cadangan = kuota_zonasi_nilai + KUOTA_CADANGAN;

    const resDataZonasiIds = (resDataZonasi.rows || []).map((item) => item.id);
    const resZonasiNilai = await DataPerangkingans.findAll({
        attributes: ['id', 'no_pendaftaran', 'nisn', 'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'],
        where: {
            jalur_pendaftaran_id: 1,
            sekolah_tujuan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 },
            id: { [Op.notIn]: resDataZonasiIds }
        },
        order: [
            ['nilai_akhir', 'DESC'],
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
        ],
        limit: kuota_zonasi_nilai_dengan_cadangan,
        transaction
    });

    // Gabungkan data dan tambahkan flag untuk cadangan
    const combinedData = [
        ...(rowsZonasiReg ? rowsZonasiReg.map(item => ({
            ...item.toJSON(),
            order_berdasar: 1,
            is_cadangan: false
        })) : []),
        
        ...(resZonasiNilai ? resZonasiNilai.map((item, index) => ({
            ...item.toJSON(),
            order_berdasar: 2,
            is_cadangan: index >= kuota_zonasi_nilai // Tandai sebagai cadangan jika melebihi kuota normal
        })) : [])
    ];

    return combinedData.map(item => ({
        ...item,
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: item.is_cadangan ? 2 : 1
    }));
    
    // return combinedData.map(item => {
    //     const { id_pendaftar, id, is_cadangan, ...rest } = item;
    //     return { 
    //         ...rest, 
    //         id: encodeId(id), 
    //         id_pendaftar: encodeId(id_pendaftar),
    //         status_daftar_sekolah: 1,
    //         is_diterima: is_cadangan ? 2 : 1 // 1 untuk diterima, 2 untuk cadangan
    //     };
    // });
}

async function prosesJalurZonasiReguler(sekolah_tujuan_id, transaction) {
    const resSek = await getSekolahTujuanById(sekolah_tujuan_id, transaction);

    let kuota_zonasi_max = resSek.daya_tampung;
    let kuota_zonasi_min = resSek.kuota_zonasi;
    let persentase_domisili_nilai = DomiNilaiHelper('nilai');
    let kuota_zonasi_nilai_min = Math.ceil((persentase_domisili_nilai / 100) * kuota_zonasi_max);
    let zonasi_jarak = kuota_zonasi_min - kuota_zonasi_nilai_min;

    zonasi_jarak = Math.max(0, zonasi_jarak);

    // Data berdasarkan jarak terdekat
    const resDataZonasi = await DataPerangkingans.findAndCountAll({
        //attributes: ['id', 'no_pendaftaran', 'nisn', 'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'],
        where: {
            jalur_pendaftaran_id: 1,
            sekolah_tujuan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        order: [
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['umur', 'DESC'],
            ['created_at', 'ASC'] 
        ],
        limit: zonasi_jarak,
        transaction
    });
    
    const rowsZonasiReg = resDataZonasi.rows;
    const totalZonasiReg = rowsZonasiReg.length;

    // Hitung total pendaftar jalur lainnya
    const countPrestasi = (await DataPerangkingans.findAll({  
        attributes: ['nisn'],
        where: {  
            jalur_pendaftaran_id: 3,
            sekolah_tujuan_id,  
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        limit: resSek.kuota_prestasi
    })).length;

    const countAfirmasi = (await DataPerangkingans.findAll({  
        where: {  
            jalur_pendaftaran_id: 5,
            sekolah_tujuan_id,  
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        limit: resSek.kuota_afirmasi
    })).length;

    const countPto = (await DataPerangkingans.findAll({  
        where: {  
            jalur_pendaftaran_id: 4,
            sekolah_tujuan_id,  
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        limit: resSek.kuota_pto
    })).length;

    let countZonasiKhusus = 0;
    let zonKhData = []; // Untuk menyimpan data per zonasi khusus
    //let zonKhData = []; // Untuk menyimpan data per zonasi khusus
    let totalZonasiKhusus = 0; // Untuk menyimpan total keseluruhan
    if(resSek.kuota_zonasi_khusus > 0){
        
        const npsn = resSek.npsn;
        const resZonKh = await SekolahZonasiKhususByNpsn(npsn);

        for (const zonKh of resZonKh) {
            const currentCount = (await DataPerangkingans.findAll({  
                attributes: ['nisn'],
                where: {  
                    jalur_pendaftaran_id: 2,
                    sekolah_tujuan_id,  
                    kode_kecamatan: zonKh.kode_wilayah_kec,  
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 },
                    // Tambahkan kondisi spesifik zonKh jika diperlukan
                    // contoh: zonasi_khusus_id: zonKh.id
                },
                limit: zonKh.kuota_zonasi_khusus
            })).length;

            // Simpan data per zonasi khusus
            zonKhData.push({
                zonasi_khusus_id: zonKh.id,
                nama_zonasi_khusus: zonKh.nama, // atau field lain yang relevan
                jumlah_pendaftar: currentCount
            });

            // Tambahkan ke total
            totalZonasiKhusus += currentCount;

        }

         // Set countZonasiKhusus dengan total keseluruhan
         countZonasiKhusus = totalZonasiKhusus;
    }

    let kuota_terpakai = totalZonasiReg + countZonasiKhusus + countPrestasi + countAfirmasi + countPto;
    let kuota_zonasi_nilai = Math.max(0, kuota_zonasi_max - kuota_terpakai);
    
    // Gunakan KUOTA_CADANGAN dari environment
    const kuota_zonasi_nilai_dengan_cadangan = kuota_zonasi_nilai + KUOTA_CADANGAN;

    const resDataZonasiIds = (resDataZonasi.rows || []).map((item) => item.id);
    const resZonasiNilai = await DataPerangkingans.findAll({
        //attributes: ['id', 'no_pendaftaran', 'nisn', 'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'],
        where: {
            jalur_pendaftaran_id: 1,
            sekolah_tujuan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 },
            id: { [Op.notIn]: resDataZonasiIds }
        },
        order: [
            ['nilai_akhir', 'DESC'],
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['umur', 'DESC'], 
            ['created_at', 'ASC'] 
        ],
        limit: kuota_zonasi_nilai_dengan_cadangan,
        // limit: Math.max(kuota_zonasi_nilai ?? 0, 0),
        transaction
    });

    // Gabungkan data dan tambahkan flag untuk cadangan
    const combinedData = [
        ...(rowsZonasiReg ? rowsZonasiReg.map(item => ({
            ...item.toJSON(),
            order_berdasar: 1,
            is_cadangan: false
        })) : []),
        
        ...(resZonasiNilai ? resZonasiNilai.map((item, index) => ({
            ...item.toJSON(),
            order_berdasar: 2,
            is_cadangan: index >= kuota_zonasi_nilai // Tandai sebagai cadangan jika melebihi kuota normal
        })) : [])
    ];

    return combinedData.map(item => ({
        ...item,
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: item.is_cadangan ? 2 : 1
    }));
    
    // return combinedData.map(item => {
    //     const { id_pendaftar, id, is_cadangan, ...rest } = item;
    //     return { 
    //         ...rest, 
    //         id: encodeId(id), 
    //         id_pendaftar: encodeId(id_pendaftar),
    //         status_daftar_sekolah: 1,
    //         is_diterima: is_cadangan ? 2 : 1 // 1 untuk diterima, 2 untuk cadangan
    //     };
    // });
}

async function prosesJalurZonasiReguler2(sekolah_tujuan_id, transaction) {
    const resSek = await getSekolahTujuanById(sekolah_tujuan_id, transaction);
    if (!resSek) {
        throw new Error(`Data sekolah tujuan dengan ID ${sekolah_tujuan_id} tidak ditemukan`);
    }

    const daya_tampung = resSek.daya_tampung || 0;
    const kuota_zonasi_min = resSek.kuota_zonasi || 0;
    const persentase_domisili_nilai = DomiNilaiHelper('nilai') || 0;
    
    // Hitung kuota berdasarkan persentase
    let kuota_zonasi_nilai_min = Math.ceil((persentase_domisili_nilai / 100) * kuota_zonasi_min);
    let zonasi_jarak = kuota_zonasi_min - kuota_zonasi_nilai_min;

    // Pastikan tidak ada nilai negatif
    kuota_zonasi_nilai_min = Math.max(0, kuota_zonasi_nilai_min);
    zonasi_jarak = Math.max(0, zonasi_jarak);

    console.log(`Kuota Zonasi Reguler untuk sekolah ${sekolah_tujuan_id}:`);
    console.log(`- Daya Tampung: ${daya_tampung}`);
    console.log(`- Kuota Zonasi Min: ${kuota_zonasi_min}`);
    console.log(`- Persentase Domisili Nilai: ${persentase_domisili_nilai}%`);
    console.log(`- Kuota Zonasi Nilai Min: ${kuota_zonasi_nilai_min}`);
    console.log(`- Kuota Zonasi Jarak: ${zonasi_jarak}`);

    // 1. Ambil data berdasarkan jarak terdekat (zonasi jarak)
    const resDataZonasi = await DataPerangkingans.findAndCountAll({
        // attributes: ['id', 'no_pendaftaran', 'nisn', 'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'],
        where: {
            jalur_pendaftaran_id: 1,
            sekolah_tujuan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        order: [
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['umur', 'DESC'],
            ['created_at', 'ASC'] 
        ],
        limit: zonasi_jarak,
        transaction
    });

    const rowsZonasiReg = resDataZonasi.rows || [];
    const totalZonasiReg = rowsZonasiReg.length;
    console.log(`Jumlah peserta zonasi jarak: ${totalZonasiReg}`);

    // 2. Hitung kuota yang sudah terpakai oleh jalur lain
    const [countPrestasi, countAfirmasi, countPto, countZonasiKhusus] = await Promise.all([
        DataPerangkingans.count({
            where: {  
                jalur_pendaftaran_id: 3,
                sekolah_tujuan_id,  
                is_delete: 0,
                is_daftar_ulang: { [Op.ne]: 2 }
            },
            transaction
        }),
        DataPerangkingans.count({
            where: {  
                jalur_pendaftaran_id: 5,
                sekolah_tujuan_id,  
                is_delete: 0,
                is_daftar_ulang: { [Op.ne]: 2 }
            },
            transaction
        }),
        DataPerangkingans.count({
            where: {  
                jalur_pendaftaran_id: 4,
                sekolah_tujuan_id,  
                is_delete: 0,
                is_daftar_ulang: { [Op.ne]: 2 }
            },
            transaction
        }),
        resSek.kuota_zonasi_khusus > 0 ? 
            DataPerangkingans.count({
                where: {  
                    jalur_pendaftaran_id: 2,
                    sekolah_tujuan_id,  
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 }
                },
                transaction
            }) : 
            Promise.resolve(0)
    ]);

    console.log(`Kuota terpakai oleh jalur lain:`);
    console.log(`- Prestasi: ${countPrestasi}`);
    console.log(`- Afirmasi: ${countAfirmasi}`);
    console.log(`- PTO: ${countPto}`);
    console.log(`- Zonasi Khusus: ${countZonasiKhusus}`);

    const kuota_terpakai = totalZonasiReg + countZonasiKhusus + countPrestasi + countAfirmasi + countPto;
    let kuota_zonasi_nilai = Math.max(0, daya_tampung - kuota_terpakai);
    
    console.log(`Kuota Zonasi Nilai yang tersedia: ${kuota_zonasi_nilai}`);

    // Ambil ID yang sudah diproses di zonasi jarak
    const resDataZonasiIds = rowsZonasiReg.map((item) => item.id);

    // 3. Ambil data berdasarkan nilai terbaik (zonasi nilai)
    const resZonasiNilai = await DataPerangkingans.findAll({
        // attributes: ['id', 'no_pendaftaran', 'nisn', 'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar'],
        where: {
            jalur_pendaftaran_id: 1,
            sekolah_tujuan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 },
            id: { [Op.notIn]: resDataZonasiIds }
        },
        order: [
            ['nilai_akhir', 'DESC'],
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['created_at', 'ASC'] 
        ],
        limit: kuota_zonasi_nilai + KUOTA_CADANGAN,
        transaction
    });

    console.log(`Jumlah peserta zonasi nilai: ${resZonasiNilai.length}`);

    // 4. Gabungkan data dan tandai cadangan
    const combinedData = [
        ...rowsZonasiReg.map(item => ({
            ...item.toJSON(),
            order_berdasar: 1, // Berdasarkan jarak
            is_cadangan: false
        })),
        ...resZonasiNilai.map((item, index) => ({
            ...item.toJSON(),
            order_berdasar: 2, // Berdasarkan nilai
            is_cadangan: index >= kuota_zonasi_nilai
        }))
    ];

    console.log(`Total data gabungan: ${combinedData.length}`);

    return combinedData.map(item => ({
        ...item,
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: item.is_cadangan ? 2 : 1 // 1 untuk diterima, 2 untuk cadangan
    }));
}

// Update all jalur processing functions to include cadangan quota
async function prosesJalurZonasiKhususBAK(sekolah_tujuan_id, transaction) {
    const resSek = await getSekolahTujuanById(sekolah_tujuan_id, transaction);
    let kuota_zonasi_khusus = resSek.kuota_zonasi_khusus;
    let kuota_dengan_cadangan = kuota_zonasi_khusus + KUOTA_CADANGAN;

    const npsn = resSek.npsn;
    const resZonKh = await SekolahZonasiKhususByNpsn(npsn);

    let resData = [];

    for (const zonKh of resZonKh) {
        const resDataQ = await DataPerangkingans.findAll({
            where: {
                jalur_pendaftaran_id: 2,
                sekolah_tujuan_id,
                kode_kecamatan: zonKh.kode_wilayah_kec,  
                is_delete: 0,
                is_daftar_ulang: { [Op.ne]: 2 },
                [Op.or]: [
                            { is_tidak_boleh_domisili: { [Op.is]: null } },
                            { is_tidak_boleh_domisili: 0 }
                        ],
            },
            order: [
                ['umur', 'DESC'],
                ['nilai_akhir', 'DESC'],
                ['created_at', 'ASC']
            ],
            limit: zonKh.kuota_zonasi_khusus,
            transaction
        });
    
        resData = resDataQ.concat(resDataQ);
    }

    return resData.map((item, index) => ({
        ...item.toJSON(),
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: index < kuota_zonasi_khusus ? 1 : 2 // 1 for main quota, 2 for cadangan
    }));
}

async function prosesJalurZonasiKhusus(sekolah_tujuan_id, transaction) {
    const resSek = await getSekolahTujuanById(sekolah_tujuan_id, transaction);
    let kuota_zonasi_khusus = resSek.kuota_zonasi_khusus;
    let kuota_dengan_cadangan = kuota_zonasi_khusus + KUOTA_CADANGAN;

    const npsn = resSek.npsn;
    const resZonKh = await SekolahZonasiKhususByNpsn(npsn);

    let resData = [];

    for (const zonKh of resZonKh) {
        const resDataQ = await DataPerangkingans.findAll({
            where: {
                jalur_pendaftaran_id: 2,
                sekolah_tujuan_id,
                kode_kecamatan: zonKh.kode_wilayah_kec,  
                is_delete: 0,
                is_daftar_ulang: { [Op.ne]: 2 },
                [Op.or]: [
                    { is_tidak_boleh_domisili: { [Op.is]: null } },
                    { is_tidak_boleh_domisili: 0 }
                ],
            },
            order: [
                ['umur', 'DESC'],
                ['nilai_akhir', 'DESC'],
                ['created_at', 'ASC']
            ],
            limit: zonKh.kuota_zonasi_khusus,
            transaction
        });
    
        resData = resData.concat(resDataQ); // Perbaikan di sini: gunakan concat untuk menambahkan data baru
    }

    // Urutkan kembali semua data yang telah dikumpulkan dari berbagai kecamatan
    resData.sort((a, b) => {
        if (b.umur !== a.umur) return b.umur - a.umur;
        if (b.nilai_akhir !== a.nilai_akhir) return b.nilai_akhir - a.nilai_akhir;
        return new Date(a.created_at) - new Date(b.created_at);
    });

    // Batasi sesuai kuota total (termasuk cadangan)
    resData = resData.slice(0, kuota_dengan_cadangan);

    return resData.map((item, index) => ({
        ...item.toJSON(),
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: index < kuota_zonasi_khusus ? 1 : 2 // 1 for main quota, 2 for cadangan
    }));
}

async function prosesJalurZonasiKhusus_BAK(sekolah_tujuan_id, transaction) {
    const resSek = await getSekolahTujuanById(sekolah_tujuan_id, transaction);
    let kuota_zonasi_khusus = resSek.kuota_zonasi_khusus;
    let kuota_dengan_cadangan = kuota_zonasi_khusus + KUOTA_CADANGAN;


    const resData = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 2,
            sekolah_tujuan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        order: [
            ['umur', 'DESC'],
            ['nilai_akhir', 'DESC'],
            ['created_at', 'ASC'] 
        ],
        limit: kuota_dengan_cadangan,
        transaction
    });

    return resData.map((item, index) => ({
        ...item.toJSON(),
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: index < kuota_zonasi_khusus ? 1 : 2 // 1 for main quota, 2 for cadangan
    }));
}

async function prosesJalurPrestasi(sekolah_tujuan_id, transaction) {
    const resSek = await getSekolahTujuanById(sekolah_tujuan_id, transaction);
    let kuota_prestasi = resSek.kuota_prestasi;
    let kuota_dengan_cadangan = kuota_prestasi + KUOTA_CADANGAN;

    const resData = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 3,
            sekolah_tujuan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        order: [
            ['nilai_akhir', 'DESC'],
            ['umur', 'DESC'],
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['created_at', 'ASC'] 
        ],
        limit: kuota_dengan_cadangan,
        transaction
    });

    return resData.map((item, index) => ({
        ...item.toJSON(),
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: index < kuota_prestasi ? 1 : 2
    }));
}

async function prosesJalurPTO(sekolah_tujuan_id, transaction) {
    const resSek = await getSekolahTujuanById(sekolah_tujuan_id, transaction);
    let kuota_pto = resSek.kuota_pto;
    let kuota_dengan_cadangan = kuota_pto + KUOTA_CADANGAN;

    const resData = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 4,
            sekolah_tujuan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        order: [
            [literal('is_anak_guru_jateng DESC')],
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['umur', 'DESC'], //umur tertua
            ['created_at', 'ASC'] 
        ],
        limit: kuota_dengan_cadangan,
        transaction
    });

    return resData.map((item, index) => ({
        ...item.toJSON(),
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: index < kuota_pto ? 1 : 2
    }));
}

async function prosesJalurAfirmasi(sekolah_tujuan_id, transaction) {
    const resSek = await getSekolahTujuanById(sekolah_tujuan_id, transaction);
    let daya_tampung = resSek.daya_tampung;
    let kuota_afirmasi = resSek.kuota_afirmasi;
    let kuota_persentase_ats = afirmasiSmaHelper('is_tidak_sekolah');
    let kuota_persentase_panti = afirmasiSmaHelper('is_anak_panti');

    // let kuota_ats = Math.ceil((kuota_persentase_ats / 100) * daya_tampung) || 0;
    // let kuota_panti = Math.ceil((kuota_persentase_panti / 100) * daya_tampung) || 0;
    let kuota_ats = Math.max(Math.ceil((kuota_persentase_ats / 100) * daya_tampung) || 0, 0);
    let kuota_panti = Math.max(Math.ceil((kuota_persentase_panti / 100) * daya_tampung) || 0, 0);
    
    let kuota_ats_dengan_cadangan = kuota_ats + Math.ceil(KUOTA_CADANGAN * (kuota_ats / kuota_afirmasi));
    let kuota_panti_dengan_cadangan = kuota_panti + Math.ceil(KUOTA_CADANGAN * (kuota_panti / kuota_afirmasi));

    // Data ATS
    const resDataAts = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 5,
            sekolah_tujuan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 },
            is_anak_keluarga_tidak_mampu: '0',
            is_anak_panti: '0',
            is_tidak_sekolah: '1'
        },
        order: [
            ['umur', 'DESC'],
            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
            ['created_at', 'ASC']
        ],
        // limit: kuota_ats_dengan_cadangan,
        limit: kuota_ats,
        transaction
    });

    // Data Panti
    const resDataPanti = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 5,
            sekolah_tujuan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 },
            is_anak_keluarga_tidak_mampu: '0',
            is_anak_panti: '1',
            is_tidak_sekolah: '0'
        },
        order: [
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['umur', 'DESC'],
            ['created_at', 'ASC'] 
        ],
        //limit: kuota_panti_dengan_cadangan,
        limit: kuota_panti,
        transaction
    });

    // Data Afirmasi Miskin
    // let kuota_afirmasi_sisa = kuota_afirmasi - (kuota_ats + kuota_panti);
    let kuota_afirmasi_sisa = kuota_afirmasi - (resDataAts.length + resDataPanti.length);
    let kuota_miskin_dengan_cadangan = kuota_afirmasi_sisa + KUOTA_CADANGAN;
    //let kuota_miskin_dengan_cadangan = kuota_afirmasi_sisa + 
        // (KUOTA_CADANGAN - (kuota_ats_dengan_cadangan - kuota_ats) - (kuota_panti_dengan_cadangan - kuota_panti));
        //(KUOTA_CADANGAN - kuota_ats - kuota_panti);

    const resDataMiskin = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 5,
            sekolah_tujuan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 },
            // is_anak_keluarga_tidak_mampu: '1',
            [Op.or]: [
                { is_anak_keluarga_tidak_mampu: '1' },
                { is_disabilitas: '1' }
            ],
            is_anak_panti: '0',
            is_tidak_sekolah: '0'
        },
        order: [
            ['is_disabilitas', 'DESC'],
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['umur', 'DESC'], //umur tertua
            ['created_at', 'ASC'] 
        ],
        limit: kuota_miskin_dengan_cadangan,
        transaction
    });

    // Gabungkan semua data dengan flag cadangan
    const combinedData = [
        ...(resDataPanti || []).map((item, index) => ({
            ...item.toJSON(),
            order_berdasar: 3,
            is_cadangan: index >= kuota_panti
        })),
        ...(resDataAts || []).map((item, index) => ({
            ...item.toJSON(),
            order_berdasar: 4,
            is_cadangan: index >= kuota_ats
        })),
        ...(resDataMiskin || []).map((item, index) => ({
            ...item.toJSON(),
            order_berdasar: 5,
            is_cadangan: index >= kuota_afirmasi_sisa
        }))
    ];

    return combinedData.map(item => ({
        ...item,
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: item.is_cadangan ? 2 : 1
    }));
}

// Implementasi fungsi untuk jalur SMK
async function prosesJalurSMKDomisili(sekolah_tujuan_id, jurusan_id, transaction) {
    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id, transaction);
    let persentase_seleksi_terdekat_anak_guru = DomiSmkHelper('anak_guru');
    let daya_tampung = resJurSek.daya_tampung;
    let kuota_anak_guru = Math.ceil((persentase_seleksi_terdekat_anak_guru / 100) * daya_tampung);
    let kuota_jarak_terdekat = resJurSek.kuota_jarak_terdekat;
    let kuota_anak_guru_dengan_cadangan = kuota_anak_guru + Math.ceil(KUOTA_CADANGAN * (kuota_anak_guru / daya_tampung));
    //let kuota_jarak_terdekat_dengan_cadangan = kuota_jarak_terdekat + (KUOTA_CADANGAN - (kuota_anak_guru_dengan_cadangan - kuota_anak_guru));

    let npsnnya = resJurSek.npsn;

    // Data Anak Guru
    const resDataAnakGuru = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 6,
            sekolah_tujuan_id,
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 },
            npsn_anak_guru: npsnnya,
            is_anak_guru_jateng: '1'
        },
        order: [
            ['is_anak_guru_jateng', 'DESC'],
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['created_at', 'ASC'] 
        ],
        //limit: kuota_anak_guru_dengan_cadangan,
        limit: kuota_anak_guru,
        transaction
    });

    const totalAnakGuru = resDataAnakGuru.length;

    const excludedNisn = resDataAnakGuru.map(item => item.nisn); // Ambil semua NISN dari hasil anak guru

    let kuota_jarak_terdekat_dengan_cadangan = (kuota_jarak_terdekat + KUOTA_CADANGAN) - totalAnakGuru;

    // Data Domisili Terdekat
    const resData = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 6,
            sekolah_tujuan_id,
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 },
            [Op.or]: [
                        { is_tidak_boleh_domisili: { [Op.is]: null } },
                        { is_tidak_boleh_domisili: 0 }
                    ],
            nisn: { [Op.notIn]: excludedNisn } // Exclude NISN yang sudah terpilih di anak guru
        },
        order: [
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['umur', 'DESC'],
            // ['created_at', 'ASC'] 
        ],
        limit: kuota_jarak_terdekat_dengan_cadangan,
        transaction
    });

    let batas_diterima_domisili = kuota_jarak_terdekat - totalAnakGuru;

    // Gabungkan data dengan flag cadangan
    const combinedData = [
        ...(resDataAnakGuru || []).map((item, index) => ({
            ...item.toJSON(),
            order_berdasar: "6",
            is_cadangan: index >= kuota_anak_guru
        })),
        ...(resData || []).map((item, index) => ({
            ...item.toJSON(),
            order_berdasar: "7",
            is_cadangan: index >= batas_diterima_domisili
        }))
    ];

    return combinedData.map(item => ({
        ...item,
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: item.is_cadangan ? 2 : 1
    }));
}

async function prosesJalurSMKPrestasi(sekolah_tujuan_id, jurusan_id, transaction) {
    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id, transaction);
    let kuota_prestasi_max = resJurSek.daya_tampung;
    let kuota_prestasi_min = resJurSek.kuota_prestasi;

    // Hitung kuota yang sudah terpakai
    // const countTerdekat = (await DataPerangkingans.count({
    //     where: {  
    //         jalur_pendaftaran_id: 6,
    //         sekolah_tujuan_id,  
    //         jurusan_id,
    //         is_delete: 0,
    //         is_daftar_ulang: { [Op.ne]: 2 }
    //     },
    //     limit: resJurSek.kuota_jarak_terdekat,
    //     transaction
    // }));

    const countTerdekat = (await DataPerangkingans.findAll({  
        where: {  
            jalur_pendaftaran_id: 6,
            sekolah_tujuan_id,  
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
        },
        limit: resJurSek.kuota_jarak_terdekat
    })).length;

    // const countAfirmasi = (await DataPerangkingans.count({
    //     where: {  
    //         jalur_pendaftaran_id: 9,
    //         sekolah_tujuan_id,  
    //         jurusan_id,
    //         is_delete: 0,
    //         is_daftar_ulang: { [Op.ne]: 2 }
    //     },
    //     limit: resJurSek.kuota_afirmasi,
    //     transaction
    // }));

    const countAfirmasi = (await DataPerangkingans.findAll({  
        where: {  
            jalur_pendaftaran_id: 9,
            sekolah_tujuan_id,  
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition   
            // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
        },
        limit: resJurSek.kuota_afirmasi
    })).length;

    // const countPrestasiKhusus = (await DataPerangkingans.count({
    //     where: {  
    //         jalur_pendaftaran_id: 8,
    //         sekolah_tujuan_id,  
    //         jurusan_id,
    //         is_delete: 0,
    //         is_daftar_ulang: { [Op.ne]: 2 }
    //     },
    //     limit: resJurSek.kuota_prestasi_khusus,
    //     transaction
    // }));

    //hitung total pendaftar prestasi khusus
    const countPrestasiKhusus = (await DataPerangkingans.findAll({  
        where: {  
            jalur_pendaftaran_id: 8,
            sekolah_tujuan_id,  
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
        },
        limit: resJurSek.kuota_prestasi_khusus
    })).length;

    let kuota_prestasi = kuota_prestasi_max - (countTerdekat + countAfirmasi + countPrestasiKhusus);
    let kuota_prestasi_akhir = 0;
    if(kuota_prestasi >= kuota_prestasi_min){
        kuota_prestasi_akhir = kuota_prestasi;
    }else{
        kuota_prestasi_akhir = kuota_prestasi_min;
    }
    let kuota_dengan_cadangan = kuota_prestasi_akhir + KUOTA_CADANGAN;

    const resData = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 7,
            sekolah_tujuan_id,
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        order: [
            ['nilai_akhir', 'DESC'],
            ['umur', 'DESC'],
            ['created_at', 'ASC']
        ],
        limit: kuota_dengan_cadangan,
        transaction
    });

    return resData.map((item, index) => ({
        ...item.toJSON(),
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: index < kuota_prestasi_akhir ? 1 : 2
    }));
}

async function prosesJalurSMKPrestasiKhusus(sekolah_tujuan_id, jurusan_id, transaction) {
    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id, transaction);
    let kuota_prestasi_khusus = resJurSek.kuota_prestasi_khusus;
    let kuota_dengan_cadangan = kuota_prestasi_khusus + KUOTA_CADANGAN;

    const resData = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 8,
            sekolah_tujuan_id,
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        order: [
            ['nilai_akhir', 'DESC'], //nilai tertinggi
            ['umur', 'DESC'], //umur tertua
            ['created_at', 'ASC']
        ],
        limit: kuota_dengan_cadangan,
        transaction
    });

    return resData.map((item, index) => ({
        ...item.toJSON(),
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: index < kuota_prestasi_khusus ? 1 : 2
    }));
}

async function prosesJalurSMKAfirmasi(sekolah_tujuan_id, jurusan_id, transaction) {
    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id, transaction);
    let kuota_afirmasi = resJurSek.kuota_afirmasi;
    let miskin = afirmasiSmkHelper('is_anak_keluarga_miskin');
    let panti = afirmasiSmkHelper('is_anak_panti');
    let ats = afirmasiSmkHelper('is_tidak_sekolah');
    let jml = miskin + panti + ats;

    let kuota_panti = Math.round((panti / jml) * kuota_afirmasi) || 0;
    let kuota_ats = Math.round((ats / jml) * kuota_afirmasi) || 0;
    let kuota_panti_dengan_cadangan = kuota_panti + Math.ceil(KUOTA_CADANGAN * (kuota_panti / kuota_afirmasi));
    let kuota_ats_dengan_cadangan = kuota_ats + Math.ceil(KUOTA_CADANGAN * (kuota_ats / kuota_afirmasi));

    // Data ATS
    const resDataAts = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 9,
            sekolah_tujuan_id,
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 },
            is_tidak_sekolah: '1', 
        },
        order: [
            ['umur', 'DESC'],
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['created_at', 'ASC'] 
        ],
        // limit: kuota_ats_dengan_cadangan,
        limit: kuota_ats,
        transaction
    });

    // Data Panti
    const resDataPanti = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 9,
            sekolah_tujuan_id,
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 },
            is_anak_panti: '1',       
        },
        order: [
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['umur', 'DESC'],
            ['created_at', 'ASC'] 
        ],
        // limit: kuota_panti_dengan_cadangan,
        limit: kuota_ats,
        transaction
    });

    // Data Afirmasi Miskin
    // let kuota_akhir_afirmasi = kuota_afirmasi - (kuota_ats + kuota_panti);
    // let kuota_miskin_dengan_cadangan = kuota_akhir_afirmasi + 
        // (KUOTA_CADANGAN - 
        // (kuota_ats_dengan_cadangan - kuota_ats) - 
        // (kuota_panti_dengan_cadangan - kuota_panti));
        //(KUOTA_CADANGAN - kuota_ats - kuota_panti);

    let kuota_akhir_afirmasi = kuota_afirmasi - (resDataAts.length + resDataPanti.length);
    let kuota_miskin_dengan_cadangan = kuota_akhir_afirmasi + KUOTA_CADANGAN;

    const resAtsIds = (resDataAts || []).map((item) => item.id);
    const resPantiIds = (resDataPanti || []).map((item) => item.id);

    const resDataMiskin = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 9,
            sekolah_tujuan_id,
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 },
            
            [Op.or]: [
                { is_anak_keluarga_tidak_mampu: '1' },
                { is_disabilitas: '1' }
            ],

            is_anak_panti: '0',
            is_tidak_sekolah: '0',
            id: { [Op.notIn]: [...resAtsIds, ...resPantiIds] } // Gabungkan ID ATS & Panti
        },
        order: [
            ['is_disabilitas', 'DESC'], //disabilitas 
            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
            ['umur', 'DESC'], //umur tertua
            ['created_at', 'ASC'] // daftar sekolah terawal
        ],
        limit: kuota_miskin_dengan_cadangan,
        transaction
    });

    // Gabungkan semua data dengan flag cadangan
    const combinedData = [
        ...(resDataPanti || []).map((item, index) => ({
            ...item.toJSON(),
            order_berdasar: 3,
            is_cadangan: index >= kuota_panti
        })),
        ...(resDataAts || []).map((item, index) => ({
            ...item.toJSON(),
            order_berdasar: 4,
            is_cadangan: index >= kuota_ats
        })),
        ...(resDataMiskin || []).map((item, index) => ({
            ...item.toJSON(),
            order_berdasar: 5,
            is_cadangan: index >= kuota_akhir_afirmasi
        }))
    ];

    return combinedData.map(item => ({
        ...item,
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: item.is_cadangan ? 2 : 1
    }));
}

export const getPerangkinganPengumuman = async (req, res) => {
    try {
        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id, 
            jurusan_id,
            nisn,
            is_pdf
        } = req.body;

        const redis_key = `perangkingan_pengumman:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;

        //1. Cek cache Redis terlebih dahulu
        const cached = await redisGet(redis_key);
        if (cached) {
            const resultData = JSON.parse(cached);
            
            if (is_pdf == 1) {
                return generatePDFResponse(res, resultData, jalur_pendaftaran_id);
            } else {
                const resTimeline = await getTimelineSatuan(6);
                return res.status(200).json({
                    status: 1,
                    message: 'Data berhasil ditemukan (from cache)',
                    data: resultData,
                    timeline: resTimeline
                });
            }
        }

        // 2. Jika tidak ada di cache, ambil dari database
        const whereClause = {
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            is_saved: 1,
            is_diterima: 1,
            is_delete: 0
        };

        //Tambahkan filter jurusan jika ada (untuk SMK)
        if (jurusan_id) {
            whereClause.jurusan_id = jurusan_id;
        }

        const resultData = await DataPerangkingans.findAll({
            attributes: ['id', 'no_pendaftaran', 'nisn' ,'nama_lengkap', 'jarak', 'nilai_akhir', 'is_daftar_ulang', 'id_pendaftar', 'order_berdasar', 'no_urut'], // Pilih kolom yang diambil
            where: whereClause,
            order: [
                ['no_urut', 'ASC'] // Urut berdasarkan no urut perangkingan
            ]
        });

        // Langsung modifikasi resultData (Sequelize model instances)
        resultData.forEach(item => {
            // Update di dataValues (untuk data utama)
            item.dataValues.id = encodeId(item.dataValues.id);
            item.dataValues.id_pendaftar = encodeId(item.dataValues.id_pendaftar);
            
            // Update juga di root object instance
            item.id = item.dataValues.id;
            item.id_pendaftar = item.dataValues.id_pendaftar;
        });

        //Simpan ke cache
        await redisSet(redis_key, JSON.stringify(resultData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);

        if (is_pdf == 1) {
            return generatePDFResponse(res, resultData, jalur_pendaftaran_id);
        } else {
            const resTimeline = await getTimelineSatuan(6);
            return res.status(200).json({
                status: 1,
                message: 'Data berhasil ditemukan',
                data: resultData,
                timeline: resTimeline
            });
        }

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({
            status: 0,
            message: 'Error'
        });
    }
};


export const getPerangkinganDaftarUlang = async (req, res) => {
    try {
        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id, 
            jurusan_id,
            nisn,
            is_pdf
        } = req.body;

        const redis_key = `perangkingan_daftar_ulang:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;

        //1. Cek cache Redis terlebih dahulu
        const cached = await redisGet(redis_key);
        if (cached) {
            const resultData = JSON.parse(cached);
            
            if (is_pdf == 1) {
                // return generatePDFResponse(res, resultData, jalur_pendaftaran_id);
            } else {
                const resTimeline = await getTimelineSatuan(6);
                return res.status(200).json({
                    status: 1,
                    message: 'Data berhasil ditemukan (from cache)',
                    data: resultData,
                    timeline: resTimeline
                });
            }
        }

        // 2. Jika tidak ada di cache, ambil dari database
        const whereClause = {
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            is_saved: 1,
            is_diterima: 1,
            is_delete: 0
        };

        //Tambahkan filter jurusan jika ada (untuk SMK)
        if (jurusan_id) {
            whereClause.jurusan_id = jurusan_id;
        }

        const resultData = await DataPerangkingans.findAll({
            include: [
                    // {
                    //     model: SekolahTujuan,
                    //     as: 'sekolah_tujuan',
                    //     attributes: ['npsn', 'nama']
                    // },
                    // {
                    //     model: SekolahJurusan,
                    //     as: 'sekolah_jurusan',
                    //     attributes: ['id', 'nama_jurusan']
                    // },
                    // {
                    //     model: JalurPendaftarans,
                    //     as: 'jalur_pendaftaran',
                    //     attributes: ['bentuk_pendidikan_id', 'nama']
                    // },
                    {
                        model: DataPendaftars,
                        as: 'data_pendaftar',
                        // Tambahkan attributes yang ingin Anda ambil dari DataPendaftars
                        attributes: ['id', 'jenis_kelamin','tempat_lahir','tanggal_lahir', 'nama_sekolah_asal', 'no_wa', 'nama_kejuaraan', 'nomor_sertifikat', 'alamat'], // sesuaikan dengan kebutuhan
                        include: [
                    {
                        model: StatusDomisilis,
                        as: 'status_domisili_name',
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
                    },{
                        model: JenisKejuaraans,
                        as: 'jenis_kejuaraan',
                        attributes: ['nama']
                    },
                    {  
                        model: WilayahVerDapodik,  
                        as: 'data_wilayah_mutasi',  
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']  
                    },  
                ],
                    }
                ],
            where: whereClause,
            order: [
                ['no_urut', 'ASC'] // Urut berdasarkan no urut perangkingan
            ]
           // logging: console.log // Ini akan menampilkan query SQL di console
        });
        

        // Langsung modifikasi resultData (Sequelize model instances)
        resultData.forEach(item => {
            // Update di dataValues (untuk data utama)
            item.dataValues.id = encodeId(item.dataValues.id);
            item.dataValues.id_pendaftar = encodeId(item.dataValues.id_pendaftar);
            
            // Update juga di root object instance
            item.id = item.dataValues.id;
            item.id_pendaftar = item.dataValues.id_pendaftar;
        });

        // Simpan ke cache
        await redisSet(redis_key, JSON.stringify(resultData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);

        if (is_pdf == 1) {
            // return generatePDFResponse(res, resDatas, jalur_pendaftaran_id);
        } else {
            const resTimeline = await getTimelineSatuan(6);
            return res.status(200).json({
                status: 1,
                message: 'Data berhasil ditemukan',
                data: resultData,
                timeline: resTimeline,
            });
        }

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({
            status: 0,
            message: 'Error'
        });
    }
};

export const getPerangkinganCadangan = async (req, res) => {
    try {
        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id, 
            jurusan_id,
            nisn,
            is_pdf
        } = req.body;

        const redis_key = `perangkingan_cadangan_:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;

        // 1. Cek cache Redis terlebih dahulu
        const cached = await redisGet(redis_key);
        if (cached) {
            const resultData = JSON.parse(cached);
            
            if (is_pdf == 1) {
                // return generatePDFResponse(res, resultData, jalur_pendaftaran_id);
            } else {
                const resTimeline = await getTimelineSatuan(6);
                return res.status(200).json({
                    status: 1,
                    message: 'Data berhasil ditemukan (from cache)',
                    data: resultData,
                    timeline: resTimeline
                });
            }
        }
        // 
        // 2. Jika tidak ada di cache, ambil dari database
        const whereClause = {
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            is_saved: 1,
            is_diterima: 1,
            is_daftar_ulang: 0,
            is_delete: 0
        };

        // Tambahkan filter jurusan jika ada (untuk SMK)
        if (jurusan_id) {
            whereClause.jurusan_id = jurusan_id;
        }

        // Pertama hitung jumlah data yang memenuhi kriteria
        const count = await DataPerangkingans.count({
            where: whereClause
        });

        // let limit_cadangan = limitasi_cadangan - count;

        // let limit_cadangan = limitasi_cadangan - count; // Hasil: NaN
        // limit_cadangan = isNaN(limit_cadangan) ? 0 : limit_cadangan;

        // let limit_cadangan = 5;
        const limit_cadangan = parseInt(process.env.KUOTA_CADANGAN) || 0; // Default to 20 if not set

        console.log('Limit Cadangan'+limit_cadangan); // Output: 0

        const whereClause2 = {
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            is_saved: 1,
            is_diterima: 2,
            is_delete: 0
        };

        if (jurusan_id) {
            whereClause2.jurusan_id = jurusan_id;
        }

        const resultData = await DataPerangkingans.findAll({
            where: whereClause2,
            order: [
                ['no_urut', 'ASC'] // Urut berdasarkan no urut perangkingan
            ],
            limit: limit_cadangan
        });

        resultData.forEach(item => {
            // Update di dataValues (untuk data utama)
            item.dataValues.id = encodeId(item.dataValues.id);
            item.dataValues.id_pendaftar = encodeId(item.dataValues.id_pendaftar);
            
            // Update juga di root object instance
            item.id = item.dataValues.id;
            item.id_pendaftar = item.dataValues.id_pendaftar;
        });

        // Simpan ke cache
        await redisSet(redis_key, JSON.stringify(resultData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);

        if (is_pdf == 1) {
            return generatePDFResponse(res, resultData, jalur_pendaftaran_id);
        } else {
            const resTimeline = await getTimelineSatuan(6);
            return res.status(200).json({
                status: 1,
                message: 'Data berhasil ditemukan',
                data: resultData,
                timeline: resTimeline
            });
        }

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({
            status: 0,
            message: 'Error'
        });
    }
};

export const getPerangkinganCadanganHitungSisaDaftarUlang = async (req, res) => {
    try {
        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id, 
            jurusan_id,
            nisn,
            is_pdf
        } = req.body;

        const redis_key = `perangkingan_cadangan_diterima_:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;

        const cached = await redisGet(redis_key);
        if (cached) {
            const resultData = JSON.parse(cached);
            
            if (is_pdf == 1) {
                return generatePDFResponse(res, resultData, jalur_pendaftaran_id);
            } else {
                const resTimeline = await getTimelineSatuan(6);
                return res.status(200).json({
                    status: 1,
                    message: 'Data berhasil ditemukan (from cache)',
                    data: resultData,
                    timeline: resTimeline
                });
            }
        }

        const whereClauseDiterima = {
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            is_saved: 1,
            is_diterima: 1,
            is_delete: 0
        };
        
        // Tambahkan filter jurusan jika ada
       if (jurusan_id) {
            whereClauseDiterima.jurusan_id = jurusan_id;  // Changed from whereClause to whereClauseDiterima
        }
        
        // Hitung total yang diterima
        const totalDiterima = await DataPerangkingans.count({
            where: whereClauseDiterima
        });
        
        // Hitung yang daftar ulang
        const totalDaftarUlang = await DataPerangkingans.count({
            where: {
                ...whereClauseDiterima,
                is_daftar_ulang: 1
            }
        });
        
        // Hitung selisih yang tidak daftar ulang
        // const totalTidakDaftarUlang = totalDiterima - totalDaftarUlang;
        const totalTidakDaftarUlang = Math.max(
            (totalDiterima || 0) - (totalDaftarUlang || 0),
            0
        );
 
        // 2. Jika tidak ada di cache, ambil dari database
        const whereClause = {
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            is_saved: 1,
            is_diterima: 2,
            is_daftar_ulang: 0,
            is_delete: 0
        };

        // Tambahkan filter jurusan jika ada (untuk SMK)
        if (jurusan_id) {
            whereClause.jurusan_id = jurusan_id;
        }

        // Pertama hitung jumlah data yang memenuhi kriteria
        const count = await DataPerangkingans.count({
            where: whereClause
        });

        // let limit_cadangan = limitasi_cadangan - count;

        // let limit_cadangan = limitasi_cadangan - count; // Hasil: NaN
        // limit_cadangan = isNaN(limit_cadangan) ? 0 : limit_cadangan;

        let limit_cadangan = totalTidakDaftarUlang;

        console.log('Limit Cadangan'+limit_cadangan); // Output: 0

        const whereClause2 = {
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            is_saved: 1,
            is_diterima: 2,
            is_delete: 0
        };

        if (jurusan_id) {
            whereClause2.jurusan_id = jurusan_id;
        }

        const resultData = await DataPerangkingans.findAll({
            include: [
                    // {
                    //     model: SekolahTujuan,
                    //     as: 'sekolah_tujuan',
                    //     attributes: ['npsn', 'nama']
                    // },
                    // {
                    //     model: SekolahJurusan,
                    //     as: 'sekolah_jurusan',
                    //     attributes: ['id', 'nama_jurusan']
                    // },
                    // {
                    //     model: JalurPendaftarans,
                    //     as: 'jalur_pendaftaran',
                    //     attributes: ['bentuk_pendidikan_id', 'nama']
                    // },
                    {
                        model: DataPendaftars,
                        as: 'data_pendaftar',
                        // Tambahkan attributes yang ingin Anda ambil dari DataPendaftars
                        attributes: ['id', 'jenis_kelamin','tempat_lahir','tanggal_lahir', 'nama_sekolah_asal', 'no_wa', 'nama_kejuaraan', 'nomor_sertifikat', 'alamat'], // sesuaikan dengan kebutuhan
                        include: [
                    {
                        model: StatusDomisilis,
                        as: 'status_domisili_name',
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
                    },{
                        model: JenisKejuaraans,
                        as: 'jenis_kejuaraan',
                        attributes: ['nama']
                    },
                    {  
                        model: WilayahVerDapodik,  
                        as: 'data_wilayah_mutasi',  
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']  
                    },  
                ],
                    }
                ],
            where: whereClause2,
            order: [
                ['no_urut', 'ASC'] // Urut berdasarkan no urut perangkingan
            ],
            limit: limit_cadangan
        });

        resultData.forEach(item => {
            // Update di dataValues (untuk data utama)
            item.dataValues.id = encodeId(item.dataValues.id);
            item.dataValues.id_pendaftar = encodeId(item.dataValues.id_pendaftar);
            
            // Update juga di root object instance
            item.id = item.dataValues.id;
            item.id_pendaftar = item.dataValues.id_pendaftar;
        });

        // Simpan ke cache
        await redisSet(redis_key, JSON.stringify(resultData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);

        if (is_pdf == 1) {
            return generatePDFResponse(res, resultData, jalur_pendaftaran_id);
        } else {
            const resTimeline = await getTimelineSatuan(6);
            return res.status(200).json({
                status: 1,
                message: 'Data berhasil ditemukan',
                data: resultData,
                timeline: resTimeline
            });
        }

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({
            status: 0,
            message: 'Error'
        });
    }
};

export const getPerangkinganCadanganHitungSisaDaftarUlangAdmin = async (req, res) => {
    try {
        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id, 
            jurusan_id,
            nisn,
            is_pdf
        } = req.body;

        const redis_key = `perangkingan_daftar_ulang_cadangan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;

         //1. Cek cache Redis terlebih dahulu
        const cached = await redisGet(redis_key);
        if (cached) {
            const resultData = JSON.parse(cached);
            
            if (is_pdf == 1) {
                // return generatePDFResponse(res, resultData, jalur_pendaftaran_id);
            } else {
                const resTimeline = await getTimelineSatuan(8);
                return res.status(200).json({
                    status: 1,
                    message: 'Data berhasil ditemukan (from cache)',
                    data: resultData,
                    timeline: resTimeline
                });
            }
        }

        const whereClauseDiterima = {
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            is_saved: 1,
            is_diterima: 1,
            is_delete: 0
        };
        
        // Tambahkan filter jurusan jika ada
        if (jurusan_id) {
            whereClauseDiterima.jurusan_id = jurusan_id;
        }
        
        // Hitung total yang diterima
        const totalDiterima = await DataPerangkingans.count({
            where: whereClauseDiterima
        });
        
        // Hitung yang daftar ulang
        const totalDaftarUlang = await DataPerangkingans.count({
            where: {
                ...whereClauseDiterima,
                is_daftar_ulang: 1
            }
        });
        
        // Hitung selisih yang tidak daftar ulang
        // const totalTidakDaftarUlang = totalDiterima - totalDaftarUlang;
        const totalTidakDaftarUlang = Math.max(
            (totalDiterima || 0) - (totalDaftarUlang || 0),
            0
        );
 
        // 2. Jika tidak ada di cache, ambil dari database
        const whereClause = {
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            is_saved: 1,
            is_diterima: 2,
            is_daftar_ulang: 0,
            is_delete: 0
        };

        // Tambahkan filter jurusan jika ada (untuk SMK)
        if (jurusan_id) {
            whereClause.jurusan_id = jurusan_id;
        }

        // Pertama hitung jumlah data yang memenuhi kriteria
        const count = await DataPerangkingans.count({
            where: whereClause
        });

        // let limit_cadangan = limitasi_cadangan - count;

        // let limit_cadangan = limitasi_cadangan - count; // Hasil: NaN
        // limit_cadangan = isNaN(limit_cadangan) ? 0 : limit_cadangan;

        let limit_cadangan = totalTidakDaftarUlang;

        console.log('Limit Cadangan'+limit_cadangan); // Output: 0

        const whereClause2 = {
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            is_saved: 1,
            is_diterima: 2,
            is_delete: 0
        };

        if (jurusan_id) {
            whereClause2.jurusan_id = jurusan_id;
        }

        const resultData = await DataPerangkingans.findAll({
            where: whereClause2,
            order: [
                ['no_urut', 'ASC'] // Urut berdasarkan no urut perangkingan
            ],
            limit: limit_cadangan
        });

        resultData.forEach(item => {
            // Update di dataValues (untuk data utama)
            item.dataValues.id = encodeId(item.dataValues.id);
            item.dataValues.id_pendaftar = encodeId(item.dataValues.id_pendaftar);
            
            // Update juga di root object instance
            item.id = item.dataValues.id;
            item.id_pendaftar = item.dataValues.id_pendaftar;
        });

        // Simpan ke cache
        // await redisSet(redis_key, JSON.stringify(resultData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
        await redisSet(redis_key, JSON.stringify(resultData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);

        if (is_pdf == 1) {
            return generatePDFResponse(res, resultData, jalur_pendaftaran_id);
        } else {
            const resTimeline = await getTimelineSatuan(6);
            return res.status(200).json({
                status: 1,
                message: 'Data berhasil ditemukan',
                data: resultData,
                timeline: resTimeline
            });
        }

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({
            status: 0,
            message: 'Error'
        });
    }
};

// Fungsi helper untuk generate PDF
const generatePDFResponse = (res, data, jalurId) => {
    const currentDateTime = new Date().toLocaleString("id-ID", {
        year: "numeric",
        month: "long", 
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    const docDefinition = {
        content: [
            { text: 'Perangkingan Pendaftaran', style: 'header' },
            { text: `Jalur Pendaftaran: ${jalurId}`, style: 'subheader' },
            { text: `Data Per Tanggal: ${currentDateTime}`, style: 'subheader' },
            { text: 'Data Perangkingan:', style: 'subheader' },
            {
                table: {
                    body: [
                        ['No', 'ID Pendaftar', 'Nama Lengkap', 'Nilai Akhir', 'Jarak (m)'],
                        ...data.map((item, index) => [
                            index + 1,
                            item.no_pendaftaran,
                            item.nama_lengkap,
                            item.nilai_akhir >= 100 ? `***` : item.nilai_akhir,
                            item.jarak
                        ])
                    ]
                }
            }
        ],
        styles: {
            header: {
                fontSize: 18,
                bold: true,
                margin: [0, 0, 0, 10]
            },
            subheader: {
                fontSize: 14,
                bold: true,
                margin: [0, 10, 0, 5]
            }
        }
    };

    const pdfDoc = pdfMake.createPdf(docDefinition);
    pdfDoc.getBase64((data) => {
        const buffer = Buffer.from(data, 'base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=perangkingan.pdf');
        res.send(buffer);
    });
};


//potensi 
export const getPotensiPerangkingan = async (req, res) => {
    try {
        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id, 
            jurusan_id,
            nisn,
            is_pdf
        } = req.body;

        // Buat Redis key dengan format yang jelas
        // const redis_key = `perangkingan:${jalur_pendaftaran_id}--${sekolah_tujuan_id}--${jurusan_id || 0}`;
        const redis_key = `perangkingan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;
        const redis_key_full = `FULL_perangkingan:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;


        const WAKTU_CAHCE_JURNAL = await checkWaktuCachePerangkingan();

        // 1. Selalu cek Redis terlebih dahulu untuk semua request
        const cached = await redisGet(redis_key);
        let resultData;
        let fromCache = false;

        if (cached) {

            let kuotanya;
            if(bentuk_pendidikan_id == 13){
                 kuotanya = await getSekolahTujuanById1(sekolah_tujuan_id);
            }
            if(bentuk_pendidikan_id == 15){
                 kuotanya = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id);
            }
            resultData = JSON.parse(cached);
            fromCache = true;
            console.log(`[REDIS] Cache ditemukan untuk key: ${redis_key}`);

              const kuotaAll = kuotanya.daya_tampung;
              let nama_jalur;
              let kuota_angka;
              if(jalur_pendaftaran_id == 1){
                nama_jalur = 'Domisili Reguler SMA';
                kuota_angka = kuotanya.kuota_zonasi;
              }else  if(jalur_pendaftaran_id == 2){
                nama_jalur = 'Domisili Khusus SMA';
                kuota_angka = kuotanya.kuota_zonasi_khusus;
              }else  if(jalur_pendaftaran_id == 3){
                nama_jalur = 'Prestasi SMA';
                 kuota_angka = kuotanya.kuota_prestasi;
              }else  if(jalur_pendaftaran_id == 4){
                nama_jalur = 'Mutasi SMA';
                 kuota_angka = kuotanya.kuota_mutasi;
              }else  if(jalur_pendaftaran_id == 5){
                nama_jalur = 'Afirmasi SMA';
                 kuota_angka = kukuotanyaota.kuota_afirmasi;
              }else  if(jalur_pendaftaran_id == 6){
                nama_jalur = 'Seleksi Terdekan SMK';
                 kuota_angka = kuotanya.kuota_domisili_terdekat;
              }else  if(jalur_pendaftaran_id == 7){
                nama_jalur = 'Seleksi Prestasi SMK';
                 kuota_angka = kuotanya.kuota_prestasi;
              }else  if(jalur_pendaftaran_id == 8){
                nama_jalur = 'Seleksi Prestasi Khusus SMK';
                 kuota_angka = kuotanya.kuota_prestasi_khusus;
              }else  if(jalur_pendaftaran_id == 9){
                nama_jalur = 'Seleksi Afirmasi SMK';
                 kuota_angka = kuotanya.kuota_afirmasi;
              }else{
                 nama_jalur = '-';
                 kuota_angka = 0;
              }
              
            
            // Hitung statistik dari data
                const totalData = resultData.length;

                 const sisaKuota = Math.max(kuota_angka - totalData, 0);
                //  const sisaKuota = 0;

               // Hitung CPD berprestasi (nilai >= 300)
                const jumlah_cmb_berprestasi_prioritas_diterima = resultData.filter(item => 
                    item.nilai_akhir >= 300
                ).length;

                // const jumlah_cmb_berprestasi_prioritas_diterima = 0;
                
                // Nilai Raport
                const nilaiRaport = resultData.map(item => item.nilai_raport);
                const nilaiRaportTertinggi = Math.max(...nilaiRaport);
                const nilaiRaportTerendah = Math.min(...nilaiRaport);
                const nilaiRaportRataRata = nilaiRaport.reduce((a, b) => a + b, 0) / totalData;
                
                // Nilai Prestasi
                const nilaiPrestasi = resultData.map(item => item.nilai_prestasi);
                const nilaiPrestasiTertinggi = Math.max(...nilaiPrestasi);
                const nilaiPrestasiTerendah = Math.min(...nilaiPrestasi);
                const nilaiPrestasiRataRata = nilaiPrestasi.reduce((a, b) => a + b, 0) / totalData;
                
                // Nilai Akhir
                const nilaiAkhir = resultData.map(item => item.nilai_akhir);
                const nilaiAkhirTertinggi = Math.max(...nilaiAkhir);
                const nilaiAkhirTerendah = Math.min(...nilaiAkhir);
                const nilaiAkhirRataRata = nilaiAkhir.reduce((a, b) => a + b, 0) / totalData;

                // Umur
                const umur = resultData.map(item => item.umur);
                const umurTertua = Math.max(...umur);
                const umurTermuda = Math.min(...umur);
                const umurRataRata = umur.reduce((a, b) => a + b, 0) / totalData;
                
                // Jarak (konversi ke number karena dalam string)
                const jarak = resultData.map(item => parseFloat(item.jarak));
                const jarakTerjauh = Math.max(...jarak);
                const jarakTerdekat = Math.min(...jarak);
                const jarakRataRata = jarak.reduce((a, b) => a + b, 0) / totalData;

                const datasNya = {
                    daya_tampung: kuotaAll,
                    total_pendaftar: totalData,
                    nama_jalur: nama_jalur,
                    kuota_jalur: kuota_angka,
                    sisa_kuota: sisaKuota,
                    jumlah_cmb_berprestasi_prioritas_diterima: jumlah_cmb_berprestasi_prioritas_diterima,
                    // nilai_raport: {
                    //     tertinggi: nilaiRaportTertinggi,
                    //     terendah: nilaiRaportTerendah,
                    //     rata_rata: nilaiRaportRataRata.toFixed(2)
                    // },
                    // nilai_prestasi: {
                    //     tertinggi: nilaiPrestasiTertinggi,
                    //     terendah: nilaiPrestasiTerendah,
                    //     rata_rata: nilaiPrestasiRataRata.toFixed(2)
                    // },
                    nilai_akhir: {
                        tertinggi: nilaiAkhirTertinggi,
                        terendah: nilaiAkhirTerendah,
                        rata_rata: nilaiAkhirRataRata.toFixed(2)
                    },
                    umur: {
                        tertua: umurTertua,
                        termuda: umurTermuda,
                        rata_rata: parseFloat(umurRataRata.toFixed(2))
                    },
                    jarak: {
                        terjauh: parseFloat(jarakTerjauh.toFixed(2)),
                        terdekat: parseFloat(jarakTerdekat.toFixed(2)),
                        rata_rata: parseFloat(jarakRataRata.toFixed(2))
                    }
                };
                
                return res.status(200).json({
                    'status': 1,
                    'message': 'Data',
                    'data': datasNya,
                    'waktu_cache': WAKTU_CAHCE_JURNAL,
                });
        }else{

                res.status(401).json({
                    'status': 0,
                    'message': 'Data Kosong'
                });

        }


    } catch (err) {
        console.error('Error:AZZZU', err);
        res.status(500).json({
            'status': 0,
            'message': 'Error'
        });
    }
}

export const getMonitoringSMA = async (req, res) => {
 
    try {
    // Ambil semua sekolah SMA (bentuk_pendidikan_id = 13)
    const sekolahList = await getSekolahTujuanAllWay();
    const sekolahSMA = sekolahList.filter(sekolah => sekolah.bentuk_pendidikan_id === 13);
    
    if (!sekolahSMA.length) {
      return res.status(404).json({
        status: 0,
        message: 'Tidak ada sekolah SMA ditemukan'
      });
    }

    const result = [];
    const jalurIds = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // Semua jalur pendaftaran

    // Proses data setiap sekolah
    for (const sekolah of sekolahSMA) {
      const sekolahData = {
        sekolah_id: sekolah.id,
        nama_sekolah: sekolah.nama,
        jalur: []
      };

      // Proses setiap jalur
      for (const jalurId of jalurIds) {
        // Format key Redis sesuai dengan yang digunakan di sistem
        const redisKey = `perangkingan:jalur:${jalurId}--sekolah:${sekolah.id}--jurusan:0`;
        
        // Ambil data dari Redis
        const cachedData = await redisGet(redisKey);
        
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          
          // Ambil kuota sekolah
          const kuotaData = await getSekolahTujuanById1(sekolah.id);
          
          // Hitung statistik
          const totalPendaftar = parsedData.length;
          const kuotaJalur = getKuotaByJalur(jalurId, kuotaData);
          const sisaKuota = Math.max(kuotaJalur - totalPendaftar, 0);
          
          const nilaiAkhir = parsedData.map(item => item.nilai_akhir);
          const nilaiAkhirTertinggi = Math.max(...nilaiAkhir);
          const nilaiAkhirTerendah = Math.min(...nilaiAkhir);
          const nilaiAkhirRataRata = (nilaiAkhir.reduce((a, b) => a + b, 0) / totalPendaftar).toFixed(2);
          
          const jarak = parsedData.map(item => parseFloat(item.jarak));
          const jarakTerjauh = Math.max(...jarak);
          const jarakTerdekat = Math.min(...jarak);
          const jarakRataRata = (jarak.reduce((a, b) => a + b, 0) / totalPendaftar).toFixed(2);
          
          const umur = parsedData.map(item => item.umur);
          const umurTertua = Math.max(...umur);
          const umurTermuda = Math.min(...umur);
          const umurRataRata = (umur.reduce((a, b) => a + b, 0) / totalPendaftar).toFixed(2);
          
          const berprestasi = parsedData.filter(item => item.nilai_akhir >= 300).length;
          
          // Format nama jalur
          const namaJalur = getNamaJalur(jalurId);
          
          sekolahData.jalur.push({
            jalur_id: jalurId,
            nama_jalur: namaJalur,
            daya_tampung: kuotaData.daya_tampung,
            kuota_jalur: kuotaJalur,
            sisa_kuota: sisaKuota,
            total_pendaftar: totalPendaftar,
            jumlah_berprestasi: berprestasi,
            nilai_akhir: {
              tertinggi: nilaiAkhirTertinggi,
              terendah: nilaiAkhirTerendah,
              rata_rata: nilaiAkhirRataRata
            },
            jarak: {
              terjauh: jarakTerjauh,
              terdekat: jarakTerdekat,
              rata_rata: jarakRataRata
            },
            umur: {
              tertua: umurTertua,
              termuda: umurTermuda,
              rata_rata: umurRataRata
            }
          });
        }
      }

      if (sekolahData.jalur.length > 0) {
        result.push(sekolahData);
      }
    }

    res.status(200).json({
      status: 1,
      message: 'Data potensi perangkingan SMA',
      data: result,
      total_sekolah: result.length
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      status: 0,
      message: 'Terjadi kesalahan server'
    });
  }


  // Helper function untuk mendapatkan kuota berdasarkan jalur
function getKuotaByJalur(jalurId, kuotaData) {
  switch(jalurId) {
    case 1: return kuotaData.kuota_zonasi;
    case 2: return kuotaData.kuota_zonasi_khusus;
    case 3: return kuotaData.kuota_prestasi;
    case 4: return kuotaData.kuota_mutasi;
    case 5: return kuotaData.kuota_afirmasi;
    case 6: return kuotaData.kuota_domisili_terdekat;
    case 7: return kuotaData.kuota_prestasi;
    case 8: return kuotaData.kuota_prestasi_khusus;
    case 9: return kuotaData.kuota_afirmasi;
    default: return 0;
  }
}

// Helper function untuk mendapatkan nama jalur
function getNamaJalur(jalurId) {
  const jalurMap = {
    1: 'Domisili Reguler SMA',
    2: 'Domisili Khusus SMA',
    3: 'Prestasi SMA',
    4: 'Mutasi SMA',
    5: 'Afirmasi SMA',
    6: 'Seleksi Terdekat SMK',
    7: 'Seleksi Prestasi SMK',
    8: 'Seleksi Prestasi Khusus SMK',
    9: 'Seleksi Afirmasi SMK'
  };
  return jalurMap[jalurId] || `Jalur ${jalurId}`;
}
};

export const getPerangkinganByLogNisn = async (req, res) => {
    try {
        const { nisn } = req.body;

        if (!nisn) {
            return res.status(400).json({
                status: 0,
                message: 'NISN is required'
            });
        }

        // Fetch the data
        const resData = await DataPerangkingans.findAll({
            where: {
                nisn: nisn
            },
            attributes: [
                'nisn',
                'nama_lengkap',
                'no_pendaftaran',
                'is_delete',
                'created_at'
            ],
            include: [
                {
                    model: SekolahTujuan,
                    as: 'sekolah_tujuan',
                    attributes: ['nama']
                },
                {
                    model: JalurPendaftarans,
                    as: 'jalur_pendaftaran',
                    attributes: ['nama']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Format the response
        const formattedData = resData.map(item => {
            const jsonItem = item.toJSON();
            return {
                nisn: jsonItem.nisn,
                nama_lengkap: jsonItem.nama_lengkap,
                no_pendaftaran: jsonItem.no_pendaftaran,
                nama_sekolah: jsonItem.sekolah_tujuan?.nama,
                jalur: jsonItem.jalur_pendaftaran?.nama,
                status_daftar: jsonItem.is_delete === 1 ? 'batal-daftar' : 'mendaftar',
                created_at: jsonItem.created_at
            };
        });

        if (formattedData.length > 0) {
            res.status(200).json({
                status: 1,
                message: 'Data berhasil ditemukan',
                data: formattedData
            });
        } else {
            res.status(200).json({
                status: 0,
                message: 'Data tidak ditemukan',
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

export const getPerangkinganByLogPendaftaran = async (req, res) => {
    try {
        const { no_pendaftaran } = req.body;

        if (!no_pendaftaran) {
            return res.status(400).json({
                status: 0,
                message: 'NISN is required'
            });
        }

        // Fetch the data
        const resData = await DataPerangkingans.findAll({
            where: {
                no_pendaftaran: no_pendaftaran
            },
            attributes: [
                'nisn',
                'nama_lengkap',
                'no_pendaftaran',
                'is_delete',
                'created_at'
            ],
            include: [
                {
                    model: SekolahTujuan,
                    as: 'sekolah_tujuan',
                    attributes: ['nama']
                },
                {
                    model: JalurPendaftarans,
                    as: 'jalur_pendaftaran',
                    attributes: ['nama']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Format the response
        const formattedData = resData.map(item => {
            const jsonItem = item.toJSON();
            return {
                nisn: jsonItem.nisn,
                nama_lengkap: jsonItem.nama_lengkap,
                no_pendaftaran: jsonItem.no_pendaftaran,
                nama_sekolah: jsonItem.sekolah_tujuan?.nama,
                jalur: jsonItem.jalur_pendaftaran?.nama,
                status_daftar: jsonItem.is_delete === 1 ? 'batal-daftar' : 'mendaftar',
                created_at: jsonItem.created_at
            };
        });

        if (formattedData.length > 0) {
            res.status(200).json({
                status: 1,
                message: 'Data berhasil ditemukan',
                data: formattedData
            });
        } else {
            res.status(200).json({
                status: 0,
                message: 'Data tidak ditemukan',
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