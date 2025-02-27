import { check, validationResult } from 'express-validator';
import DataPendaftars from "../../models/service/DataPendaftarModel.js";
import DataPerangkingans from "../../models/service/DataPerangkinganModel.js";
import Zonasis from "../../models/service/ZonasiModel.js";
import SekolahZonasis from "../../models/service/SekolahZonasiModel.js";
import FileTambahans from "../../models/master/FileTambahanModel.js";
import SekolahTujuan from '../../models/master/SekolahTujuanModel.js';
import SekolahJurusan from "../../models/master/SekolahJurusanModel.js";
import JalurPendaftarans from '../../models/master/JalurPendaftaranModel.js';
import WilayahVerDapodik from '../../models/master/WilayahVerDapodikModel.js';
import StatusDomisilis from '../../models/master/StatusDomisiliModel.js';
import Timelines from "../../models/service/TimelineModel.js";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { encodeId, decodeId } from '../../middleware/EncodeDecode.js';
import { Sequelize, Op, literal } from 'sequelize';

import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";

pdfMake.vfs = pdfFonts?.default?.vfs || pdfFonts.vfs;


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
                const jsonItem = item.toJSON();
                jsonItem.id_perangkingan_ = encodeId(item.id); // Add the encoded ID to the response
                jsonItem.id_pendaftar_ = encodeId(item.id_pendaftar); // Add the encoded ID to the response
                delete jsonItem.id; // Hapus kolom id dari output JSON
                delete jsonItem.id_pendaftar; // Hapus kolom id dari output JSON
            
                return jsonItem;
            });

        // }else{

        //     const resData = 0;

        // }

        const resTimeline = await Timelines.findOne({
            where: {
                id: 6,
            },
        });

        // Check if data is found
        if (resData && resData.length > 0) {
            res.status(200).json({
                status: 1,
                message: 'Data berhasil ditemukan',
                data: resDatas,
                timeline: resTimeline
            });
        } else {
            res.status(200).json({
                status: 0,
                message: 'Data kosong',
                data: [],
                timeline: resTimeline
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
        const { id_perangkingan } = req.body;

        // Decode the ID
        const decodedIdPerangkingan = decodeId(id_perangkingan);

        // Fetch the data
        const resData = await DataPerangkingans.findOne({
            where: {
                id: decodedIdPerangkingan, // Pastikan id_pendaftar adalah string
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


        // Check if data is found
        if (resData) {

            const profil = await DataPendaftars.findOne({
                where: {
                  id: resData.id_pendaftar,
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
                    }
                ],
            });

             // Convert to JSON and remove the id from profil
             const jsonProfil = profil ? profil.toJSON() : null;
             if (jsonProfil) {
                 delete jsonProfil.id;
             }

            const jsonItem = resData.toJSON();
            jsonItem.id_perangkingan_ = encodeId(jsonItem.id); // Add the encoded ID to the response
            jsonItem.data_pendaftar = jsonProfil;
            delete jsonItem.id; // Remove the original ID from the output

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

export const getPerangkinganBAK = async (req, res) => {

    try {

        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            jurusan_id,
            nisnxw,
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
                    // ['jarak', 'ASC'], //jarak terendah
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] //daftar sekolah terawal
                ]
                
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
export const getPerangkinganBeforeEdit = async (req, res) => {

    try {

        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            jurusan_id,
            nisn,
        } = req.body;
        
        const resTimeline = await Timelines.findOne({
            where: {
                id: 6,
            },
        });
        
        if(jalur_pendaftaran_id == 1){
 
            //Jalur Zonasi Reguler SMA

            const resSek = await SekolahTujuan.findOne({
                where: {
                    id : sekolah_tujuan_id,
                }
            });

            let kuota_zonasi_max = resSek.daya_tampung;
            let kuota_zonasi_min = resSek.kuota_zonasi;

            //hitung total pendaftar prestasi dulu
            const countPrestasi = await DataPerangkingans.count({  
                where: {  
                    jalur_pendaftaran_id: 3,
                    sekolah_tujuan_id,  
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition  
                },
                limit: resSek.kuota_prestasi
            });

             //hitung total pendaftar afirmasi dulu
             const countAfirmasi = await DataPerangkingans.count({  
                where: {  
                    jalur_pendaftaran_id: 5,
                    sekolah_tujuan_id,  
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition   
                },
                limit: resSek.kuota_afirmasi
            });

             //hitung total pendaftar pto dulu
             const countPto = await DataPerangkingans.count({  
                where: {  
                    jalur_pendaftaran_id: 4,
                    sekolah_tujuan_id,  
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition    
                },
                limit: resSek.kuota_afirmasi
            });

            let kuota_zonasi = kuota_zonasi_max - countPrestasi - countAfirmasi - countPto;

            
            let kuota_zonasi_akhir; // Menggunakan let untuk scope blok  
            if(kuota_zonasi >= kuota_zonasi_min){
                kuota_zonasi_akhir = kuota_zonasi;
            }else{
                kuota_zonasi_akhir = kuota_zonasi_min;
            }

            const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition  
                },
                order: [
                    // ['jarak', 'ASC'], //jarak terendah
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] //daftar sekolah terawal
                ],
                limit: kuota_zonasi_akhir
                
            });

            if (resData && resData.length > 0) {

               

                const modifiedData = resData.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                });

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': modifiedData, // Return the found data
                    'timeline' : resTimeline
                });
            } else {
                res.status(200).json({
                    'status': 0,
                    'message': 'Data kosong',
                    'data': [], // Return null or an appropriate value when data is not found
                    'timeline': resTimeline // Return the found data
                });
            }

        }else if(jalur_pendaftaran_id == 2){
            //Jalur Zonasi KHUSUS SMA

            const resSek = await SekolahTujuan.findOne({
                where: {
                    id : sekolah_tujuan_id,
                }
            });

            let kuota_zonasi_khusus = resSek.kuota_zonasi_khusus;


            const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                    
                },
                order: [
                    ['umur', 'DESC'], //umur tertua
                    ['nilai_akhir', 'DESC'], //jarak terendah  
                    ['created_at', 'ASC'] //daftar sekolah terawal
                ],
                limit: kuota_zonasi_khusus
            });

            if (resData) { // Check if resData is not null
                // res.status(200).json({
                //     'status': 1,
                //     'message': 'Data berhasil ditemukan',
                //     'data': resData // Return the found data
                // });

                const modifiedData = resData.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    // return { ...rest, id: encodeId(id) };
                    return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                });

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': modifiedData,
                    'timeline': resTimeline// Return the found data
                });


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

            const resSek = await SekolahTujuan.findOne({
                where: {
                    id : sekolah_tujuan_id,
                }
            });

            let kuota_prestasi = resSek.kuota_prestasi;

             const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                },
                order: [
                    ['nilai_akhir', 'DESC'], //nilai tertinggi
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] // daftar sekolah terawal
                ],
                limit: kuota_prestasi
               
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

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': modifiedData,
                    'timeline': resTimeline // Return the found data
                });
            } else {
                res.status(200).json({
                    'status': 0,
                    'message': 'Data kosong',
                    'data': [], // Return null or an appropriate value when data is not found
                    'timeline': resTimeline // Return the found data
                });
            }


        }else if(jalur_pendaftaran_id == 4){
            //Jalur PTO SMA
            const resSek = await SekolahTujuan.findOne({
                where: {
                    id : sekolah_tujuan_id,
                }
            });

            let kuota_pto = resSek.kuota_pto;

            const resData = await DataPerangkingans.findAll({
               where: {
                   jalur_pendaftaran_id,
                   sekolah_tujuan_id,
                   is_anak_guru_jateng: '1',
                   is_delete: 0,
                   is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
               },
               order: [
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] //daftar sekolah terawal
                  ],
                limit: kuota_pto
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

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': modifiedData,
                    'timeline': resTimeline // Return the found data
                });
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

            const resSek = await SekolahTujuan.findOne({
                where: {
                    id : sekolah_tujuan_id,
                }
            });

            let kuota_afirmasi = resSek.kuota_afirmasi;

            const resData = await DataPerangkingans.findAll({
            where: {
                jalur_pendaftaran_id,
                sekolah_tujuan_id,
                is_delete: 0,
                is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
            },
            order: [
                [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                ['umur', 'DESC'], //umur tertua
                ['created_at', 'ASC'] //daftar sekolah terawal
            ],
            limit: kuota_afirmasi
           
            });
            if (resData) { // Check if resData is not null
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

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': modifiedData, // Return the found data
                    'timeline': resTimeline
                });

            } else {
                res.status(200).json({
                    'status': 0,
                    'message': 'Data kosong',
                    'data': [], // Return null or an appropriate value when data is not found
                    'timeline': resTimeline // Return the found data
                });
            }
        }else if(jalur_pendaftaran_id == 6){
            //Jalur SMK Terdekat
                const resJurSek = await SekolahJurusan.findOne({
                    where: {
                        id_sekolah_tujuan : sekolah_tujuan_id,
                        id : jurusan_id,
                    }
                });
                
                let kuota_jarak_terdekat = resJurSek.kuota_jarak_terdekat;

                const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    jurusan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                }, order: [
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    ['nilai_akhir', 'DESC'], //nilai tertinggi
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] // daftar sekolah terawal
                ],
                limit: kuota_jarak_terdekat
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
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': modifiedData, // Return the found data
                        'timeline': resTimeline
                    });
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
        }else if(jalur_pendaftaran_id == 7){
            //Jalur SMK Prestasi

                const resJurSek = await SekolahJurusan.findOne({
                    where: {
                        id_sekolah_tujuan : sekolah_tujuan_id,
                        id : jurusan_id,
                    }
                });

                let kuota_prestasi_max = resJurSek.daya_tampung;
                let kuota_prestasi_min = resJurSek.kuota_prestasi;
    
                //hitung total pendaftar domisili terdekat smk dulu,
                const countTerdekat = await DataPerangkingans.count({  
                    where: {  
                        jalur_pendaftaran_id: 6,
                        sekolah_tujuan_id,  
                        jurusan_id,
                        is_delete: 0  ,
                        is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                    },
                    limit: resJurSek.kuota_jarak_terdekat
                });

                //hitung total pendaftar afirmasi smk dulu,
                const countAfirmasi = await DataPerangkingans.count({  
                    where: {  
                        jalur_pendaftaran_id: 9,
                        sekolah_tujuan_id,  
                        jurusan_id,
                        is_delete: 0 ,
                        is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition   
                    },
                    limit: resJurSek.kuota_jarak_terdekat
                });

                // let kuota_prestasi = resJurSek.kuota_prestasi;
                let kuota_prestasi = kuota_prestasi_max - countTerdekat - countAfirmasi;

            
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
                if (resData && resData.length > 0) {
    
                   
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                    });
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': modifiedData, // Return the found data
                        'timeline': resTimeline
                    });
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

                const resJurSek = await SekolahJurusan.findOne({
                    where: {
                        id_sekolah_tujuan : sekolah_tujuan_id,
                        id : jurusan_id,
                    }
                });

                let kuota_prestasi_khusus = resJurSek.kuota_prestasi_khusus;

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
                limit: kuota_prestasi_khusus
                });
                if (resData && resData.length > 0) {
                   
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                        
                    });
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': modifiedData, // Return the found data
                        'timeline': resTimeline
                    });
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
                const resJurSek = await SekolahJurusan.findOne({
                    where: {
                        id_sekolah_tujuan : sekolah_tujuan_id,
                        id : jurusan_id,
                    }
                });

                let kuota_afirmasi = resJurSek.kuota_afirmasi;

                const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    jurusan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                    [Op.or]: [  
                        { is_anak_panti: { [Op.ne]: '0' } },  // Check if is_anak_panti is not equal to '0'  
                        { is_anak_keluarga_tidak_mampu: { [Op.ne]: '0' } },  // Check if is_anak_keluarga_tidak_mampu is not equal to '0'   di di view is_dtks
                        // { is_pip: { [Op.ne]: '0' } }  // Check if is_pip is not equal to '0'  
                    ]                     
                }, order: [
                    ['nilai_akhir', 'DESC'], //nilai tertinggi
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] // daftar sekolah terawal
                ],
                limit: kuota_afirmasi
                });
                if (resData && resData.length > 0) {
                    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                    });
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': modifiedData ,// Return the found data
                        'timeline': resTimeline,
                    });
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }

        }else{
            
            res.status(200).json({
                'status': 0,
                'message': 'Ada kesalahan, jalur pendaftaran tidak ditemukan',
                'data': [], // Return null or an appropriate value when data is not found
                'timeline': null // Return the found data
            });
            
                //Jalur Afirmasi SMK Terdekat
                // const resData = await DataPerangkingans.findAll({
                // where: {
                //     jalur_pendaftaran_id,
                //     sekolah_tujuan_id,
                //     is_delete: 0
                // }, order: [
                //     ['jarak', 'ASC'], //nilai tertinggi
                //     ['umur', 'DESC'], //umur tertua
                //     ['created_at', 'ASC'] // daftar sekolah terawal
                // ]
                
                // });
                // if (resData && resData.length > 0) {
                //     // res.status(200).json({
                //     //     'status': 1,
                //     //     'message': 'Data berhasil ditemukan',
                //     //     'data': resData // Return the found data
                //     // });
                //     const modifiedData = resData.map(item => {
                //         const { id_pendaftar, id, ...rest } = item.toJSON();
                //         return { ...rest, id: encodeId(id) };
                //     });
    
                //     res.status(200).json({
                //         'status': 1,
                //         'message': 'Data berhasil ditemukan',
                //         'data': modifiedData // Return the found data
                //     });
                // } else {
                //     res.status(200).json({
                //         'status': 0,
                //         'message': 'Data kosong',
                //         'data': [] // Return null or an appropriate value when data is not found
                //     });
                // }
        }

   

    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({ // Use 500 for server error
            'status': 0,
            'message': 'Error'
        });
    }
}

