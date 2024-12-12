// Import model Product
import SekolahTujuans from "../../models/master/SekolahTujuanModel.js";
import SekolahJurusan from "../../models/master/SekolahJurusanModel.js";
import DataPendaftars from "../../models/service/DataPendaftarModel.js";
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

export const getSekolahTujuanPublik = async (req, res) => {
    const redis_key = 'SekolahTujuansPublik'+req.body.bentuk_pendidikan_id;
    try {
        const cacheNya = await redisGet(redis_key);
        // const cacheNya = false;
        if (cacheNya) {

            res.status(200).json({
                'status': 1,
                'message': 'Data di ambil dari cache',
                'data': JSON.parse(cacheNya)
            });

           
        }else{

            const resData = await SekolahTujuans.findAll({
                where: {
                    bentuk_pendidikan_id: req.body.bentuk_pendidikan_id
                },
                attributes: ['id', 'nama',  'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'] // Specify the attributes to retrieve
            });

             // Tambahkan properti nama_npsn ke setiap item dalam resData
             const formattedResData = resData.map(school => {
                return {
                    ...school.dataValues,
                    nama_npsn: `${school.nama} ${school.npsn}` // Gabungkan nama dan npsn
                };
            });

            
            if(formattedResData.length > 0){

                const newCacheNya = formattedResData;
                await redisSet(redis_key, JSON.stringify(newCacheNya), process.env.REDIS_EXPIRE_TIME_MASTER); 

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': formattedResData
                });
            }else{

                res.status(200).json({
                    'status': 0,
                    'message': 'Data kosong',
                    'data': ''
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

export const getSekolahTujuan = async (req, res) => {


            const nins = req.body.nisn;
            const jalur_pendaftaran_id = req.body.jalur_pendaftaran_id;

            if(jalur_pendaftaran_id == 1){

                const cekPendaftar = await DataPendaftars.findOne({
                    where: {
                        nisn: req.body.nisn,
                        is_delete: 0
                    },
                });
    
                const resData = await SekolahTujuans.findAll({
                    where: {
                        bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,
                        kode_wilayah_kec: cekPendaftar.kecamatan_id
                    },
                    attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'] // Specify the attributes to retrieve
                });

                 // Tambahkan properti nama_npsn ke setiap item dalam resData
                const formattedResData = resData.map(school => {
                    return {
                        ...school.dataValues,
                        nama_npsn: `${school.nama} ${school.npsn}` // Gabungkan nama dan npsn
                    };
                });


                if(formattedResData.length > 0){
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': formattedResData
                    });
                }else{
    
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': ''
                    });
    
                }

            }else{

                const resData = await SekolahTujuans.findAll({
                    where: {
                        bentuk_pendidikan_id: req.body.bentuk_pendidikan_id
                    },
                    attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'] // Specify the attributes to retrieve
                });

                 // Tambahkan properti nama_npsn ke setiap item dalam resData
                 const formattedResData = resData.map(school => {
                    return {
                        ...school.dataValues,
                        nama_npsn: `${school.nama} ${school.npsn}` // Gabungkan nama dan npsn
                    };
                });

                if(formattedResData.length > 0){
    
                    res.status(200).json({
                        'status': 1,
                        'message': 'Data berhasil ditemukan',
                        'data': formattedResData
                    });
                }else{
    
                    res.status(200).json({
                        'status': 0,
                        'message': 'Data kosong',
                        'data': ''
                    });
    
                }

            }

}

export const getSekolahTujuanJurusanPublik = async (req, res) => {

        const resData = await SekolahJurusan.findAll({
            where: {
                id_sekolah_tujuan: req.body.id_sekolah_tujuan, // Filter dari EzSekolahTujuans
            },
            attributes: ['id', 'npsn' ,'nama_jurusan', 'daya_tampung'], // Ambil atribut hanya dari EzSekolahJurusan
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
                'data': ''
            });

        }

}

