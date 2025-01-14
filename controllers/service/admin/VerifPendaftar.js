import { encodeId, decodeId } from '../../../middleware/EncodeDecode.js';
import DataPendaftars from "../../../models/service/DataPendaftarModel.js";
import { redisGet, redisSet } from '../../../redis.js'; // Import the Redis functions
import { clearCacheByKeyFunction } from '../../config/CacheControl.js';
import WilayahVerDapodik from '../../../models/master/WilayahVerDapodikModel.js';
import DataUsers from '../../../models/service/DataUsersModel.js';
import multer from "multer";
import path from "path";
import fs from "fs";
import { Sequelize, Op } from 'sequelize';

import { fileURLToPath } from 'url';


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = `upload/berkas/${req.body.nisn}`;
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const hash = crypto.createHash('md5').update(file.originalname + Date.now().toString()).digest('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${hash}${ext}`);
    }
});

const upload = multer({ storage });

// Middleware for handling file uploads
const uploadFiles = upload.fields([
    { name: 'dok_pakta_integritas', maxCount: 1 },
    { name: 'dok_kk', maxCount: 1 },
    { name: 'dok_suket_nilai_raport', maxCount: 1 },
    { name: 'dok_piagam', maxCount: 1 }
]);

export const getDataPendaftarForVerif = async (req, res) => {
    const redis_key = 'DataPendaftarAllinAdmin';
    try {
        // const cacheNya = await redisGet(redis_key);
        const cacheNya = false;
        if (cacheNya) {

            res.status(200).json({
                'status': 1,
                'message': 'Data di ambil dari cache',
                'data': JSON.parse(cacheNya)
            });
           
        }else{

            const adminNya = req.user.userId;

            const dataAdminNya = await DataUsers.findOne({
                where: {
                    id: adminNya,
                    is_active: 1,
                    is_delete: 0
                }
            });


            let whereFor = {
                [Op.or]: [
                  { is_delete: { [Op.is]: null } },
                  { is_delete: 0 }
                ]
              };
      
            if (dataAdminNya.role_ == 101) {
                whereFor.verifikasikan_disdukcapil = 1
                whereFor.kabkota_id = dataAdminNya.kabkota_id
            }

            const resData = await DataPendaftars.findAll({
                attributes: { exclude: ['password_'] },
                include: [
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah',
                        attributes: ['kode_wilayah','nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_kec',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_kot',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: DataUsers,
                        as: 'diverifikasi_oleh',
                        attributes: ['id', 'nama']
                    }
                ],
                where: whereFor
            });
            if(resData != null){

                // const resDatas = resData.map(item => ({
                //     ...item.toJSON(),
                //     encodedId: encodeId(item.id)
                // }));
                const resDatas = resData.map(item => {
                    const jsonItem = item.toJSON();
                    jsonItem.id_ = encodeId(item.id); // Add the encoded ID to the response
                    delete jsonItem.id; // Hapus kolom id dari output JSON
                   
                    return jsonItem;
                });

                // const resDatas = resData.map(item => {
                //     const jsonItem = item.toJSON();
                //     const encodedId = encodeId(jsonItem.id); // Encode the original ID
                //     delete jsonItem.id; // Remove the original ID from the response
                //     jsonItem.encodedId = encodedId; // Add the encoded ID to the response
                //     return jsonItem;
                // });

                const newCacheNya = resDatas;
                await redisSet(redis_key, JSON.stringify(newCacheNya), process.env.REDIS_EXPIRE_TIME_SOURCE_DATA); 

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': resDatas
                });
            }else{

                res.status(200).json({
                    'status': 0,
                    'message': 'Data kosong',
                });

            }

        }
    } catch (err){
        console.error('Error fetching data:', err); // Log the error for debugging
        res.status(404).json({
            'status': 0,
            'message': 'Error'
        });
    }
}

