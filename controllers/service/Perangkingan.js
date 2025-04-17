import { check, validationResult } from 'express-validator';
import { DomiSmkHelper, afirmasiSmkHelper, afirmasiSmaHelper, DomiRegHelper, getTimelineSatuan } from '../../helpers/HelpHelper.js';
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
import { redisGet, redisSet } from '../../redis.js'; // Import the Redis functions

import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";

pdfMake.vfs = pdfFonts?.default?.vfs || pdfFonts.vfs;


//Generate Verification Code
const generatePendaftaranNumber_old = async () => {
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

const calculateAgeInMonth_BAK = (birthdate) => {
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

        // const resTimeline = await Timelines.findOne({
        //     where: {
        //         id: 4,
        //     },
        // });

        const allTimelines = await Timelines.findAll();

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
                attributes: ['nisn', 'nama_lengkap', 'tempat_lahir', 'jenis_kelamin', 'tanggal_cetak_kk'],
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

export const getPerangkinganBAK = async (req, res) => {

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
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'],
                    // ['created_at', 'ASC'] // daftar sekolah terawal
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

            let kuota_afirmasi = resSek.kuota_afirmasi;

            const resData = await DataPerangkingans.findAll({
            where: {
                jalur_pendaftaran_id,
                sekolah_tujuan_id,
                is_delete: 0,
                is_daftar_ulang: { [Op.ne]: 2 }, // tidak daftar ulang
                // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                [Op.or]: [
                    { is_anak_keluarga_tidak_mampu: '1' },
                    { is_tidak_sekolah: '1' },
                    { is_anak_panti: '1' }
                ]
            },
            order: [
                [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                ['umur', 'DESC'], //umur tertua
                // ['created_at', 'ASC'] //daftar sekolah terawal
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

                let murni = DomiSmkHelper('terdekat');
                let anak_guru = DomiSmkHelper('anak_guru');
                let jml = murni + anak_guru;

                let kuota_anak_guru =  Math.round((anak_guru / jml) * kuota_jarak_terdekat) || 0;
                let kuota_dom_murni =  Math.round((murni / jml) * kuota_jarak_terdekat) || 0;

                //anak guru
                const resData2 = await DataPerangkingans.findAndCountAll({
                    where: {
                        jalur_pendaftaran_id,
                        sekolah_tujuan_id,
                        jurusan_id,
                        is_delete: 0,
                        is_daftar_ulang: { [Op.ne]: 2 } // Adding the new condition
                        // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                    }, order: [
                        [literal('is_anak_guru_jateng DESC')],  // Prioritaskan yang is_anak_guru_jateng = 1
                        [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Urutkan berdasarkan jarak (terdekat lebih dulu)
                    ],
                    limit: kuota_anak_guru
                });

                const rowsResData2 = resData2.rows; // Data hasil query
                const totalResData2 = resData2.length || 0; // Total jumlah data setelah limit

                let kuota_dom_murni_akhir = kuota_dom_murni - kuota_anak_guru;

                const resIds = (rowsResData2.rows || []).map((item) => item.id);

                // murni
                const resData = await DataPerangkingans.findAll({
                where: {
                    jalur_pendaftaran_id,
                    sekolah_tujuan_id,
                    jurusan_id,
                    is_delete: 0,
                    is_daftar_ulang: { [Op.ne]: 2 }, // Adding the new condition
                    id: { [Op.notIn]: resIds }
                    // is_daftar_ulang: { [Op.notIn]: [2, 3] } // Updated condition to exclude 2 and 3
                }, order: [
                    [literal('CAST(jarak AS FLOAT)'), 'ASC'], // Use literal for raw SQL  
                    ['umur', 'DESC'], //umur tertua
                    // ['created_at', 'ASC'] // daftar sekolah terawal
                ],
                limit: kuota_dom_murni_akhir
                });

                const modifiedData = [...rowsResData2, ...resData].map(item => {
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

                 //hitung total pendaftar domisili terdekat smk dulu,
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
                        // ['created_at', 'ASC'] // daftar sekolah terawal
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

        // const resTm = await Timelines.findOne({  
        //     where: { id: 4 }, // Find the timeline by ID  
        //     attributes: ['id', 'nama', 'status']  
        // }); 
        
        const resTm = await getTimelineSatuan(4);

        // console.log(resTm);

        if (resTm.status != 1) {  
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
                 'nilai_raport_rata', 'nilai_prestasi', 'nilai_organisasi', 
                ] 
        });

        if (!pendaftar) {
            return res.status(200).json({ status: 0, message: 'Pendaftar tidak ditemukan' });
        }

        if (!pendaftar.is_verified == 2) {
            return res.status(200).json({ status: 0, message: 'Status anda sedang diminta untuk revisi, tidak dapat mendaftar sekolah sekarang!' });
        }

        //jika status domisili "Menggunakan Surat Perpindahan Tugas Ortu/Wali" maka
        if(pendaftar.status_domisili == 2){
            //tidak boleh daftar jalur selain jalur mutasi dan domisili terdekat di SMK
            if(jalur_pendaftaran_id != 4){
                return res.status(200).json({ status: 0, message: 'Saat ini sistem membaca bahwa status domisili anda adalah "Sesuai Surat Mutasi Tugas Ortu/Wali" status domisili tersebut hanya di perbolehkan mendaftar jalur mutasi (SMA)' });
            }
        }

        //jika status domisili bukan "Menggunakan Surat Perpindahan Tugas Ortu/Wali" maka
        if(pendaftar.status_domisili != 2){
            if(jalur_pendaftaran_id == 4){
             return res.status(200).json({ status: 0, message: 'Saat ini sistem membaca bahwa status domisili anda adalah `bukan` "Menggunakan Surat Perpindahan Tugas Ortu/Wali" status domisili tersebut hanya di perbolehkan mendaftar jalur mutasi jalur mutasi (SMA)' });
            }
        }

        // if(pendaftar.is_anak_keluarga_tidak_mampu == 0 && jalur_pendaftaran_id == 5){
        //     return res.status(200).json({ status: 0, message: 'Anda tidak bisa mendaftar jalur ini karena anda tidak termasuk salah satu dari kategori afirmasi: (ATS, Anaka Panti, Anak Keluarga Tidak Mampu yang terdaftar  pada BDT Jateng)' });
        // }

        if(pendaftar.is_tidak_sekolah == 0 && pendaftar.is_anak_panti == 0 && pendaftar.is_anak_keluarga_tidak_mampu == 0){

            if(jalur_pendaftaran_id == 5 || jalur_pendaftaran_id == 9){
                return res.status(200).json({ status: 0, message: 'Anda tidak bisa mendaftar jalur ini karena anda tidak termasuk salah satu dari kategori afirmasi: (ATS, Anak Panti, Anak Keluarga Tidak Mampu yang terdaftar  pada BDT Jateng)' });
            }

        }

        if(jalur_pendaftaran_id == 1){

            console.log('is_tidak_boleh_domisili:'+pendaftar.is_tidak_boleh_domisili);

            if(pendaftar.is_tidak_boleh_domisili == 1){
                return res.status(200).json({ status: 0, message: 'Anda tidak diperbolehkan mendaftar jalur domisili karena alasan tanggal kedatangan dan status nik pada kk' });
            }

            const kecPendaftar = pendaftar.kecamatan_id.toString();

            console.log('anak pondok:'+pendaftar.is_anak_pondok);
            if(pendaftar.is_anak_pondok != 1){
                //tidak boleh jika tidak dalam zonasi
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

        }

        

        let data_file_tambahan_var = null;

        const data_file_tambahan = await FileTambahans.findAll({
            where: {
                id_jalur_pendaftaran: jalur_pendaftaran_id,
                is_active: 1
            }
        });

        //pendaftaran
        if(jalur_pendaftaran_id == 5){

            if(pendaftar.is_disabilitas == "1"){

                data_file_tambahan_var = data_file_tambahan

                // data_file_tambahan = await FileTambahans.findAll({
                //     where: {
                //         id_jalur_pendaftaran: jalur_pendaftaran_id,
                //         is_active: 1
                //     }
                // });

            }else{

                data_file_tambahan_var = [];

            }

            
            
        }else{

            data_file_tambahan_var = data_file_tambahan;
            //  data_file_tambahan = await FileTambahans.findAll({
            //     where: {
            //         id_jalur_pendaftaran: jalur_pendaftaran_id,
            //         is_active: 1
            //     }
            // });

        }

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
            is_tidak_sekolah: pendaftar.is_tidak_sekolah,
            is_anak_panti: pendaftar.is_anak_panti,
            is_anak_keluarga_tidak_mampu: pendaftar.is_anak_keluarga_tidak_mampu,
            is_anak_guru_jateng: pendaftar.is_anak_guru_jateng,
            is_pip: pendaftar.is_pip,
            is_disabilitas: pendaftar.is_disabilitas,
            is_buta_warna,
            created_at: new Date(), // Set the current date and time
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

        // const resTm = await Timelines.findOne({  
        //     where: { id: 6 }, // Find the timeline by ID  
        //     attributes: ['id', 'nama', 'status']  
        // });  
        const resTm = getTimelineSatuan(6);

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


