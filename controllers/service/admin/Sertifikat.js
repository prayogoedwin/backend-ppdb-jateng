import Sertifikats from "../../../models/service/DataSertifikatModel.js";
import { redisGet, redisSet } from '../../../redis.js'; // Import the Redis functions

export const getSertifikats = async (req, res) => {
    const redis_key = 'SertifikatAllinAdmin';
    try {
        const cacheNya = await redisGet(redis_key);
        if (cacheNya) {

            res.status(200).json({
                'status': 1,
                'message': 'Data di ambil dari cache',
                'data': JSON.parse(cacheNya)
            });

           
        }else{

            const resData = await Sertifikats.findAll({
                order: [
                    ['id', 'ASC']
                ]
            });
            if(resData != null ){

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