export const getDataPendaftarForVerifPagination = async (req, res) => {
    const redis_key = 'DataPendaftarAllinAdmin';
    try {
        // const cacheNya = await redisGet(redis_key);
        const cacheNya = false;
        if (cacheNya) {
            res.status(200).json({
                status: 1,
                message: 'Data diambil dari cache',
                data: JSON.parse(cacheNya)
            });
        } else {
            const adminNya = req.user.userId;

            const dataAdminNya = await DataUsers.findOne({
                where: {
                    id: adminNya,
                    is_active: 1,
                    is_delete: 0
                }
            });

            let whereFor = {
                [Op.or]: [
                    { is_delete: { [Op.is]: null } },
                    { is_delete: 0 }
                ]
            };

            if (dataAdminNya.role_ == 101) {
                whereFor.verifikasikan_disdukcapil = 1;
                whereFor.kabkota_id = dataAdminNya.kabkota_id;
            }

            // Parameter pencarian opsional
            const { nisn, nama } = req.query;
            if (nisn) {
                whereFor.nisn = nisn; // Tambahkan kondisi pencarian berdasarkan NISN
            }

            if (nama) {
                whereFor.nama_lengkap = { [Op.like]: `%${nama}%` }; // Add LIKE condition for nama_lengkap
            }
            

            // Pagination logic
            const page = parseInt(req.query.page) || 1; // Default page is 1
            const limit = parseInt(req.query.limit) || 10; // Default limit is 10
            const offset = (page - 1) * limit;

            const { count, rows } = await DataPendaftars.findAndCountAll({
                attributes: { exclude: ['password_'] },
                include: [
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_kec',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_kot',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_prov',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    }
                ],
                where: whereFor,
                limit,
                offset
            });

            if (rows.length > 0) {
                const resDatas = rows.map(item => {
                    const jsonItem = item.toJSON();
                    jsonItem.id_ = encodeId(item.id); // Add the encoded ID to the response
                    delete jsonItem.id; // Hapus kolom id dari output JSON
                    return jsonItem;
                });

                const newCacheNya = resDatas;
                await redisSet(redis_key, JSON.stringify(newCacheNya), process.env.REDIS_EXPIRE_TIME_SOURCE_DATA);

                res.status(200).json({
                    status: 1,
                    message: 'Data berhasil ditemukan',
                    currentPage: page,
                    totalPages: Math.ceil(count / limit),
                    totalItems: count,
                    data: resDatas
                });
            } else {
                res.status(200).json({
                    status: 0,
                    message: 'Data kosong',
                    data: []
                });
            }
        }
    } catch (err) {
        console.error('Error fetching data:', err); // Log the error for debugging
        res.status(404).json({
            status: 0,
            message: 'Error'
        });
    }
};

