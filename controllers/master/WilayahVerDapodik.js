// Import model Product
import EzWilayahVerDapodiks from "../../models/master/WilayahVerDapodikModel.js";
import { redisGet, redisSet } from '../../redis.js'; // Import the Redis functions


const getProvinsi = async (req, res) => {
    try {

        const redis_key = 'ProvinsiAll';
        const cacheNya = await redisGet(redis_key);
        if (cacheNya) {

            res.status(200).json({
                'status': 1,
                'message': 'Data di ambil dari cache',
                'data': JSON.parse(cacheNya)
            });

           
        }else{

            const resData = await EzWilayahVerDapodiks.findAll({
                attributes: ['kode_wilayah', 'nama'], // Specify the attributes to retrieve
                where: {
                    id_level_wilayah: 1
                }
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
                    'status': 1,
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

const getKabkota = async (req, res) => {
    try {
        const { kode_provinsi } = req.body;
        const redis_key = `Kabkota_${kode_provinsi}`;
        const cacheNya = await redisGet(redis_key);
        if (cacheNya) {

            res.status(200).json({
                'status': 1,
                'message': 'Data di ambil dari cache',
                'data': JSON.parse(cacheNya)
            });

           
        }else{

            const resData = await EzWilayahVerDapodiks.findAll({
                attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah'], // Specify the attributes to retrieve
                where: {
                    mst_kode_wilayah: kode_provinsi,
                    id_level_wilayah: 2
                }
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
                    'status': 1,
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

const getKecamatan = async (req, res) => {
    try {
        const { kode_kabkota } = req.body;
        const redis_key = `Kecamatan_${kode_kabkota}`;
        const cacheNya = await redisGet(redis_key);
        if (cacheNya) {

            res.status(200).json({
                'status': 1,
                'message': 'Data di ambil dari cache',
                'data': JSON.parse(cacheNya)
            });

           
        }else{

            const resData = await EzWilayahVerDapodiks.findAll({
                attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah'], // Specify the attributes to retrieve
                where: {
                    mst_kode_wilayah: kode_kabkota,
                    id_level_wilayah: 3
                }
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
                    'status': 1,
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

const getKelurahan = async (req, res) => {
    try {
        const { kode_kecamatan } = req.body;
        const redis_key = `Kelurahan_${kode_kecamatan}`;
        const cacheNya = await redisGet(redis_key);
        if (cacheNya) {

            res.status(200).json({
                'status': 1,
                'message': 'Data di ambil dari cache',
                'data': JSON.parse(cacheNya)
            });

           
        }else{

            const resData = await EzWilayahVerDapodiks.findAll({
                attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah'], // Specify the attributes to retrieve
                where: {
                    mst_kode_wilayah: kode_kecamatan,
                    id_level_wilayah: 4
                }
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
    } catch (err){
        console.error('Error fetching data:', err); // Log the error for debugging
        res.status(404).json({
            'status': 0,
            'message': 'Error'
        });
    }
}


export { getProvinsi, getKabkota, getKecamatan, getKelurahan };


