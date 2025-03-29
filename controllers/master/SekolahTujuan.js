// Import model Product
import SekolahTujuans from "../../models/master/SekolahTujuanModel.js";
import SekolahZonasis from "../../models/master/SekolahZonasiModel.js";
import SekolahJurusan from "../../models/master/SekolahJurusanModel.js";
import DataPendaftars from "../../models/service/DataPendaftarModel.js";
import { redisGet, redisSet } from '../../redis.js'; // Import the Redis functions
import { Sequelize, Op } from "sequelize";


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
        // const cacheNya = await redisGet(redis_key);
        const cacheNya = false;
        if (cacheNya) {

            res.status(200).json({
                'status': 1,
                'message': 'Data di ambil dari cache',
                'data': JSON.parse(cacheNya)
            });

           
        }else{

            const resData = await SekolahTujuans.findAll({
                where: {
                    bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,
                    kode_wilayah_kot: req.body.kabkota,
                },
                // attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'kuota_zonasi_persentase', 'kuota_zonasi_khusus_persentase', 'kuota_afirmasi_persentase', 'kuota_prestasi_persentase', 'kuota_pto_persentase', 'alamat_jalan'] // Specify the attributes to retrieve
                attributes: [
                    'npsn', 
                    [Sequelize.fn('MIN', Sequelize.col('id')), 'id'], // Get the minimum id for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'], // Get the minimum name for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'], // Get the minimum latitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'], // Get the minimum longitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('kuota_zonasi_persentase')), 'kuota_zonasi_persentase'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('kuota_zonasi_khusus_persentase')), 'kuota_zonasi_khusus_persentase'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('kuota_afirmasi_persentase')), 'kuota_afirmasi_persentase'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('kuota_prestasi_persentase')), 'kuota_prestasi_persentase'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('kuota_pto_persentase')), 'kuota_pto_persentase'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'], // Get the minimum capacity for each npsn
                   
                ],
                group: ['npsn']  
                
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

export const getSekolahTujuanBAK = async (req, res) => {


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

export const getSekolahTujuan = async (req, res) => {  
    const nins = req.body.nisn;  
    const jalur_pendaftaran_id = req.body.jalur_pendaftaran_id;  
    const kabkota = req.body.kabkota; 
  
    try {  
        if (jalur_pendaftaran_id == 1) {  
            const cekPendaftar = await DataPendaftars.findOne({  
                where: {  
                    nisn: req.body.nisn,  
                    is_delete: 0  
                },  
            }); 
            
            // Fetch npsn values from SekolahZonasis
            const resDataZ = await SekolahZonasis.findAll({  
                where: {  
                    kode_wilayah_kec: cekPendaftar.kecamatan_id  
                },  
                attributes: ['npsn']  
            });
            // console.log("test:"+resDataZ);

            // Extract npsn values from resDataZ
            // const npsnList = resDataZ.map(s => s.npsn); // Assuming resDataZ is an array of objects
            const npsnList = resDataZ.map(s => s.npsn).filter(npsn => npsn !== null); // Filter out null values

            // Fetch data from SekolahTujuans where npsn is in the list from resDataZ
            const resData = await SekolahTujuans.findAll({  
                where: {  
                    bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,  
                    kode_wilayah_kot: kabkota,
                    npsn: { [Op.in]: npsnList } // Use Op.in to filter by npsn
                },  
                // attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'],
                attributes: [
                    'npsn', 
                    [Sequelize.fn('MIN', Sequelize.col('id')), 'id'], // Get the minimum id for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'], // Get the minimum name for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'], // Get the minimum latitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'], // Get the minimum longitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'] // Get the minimum address for each npsn
                ],  
                group: ['npsn']  
            });
  
            // const resData = await SekolahTujuans.findAll({  
            //     where: {  
            //         bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,  
            //         kode_wilayah_kec: cekPendaftar.kecamatan_id  
            //     },  
            //     attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan']  
            // });  
  
            // Tambahkan properti nama_npsn ke setiap item dalam resData  
            const formattedResData = resData.map(school => {  
                return {  
                    ...school.dataValues,  
                    nama_npsn: `${school.nama} ${school.npsn}`  
                };  
            });  
  
            // If bentuk_pendidikan_id is 15, fetch jurusan data  
            if (req.body.bentuk_pendidikan_id == 15) {  
                const jurusanData = await SekolahJurusan.findAll({  
                    where: {  
                        id_sekolah_tujuan: formattedResData.map(school => school.id) // Get the ids of the schools  
                    },  
                        attributes: ['id', 'nama_jurusan', 'id_sekolah_tujuan', 'daya_tampung']  
                });  
  
                // Format jurusan data  
                const formattedJurusanData = jurusanData.map(jurusan => {  
                    return {  
                        ...jurusan.dataValues,  
                        id_sekolah_tujuan: jurusan.id_sekolah_tujuan // Include the school id for reference  
                    };  
                });  
  
                // Combine school and jurusan data  
                formattedResData.forEach(school => {  
                    school.jurusan = formattedJurusanData.filter(jurusan => jurusan.id_sekolah_tujuan === school.id);  
                });  
            }  
  
            if (formattedResData.length > 0) {  
                res.status(200).json({  
                    'status': 1,  
                    'message': 'Data berhasil ditemukan',  
                    'data': formattedResData  
                });  
            } else {  
                res.status(200).json({  
                    'status': 0,  
                    'message': 'Data kosong',  
                    'data': ''  
                });  
            }  
  
        } else {  
            const resData = await SekolahTujuans.findAll({  
                where: {  
                    bentuk_pendidikan_id: req.body.bentuk_pendidikan_id  
                },  
                // attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'] 
                attributes: [
                    'npsn', 
                    [Sequelize.fn('MIN', Sequelize.col('id')), 'id'], // Get the minimum id for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'], // Get the minimum name for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'], // Get the minimum latitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'], // Get the minimum longitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'] // Get the minimum address for each npsn
                ],  
                group: ['npsn']   
            });  
  
            // Tambahkan properti nama_npsn ke setiap item dalam resData  
            const formattedResData = resData.map(school => {  
                return {  
                    ...school.dataValues,  
                    nama_npsn: `${school.nama} ${school.npsn}`  
                };  
            });  
  
            // If bentuk_pendidikan_id is 15, fetch jurusan data  
            if (req.body.bentuk_pendidikan_id == 15) {  
                const jurusanData = await SekolahJurusan.findAll({  
                    where: {  
                        id_sekolah_tujuan: formattedResData.map(school => school.id)  
                    },  
                    attributes: ['id', 'nama_jurusan', 'id_sekolah_tujuan', 'daya_tampung']  
                });  
  
                // Format jurusan data  
                const formattedJurusanData = jurusanData.map(jurusan => {  
                    return {  
                        ...jurusan.dataValues,  
                        id_sekolah_tujuan: jurusan.id_sekolah_tujuan  
                    };  
                });  
  
                // Combine school and jurusan data  
                formattedResData.forEach(school => {  
                    school.jurusan = formattedJurusanData.filter(jurusan => jurusan.id_sekolah_tujuan === school.id);  
                });  
            }  
  
            if (formattedResData.length > 0) {  
                res.status(200).json({  
                    'status': 1,  
                    'message': 'Data berhasil ditemukan',  
                    'data': formattedResData  
                });  
            } else {  
                res.status(200).json({  
                    'status': 0,  
                    'message': 'Data kosong',  
                    'data': ''  
                });  
            }  
        }  
    } catch (error) {  
        console.error(error);  
        res.status(500).json({  
            'status': 0,  
            'message': 'Terjadi kesalahan pada server',  
            'data': ''  
        });  
    }  
}  

export const getSekolahTujuanKabkota = async (req, res) => {  
    const nins = req.body.nisn;  
    const bentuk_pendidikan_id = req.body.bentuk_pendidikan_id;
    const kabkota = req.body.kabkota; 
  
    try {  
       
        const resData = await SekolahTujuans.findAll({  
            where: {  
                bentuk_pendidikan_id: bentuk_pendidikan_id,
                kode_wilayah_kot: kabkota
            },  
            // attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'] 
            attributes: [
                'npsn', 
                [Sequelize.fn('MIN', Sequelize.col('id')), 'id'], // Get the minimum id for each npsn
                [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'], // Get the minimum name for each npsn
                [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'], // Get the minimum latitude for each npsn
                [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'], // Get the minimum longitude for each npsn
                [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'], // Get the minimum capacity for each npsn
                [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'] // Get the minimum address for each npsn
            ],
        
            group: ['npsn'],  
            order: ['id']
        });  

        // Tambahkan properti nama_npsn ke setiap item dalam resData  
        const formattedResData = resData.map(school => {  
            return {  
                ...school.dataValues,  
                nama_npsn: `${school.nama} ${school.npsn}`  
            };  
        });  

        // If bentuk_pendidikan_id is 15, fetch jurusan data  
        if (req.body.bentuk_pendidikan_id == 15) {  
            const jurusanData = await SekolahJurusan.findAll({  
                where: {  
                    id_sekolah_tujuan: formattedResData.map(school => school.id)  
                },
                
                attributes: ['id', 'nama_jurusan', 'id_sekolah_tujuan', 'daya_tampung'],
                order: ['id']
            });  

            // Format jurusan data  
            const formattedJurusanData = jurusanData.map(jurusan => {  
                return {  
                    ...jurusan.dataValues,  
                    id_sekolah_tujuan: jurusan.id_sekolah_tujuan  
                };  
            });  

            // Combine school and jurusan data  
            formattedResData.forEach(school => {  
                school.jurusan = formattedJurusanData.filter(jurusan => jurusan.id_sekolah_tujuan === school.id);  
            });  
        }  


        if (formattedResData.length > 0) {  
            res.status(200).json({  
                'status': 1,  
                'message': 'Data berhasil ditemukan',  
                'data': formattedResData  
            });  
        } else {  
            res.status(200).json({  
                'status': 0,  
                'message': 'Data kosong',  
                'data': ''  
          
            });
        }
    } catch (error) {  
        console.error(error);  
        res.status(500).json({  
            'status': 0,  
            'message': 'Terjadi kesalahan pada server',  
            'data': ''  
        });  
    }  
} 

export const getSekolahTujuanJurusanPublik = async (req, res) => {

        const resData = await SekolahJurusan.findAll({
            where: {
                id_sekolah_tujuan: req.body.id_sekolah_tujuan, // Filter dari EzSekolahTujuans
            },
            // attributes: ['id', 'npsn' ,'nama_jurusan', 'id_jurusan', 'daya_tampung'], // Ambil atribut hanya dari EzSekolahJurusan
            attributes: ['id', 'nama_jurusan', 'npsn', 'id_jurusan', 'daya_tampung', 'kuota_jarak_terdekat_persentase', 'kuota_afirmasi_persentase', 'kuota_prestasi_persentase', 'kuota_prestasi_khusus_persentase'] // Specify the attributes to retrieve
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
