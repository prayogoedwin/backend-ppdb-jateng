import SekolahTujuans from '../../../models/master/SekolahTujuanModel.js'
import SekolahJurusan from "../../../models/master/SekolahJurusanModel.js";;
import { encodeId, decodeId } from '../../../middleware/EncodeDecode.js';
import { Op } from 'sequelize';
import { redisGet, redisSet } from '../../../redis.js';
import { clearCacheByKeyFunction } from '../../config/CacheControl.js';


// export const getSekolahTujuanAdmin = async (req, res) => {
//     const redis_key = 'SekolahTujuanAdmin'+req.body.bentuk_pendidikan_id;
//     const sekolah_id = req.body.sekolah_id;
//     try {
//         // const cacheNya = await redisGet(redis_key);
//         const cacheNya = false;
//         if (cacheNya) {

//             res.status(200).json({
//                 'status': 1,
//                 'message': 'Data di ambil dari cache',
//                 'data': JSON.parse(cacheNya)
//             });

           
//         }else{

//             if(sekolah_id == null){

//                 const resData = await SekolahTujuans.findAll({
//                     where: {
//                         bentuk_pendidikan_id: req.body.bentuk_pendidikan_id
//                     },
//                     attributes: ['id', 'nama', 'lat', 'lng', 'daya_tampung', 'npsn', 'alamat_jalan'] // Specify the attributes to retrieve
//                 });

//                 if(resData.length > 0){

//                     const newCacheNya = resData;
//                     await redisSet(redis_key, JSON.stringify(newCacheNya), process.env.REDIS_EXPIRE_TIME_MASTER); 
    
//                     res.status(200).json({
//                         'status': 1,
//                         'message': 'Data berhasil ditemukan',
//                         'data': resData
//                     });
//                 }else{
    
//                     res.status(200).json({
//                         'status': 0,
//                         'message': 'Data kosong',
//                         'data': resData
//                     });
    
//                 }

               
//             }else{

//                 const resData = await SekolahTujuans.findAll({
//                     where: {
//                         id: sekolah_id
//                     },
//                     attributes: ['id', 'nama', 'lat', 'lng', 'daya_tampung', 'npsn', 'alamat_jalan'] // Specify the attributes to retrieve
//                 });

//                 if(resData.length > 0){

//                     const newCacheNya = resData;
//                     await redisSet(redis_key, JSON.stringify(newCacheNya), process.env.REDIS_EXPIRE_TIME_MASTER); 
    
//                     res.status(200).json({
//                         'status': 1,
//                         'message': 'Data berhasil ditemukan',
//                         'data': resData
//                     });
//                 }else{
    
//                     res.status(200).json({
//                         'status': 0,
//                         'message': 'Data kosong',
//                         'data': resData
//                     });
    
//                 }

               
//             }

           

//         }
//     } catch (err){
//         console.error('Error fetching data:', err); // Log the error for debugging
//         res.status(404).json({
//             'status': 0,
//             'message': 'Error'
//         });
//     }
// }

export const getSekolahTujuanAdmin = async (req, res) => {  
    const redis_key = 'SekolahTujuanAdmin' + req.body.bentuk_pendidikan_id;  
    const sekolah_id = req.body.sekolah_id;  
  
    try {  
        // const cacheNya = await redisGet(redis_key);  
        const cacheNya = false; // Set to false for testing; replace with actual cache logic  
  
        if (cacheNya) {  
            res.status(200).json({  
                'status': 1,  
                'message': 'Data diambil dari cache',  
                'data': JSON.parse(cacheNya)  
            });  
        } else {  
            let resData;  
  
            if (sekolah_id == null) {  
                resData = await SekolahTujuans.findAll({  
                    where: {  
                        bentuk_pendidikan_id: req.body.bentuk_pendidikan_id  
                    },  
                    attributes: ['id', 'nama', 'lat', 'lng', 'daya_tampung', 'npsn', 'alamat_jalan']  
                });  
            } else {  
                resData = await SekolahTujuans.findAll({  
                    where: {  
                        id: sekolah_id  
                    },  
                    attributes: ['id', 'nama', 'lat', 'lng', 'daya_tampung', 'npsn', 'alamat_jalan']  
                });  
            }  
  
            if (resData.length > 0) {  
                // If bentuk_pendidikan_id is 15, fetch jurusan data  
                if (req.body.bentuk_pendidikan_id == 15) {  
                    const jurusanData = await SekolahJurusan.findAll({  
                        where: {  
                            id_sekolah_tujuan: resData.map(school => school.id)  
                        },  
                        attributes: ['id', 'nama_jurusan', 'id_sekolah_tujuan', 'daya_tampung']  
                    });  
  
                    // Format the response to include jurusan  
                    const formattedResData = resData.map(school => {  
                        return {  
                            ...school.dataValues,  
                            jurusan: jurusanData.filter(jurusan => jurusan.id_sekolah_tujuan === school.id)  
                        };  
                    });  
  
                    // Cache the new data  
                    await redisSet(redis_key, JSON.stringify(formattedResData), process.env.REDIS_EXPIRE_TIME_MASTER);  
  
                    res.status(200).json({  
                        'status': 1,  
                        'message': 'Data berhasil ditemukan',  
                        'data': formattedResData  
                    });  
                } else {  
                    // If bentuk_pendidikan_id is 13, set jurusan to null  
                    const formattedResData = resData.map(school => {  
                        return {  
                            ...school.dataValues,  
                            jurusan: null // Set jurusan to null for bentuk_pendidikan_id 13  
                        };  
                    });  
  
                    // Cache the new data  
                    await redisSet(redis_key, JSON.stringify(formattedResData), process.env.REDIS_EXPIRE_TIME_MASTER);  
  
                    res.status(200).json({  
                        'status': 1,  
                        'message': 'Data berhasil ditemukan',  
                        'data': formattedResData  
                    });  
                }  
            } else {  
                res.status(200).json({  
                    'status': 0,  
                    'message': 'Data kosong',  
                    'data': resData  
                });  
            }  
        }  
    } catch (err) {  
        console.error('Error fetching data:', err); // Log the error for debugging  
        res.status(500).json({  
            'status': 0,  
            'message': 'Terjadi kesalahan pada server',  
            'data': ''  
        });  
    }  
}  


