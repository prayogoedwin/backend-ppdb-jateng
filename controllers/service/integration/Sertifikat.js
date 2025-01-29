import DataSertifikats from "../../../models/service/DataSertifikatModel.js";
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

// Function to handle POST request
export const insertSertifikat = async (req, res) => {
    const userId = req.user.userId;
    try {
        const {
            kejuaraan_id,
            nama_kejuaraan,
            tanggal_sertifikat,
            nomor_sertifikat,
            nisn,
            nik,
            url_file
        } = req.body;

        const newSertifikatData = {
            kejuaraan_id,
            nama_kejuaraan,
            tanggal_sertifikat,
            nomor_sertifikat,
            nisn,
            nik,
            url_file,
            created_at: new Date(),
            created_by: userId,
        };
        DataSertifikats.create(newSertifikatData);
        res.status(201).json({
            status: 1,
            message: 'Daftar berhasil dibuat',
            data: newSertifikatData
        });

    } catch (error) {
        console.error('Error daftar:', error);
        res.status(500).json({
            status: 0,
            message: error.message || 'Terjadi kesalahan saat proses daftar'
        });
    }
}