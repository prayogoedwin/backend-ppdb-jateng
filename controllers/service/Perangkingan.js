import { check, validationResult } from 'express-validator';
import { DomiSmkHelper, DomiNilaiHelper, afirmasiSmkHelper, afirmasiSmaHelper, 
    DomiRegHelper, getTimelineSatuan, getTimelineAll, getFileTambahanByJalurPendaftaran, 
    getSekolahTujuanById, getSekolahJurusanById, SekolahZonasiKhususByNpsn, checkWaktuCachePerangkingan, parseKodeWilayah } from '../../helpers/HelpHelper.js';
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
import { redisGet, redisSet } from '../../redis.js'; // Import the Redis functions
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

export const getPerangkinganSelamat = async (req, res) => {

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

        const currentDateTime = new Date().toLocaleString("id-ID", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
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

             //hitung total pendaftar zonasi khusus
             const countZonasiKhusus = (await DataPerangkingans.findAll({  
                attributes: ['nisn'], // Pilih kolom yang diambil
                where: {  
                    jalur_pendaftaran_id: 2,
                    sekolah_tujuan_id,  
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // Tidak daftar ulang
                },
                limit: resSek.kuota_zonasi_khusus
            })).length;

            let zonasi_jarak = kuota_zonasi_min - countZonasiKhusus;
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
                    ['umur', 'DESC'] // Umur tertua
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
                    // ['created_at', 'ASC'] 
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
                    is_daftar_ulang: { [Op.ne]: 2 }// dinyatakan tidak daftar ulang
                    // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    
                },
                order: [
                    ['umur', 'DESC'], //umur tertua
                    ['nilai_akhir', 'DESC'], //jarak terendah  
                    // ['created_at', 'ASC'] //daftar sekolah terawal
                ],
                limit: kuota_zonasi_khusus
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
                    return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                });

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
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 } // yang tidak daftar ulang
                },
                order: [
                    [literal('is_anak_guru_jateng DESC')], // Prioritaskan yang is_anak_guru_jateng = 1
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                    // ['created_at', 'ASC'] // Urutkan berdasarkan waktu pendaftaran (tercepat lebih dulu)
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

            const resSek = await SekolahTujuan.findOne({
                where: {
                    id : sekolah_tujuan_id,
                }
            });
            
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
                    // ['created_at', 'ASC'] //daftar sekolah terawal
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
                const resJurSek = await SekolahJurusan.findOne({
                    where: {
                        id_sekolah_tujuan : sekolah_tujuan_id,
                        id : jurusan_id,
                    }
                });
                

                let kuota_jarak_terdekat = resJurSek.kuota_jarak_terdekat;

                // murni
                const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    jurusan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                }, order: [
                    ['is_anak_guru_jateng', 'DESC'],
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    ['umur', 'DESC'], //umur tertua
                    // ['created_at', 'ASC'] // daftar sekolah terawal
                ],
                limit: kuota_jarak_terdekat
                });

                const modifiedData = resData.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                });

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

                const resJurSek = await SekolahJurusan.findOne({
                    where: {
                        id_sekolah_tujuan : sekolah_tujuan_id,
                        id : jurusan_id,
                    }
                });

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
                    // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                }, order: [
                    ['nilai_akhir', 'DESC'], //nilai tertinggi
                    ['umur', 'DESC'], //umur tertua
                    // ['created_at', 'ASC'] // daftar sekolah terawal
                ],
                limit: kuota_prestasi_khusus
                });
                
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
                const resJurSek = await SekolahJurusan.findOne({
                    where: {
                        id_sekolah_tujuan : sekolah_tujuan_id,
                        id : jurusan_id,
                    }
                });

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
                const totalAtsL = resDataAts.length || 0; // Total jumlah data setelah limit

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
                const totalPatntiL = resDataPanti.length || 0; // Total jumlah data setelah limit


                let kuota_akhir_afirmasi = kuota_afirmasi - (totalPatntiL + totalAtsL)

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

                    const modifiedData = [...(rowsAtsR || []), ...(rowsPantiR || []), ...(resDataMiskin || [])].map(item => {
                        const { id_pendaftar, id, ...rest } = item.toJSON();
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                    });

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
                'timeline': null // Return the found data
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

