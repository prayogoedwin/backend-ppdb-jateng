import Timelines from "../../../models/service/TimelineModel.js";
import { redisGet, redisSet } from '../../../redis.js'; // Import the Redis functions
import { clearCacheByKeyFunction } from '../../config/CacheControl.js';


export const getTimeline = async (req, res) => {
    const redis_key = 'TimelineAllinAdmin';
    try {
        const cacheNya = await redisGet(redis_key);
        if (cacheNya) {

            res.status(200).json({
                'status': 1,
                'message': 'Data di ambil dari cache',
                'data': JSON.parse(cacheNya)
            });

           
        }else{

            const resData = await Timelines.findAll({
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

export const getTimelineById = async (req, res) => {
    const { id } = req.params; // Ambil id dari params URL
    try {
        const resData = await Timelines.findOne({
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
export const updateTimeline = [
    async (req, res) => {
        const { 
            id, 
            nama, 
            keterangan,
            tanggal_buka,
            tanggal_tutup,
            status,
            icon,
            url_route,
        } = req.body;


        try {
            const resData = await Timelines.findOne({
                where: {
                    id
                }
            });

            if (!resData) {
                return res.status(400).json({ status: 0, message: 'Invalid id' });
            }
            
            if(resData.id == 5 && status == 1){

                await Timelines.update({
                    status: 0
                }, {
                    where: {
                        id:4
                    }
                });

            }


            if(resData.id == 5 && status == 0){

                await Timelines.update({
                    status: 1
                }, {
                    where: {
                        id:4
                    }
                });

            }


            if(resData.id == 4 && status == 1){

                await Timelines.update({
                    status: 0
                }, {
                    where: {
                        id:5
                    }
                });

            }

            if(resData.id == 4 && status == 0){

                await Timelines.update({
                    status: 1
                }, {
                    where: {
                        id:5
                    }
                });

            }

            await Timelines.update({
                nama,
                keterangan,
                tanggal_buka,
                tanggal_tutup,
                status,
                updatedAt: new Date(), // Set the current date and time
                updatedby: req.user.userId, // Use user ID from token
                icon,
                url_route
            }, {
                where: {
                    id
                }
            });

            await clearCacheByKeyFunction('TimelineAllinAdmin');
            await clearCacheByKeyFunction('TimelineAll');

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
