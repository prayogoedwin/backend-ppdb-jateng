import { encodeId, decodeId } from '../../../middleware/EncodeDecode.js';
import DataPendaftars from "../../../models/service/DataPendaftarModel.js";
import { redisGet, redisSet } from '../../../redis.js'; // Import the Redis functions
import { clearCacheByKeyFunction } from '../../config/CacheControl.js';
import WilayahVerDapodik from '../../../models/master/WilayahVerDapodikModel.js';


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
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_prov',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    }
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
                    }
                ],
                
            });
            if(resData != null){
                
    
                // res.status(200).json({
                //     status: 1,
                //     message: 'Data berhasil ditemukan',
                //     data: resData
                // });
               
                const data = {
                    id_: encodeId(item.id), 
                    ...resData.toJSON(), // Convert Sequelize instance to plain object
                };
                delete data.id; // Remove original ID from the response
    
                res.status(200).json({
                    status: 1,
                    message: 'Data berhasil ditemukan',
                    data: data
                });

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

export const verifikasiPendaftar = [
    async (req, res) => {
        const { id, is_verified } = req.body;

        if (!id) {
            return res.status(400).json({ status: 0, message: 'ID is required' });
        }

        let decodedId;
        try {
            decodedId = decodeId(id);
            if (!decodedId) {
                return res.status(400).json({ status: 0, message: 'Invalid ID format' });
            }
        } catch (err) {
            console.error('Error decoding ID:', err);
            return res.status(400).json({ status: 0, message: 'Invalid ID format' });
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
                return res.status(400).json({ status: 0, message: 'Data not found' });
            }

            await DataPendaftars.update(
                {
                    is_verified,
                    updated_at: new Date(), // Set the current date and time
                    updated_by: req.user.userId, // Extracted from token
                    verified_at: new Date(), // Set the current date and time
                    verified_by: req.user.userId, // Extracted from token
                },
                {
                    where: {
                        id: decodedId,
                        is_delete: 0
                    }
                }
            );

            // await clearCacheByKeyFunction('DataPendaftarAllinAdmin');

            res.status(200).json({
                status: 1,
                message: 'Update successful',
            });
        } catch (error) {
            console.error('Error updating data:', error);
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }
    }
];