export const getPerangkingan = async (req, res) => {

    try {

        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            jurusan_id,
            nisn,
            is_pdf // New parameter
        } = req.body;
        
        const resTimeline = await Timelines.findOne({
            where: {
                id: 6,
            },
        });
        
        if(jalur_pendaftaran_id == 1){
 
            //Jalur Zonasi Reguler SMA

            const resSek = await SekolahTujuan.findOne({
                where: {
                    id : sekolah_tujuan_id,
                }
            });

            let kuota_zonasi_max = resSek.daya_tampung;
            let kuota_zonasi_min = resSek.kuota_zonasi;

            //hitung total pendaftar prestasi dulu
            const countPrestasi = await DataPerangkingans.count({  
                where: {  
                    jalur_pendaftaran_id: 3,
                    sekolah_tujuan_id,  
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition  
                },
                limit: resSek.kuota_prestasi
            });

             //hitung total pendaftar afirmasi dulu
             const countAfirmasi = await DataPerangkingans.count({  
                where: {  
                    jalur_pendaftaran_id: 5,
                    sekolah_tujuan_id,  
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition   
                },
                limit: resSek.kuota_afirmasi
            });

             //hitung total pendaftar pto dulu
             const countPto = await DataPerangkingans.count({  
                where: {  
                    jalur_pendaftaran_id: 4,
                    sekolah_tujuan_id,  
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition    
                },
                limit: resSek.kuota_afirmasi
            });

            let kuota_zonasi = kuota_zonasi_max - countPrestasi - countAfirmasi - countPto;

            
            let kuota_zonasi_akhir; // Menggunakan let untuk scope blok  
            if(kuota_zonasi >= kuota_zonasi_min){
                kuota_zonasi_akhir = kuota_zonasi;
            }else{
                kuota_zonasi_akhir = kuota_zonasi_min;
            }

            const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition  
                },
                order: [
                    // ['jarak', 'ASC'], //jarak terendah
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] //daftar sekolah terawal
                ],
                limit: kuota_zonasi_akhir
                
            });

            if (resData && resData.length > 0) {

               

                const modifiedData = resData.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                });

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': modifiedData, // Return the found data
                    'timeline' : resTimeline
                });
            } else {
                res.status(200).json({
                    'status': 0,
                    'message': 'Data kosong',
                    'data': [], // Return null or an appropriate value when data is not found
                    'timeline': resTimeline // Return the found data
                });
            }

        }else if(jalur_pendaftaran_id == 2){
            //Jalur Zonasi KHUSUS SMA

            const resSek = await SekolahTujuan.findOne({
                where: {
                    id : sekolah_tujuan_id,
                }
            });

            let kuota_zonasi_khusus = resSek.kuota_zonasi_khusus;


            const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                    
                },
                order: [
                    ['umur', 'DESC'], //umur tertua
                    ['nilai_akhir', 'DESC'], //jarak terendah  
                    ['created_at', 'ASC'] //daftar sekolah terawal
                ],
                limit: kuota_zonasi_khusus
            });

            if (resData) { // Check if resData is not null
                // res.status(200).json({
                //     'status': 1,
                //     'message': 'Data berhasil ditemukan',
                //     'data': resData // Return the found data
                // });

                const modifiedData = resData.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    // return { ...rest, id: encodeId(id) };
                    return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                });

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': modifiedData,
                    'timeline': resTimeline// Return the found data
                });


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

            const resSek = await SekolahTujuan.findOne({
                where: {
                    id : sekolah_tujuan_id,
                }
            });

            let kuota_prestasi = resSek.kuota_prestasi;

             const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                },
                order: [
                    ['nilai_akhir', 'DESC'], //nilai tertinggi
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] // daftar sekolah terawal
                ],
                limit: kuota_prestasi
               
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

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': modifiedData,
                    'timeline': resTimeline // Return the found data
                });
            } else {
                res.status(200).json({
                    'status': 0,
                    'message': 'Data kosong',
                    'data': [], // Return null or an appropriate value when data is not found
                    'timeline': resTimeline // Return the found data
                });
            }


        }else if(jalur_pendaftaran_id == 4){
            //Jalur PTO SMA
            const resSek = await SekolahTujuan.findOne({
                where: {
                    id : sekolah_tujuan_id,
                }
            });

            let kuota_pto = resSek.kuota_pto;

            const resData = await DataPerangkingans.findAll({
               where: {
                   jalur_pendaftaran_id,
                   sekolah_tujuan_id,
                   is_anak_guru_jateng: '1',
                   is_delete: 0,
                   is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
               },
               order: [
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] //daftar sekolah terawal
                  ],
                limit: kuota_pto
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

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': modifiedData,
                    'timeline': resTimeline // Return the found data
                });
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

            const resSek = await SekolahTujuan.findOne({
                where: {
                    id : sekolah_tujuan_id,
                }
            });

            let kuota_afirmasi = resSek.kuota_afirmasi;

            const resData = await DataPerangkingans.findAll({
            where: {
                jalur_pendaftaran_id,
                sekolah_tujuan_id,
                is_delete: 0,
                is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
            },
            order: [
                [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                ['umur', 'DESC'], //umur tertua
                ['created_at', 'ASC'] //daftar sekolah terawal
            ],
            limit: kuota_afirmasi
           
            });
            if (resData) { // Check if resData is not null
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

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': modifiedData, // Return the found data
                    'timeline': resTimeline
                });

            } else {
                res.status(200).json({
                    'status': 0,
                    'message': 'Data kosong',
                    'data': [], // Return null or an appropriate value when data is not found
                    'timeline': resTimeline // Return the found data
                });
            }
        }else if(jalur_pendaftaran_id == 6){
            //Jalur SMK Terdekat
                const resJurSek = await SekolahJurusan.findOne({
                    where: {
                        id_sekolah_tujuan : sekolah_tujuan_id,
                        id : jurusan_id,
                    }
                });
                
                let kuota_jarak_terdekat = resJurSek.kuota_jarak_terdekat;

                const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    jurusan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                }, order: [
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    ['nilai_akhir', 'DESC'], //nilai tertinggi
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] // daftar sekolah terawal
                ],
                limit: kuota_jarak_terdekat
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
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': modifiedData, // Return the found data
                        'timeline': resTimeline
                    });
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }
        }else if(jalur_pendaftaran_id == 7){
            //Jalur SMK Prestasi

                const resJurSek = await SekolahJurusan.findOne({
                    where: {
                        id_sekolah_tujuan : sekolah_tujuan_id,
                        id : jurusan_id,
                    }
                });

                let kuota_prestasi_max = resJurSek.daya_tampung;
                let kuota_prestasi_min = resJurSek.kuota_prestasi;
    
                //hitung total pendaftar domisili terdekat smk dulu,
                const countTerdekat = await DataPerangkingans.count({  
                    where: {  
                        jalur_pendaftaran_id: 6,
                        sekolah_tujuan_id,  
                        jurusan_id,
                        is_delete: 0  ,
                        is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                    },
                    limit: resJurSek.kuota_jarak_terdekat
                });

                //hitung total pendaftar afirmasi smk dulu,
                const countAfirmasi = await DataPerangkingans.count({  
                    where: {  
                        jalur_pendaftaran_id: 9,
                        sekolah_tujuan_id,  
                        jurusan_id,
                        is_delete: 0 ,
                        is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition   
                    },
                    limit: resJurSek.kuota_jarak_terdekat
                });

                // let kuota_prestasi = resJurSek.kuota_prestasi;
                let kuota_prestasi = kuota_prestasi_max - countTerdekat - countAfirmasi;

            
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
                if (resData && resData.length > 0) {
    
                   
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                    });

                    if (is_pdf === 1) {
                        // Generate PDF
                        const docDefinition = {
                            content: [
                                { text: 'Perangkingan Pendaftaran', style: 'header' },
                                { text: `Jalur Pendaftaran: ${jalur_pendaftaran_id}`, style: 'subheader' },
                                { text: 'Data Perangkingan:', style: 'subheader' },
                                // {
                                //     table: {
                                //         widths: ['auto', '*', '*', '*', '*', '*'],
                                //         body: [
                                //             ['No', 'ID Pendaftar', 'Nama', 'Nilai Akhir', 'Umur', 'Tanggal Daftar'],
                                //             ...modifiedData.map((item, index) => [
                                //                 index + 1,
                                //                 item.id_pendaftar,
                                //                 item.nama,
                                //                 item.nilai_akhir,
                                //                 item.umur,
                                //                 item.created_at
                                //             ])
                                //         ]
                                //     }
                                // }
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

                const resJurSek = await SekolahJurusan.findOne({
                    where: {
                        id_sekolah_tujuan : sekolah_tujuan_id,
                        id : jurusan_id,
                    }
                });

                let kuota_prestasi_khusus = resJurSek.kuota_prestasi_khusus;

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
                limit: kuota_prestasi_khusus
                });
                if (resData && resData.length > 0) {
                   
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                        
                    });
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': modifiedData, // Return the found data
                        'timeline': resTimeline
                    });
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
                const resJurSek = await SekolahJurusan.findOne({
                    where: {
                        id_sekolah_tujuan : sekolah_tujuan_id,
                        id : jurusan_id,
                    }
                });

                let kuota_afirmasi = resJurSek.kuota_afirmasi;

                const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    jurusan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                    [Op.or]: [  
                        { is_anak_panti: { [Op.ne]: '0' } },  // Check if is_anak_panti is not equal to '0'  
                        { is_anak_keluarga_tidak_mampu: { [Op.ne]: '0' } },  // Check if is_anak_keluarga_tidak_mampu is not equal to '0'   di di view is_dtks
                        // { is_pip: { [Op.ne]: '0' } }  // Check if is_pip is not equal to '0'  
                    ]                     
                }, order: [
                    ['nilai_akhir', 'DESC'], //nilai tertinggi
                    ['umur', 'DESC'], //umur tertua
                    ['created_at', 'ASC'] // daftar sekolah terawal
                ],
                limit: kuota_afirmasi
                });
                if (resData && resData.length > 0) {
                    
                    const modifiedData = resData.map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                        // return { ...rest, id: encodeId(id) };
                    });
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': modifiedData ,// Return the found data
                        'timeline': resTimeline,
                    });
                } else {
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': [], // Return null or an appropriate value when data is not found
                        'timeline': resTimeline // Return the found data
                    });
                }

        }else{
            
            res.status(200).json({
                'status': 0,
                'message': 'Ada kesalahan, jalur pendaftaran tidak ditemukan',
                'data': [], // Return null or an appropriate value when data is not found
                'timeline': null // Return the found data
            });
            
                //Jalur Afirmasi SMK Terdekat
                // const resData = await DataPerangkingans.findAll({
                // where: {
                //     jalur_pendaftaran_id,
                //     sekolah_tujuan_id,
                //     is_delete: 0
                // }, order: [
                //     ['jarak', 'ASC'], //nilai tertinggi
                //     ['umur', 'DESC'], //umur tertua
                //     ['created_at', 'ASC'] // daftar sekolah terawal
                // ]
                
                // });
                // if (resData && resData.length > 0) {
                //     // res.status(200).json({
                //     //     'status': 1,
                //     //     'message': 'Data berhasil ditemukan',
                //     //     'data': resData // Return the found data
                //     // });
                //     const modifiedData = resData.map(item => {
                //         const { id_pendaftar, id, ...rest } = item.toJSON();
                //         return { ...rest, id: encodeId(id) };
                //     });
    
                //     res.status(200).json({
                //         'status': 1,
                //         'message': 'Data berhasil ditemukan',
                //         'data': modifiedData // Return the found data
                //     });
                // } else {
                //     res.status(200).json({
                //         'status': 0,
                //         'message': 'Data kosong',
                //         'data': [] // Return null or an appropriate value when data is not found
                //     });
                // }
        }

   

    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({ // Use 500 for server error
            'status': 0,
            'message': 'Error'
        });
    }
}