export const getDataPendaftarByWhere = async (req, res) => {
    const redis_key = 'DataPendaftarAllinAdmin';
    try {
        // const cacheNya = await redisGet(redis_key);
        const cacheNya = false;
        if (cacheNya) {
            res.status(200).json({
                status: 1,
                message: 'Data diambil dari cache',
                data: JSON.parse(cacheNya)
            });
        } else {
            const adminNya = req.user.userId;
            // const adminNya = 19;

            const dataAdminNya = await DataUsers.findOne({
                where: {
                    id: adminNya,
                    is_active: 1,
                    is_delete: 0
                }
            });

            let whereFor = {
                [Op.or]: [
                    { is_delete: { [Op.is]: null } },
                    { is_delete: 0 }
                ]
            };

            // Parameter pencarian opsional
            const { nisn, nama } = req.query;
            //  if (nisn) {
            //      whereFor.nisn = nisn; // Tambahkan kondisi pencarian berdasarkan NISN
            //  }
            

            if (nisn) {
                whereFor.nisn = nisn;
            }
            
 
             if (nama) {
                 whereFor.nama_lengkap = { [Op.like]: `${nama}%` }; // Add LIKE condition for nama_lengkap
             }


            if (dataAdminNya.role_ != 101) {
                const kirimDukcapil = req.query.kirim_dukcapil;
                const verifikasiDukcapil = req.query.verifikasi_dukcapil;
                const verifikasiAdmin = req.query.is_verified;

                // if (kirimDukcapil != 1) {
                //     whereFor.verifikasikan_disdukcapil = {
                //         [Sequelize.Op.or]: [0, null], // Mencari data dengan nilai 0 atau null
                //     };
                // }
                // if (verifikasiDukcapil != 1) {
                //     whereFor.is_verified_disdukcapil = {
                //         [Sequelize.Op.or]: [0, null], // Mencari data dengan nilai 0 atau null
                //     };
                // }

                // if (verifikasiAdmin != 1) {
                //     whereFor.is_verified = {
                //         [Sequelize.Op.or]: [0, null], // Mencari data dengan nilai 0 atau null
                //     };
                // }

                if (verifikasiAdmin) {
                    whereFor.is_verified = verifikasiAdmin;
                }

                if (kirimDukcapil) {
                    whereFor.verifikasikan_disdukcapil = kirimDukcapil;
                }

                if (verifikasiDukcapil) {
                    whereFor.is_verified_disdukcapil = verifikasiDukcapil;
                }


               
            }

            if (dataAdminNya.role_ == 101) {
                const verifikasiDukcapil = req.query.verifikasi_dukcapil;

                whereFor.verifikasikan_disdukcapil =  1;
                whereFor.is_verified !=  1;
                whereFor.kabkota_id = dataAdminNya.kabkota_id;
                // if (verifikasiDukcapil != 1) {
                //     whereFor.is_verified_disdukcapil = {
                //         [Sequelize.Op.or]: [0, null], // Mencari data dengan nilai 0 atau null
                //     };
                // }
                if (verifikasiDukcapil) {
                    whereFor.is_verified_disdukcapil = verifikasiDukcapil;
                }

               
            }

          
            

            // Pagination logic
            const page = parseInt(req.query.page) || 1; // Default page is 1
            const limit = parseInt(req.query.limit) || 10; // Default limit is 10
            const offset = (page - 1) * limit;

            const { count, rows } = await DataPendaftars.findAndCountAll({
                attributes: { exclude: ['password_'] },
                include: [
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_kec',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_kot',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_prov',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_prov',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: DataUsers,
                        as: 'diverifikasi_oleh',
                        attributes: ['id', 'nama']
                    }
                ],
                where: whereFor,
                limit,
                offset
            });

            if (rows.length > 0) {
                const resDatas = rows.map(item => {
                    const jsonItem = item.toJSON();
                    jsonItem.id_ = encodeId(item.id); // Add the encoded ID to the response
                    delete jsonItem.id; // Hapus kolom id dari output JSON
                    return jsonItem;
                });

                const newCacheNya = resDatas;
                await redisSet(redis_key, JSON.stringify(newCacheNya), process.env.REDIS_EXPIRE_TIME_SOURCE_DATA);

                res.status(200).json({
                    status: 1,
                    message: 'Data berhasil ditemukan',
                    currentPage: page,
                    totalPages: Math.ceil(count / limit),
                    totalItems: count,
                    data: resDatas
                });
            } else {
                res.status(200).json({
                    status: 0,
                    message: 'Data kosong',
                    data: []
                });
            }
        }
    } catch (err) {
        console.error('Error fetching data:', err); // Log the error for debugging
        res.status(404).json({
            status: 0,
            message: 'Error'
        });
    }
};