export const getSekolahTujuanAdminById = async (req, res) => {
    const { id } = req.params; // Ambil id dari params URL
    try {
        const resData = await SekolahTujuans.findOne({
            where: {
                id
            }
        });
        if(resData != null ){
           
            res.status(200).json({
                'status': 1,
                'message': 'Data berhasil ditemukan',
                'data': resData
            });

        }else{

            res.status(200).json({
                'status': 0,
                'message': 'Data kosong',
            });

        }
    }catch (error) {
        res.status(500).json({
            status: 0,
            message: error.message,
        });
    }

    
}

// Uverif pendaftart
export const updateSekolahTujuanAdmin = [
    async (req, res) => {
        const { 
            id, 
            daya_tampung, 
            kuota_zonasi_persentase,
            kuota_zonasi,
            kuota_zonasi_khusus_persentase,
            kuota_zonasi_khusus,
            kuota_afirmasi_persentase,
            kuota_afirmasi,
            kuota_prestasi_persentase,
            kuota_prestasi,
            kuota_prestasi_khusus_persentase,
            kuota_prestasi_khusus,
            kuota_pto_persentase,
            kuota_pto,
        } = req.body;


        try {
            const resData = await SekolahTujuans.findOne({
                where: {
                    id
                }
            });

            if (!resData) {
                return res.status(400).json({ status: 0, message: 'Invalid id' });
            }

            await SekolahTujuans.update({
                daya_tampung, 
                kuota_zonasi_persentase,
                kuota_zonasi,
                kuota_zonasi_khusus_persentase,
                kuota_zonasi_khusus,
                kuota_afirmasi_persentase,
                kuota_afirmasi,
                kuota_prestasi_persentase,
                kuota_prestasi,
                kuota_prestasi_khusus_persentase,
                kuota_prestasi_khusus,
                kuota_pto_persentase,
                kuota_pto,
                updated_at: new Date(), // Set the current date and time
                updated_by: req.user.userId, // Use user ID from token
                updated_by_ip: req.ip
            }, {
                where: {
                    id
                }
            });

            await clearCacheByKeyFunction('SekolahTujuanAdmin13');
            await clearCacheByKeyFunction('SekolahTujuanAdmin15');
            await clearCacheByKeyFunction('SekolahTujuans13');
            await clearCacheByKeyFunction('SekolahTujuans15');

            res.status(200).json({
                status: 1,
                message: 'Update berhasil',
            });
        } catch (error) {
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }
    }
];


export const getSekolahTujuanJurusanAdmin = async (req, res) => {  
    const sekolah_id = req.body.sekolah_id;  
  
    try {  
        
            const resData = await SekolahJurusan.findAll({  
                where: {  
                    id_sekolah_tujuan: sekolah_id
                }
            }); 
  
            if (resData.length > 0) {  
                
                res.status(200).json({  
                    'status': 0,  
                    'message': 'Data Jurusan',  
                    'data': resData  
                });  

            } else {  
                res.status(200).json({  
                    'status': 0,  
                    'message': 'Data kosong',  
                    'data': null  
                });  
            }  
        
    } catch (err) {  
        console.error('Error fetching data:', err); // Log the error for debugging  
        res.status(500).json({  
            'status': 0,  
            'message': 'Terjadi kesalahan pada server',  
            'data': ''  
        });  
    }  
}  

export const getSekolahTujuanJurusanAdminById = async (req, res) => {
    const { id } = req.params; // Ambil id dari params URL
    try {
        const resData = await SekolahJurusan.findOne({
            where: {
                id
            }
        });
        if(resData != null ){
           
            res.status(200).json({
                'status': 1,
                'message': 'Data berhasil ditemukan',
                'data': resData
            });

        }else{

            res.status(200).json({
                'status': 0,
                'message': 'Data kosong',
            });

        }
    }catch (error) {
        res.status(500).json({
            status: 0,
            message: error.message,
        });
    }

    
}

// Uverif pendaftart
export const updateSekolahTujuanJurusanAdmin = [
    async (req, res) => {
        const { 
            id, 
            daya_tampung, 
            kuota_jarak_terdekat,
            kuota_jarak_terdekat_persentase,
            kuota_afirmasi,
            kuota_afirmasi_persentase,
            kuota_prestasi,
            kuota_prestasi_persentase,
            kuota_prestasi_khusus,
            kuota_prestasi_khusus_persentase,
        } = req.body;


        try {
            const resData = await SekolahJurusan.findOne({
                where: {
                    id
                }
            });

            if (!resData) {
                return res.status(400).json({ status: 0, message: 'Invalid id' });
            }

            await SekolahJurusan.update({
                daya_tampung, 
                kuota_jarak_terdekat_persentase,
                kuota_jarak_terdekat,
                kuota_afirmasi_persentase,
                kuota_afirmasi,
                kuota_prestasi_persentase,
                kuota_prestasi,
                kuota_prestasi_khusus_persentase,
                kuota_prestasi_khusus,
                updated_at: new Date(), // Set the current date and time
                updated_by: req.user.userId, // Use user ID from token
                updated_by_ip: req.ip
            }, {
                where: {
                    id
                }
            });

            res.status(200).json({
                status: 1,
                message: 'Update berhasil',
            });
        } catch (error) {
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }
    }
];