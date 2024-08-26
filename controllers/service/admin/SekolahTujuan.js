import SekolahTujuans from '../../../models/master/SekolahTujuanModel.js';
import { encodeId, decodeId } from '../../../middleware/EncodeDecode.js';
import { Op } from 'sequelize';
import { redisGet, redisSet } from '../../../redis.js';
import { clearCacheByKeyFunction } from '../../config/CacheControl.js';


export const getSekolahTujuanAdmin = async (req, res) => {
    const redis_key = 'SekolahTujuanAdmin'+req.body.bentuk_pendidikan_id;
    const sekolah_id = req.body.sekolah_id;
    try {
        const cacheNya = await redisGet(redis_key);
        if (cacheNya) {

            res.status(200).json({
                'status': 1,
                'message': 'Data di ambil dari cache',
                'data': JSON.parse(cacheNya)
            });

           
        }else{

            if(sekolah_id == null){

                const resData = await SekolahTujuans.findAll({
                    where: {
                        bentuk_pendidikan_id: req.body.bentuk_pendidikan_id
                    },
                    attributes: ['id', 'nama', 'lat', 'lng', 'daya_tampung'] // Specify the attributes to retrieve
                });

                if(resData.length > 0){

                    const newCacheNya = resData;
                    await redisSet(redis_key, JSON.stringify(newCacheNya), process.env.REDIS_EXPIRE_TIME_MASTER); 
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': resData
                    });
                }else{
    
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': resData
                    });
    
                }

               
            }else{

                const resData = await SekolahTujuans.findAll({
                    where: {
                        id: sekolah_id
                    },
                    attributes: ['id', 'nama', 'lat', 'lng', 'daya_tampung'] // Specify the attributes to retrieve
                });

                if(resData.length > 0){

                    const newCacheNya = resData;
                    await redisSet(redis_key, JSON.stringify(newCacheNya), process.env.REDIS_EXPIRE_TIME_MASTER); 
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': resData
                    });
                }else{
    
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': resData
                    });
    
                }

               
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