export const getDataPendaftarCount = async (req, res) => {
    const redis_key = 'DataPendaftarCountAdmin';
    try {
        // const cacheNya = await redisGet(redis_key);
        const cacheNya = false;
        if (cacheNya) {
            res.status(200).json({
                status: 1,
                message: 'Data diambil dari cache',
                data: JSON.parse(cacheNya)
            });
        } else {
            const adminNya = 19;

            const dataAdminNya = await DataUsers.findOne({
                where: {
                    id: adminNya,
                    is_active: 1,
                    is_delete: 0
                }
            });

            let whereFor = {
                [Op.or]: [
                    { is_delete: { [Op.is]: null } },
                    { is_delete: 0 }
                ]
            };


            if (dataAdminNya.role_ == 101) {
                whereFor.kabkota_id = dataAdminNya.kabkota_id;
            }

            // Parameter pencarian opsional
            const { nisn } = req.query;
            if (nisn) {
                whereFor.nisn = nisn; // Tambahkan kondisi pencarian berdasarkan NISN
            }

            // Menghitung data berdasarkan kondisi
            const countVerifikasikan1 = await DataPendaftars.count({
                where: {
                    ...whereFor,
                    verifikasikan_disdukcapil: 1,
                }
            });

            const countVerifikasikan1AndVerified1 = await DataPendaftars.count({
                where: {
                    ...whereFor,
                    verifikasikan_disdukcapil: 1,
                    is_verified_disdukcapil: 1,
                }
            });

            const countVerifikasikan1AndVerifiedNullOr0 = await DataPendaftars.count({
                where: {
                    ...whereFor,
                    verifikasikan_disdukcapil: 1,
                    [Op.or]: [
                        { is_verified_disdukcapil: { [Op.is]: null } },
                        { is_verified_disdukcapil: 0 }
                    ]
                }
            });

            res.status(200).json({
                status: 1,
                message: 'Jumlah data berhasil dihitung',
                data: {
                    verifikasikan_disdukcapil_1: countVerifikasikan1,
                    verifikasikan_disdukcapil_1_and_verifikasi_dukcapil_1: countVerifikasikan1AndVerified1,
                    verifikasikan_disdukcapil_1_and_verifikasi_dukcapil_0_null: countVerifikasikan1AndVerifiedNullOr0
                }
            });
        }
    } catch (err) {
        console.error('Error fetching data:', err); // Log the error for debugging
        res.status(404).json({
            status: 0,
            message: 'Error'
        });
    }
};