export const getPerangkinganTes = async (req, res) => {
    try {
        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            jurusan_id,
            // nisn,
        } = req.body;

        const resTimeline = await Timelines.findOne({
            where: {
                id: 6,
            },
        });

        let resData;
        let kuota;
        let countPrestasi;
        let countAfirmasi;
        let countPto;
        let countTerdekat;
        let kuota_zonasi_max;
        let kuota_zonasi_min;
        let kuota_zonasi_khusus;
        let kuota_prestasi;
        let kuota_prestasi_max;
        let kuota_prestasi_min;
        let kuota_pto;
        let kuota_jarak_terdekat;
        let kuota_prestasi_khusus;
        let kuota_afirmasi;

        switch (jalur_pendaftaran_id) {
            case '1':
                // Jalur Zonasi Reguler SMA
                const resSek1 = await SekolahTujuan.findOne({
                    where: {
                        id: sekolah_tujuan_id,
                    },
                });
                console.log('kuota')
                console.log(resSek1.kuota_zonasi);

                countPrestasi = await DataPerangkingans.count({
                    where: {
                        jalur_pendaftaran_id: 3,
                        sekolah_tujuan_id,
                        is_delete: 0,
                    },
                    limit: resSek1.kuota_prestasi,
                });

                countAfirmasi = await DataPerangkingans.count({
                    where: {
                        jalur_pendaftaran_id: 5,
                        sekolah_tujuan_id,
                        is_delete: 0,
                    },
                    limit: resSek1.kuota_afirmasi,
                });

                countPto = await DataPerangkingans.count({
                    where: {
                        jalur_pendaftaran_id: 4,
                        sekolah_tujuan_id,
                        is_delete: 0,
                    },
                    limit: resSek1.kuota_afirmasi,
                });

                kuota_zonasi_max = resSek1.daya_tampung;
                kuota_zonasi_min = resSek1.kuota_zonasi;

                kuota = Math.max(kuota_zonasi_min, kuota_zonasi_max - countPrestasi - countAfirmasi - countPto);
                console.log('kuota by perhitungan')
                console.log(kuota)

                resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                    },
                    order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        ['umur', 'DESC'],
                        ['created_at', 'ASC'],
                    ],
                    limit: kuota,
                });
                break;

            case '2':
                // Jalur Zonasi KHUSUS SMA
                const resSek2 = await SekolahTujuan.findOne({
                    where: {
                        id: sekolah_tujuan_id,
                    },
                });

                kuota_zonasi_khusus = resSek2.kuota_zonasi_khusus;

                kuota = kuota_zonasi_khusus;

                resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                    },
                    order: [
                        ['umur', 'DESC'],
                        ['nilai_akhir', 'DESC'],
                        ['created_at', 'ASC'],
                    ],
                    limit: kuota,
                });
                break;

            case '3':
                // Jalur Prestasi SMA
                const resSek3 = await SekolahTujuan.findOne({
                    where: {
                        id: sekolah_tujuan_id,
                    },
                });

                kuota_prestasi = resSek3.kuota_prestasi;

                kuota = kuota_prestasi;

                resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                    },
                    order: [
                        ['nilai_akhir', 'DESC'],
                        ['umur', 'DESC'],
                        ['created_at', 'ASC'],
                    ],
                    limit: kuota,
                });
                break;

            case '4':
                // Jalur PTO SMA
                const resSek4 = await SekolahTujuan.findOne({
                    where: {
                        id: sekolah_tujuan_id,
                    },
                });

                kuota_pto = resSek4.kuota_pto;

                kuota = kuota_pto;

                resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_anak_guru_jateng: '1',
                        is_delete: 0,
                    },
                    order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        ['umur', 'DESC'],
                        ['created_at', 'ASC'],
                    ],
                    limit: kuota,
                });
                break;

            case '5':
                // Jalur Afirmasi SMA
                const resSek5 = await SekolahTujuan.findOne({
                    where: {
                        id: sekolah_tujuan_id,
                    },
                });

                kuota_afirmasi = resSek5.kuota_afirmasi;

                kuota = kuota_afirmasi;

                resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        is_delete: 0,
                    },
                    order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        ['umur', 'DESC'],
                        ['created_at', 'ASC'],
                    ],
                    limit: kuota,
                });
                break;

            case '6':
                // Jalur SMK Terdekat
                const resJurSek6 = await SekolahJurusan.findOne({
                    where: {
                        id_sekolah_tujuan: sekolah_tujuan_id,
                        id: jurusan_id,
                    },
                });

                kuota_jarak_terdekat = resJurSek6.kuota_jarak_terdekat;

                kuota = kuota_jarak_terdekat;

                resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                    },
                    order: [
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                        ['nilai_akhir', 'DESC'],
                        ['umur', 'DESC'],
                        ['created_at', 'ASC'],
                    ],
                    limit: kuota,
                });
                break;

            case '7':
                // Jalur SMK Prestasi
                const resJurSek7 = await SekolahJurusan.findOne({
                    where: {
                        id_sekolah_tujuan: sekolah_tujuan_id,
                        id: jurusan_id,
                    },
                });

                countTerdekat = await DataPerangkingans.count({
                    where: {
                        jalur_pendaftaran_id: 6,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                    },
                    limit: resJurSek7.kuota_jarak_terdekat,
                });

                countAfirmasi = await DataPerangkingans.count({
                    where: {
                        jalur_pendaftaran_id: 9,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                    },
                    limit: resJurSek7.kuota_jarak_terdekat,
                });

                kuota_prestasi_max = resJurSek7.daya_tampung;
                kuota_prestasi_min = resJurSek7.kuota_prestasi;

                kuota = Math.max(kuota_prestasi_min, kuota_prestasi_max - countTerdekat - countAfirmasi);

                resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                    },
                    order: [
                        ['nilai_akhir', 'DESC'],
                        ['umur', 'DESC'],
                        ['created_at', 'ASC'],
                    ],
                    limit: kuota,
                });
                break;

            case '8':
                // Jalur SMK Prestasi Khusus
                const resJurSek8 = await SekolahJurusan.findOne({
                    where: {
                        id_sekolah_tujuan: sekolah_tujuan_id,
                        id: jurusan_id,
                    },
                });

                kuota_prestasi_khusus = resJurSek8.kuota_prestasi_khusus;

                kuota = kuota_prestasi_khusus;

                resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                    },
                    order: [
                        ['nilai_akhir', 'DESC'],
                        ['umur', 'DESC'],
                        ['created_at', 'ASC'],
                    ],
                    limit: kuota,
                });
                break;

            case '9':
                // Jalur SMK Afirmasi
                const resJurSek9 = await SekolahJurusan.findOne({
                    where: {
                        id_sekolah_tujuan: sekolah_tujuan_id,
                        id: jurusan_id,
                    },
                });

                kuota_afirmasi = resJurSek9.kuota_afirmasi;

                kuota = kuota_afirmasi;

                resData = await DataPerangkingans.findAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                        [Op.or]: [
                            { is_anak_panti: { [Op.ne]: '0' } },
                            { is_anak_keluarga_tidak_mampu: { [Op.ne]: '0' } },
                        ],
                    },
                    order: [
                        ['nilai_akhir', 'DESC'],
                        ['umur', 'DESC'],
                        ['created_at', 'ASC'],
                    ],
                    limit: kuota,
                });
                break;

            default:
                res.status(200).json({
                    'status': 0,
                    'message': 'Ada kesalahan, jalur pendaftaran tidak ditemukan',
                    'data': [],
                    'timeline': resTimeline,
                });
                return;
        }

        if (resData && resData.length > 0) {

             // Mengelompokkan data berdasarkan NISN dan memilih ID terkecil
            const nisnMap = new Map();
            resData.forEach(item => {
                const { nisn, id, ...rest } = item.toJSON();
                if (!nisnMap.has(nisn) || nisnMap.get(nisn).id > id) {
                    nisnMap.set(nisn, { id, ...rest });
                }
            });

            // Mengubah Map menjadi array untuk respons
            const modifiedData = Array.from(nisnMap.entries()).map(([nisn, data]) => ({
                nisn,
                ...data,
            }));

            res.status(200).json({
                'status': 1,
                'message': 'Data berhasil ditemukan',
                'data': modifiedData,
                'timeline': resTimeline,
            });

            
        } else {
            res.status(200).json({
                'status': 0,
                'message': 'Data kosong',
                'data': [],
                'timeline': resTimeline,
            });
        }
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            'status': 0,
            'message': 'Error',
        });
    }
};

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

            const resTm = await Timelines.findOne({  
                where: { id: 4 }, // Find the timeline by ID  
                attributes: ['id', 'nama', 'status']  
            });  

            if (resTm.status != 1) {  
                return res.status(200).json({ status: 0, message: 'Pendaftaran Belum Dibuka' });
            }

            const cariDtSekolah = await SekolahTujuan.findOne({
            where: {
                id: sekolah_tujuan_id,
            }
            });

             // Count existing entries with the same NISN that are not deleted
             const cari = await DataPerangkingans.findOne({
                where: {
                    nisn,
                    is_delete: 0
                }
                });



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

            if(jalur_pendaftaran_id == 1){

                if(pendaftar.status_domisili == 2){
                    return res.status(200).json({ status: 0, message: 'Saat ini sistem membaca bahwa status domisili anda adalah "Menggunakan Surat Perpindahan Tugas Ortu/Wali" status domisili tersebut tidak diperbolehkan mendaftar jalur zonasi' });
                }

                if(pendaftar.status_domisili == 4){
                    return res.status(200).json({ status: 0, message: 'Saat ini sistem membaca bahwa status domisili anda adalah "Sesuai Domisili Panti Asuhan (Dinas Sosial)" status domisili tersebut tidak diperbolehkan mendaftar jalur zonasi' });
                }
                
            }

            if(jalur_pendaftaran_id == 6){

                if(pendaftar.status_domisili != 1){
                    return res.status(200).json({ status: 0, message: 'Saat ini sistem membaca bahwa status domisili anda tidak menggunakan "Sesuai KK" status domisili selain "Sesuai KK" tidak diperbolehkan mendaftar seleksi domisili terdekat' });
                }
                
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

            if(bentuk_pendidikan_id == 13){

                if(count > 0){
                     //hanya boleh daftar 1 sekolah di masing2 jalur
                    if (cari.sekolah_tujuan_id == sekolah_tujuan_id) {
                        return res.status(200).json({ status: 0, message: 'Hanya boleh mendaftar 1 sekolah di masing-masing jalur' });
                    }

                    //tidak boleh sama jalur
                    if (cari.jalur_pendaftaran_id == jalur_pendaftaran_id) {
                        return res.status(200).json({ status: 0, message: 'Hanya boleh mendaftar 1 jalur pendaftaran di masing-masing jalur pendaftaran' });
                    }
                }
               

                
                // return res.status(200).json({ status: 0, message: 'NISN sudah terdaftar 2 kali' });
                if (count > 2) {
                    return res.status(200).json({ status: 0, message: 'NISN sudah tidak bisa daftar jalur/sekolah ini' });
                }
            }

            if(bentuk_pendidikan_id == 15){

                // Count existing entries with the same NISN that are not deleted
                const countSklJur = await DataPerangkingans.count({
                    where: {
                        nisn,
                        sekolah_tujuan_id: sekolah_tujuan_id,
                        jurusan_id: jurusan_id,
                        is_delete: 0
                    }
                });

                if(countSklJur >= 1){
                    return res.status(200).json({ status: 0, message: 'Anda sudah pernah mendaftar pada jurusan ini' });
                }

                // Query to count unique sekolah_id for the given nisn
                const getPrSmk1 = await DataPerangkingans.findAll({
                    attributes: [
                        'jalur_pendaftaran_id',
                        [Sequelize.fn('COUNT', Sequelize.col('jalur_pendaftaran_id')), 'count']
                    ],
                    where: {
                        nisn,
                        is_delete: 0
                    },
                    group: ['jalur_pendaftaran_id'],
                    raw: true
                });

                 // Extract unique sekolah_id from the result
                 const uniqueJalurIds = getPrSmk1.map(row => row.jalur_pendaftaran_id);
                 const uniqueCountJ = uniqueJalurIds.length;

                //  console.log('uniqcount jalur pendaaftaran id:'+uniqueCountJ);
 
                 if (uniqueCountJ > 2) {
                    return res.status(200).json({ status: 0, message: 'Maksimal daftar di 2 jalur yang berbeda' });
                 }



                // Query to count unique sekolah_id for the given nisn
                const getPrSmk2 = await DataPerangkingans.findAll({
                    attributes: [
                        'sekolah_tujuan_id',
                        [Sequelize.fn('COUNT', Sequelize.col('sekolah_tujuan_id')), 'count']
                    ],
                    where: {
                        nisn,
                        is_delete: 0
                    },
                    group: ['sekolah_tujuan_id'],
                    raw: true
                });

                // Extract unique sekolah_id from the result
                const uniqueSekolahIds = getPrSmk2.map(row => row.sekolah_tujuan_id);
                const uniqueCount = uniqueSekolahIds.length;

                // console.log('uniqcount sekolah id:'+uniqueCount);

                if (uniqueCount >= 2) {
                    if(count >= 4){
                        return res.status(200).json({ status: 0, message: 'NISN maksimal daftar di 2 sekolah' });
                    }
                  
                }


                // Query to count unique sekolah_id for the given nisn
                const getPrSmk3 = await DataPerangkingans.findAll({
                    attributes: [
                        'jurusan_id',
                        [Sequelize.fn('COUNT', Sequelize.col('jurusan_id')), 'count']
                    ],
                    where: {
                        nisn,
                        sekolah_tujuan_id: sekolah_tujuan_id,
                        is_delete: 0
                    },
                    group: ['jurusan_id'],
                    raw: true
                });

                // Extract unique sekolah_id from the result
                const uniqueSekolahJurIds = getPrSmk3.map(row => row.jurusan_id);
                const uniqueCountJur = uniqueSekolahJurIds.length;

                if (uniqueCountJur >= 2) {
                    return res.status(200).json({ status: 0, message: 'NISN maksimal daftar di 2 jurusan di 1 sekolah' });
                }
            }

          

            

            if(cari != null){

                //tidak boleh sma - smk
                if(cari.bentuk_pendidikan_id != bentuk_pendidikan_id){
                    return res.status(200).json({ status: 0, message: 'Hanya boleh mendaftar 1 jenjang yang sama (Jika sebelumnya sudah mendaftar SMA maka tidak di perbolehkan mendaftar SMK, begitu juga sebaliknya)' });
                }

                

                //cari zonasi untuk SMA
                if(jalur_pendaftaran_id == 1){



                    const kecPendaftar = pendaftar.kecamatan_id.toString();

                    //tidak boleh jika tidak dalam zonasi
                    const cariZonasis = await SekolahZonasis.findAll({
                        where: {
                          sekolah_id : sekolah_tujuan_id
                        }
                      });
                
                      let isInZonasis = false;
                      
                      cariZonasis.forEach(zonasi => {
                        if (zonasi.kode_wilayah_kec == kecPendaftar) {
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
                    const allZonasisForKecamatan = await SekolahZonasis.findAll({
                        where: {
                            kode_wilayah_kec: kecPendaftar
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
    
                
    

                //hanya boleh daftar 1 jurusan saja untuk SMK
                // if (bentuk_pendidikan_id == 15) {
                //     if(cari.jurusan_id != 0 && cari.jurusan_id == jurusan_id){
                //         return res.status(200).json({ status: 0, message: 'Hanya boleh mendaftar 1 jurusan di masing-masing jurusan' });
                //     }
                // }   


            }

            if(cari == null){
                //cari zonasi untuk SMA
                if(jalur_pendaftaran_id == 1){


                    const kecPendaftar = pendaftar.kecamatan_id.toString();

                    //tidak boleh jika tidak dalam zonasi
                    const cariZonasis = await SekolahZonasis.findOne({
                        where: {
                          id_sekolah: sekolah_tujuan_id,
                          kode_wilayah_kec: kecPendaftar,
                        }
                      });
                
                    //   let isInZonasis = false;
                      
                    //   cariZonasis.forEach(zonasi => {
                    //     if (zonasi.kode_wilayah_kec == kecPendaftar) {
                    //       isInZonasis = true;
                    //     }
                    //   });
                
                      if (!cariZonasis) {
                        return res.status(200).json({
                          status: 0,
                          message: "Domisili Anda tidak termasuk dalam zonasi Sekolah Yang Anda Daftar. ",
                        });
                      }


                     // Get all zonasi for the pendaftar's kecamatan
                    const allZonasisForKecamatan = await SekolahZonasis.findAll({
                        where: {
                            kode_wilayah_kec: kecPendaftar
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
                file_tambahan: pendaftar.file_tambahan,
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

        if(bentuk_pendidikan_id == 13){
            if (count >= 2) {
                return res.status(200).json({ status: 0, message: 'NISN sudah terdaftar lebih dari 2 kali' });
            }
        }

        if(bentuk_pendidikan_id == 15){
            if (count >= 4) {
                return res.status(200).json({ status: 0, message: 'NISN sudah terdaftar lebih dari 4 kali (2 sekolah, 4 jurusan)' });
            }
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
            },
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

// Function to handle  request
export const daftarUlangPerangkingan = async (req, res) => {
    try {
        const { id_perangkingan } = req.body;

        // Decode the ID
        const id_perangkingan_decode = decodeId(id_perangkingan);

        const resTm = await Timelines.findOne({  
            where: { id: 6 }, // Find the timeline by ID  
            attributes: ['id', 'nama', 'status']  
        });  

        if (resTm.status != 1) {  
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
        const perangkingan2 = await DataPerangkingans.findOne({
            where: {
                nisn: perangkingan.nisn,
                is_daftar_ulang: 1,
                is_delete: 0
            }
        });

        if (perangkingan2) {
            return res.status(200).json({ status: 0, message: 'Anda sudah pernah melakukan daftar ulang, daftar ulang hanya bisa di lakukan 1 kali' });
        }


        // Update the record to set is_delete to 1
        const perangkingan3 = await DataPerangkingans.update(
            { 
                is_daftar_ulang: 1,
                daftar_ulang_at: new Date(),
             },
            { where: { id: id_perangkingan_decode } }
        );

        if (perangkingan3) {
            const perangkingan4 = await DataPerangkingans.findAll({
                where: {
                    nisn: perangkingan.nisn, // Condition for specific NISN
                    id: { [Op.ne]: id_perangkingan_decode }, // Condition for id not equal to id_perangkingan_decode
                    is_delete: 0 // Condition for is_delete being 0
                }
            });

            await DataPerangkingans.update(
                { 
                    is_daftar_ulang: 2,
                    daftar_ulang_at: new Date(),
                 },
                { 
                    where: {
                        nisn: perangkingan.nisn, // Condition for specific NISN
                        id: { [Op.ne]: id_perangkingan_decode }, // Condition for id not equal to id_perangkingan_decode
                        is_delete: 0 // Condition for is_delete being 0
                    }
                 }
            );
        }

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


