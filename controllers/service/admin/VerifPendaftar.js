import DataPendaftars from "../../../models/service/DataPendaftarModel.js";
import { redisGet, redisSet } from '../../../redis.js'; // Import the Redis functions


// Get semua product
// export const getKabkotas = async (req, res) => {
//     try {
//         const kabkota = await Kabkotas.findAll();
//         res.send(kabkota);
//     } catch (err) {
//         console.log(err);
//     }
// }

export const getDataPendaftarForVerif = async (req, res) => {
    const redis_key = 'DataPendaftarAllinAdmin';
    try {
        const cacheNya = await redisGet(redis_key);
        if (cacheNya) {

            res.status(200).json({
                'status': 1,
                'message': 'Data di ambil dari cache',
                'data': JSON.parse(cacheNya)
            });

           
        }else{

            const resData = await DataPendaftars.findAll();
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
    } catch (err){
        console.error('Error fetching data:', err); // Log the error for debugging
        res.status(404).json({
            'status': 0,
            'message': 'Error'
        });
    }
}

export const getDataPendaftarById = async (req, res) => {
        const { id } = req.body;
        try {
            const resData = await DataPendaftars.findOne({
                where: {
                    id,
                    is_delete: 0
                }
            });
            if(resData.length > 0){

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
        }catch (error) {
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }

        
}

// User login
export const verifikasiPendaftar = [
    async (req, res) => {
        const { id, is_verified, verified_by } = req.body;

        try {
            const resData = await DataPendaftars.findOne({
                where: {
                    id,
                    is_delete: 0
                }
            });

            if (!resData) {
                return res.status(400).json({ status: 0, message: 'Invalid id' });
            }

            await DataPendaftars.update({
                is_verified,
                verified_at: new Date(), // Set the current date and time
                verified_by
            }, {
                where: {
                    id
                }
            });

            res.status(200).json({
                status: 1,
                message: 'Update successful',
            });
        } catch (error) {
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }
    }
];

