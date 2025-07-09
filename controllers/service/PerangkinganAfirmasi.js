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

//selain tambah redis, ada perbaikan di jarak terdekat SMK, penambahan 2% untuk anak guru
export const getPerangkinganKhususAfirmasi2 = async (req, res) => {
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

export const automasiPerangkingan2 = async (req, res) => {
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
            case 5: // Afirmasi SMA
                resultData = await prosesJalurAfirmasi(sekolah_tujuan_id, transaction);
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


async function prosesJalurAfirmasi(sekolah_tujuan_id, transaction) {
    const resSek = await getSekolahTujuanById(sekolah_tujuan_id, transaction);
    let daya_tampung = resSek.daya_tampung;
    let kuota_afirmasi = resSek.kuota_afirmasi;
    let kuota_afirmasi_plus_cadangan = kuota_afirmasi + KUOTA_CADANGAN;


    const resDataMiskin = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 5,
            sekolah_tujuan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 },
        },
        order: [
            ['umur', 'DESC'], //umur tertua
            ['nilai_akhir', 'DESC'],
            ['created_at', 'ASC'] //daftar sekolah terawal
        ],
        limit: kuota_afirmasi_plus_cadangan,
        transaction
    });

    return resDataMiskin.map(item => ({
        ...item,
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: index <= kuota_afirmasi ? 1 : 2
    }));
}

async function prosesJalurSMKAfirmasi(sekolah_tujuan_id, jurusan_id, transaction) {
    const resJurSek = await getSekolahJurusanById(sekolah_tujuan_id, jurusan_id, transaction);
    let kuota_afirmasi = resJurSek.kuota_afirmasi;
    let kuota_afirmasi_plus_cadangan = kuota_afirmasi + KUOTA_CADANGAN;


    const resDataMiskin = await DataPerangkingans.findAll({
        where: {
            jalur_pendaftaran_id: 9,
            sekolah_tujuan_id,
            jurusan_id,
            is_delete: 0,
            is_daftar_ulang: { [Op.ne]: 2 }
        },
        order: [
            ['umur', 'DESC'], //umur tertua
            ['nilai_akhir', 'DESC'],
            ['created_at', 'ASC'] //daftar sekolah terawal
        ],
        limit: kuota_afirmasi_plus_cadangan,
        transaction
    });

     return resDataMiskin.map(item => ({
        ...item,
        id: encodeId(item.id),
        id_pendaftar: encodeId(item.id_pendaftar),
        status_daftar_sekolah: 1,
        is_diterima: index <= kuota_afirmasi ? 1 : 2
    }));
}


