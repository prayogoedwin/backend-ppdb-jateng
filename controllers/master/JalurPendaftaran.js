// Import model Product
import JalurPendaftarans from "../../models/master/JalurPendaftaranModel.js";
import { redisGet, redisSet } from '../../redis.js'; // Import the Redis functions


// Get semua product
// export const getKabkotas = async (req, res) => {
//     try {
//         const kabkota = await Kabkotas.findAll();
//         res.send(kabkota);
//     } catch (err) {
//         console.log(err);
//     }
// }

export const getJalurPendaftaran = async (req, res) => {
    const redis_key = 'JalurPendaftaranBy_'+req.body.smasmk;
    try {
        const cacheNya = await redisGet(redis_key);
        if (cacheNya) {

            res.status(200).json({
                'status': 1,
                'message': 'Data di ambil dari cache',
                'data': JSON.parse(cacheNya)
            });

           
        }else{

            const resData = await JalurPendaftarans.findAll({
                where: {
                    smasmk: req.body.smasmk
                },
                attributes: ['id', 'smasmk', 'nama'] // Specify the attributes to retrieve
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