export const getDataPendaftarById_BAK = async (req, res) => {
        const { id } = req.params; // Ambil id dari params URL
        try {
            const resData = await DataPendaftars.findOne({
                where: {
                    id: decodeId(id),
                    is_delete: 0
                },
                include: [
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah',
                        attributes: ['kode_wilayah','nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_kec',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_kot',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_prov',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: DataUsers,
                        as: 'diverifikasi_oleh',
                        attributes: ['id', 'nama']
                    }
                ],
                
            });
            if(resData != null){

                // const baseUrl = process.env.BASE_URL+'upload/berkas/'+resData.nisn+'/';// Ganti dengan URL dasar yang diinginkan
                const baseUrl = `${process.env.BASE_URL}download/${resData.nisn}/`; // Ganti dengan URL dasar yang diinginkan

                const data = {
                    id_: id,
                    ...resData.toJSON(), // Convert Sequelize instance to plain object
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

                res.status(200).json({
                    status: 1,
                    message: 'Data berhasil ditemukan',
                    data: data
                });
                
    
                // res.status(200).json({
                //     status: 1,
                //     message: 'Data berhasil ditemukan',
                //     data: resData
                // });
               
                // const data = {
                //     id_: id, 
                //     ...resData.toJSON(), // Convert Sequelize instance to plain object
                // };
                // delete data.id; // Remove original ID from the response
    
                // res.status(200).json({
                //     status: 1,
                //     message: 'Data berhasil ditemukan',
                //     data: data
                // });

            }else{

                res.status(200).json({
                    'status': 0,
                    'message': 'Data tidak ditemukan',
                });

            }
        }catch (error) {
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }

        
}

export const getDataPendaftarById = async (req, res) => {  
    const { id } = req.params; // Ambil id dari params URL  
    try {  
        const resData = await DataPendaftars.findOne({  
            where: {  
                id: decodeId(id),  
                is_delete: 0  
            },  
            include: [  
                {  
                    model: WilayahVerDapodik,  
                    as: 'data_wilayah',  
                    attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']  
                },  
                {  
                    model: WilayahVerDapodik,  
                    as: 'data_wilayah_kec',  
                    attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']  
                },  
                {  
                    model: WilayahVerDapodik,  
                    as: 'data_wilayah_kot',  
                    attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']  
                },  
                {  
                    model: WilayahVerDapodik,  
                    as: 'data_wilayah_prov',  
                    attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']  
                },  
                {  
                    model: DataUsers,  
                    as: 'diverifikasi_oleh',  
                    attributes: ['id', 'nama']  
                }  
            ],  
        });  
  
        if (resData != null) {  

            // Check if opened_by is not 0  
            if (resData.opened_by != 0) {  
                // Fetch the admin's name using opened_by  
                const adminData = await DataUsers.findOne({  
                    where: { id: resData.opened_by },  
                    attributes: ['nama'] // Get only the name  
                });  
  
                // Check if the current user is the one who opened the data  
                if (req.user.userId != resData.opened_by) {  
                    const adminName = adminData ? adminData.nama : 'Admin'; // Fallback to 'Admin' if not found  
                    return res.status(200).json({  
                        status: 0,  
                        message: `Data Sedang Diverifikasi Oleh Admin: ${adminName}`,  
                        data: [] // Return the data for reference  
                    });  
                }  
            }  
  
            // Update the opened_by column  
            await DataPendaftars.update(  
                { opened_by: req.user.userId }, // Set the opened_by field  
                { where: { id: decodeId(id) } } // Condition to find the correct record  
            );  
  
            const baseUrl = `${process.env.BASE_URL}download/${resData.nisn}/`; // Ganti dengan URL dasar yang diinginkan  
  
            const data = {  
                id_: id,  
                ...resData.toJSON(), // Convert Sequelize instance to plain object  
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
  
            res.status(200).json({  
                status: 1,  
                message: 'Data berhasil ditemukan',  
                data: data  
            });  
  
        } else {  
            res.status(200).json({  
                'status': 0,  
                'message': 'Data tidak ditemukan',  
            });  
        }  
    } catch (error) {  
        res.status(500).json({  
            status: 0,  
            message: error.message,  
        });  
    }  
}  

export const verifikasiPendaftar = async (req, res) => {
        const { id, is_verified } = req.body;

        if (!id) {
            return res.status(400).json({ status: 0, message: 'Wajib kirim id' });
        }

        let decodedId;
        try {
            decodedId = decodeId(id);
            if (!decodedId) {
                return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
            }
        } catch (err) {
            console.error('Error decoding ID:', err);
            return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
        }

        console.log('Decoded ID:', decodedId); // For debugging

        try {
            const resData = await DataPendaftars.findOne({
                where: {
                    id: decodedId,
                    is_delete: 0
                }
            });

            if (!resData) {
                return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
            }

            await DataPendaftars.update(
                {
                    is_verified,
                    updated_at: new Date(), // Set the current date and time
                    updated_by: req.user.userId, // Extracted from token
                    verified_at: new Date(), // Set the current date and time
                    verified_by: req.user.userId, // Extracted from token
                    opened_by: 0 // Set opened_by to 0  
                },
                {
                    where: {
                        id: decodedId,
                        is_delete: 0
                    }
                }
            );

            await clearCacheByKeyFunction('DataPendaftarAllinAdmin');

            res.status(200).json({
                status: 1,
                message: 'Berhasil perbaharui data',
            });
        } catch (error) {
            console.error('Error updating data:', error);
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }
}

export const updatePendaftar = async (req, res) => {
    const { 
        
        id,
        sekolah_asal_id,
        jenis_lulusan_id,
        tahun_lulus,
        nama_sekolah_asal,
        nik,
        nama_lengkap,
        jenis_kelamin,
        tanggal_lahir,
        tempat_lahir,
        status_domisili,
        alamat,
        provinsi_id,
        kabkota_id,
        kecamatan_id,
        kelurahan_id,
        rt,
        rw,
        lat,
        lng,
        no_wa,
        tanggal_cetak_kk,
        kejuaraan_id,
        nama_kejuaraan,
        tanggal_sertifikat,
        umur_sertifikat,
        nomor_sertifikat,
        nilai_prestasi,
        nilai_raport,
        nilai_raport_rata,
        is_tidak_sekolah,
        is_anak_panti,
        is_anak_keluarga_tidak_mampu,
        is_anak_guru_jateng,
        is_pip,
        verifikasikan_disdukcapil,
        dari_dukcapil,
        is_verified_disdukcapil
    
    } = req.body;

    if (!id) {
        return res.status(400).json({ status: 0, message: 'Wajib kirim id' });
    }

    let decodedId;
    try {
        decodedId = decodeId(id);
        if (!decodedId) {
            return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
        }
    } catch (err) {
        console.error('Error decoding ID:', err);
        return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
    }

    // console.log('Decoded ID:', decodedId); // For debugging

    try {

        let nilai_raport_def = {
            "pendidikan_agama": '',
            "pkn": '',
            "bahasa_indonesia": '',
            "matematika": '',
            "ipa":'',
            "ips": '',
            "bahasa_inggris": '',
            "pjok": '',
            "seni_budaya": ''
          }

          nilai_raport_def = JSON.stringify(nilai_raport_def);
        
        const resData = await DataPendaftars.findOne({
            where: {
                id: decodedId,
                is_delete: 0
            }
        });

        if (!resData) {
            return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
        }

        await DataPendaftars.update(
            {
                sekolah_asal_id,
                jenis_lulusan_id,
                tahun_lulus,
                nama_sekolah_asal,
                nik,
                nama_lengkap,
                jenis_kelamin,
                tanggal_lahir: new Date(tanggal_lahir),
                tempat_lahir,
                status_domisili,
                alamat,
                provinsi_id,
                kabkota_id,
                kecamatan_id,
                kelurahan_id,
                rt,
                rw,
                lat,
                lng,
                no_wa,
                tanggal_cetak_kk: tanggal_cetak_kk ? new Date(tanggal_cetak_kk) : null,
                kejuaraan_id: kejuaraan_id || 0,
                nama_kejuaraan,
                tanggal_sertifikat: tanggal_sertifikat ? new Date(tanggal_sertifikat) : null,
                umur_sertifikat: umur_sertifikat || 0,
                nomor_sertifikat,
                nilai_prestasi,
                nilai_raport: nilai_raport || nilai_raport_def,
                nilai_raport_rata,
                is_tidak_sekolah,
                is_anak_panti,
                is_anak_keluarga_tidak_mampu,
                is_anak_guru_jateng,
                is_pip,
                updated_at: new Date(),
                updated_by: req.user.userId,
                verifikasikan_disdukcapil,
                opened_by: 0 // Set opened_by to 0  

            },
            {
                where: {
                    id: decodedId,
                    [Op.or]: [
                        { is_delete: 0 }, // Entri yang belum dihapus
                        { is_delete: null } // Entri yang belum diatur
                    ]
                }
            }
        );

        if(dari_dukcapil == 1){

            await DataPendaftars.update(
                {
                    verifikasikan_disdukcapil,
                    is_verified_disdukcapil,
                    disdukcapil_at: new Date(),
                    disdukcapil_by: req.user.userId,
    
                },
                {
                    where: {
                        id: decodedId,
                        [Op.or]: [
                            { is_delete: 0 }, // Entri yang belum dihapus
                            { is_delete: null } // Entri yang belum diatur
                        ]
                    }
                }
            );

        }

        await clearCacheByKeyFunction('DataPendaftarAllinAdmin');

        res.status(200).json({
            status: 1,
            message: 'Berhasil perbaharui data',
        });
    } catch (error) {
        console.error('Error updating data:', error);
        res.status(500).json({
            status: 0,
            message: error.message,
        });
    }
}

export const updatePendaftarCapilBAK = async (req, res) => {
    const { 
        
        id,
        verifikasikan_disdukcapil,
        dari_dukcapil,
        is_verified_disdukcapil,
        tanggal_kedatangan,
        tanggal_kedatangan_ibu,
        tanggal_kedatangan_ayah
    
    } = req.body;

    if (!id) {
        return res.status(400).json({ status: 0, message: 'Wajib kirim id' });
    }

    let decodedId;
    try {
        decodedId = decodeId(id);
        if (!decodedId) {
            return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
        }
    } catch (err) {
        console.error('Error decoding ID:', err);
        return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
    }

    // console.log('Decoded ID:', decodedId); // For debugging

    try {
    
        const resData = await DataPendaftars.findOne({
            where: {
                id: decodedId,
                is_delete: 0
            }
        });

        if (!resData) {
            return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
        }

        await DataPendaftars.update(
            {
                tanggal_kedatangan,
                tanggal_kedatangan_ibu,
                tanggal_kedatangan_ayah,
                updated_at: new Date(),
                updated_by: req.user.userId,
                verifikasikan_disdukcapil,

            },
            {
                where: {
                    id: decodedId,
                    [Op.or]: [
                        { is_delete: 0 }, // Entri yang belum dihapus
                        { is_delete: null } // Entri yang belum diatur
                    ]
                }
            }
        );

        if(dari_dukcapil == 1){

            await DataPendaftars.update(
                {
                    tanggal_kedatangan,
                    tanggal_kedatangan_ibu,
                    tanggal_kedatangan_ibu,
                    verifikasikan_disdukcapil,
                    is_verified_disdukcapil,
                    disdukcapil_at: new Date(),
                    disdukcapil_by: req.user.userId,
    
                },
                {
                    where: {
                        id: decodedId,
                        [Op.or]: [
                            { is_delete: 0 }, // Entri yang belum dihapus
                            { is_delete: null } // Entri yang belum diatur
                        ]
                    }
                }
            );

        }

        await clearCacheByKeyFunction('DataPendaftarAllinAdmin');

        res.status(200).json({
            status: 1,
            message: 'Berhasil perbaharui data',
        });
    } catch (error) {
        console.error('Error updating data:', error);
        res.status(500).json({
            status: 0,
            message: error.message,
        });
    }
}

export const updatePendaftarCapil = async (req, res) => {
    const { 
        id,
        verifikasikan_disdukcapil,
        dari_dukcapil,
        is_verified_disdukcapil,
        tanggal_kedatangan,
        tanggal_kedatangan_ibu,
        tanggal_kedatangan_ayah,
        keterangan_dukcapl,
    } = req.body;

    if (!id) {
        return res.status(400).json({ status: 0, message: 'Wajib kirim id' });
    }

    let decodedId;
    try {
        decodedId = decodeId(id);
        if (!decodedId) {
            return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
        }
    } catch (err) {
        console.error('Error decoding ID:', err);
        return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
    }

    try {
        const resData = await DataPendaftars.findOne({
            where: {
                id: decodedId,
                is_delete: 0
            }
        });

        if (!resData) {
            return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
        }

        // Buat objek data update
        const updateData = {
            verifikasikan_disdukcapil,
            is_verified_disdukcapil,
            disdukcapil_at: new Date(),
            disdukcapil_by: req.user.userId,
            keterangan_dukcapl,
        };

        // Tambahkan tanggal hanya jika tidak null
        if (tanggal_kedatangan !== null) {
            updateData.tanggal_kedatangan = tanggal_kedatangan;
        }
        if (tanggal_kedatangan_ibu !== null) {
            updateData.tanggal_kedatangan_ibu = tanggal_kedatangan_ibu;
        }
        if (tanggal_kedatangan_ayah !== null) {
            updateData.tanggal_kedatangan_ayah = tanggal_kedatangan_ayah;
        }

        await DataPendaftars.update(updateData, {
            where: {
                id: decodedId,
                [Op.or]: [
                    { is_delete: 0 }, // Entri yang belum dihapus
                    { is_delete: null } // Entri yang belum diatur
                ]
            }
        });

        await clearCacheByKeyFunction('DataPendaftarAllinAdmin');

        res.status(200).json({
            status: 1,
            message: 'Berhasil perbaharui data',
        });
    } catch (error) {
        console.error('Error updating data:', error);
        res.status(500).json({
            status: 0,
            message: error.message,
        });
    }
};

//     const {
//         id,
//         sekolah_asal_id,
//         jenis_lulusan_id,
//         tahun_lulus,
//         nama_sekolah_asal,
//         nik,
//         nama_lengkap,
//         jenis_kelamin,
//         tanggal_lahir,
//         tempat_lahir,
//         status_domisili,
//         alamat,
//         provinsi_id,
//         kabkota_id,
//         kecamatan_id,
//         kelurahan_id,
//         rt,
//         rw,
//         lat,
//         lng,
//         no_wa,
//         tanggal_cetak_kk,
//         kejuaraan_id,
//         nama_kejuaraan,
//         tanggal_sertifikat,
//         umur_sertifikat,
//         nomor_sertifikat,
//         nilai_prestasi,
//         nilai_raport,
//         nilai_raport_rata,
//         is_tidak_sekolah,
//         is_anak_panti,
//         is_anak_keluarga_tidak_mampu,
//         is_anak_guru_jateng,
//         is_pip
//     } = req.body;

//     try {

//         res.status(200).json({
//             status: 1,
//             message: 'Data berhasil diperbarui',
//         });


//         // Cek apakah pendaftar sudah ada dan belum dihapus
//         const existingPendaftar = await DataPendaftars.findOne({
//             where: {
//                 id: decodeId(id),
//                 [Op.or]: [
//                     { is_delete: 0 }, // Entri yang belum dihapus
//                     { is_delete: null } // Entri yang belum diatur
//                 ]
//             }
//         });

//         if (!existingPendaftar) {
//             return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
//         }

//         const updateData = {
//             sekolah_asal_id,
//             jenis_lulusan_id,
//             tahun_lulus,
//             nama_sekolah_asal,
//             nik,
//             nama_lengkap,
//             jenis_kelamin,
//             tanggal_lahir: new Date(tanggal_lahir),
//             tempat_lahir,
//             status_domisili,
//             alamat,
//             provinsi_id,
//             kabkota_id,
//             kecamatan_id,
//             kelurahan_id,
//             rt,
//             rw,
//             lat,
//             lng,
//             no_wa,
//             tanggal_cetak_kk: tanggal_cetak_kk ? new Date(tanggal_cetak_kk) : null,
//             kejuaraan_id: kejuaraan_id || 0,
//             nama_kejuaraan,
//             tanggal_sertifikat: tanggal_sertifikat ? new Date(tanggal_sertifikat) : null,
//             umur_sertifikat: umur_sertifikat || 0,
//             nomor_sertifikat,
//             nilai_prestasi,
//             nilai_raport,
//             nilai_raport_rata,
//             is_tidak_sekolah,
//             is_anak_panti,
//             is_anak_keluarga_tidak_mampu,
//             is_anak_guru_jateng,
//             is_pip,
//             updated_at: new Date(),
//             updated_by: req.user.userId

//         };

//         // // Update the pendaftar entry
//         await DataPendaftars.update(updateData, {
//             where: { id: decodeId(id), }
//         });

//         await clearCacheByKeyFunction('DataPendaftarAllinAdmin');
//         res.status(200).json({
//             status: 1,
//             message: 'Data berhasil diperbarui',
//             data: updateData
//         });

//     } catch (error) {
//         console.error('Gagal memperbarui data:', error);
//         res.status(500).json({
//             status: 0,
//             message: error.message
//         });
//     }
// };