export const getPerangkingan1May2025 = async (req, res) => {

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

        const currentDateTime = new Date().toLocaleString("id-ID", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
        
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
            let kuota_zonasi_nilai_min = Math.ceil((persentase_domisili_nilai / 100) * kuota_zonasi_min);



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
                    ['umur', 'DESC'] // Umur tertua
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
                    // ['created_at', 'ASC'] 
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
                    // ['created_at', 'ASC'] //daftar sekolah terawal
                ],
                limit: kuota_zonasi_khusus
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
                    return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                });

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
                    // ['created_at', 'ASC'] // Urutkan berdasarkan waktu pendaftaran (tercepat lebih dulu)
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
                    // ['created_at', 'ASC'] //daftar sekolah terawal
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
                

                let kuota_jarak_terdekat = resJurSek.kuota_jarak_terdekat;

                // murni
                const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    jurusan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                }, order: [
                    ['is_anak_guru_jateng', 'DESC'],
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    ['umur', 'DESC'], //umur tertua
                    // ['created_at', 'ASC'] // daftar sekolah terawal
                ],
                limit: kuota_jarak_terdekat
                });

                const modifiedData = resData.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                });

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
                    ['nilai_akhir', 'DESC'], //nilai tertinggi
                    ['umur', 'DESC'], //umur tertua
                    // ['created_at', 'ASC'] // daftar sekolah terawal
                ],
                limit: kuota_prestasi_khusus
                });
                
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

   

    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({ // Use 500 for server error
            'status': 0,
            'message': 'Error'
        });
    }
}

export const getPerangkingan_Tanpa_Redis = async (req, res) => {

    try {

        const {
            bentuk_pendidikan_id,
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            jurusan_id,
            nisn,
            is_pdf // New parameter
        } = req.body;
        
        // const resTimeline = await Timelines.findOne({
        //     where: {
        //         id: 6,
        //     },
        // });
        const resTimeline = await getTimelineSatuan(6);

        const currentDateTime = new Date().toLocaleString("id-ID", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
        
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
            let kuota_zonasi_nilai_min = Math.ceil((persentase_domisili_nilai / 100) * kuota_zonasi_min);



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
                    ['umur', 'DESC'] // Umur tertua
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
                    // ['created_at', 'ASC'] 
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
                    // ['created_at', 'ASC'] //daftar sekolah terawal
                ],
                limit: kuota_zonasi_khusus
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
                    return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                });

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
                    // ['created_at', 'ASC'] // Urutkan berdasarkan waktu pendaftaran (tercepat lebih dulu)
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
                    // ['created_at', 'ASC'] //daftar sekolah terawal
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
                

                let kuota_jarak_terdekat = resJurSek.kuota_jarak_terdekat;

                // murni
                const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    jurusan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                }, order: [
                    ['is_anak_guru_jateng', 'DESC'],
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    ['umur', 'DESC'], //umur tertua
                    // ['created_at', 'ASC'] // daftar sekolah terawal
                ],
                limit: kuota_jarak_terdekat
                });

                const modifiedData = resData.map(item => {
                    const { id_pendaftar, id, ...rest } = item.toJSON();
                    return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                });

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
                    ['nilai_akhir', 'DESC'], //nilai tertinggi
                    ['umur', 'DESC'], //umur tertua
                    // ['created_at', 'ASC'] // daftar sekolah terawal
                ],
                limit: kuota_prestasi_khusus
                });
                
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

   

    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({ // Use 500 for server error
            'status': 0,
            'message': 'Error'
        });
    }
}

