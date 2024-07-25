import SekolahTujuans from '../../../models/service/SekolahTujuanModel.js';
import { encodeId, decodeId } from '../../../middleware/EncodeDecode.js';
import { Op } from 'sequelize';
import { redisGet, redisSet } from '../../../redis.js';
import { clearCacheByKeyFunction } from '../../config/CacheControl.js';


export const getSekolahTujuan = async (req, res) => {
    const redis_key = 'DataSekolahTujuanAllinAdmin';
    try {
        const cacheNya = await redisGet(redis_key);
        if (cacheNya) {

            res.status(200).json({
                'status': 1,
                'message': 'Data di ambil dari cache',
                'data': JSON.parse(cacheNya)
            });
           
        }else{

            const resData = await DataPendaftars.findAll({
                attributes: { exclude: ['password_'] },
                include: [
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah',
                        attributes: ['kode_wilayah','nama', 'mst_kode_wilayah']
                    },
                ]
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