// const resultData = JSON.parse(cached);
// console.log('Jumlah row:', resultData.length);
//selain tambah redis, ada perbaikan di jarak terdekat SMK, penambahan 2% untuk anak guru
export const getPerangkingan_YANGINI = async (req, res) => {
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
                let kuota_zonasi_nilai_min = Math.ceil((persentase_domisili_nilai / 100) * kuota_zonasi_min);
    
    
    
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
                        ['umur', 'DESC'] // Umur tertua
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
                        // ['created_at', 'ASC'] 
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
                        // ['created_at', 'ASC'] //daftar sekolah terawal
                    ],
                    limit: kuota_zonasi_khusus
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
                        return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                    });

                    // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                    await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                    console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);
    
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
                        // ['created_at', 'ASC'] // Urutkan berdasarkan waktu pendaftaran (tercepat lebih dulu)
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

                     // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                     await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                     console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);
    
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
                        // ['created_at', 'ASC'] //daftar sekolah terawal
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
                            // ['created_at', 'ASC'] // daftar sekolah terawal
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
                    if (resData && resData.length > 0) {
        
                       
                        const modifiedData = resData.map(item => {
                            const { id_pendaftar, id, ...rest } = item.toJSON();
                            return { ...rest, id: encodeId(id), id_pendaftar: encodeId(id_pendaftar) };
                            // return { ...rest, id: encodeId(id) };
                        });

                         // await redisSet(redis_key, JSON.stringify(modifiedData), 'EX', REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN); // Cache 1 jam
                        await redisSet(redis_key, JSON.stringify(modifiedData), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                        console.log(`[DB] Data disimpan ke cache untuk key: ${redis_key}`);
    
    
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

//percobaan untuk akomodir urutan peserta didalam redis
//selain tambah redis, ada perbaikan di jarak terdekat SMK, penambahan 2% untuk anak guru
export const getPerangkinganBAK = async (req, res) => {
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
                let kuota_zonasi_nilai_min = Math.ceil((persentase_domisili_nilai / 100) * kuota_zonasi_min);
    
    
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
                        ['umur', 'DESC'] // Umur tertua
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
                        // ['created_at', 'ASC'] 
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
                        // ['created_at', 'ASC'] //daftar sekolah terawal
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
                        // ['created_at', 'ASC'] // daftar sekolah terawal
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
                        // ['created_at', 'ASC'] // daftar sekolah terawal
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
                        // ['created_at', 'ASC'] // Urutkan berdasarkan waktu pendaftaran (tercepat lebih dulu)
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
                        // ['created_at', 'ASC'] // Urutkan berdasarkan waktu pendaftaran (tercepat lebih dulu)
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
                        // ['created_at', 'ASC'] //daftar sekolah terawal
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
                            // ['created_at', 'ASC'] // daftar sekolah terawal
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

export const getPerangkinganBackupNdadak = async (req, res) => {
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
                            limit: resSek.kuota_zonasi_khusus
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
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            kode_kecamatan: zonKh.kode_wilayah_kec,  
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 }
                        },
                        order: [
                            ['umur', 'DESC'],
                            ['nilai_akhir', 'DESC'],
                            ['created_at', 'ASC']
                        ],
                        limit: zonKh.kuota_zonasi_khusus
                    });
                
                    resData = resDataQ.concat(resDataQ);
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
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
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
                            ['is_disabilitas', 'ASC'], //disabilitas 
                            [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
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
                            ['created_at', 'ASC'] // daftar sekolah terawal
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
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                        ['umur', 'DESC'], //umur tertua
                        ['created_at', 'ASC'] // daftar sekolah terawal
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
export const getPerangkingan13BAK = async (req, res) => {
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


        const WAKTU_CAHCE_JURNAL = await checkWaktuCachePerangkingan('waktu_cache_perangkingan14045')

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
                            limit: resSek.kuota_zonasi_khusus
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

                const npsn = resSek.npsn;
                const resZonKh = await SekolahZonasiKhususByNpsn(npsn);

                let resData = [];

                for (const zonKh of resZonKh) {
                    const resDataQ = await DataPerangkingans.findAll({
                        where: {
                            jalur_pendaftaran_id,
                            sekolah_tujuan_id,
                            kode_kecamatan: zonKh.kode_wilayah_kec,  
                            is_delete: 0,
                            is_daftar_ulang: { [Op.ne]: 2 }
                        },
                        order: [
                            ['umur', 'DESC'],
                            ['nilai_akhir', 'DESC'],
                            ['created_at', 'ASC']
                        ],
                        limit: zonKh.kuota_zonasi_khusus
                    });
                
                    resData = resDataQ.concat(resDataQ);
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

        if(jalur_pendaftaran_id == 8){
            const anak_prestasi_khusus = await getPendaftarPrestasiKhususByNisn();
            
            const isNisnTerdaftar = anak_prestasi_khusus.some(
                (anak) => anak.nisn === nisn
            );
        
            if (!isNisnTerdaftar) {
                return res.status(200).json({ 
                    status: 0, 
                    message: 'Anda tidak memiliki rekomendasi untuk daftar seleksi prestasi khusus' 
                });
            }

            // if(pendaftar.is_boleh_prestasi_khusus != 1){
            //     return res.status(200).json({ status: 0, message: 'Anda tidak memiliki rekomendasi untuk daftar seleksi prestasi khusus' });
            // }
        }

        if(jalur_pendaftaran_id == 1){

            let kecPendaftar = 0;

            console.log('is_tidak_boleh_domisili:'+pendaftar.is_tidak_boleh_domisili);

            if(pendaftar.is_tidak_boleh_domisili == 1){
                return res.status(200).json({ status: 0, message: 'Anda tidak diperbolehkan mendaftar jalur domisili karena alasan tanggal kedatangan dan status nik pada kk' });
            }

            kecPendaftar = pendaftar.kecamatan_id.toString();
            console.log('KECMATAN:'+kecPendaftar);

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

        // if(jalur_pendaftaran_id == 1){

        //     console.log('is_tidak_boleh_domisili:'+pendaftar.is_tidak_boleh_domisili);

        //     if(pendaftar.is_tidak_boleh_domisili == 1){
        //         return res.status(200).json({ status: 0, message: 'Anda tidak diperbolehkan mendaftar jalur domisili karena alasan tanggal kedatangan dan status nik pada kk' });
        //     }

        //     const kecPendaftar = pendaftar.kecamatan_id.toString();

        //     console.log('KECAMATAN:'+kecPendaftar);

        //     const cariZonasis = await SekolahZonasis.findOne({
        //         where: {
        //         id_sekolah: sekolah_tujuan_id,
        //         kode_wilayah_kec: kecPendaftar,
        //         }
        //     });
        
        //     if (!cariZonasis) {
        //         return res.status(200).json({
        //         status: 0,
        //         message: "Domisili Anda tidak termasuk dalam wlayah domisili Sekolah Yang Anda Daftar. ",
        //         });
        //     }

        // }

        

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


export const automasiPerangkingan = async (req, res) => {
    // Dapatkan transaction dari sequelize instance
    // const transaction = await Sequelize.transaction();
    const transaction = await db.transaction();
    
    try {
        console.log('Memulai proses automasi perangkingan...');
        
        // 1. Ambil semua jalur pendaftaran yang aktif
        const allJalur = await JalurPendaftarans.findAll({
            // where: { 
            //     id: 1,
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
                attributes: ['id'],
                // where: { 
                //     id: 2233,
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
                            attributes: ['id'],
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

async function prosesJalurZonasiReguler(sekolah_tujuan_id, transaction) {
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

// Update all jalur processing functions to include cadangan quota
async function prosesJalurZonasiKhusus(sekolah_tujuan_id, transaction) {
    const resSek = await getSekolahTujuanById(sekolah_tujuan_id, transaction);
    let kuota_zonasi_khusus = resSek.kuota_zonasi_khusus;
    let kuota_dengan_cadangan = kuota_zonasi_khusus + KUOTA_CADANGAN;

    npsn = resSek.npsn;
    const resZonKh = await SekolahZonasiKhususByNpsn(npsn);

    let resData = [];

    for (const zonKh of resZonKh) {
        const resDataQ = await DataPerangkingans.findAll({
            where: {
                jalur_pendaftaran_id: 2,
                sekolah_tujuan_id,
                kode_kecamatan: zonKh.kode_wilayah_kec,  
                is_delete: 0,
                is_daftar_ulang: { [Op.ne]: 2 }
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

    // const resData = await DataPerangkingans.findAll({
    //     where: {
    //         jalur_pendaftaran_id: 2,
    //         sekolah_tujuan_id,
    //         is_delete: 0,
    //         is_daftar_ulang: { [Op.ne]: 2 }
    //     },
    //     order: [
    //         ['umur', 'DESC'],
    //         ['nilai_akhir', 'DESC'],
    //         ['created_at', 'ASC'] 
    //     ],
    //     limit: kuota_dengan_cadangan,
    //     transaction
    // });

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

    let kuota_ats = Math.ceil((kuota_persentase_ats / 100) * daya_tampung) || 0;
    let kuota_panti = Math.ceil((kuota_persentase_panti / 100) * daya_tampung) || 0;
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
            ['is_disabilitas', 'ASC'],
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
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

    // Data Anak Guru
    const resDataAnakGuru = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 6,
            sekolah_tujuan_id,
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 },
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
    let kuota_jarak_terdekat_dengan_cadangan = (kuota_jarak_terdekat + KUOTA_CADANGAN) - totalAnakGuru;

    // Data Domisili Terdekat
    const resData = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 6,
            sekolah_tujuan_id,
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        order: [
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['umur', 'DESC'],
            ['created_at', 'ASC'] 
        ],
        limit: kuota_jarak_terdekat_dengan_cadangan,
        transaction
    });

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
            is_cadangan: index >= kuota_jarak_terdekat
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
    const countTerdekat = (await DataPerangkingans.count({
        where: {  
            jalur_pendaftaran_id: 6,
            sekolah_tujuan_id,  
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        transaction
    }));

    const countAfirmasi = (await DataPerangkingans.count({
        where: {  
            jalur_pendaftaran_id: 9,
            sekolah_tujuan_id,  
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        transaction
    }));

    const countPrestasiKhusus = (await DataPerangkingans.count({
        where: {  
            jalur_pendaftaran_id: 8,
            sekolah_tujuan_id,  
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        transaction
    }));

    let kuota_prestasi = kuota_prestasi_max - (countTerdekat + countAfirmasi + countPrestasiKhusus);
    let kuota_prestasi_akhir = kuota_prestasi >= kuota_prestasi_min ? kuota_prestasi : kuota_prestasi_min;
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
            is_tidak_sekolah: '1'
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
            is_anak_panti: '1'
        },
        order: [
            [literal('CAST(jarak AS FLOAT)'), 'ASC'],
            ['umur', 'DESC'],
            ['created_at', 'ASC'] 
        ],
        // limit: kuota_panti_dengan_cadangan,
        limit: kuota_panti,
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

    const resDataMiskin = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 9,
            sekolah_tujuan_id,
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 },
            is_anak_keluarga_tidak_mampu: '1',
            is_anak_panti: '0',
            is_tidak_sekolah: '0'
        },
        order: [
            ['nilai_akhir', 'DESC'],
            ['umur', 'DESC'],
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

        // const redis_key = `perangkingan_daftar_ulang:jalur:${jalur_pendaftaran_id}--sekolah:${sekolah_tujuan_id}--jurusan:${jurusan_id || 0}`;

        // 1. Cek cache Redis terlebih dahulu
        // const cached = await redisGet(redis_key);
        // if (cached) {
        //     const resultData = JSON.parse(cached);
            
        //     if (is_pdf == 1) {
        //         return generatePDFResponse(res, resultData, jalur_pendaftaran_id);
        //     } else {
        //         const resTimeline = await getTimelineSatuan(6);
        //         return res.status(200).json({
        //             status: 1,
        //             message: 'Data berhasil ditemukan (from cache)',
        //             data: resultData,
        //             timeline: resTimeline
        //         });
        //     }
        // }

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

        // Simpan ke cache
        // await redisSet(redis_key, JSON.stringify(resDatas), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);

        if (is_pdf == 1) {
            return generatePDFResponse(res, resDatas, jalur_pendaftaran_id);
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

        let limit_cadangan = 5;

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
            whereClause.jurusan_id = jurusan_id;
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

        const whereClauseDiterima = {
            jalur_pendaftaran_id,
            sekolah_tujuan_id,
            is_saved: 1,
            is_diterima: 1,
            is_delete: 0
        };
        
        // Tambahkan filter jurusan jika ada
        if (jurusan_id) {
            whereClause.jurusan_id = jurusan_id;
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





