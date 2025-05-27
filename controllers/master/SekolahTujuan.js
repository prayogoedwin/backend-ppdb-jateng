// Import model Product
import SekolahTujuans from "../../models/master/SekolahTujuanModel.js";
import SekolahZonasis from "../../models/master/SekolahZonasiModel.js";
import SekolahZonasisKhusus from "../../models/master/SekolahZonasiKhususModel.js";
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


export const cekZonasiByKecamatan = async (req, res) => {

    const resDataZ = await SekolahZonasis.findAll({  
        where: {  
            kode_wilayah_kec: req.body.kode_wilayah_kec  
        },
    });

    if(!resDataZ){

        res.status(200).json({  
            'status': 0,  
            'message': 'Data Tidak Ditemukan',  
            'data': []
        });  

    }else{

        res.status(200).json({  
            'status': 0,  
            'message': 'Data Ditemukan',  
            'data': resDataZ
        });  

       

    }

}

export const cekZonasiKhususByKecamatan = async (req, res) => {

    const resDataZ = await SekolahZonasisKhusus.findAll({  
        where: {  
            kode_wilayah_kec: req.body.kode_wilayah_kec  
        },
    });

    if(!resDataZ){

        res.status(200).json({  
            'status': 0,  
            'message': 'Data Tidak Ditemukan',  
            'data': []
        });  

    }else{

        res.status(200).json({  
            'status': 0,  
            'message': 'Data Ditemukan',  
            'data': resDataZ
        });  

       

    }

    

}

export const getSekolahTujuanPublik = async (req, res) => {
    // const redis_key = 'SekolahTujuansPublik'+req.body.bentuk_pendidikan_id;
    const redis_key = 'SekolahTujuansPublik'+req.body.bentuk_pendidikan_id+req.body.kabkota;
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
                    bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,
                    kode_wilayah_kot: req.body.kabkota,
                    nama_jurusan: {
                        [Op.not]: null,
                      }

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
                    [Sequelize.fn('MIN', Sequelize.col('kuota_zonasi')), 'kuota_zonasi'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('kuota_zonasi_khusus_persentase')), 'kuota_zonasi_khusus_persentase'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('kuota_zonasi_khusus')), 'kuota_zonasi_khusus'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('kuota_afirmasi_persentase')), 'kuota_afirmasi_persentase'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('kuota_afirmasi')), 'kuota_afirmasi'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('kuota_prestasi_persentase')), 'kuota_prestasi_persentase'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('kuota_prestasi')), 'kuota_prestasi'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('kuota_pto_persentase')), 'kuota_pto_persentase'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('kuota_pto')), 'kuota_pto'], // Get the minimum capacity for each npsn
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

export const getSekolahTujuanBAKANAKPONDO = async (req, res) => {  
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
            
            
            let resData ;
            if(cekPendaftar.is_anak_pondok == 1){

                 // Fetch data from SekolahTujuans where npsn is in the list from resDataZ
                 const resData = await SekolahTujuans.findAll({  
                    where: {  
                        bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,  
                        kode_wilayah_kot: kabkota,
                        status_sekolah: 1,
                        nama_jurusan: {
                            [Op.not]: null,
                          }
                    },  
                    // attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'],
                    attributes: [
                        'npsn', 
                        [Sequelize.fn('MIN', Sequelize.col('id')), 'id'], // Get the minimum id for each npsn
                        [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'], // Get the minimum name for each npsn
                        [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'], // Get the minimum latitude for each npsn
                        [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'], // Get the minimum longitude for each npsn
                        [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'], // Get the minimum capacity for each npsn
                        [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'], // Get the minimum address for each npsn
                        [Sequelize.fn('MIN', Sequelize.col('status_sekolah')), 'status_sekolah'] // Get the minimum address for each npsn
                    ],  
                    group: ['npsn']  
                });

            }else{

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
                 resData = await SekolahTujuans.findAll({  
                    where: {  
                        bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,  
                        kode_wilayah_kot: kabkota,
                        status_sekolah: 1,
                        nama_jurusan: {
                            [Op.not]: null,
                          },
                        npsn: { [Op.in]: npsnList }, // Use Op.in to filter by npsn
                        
                    },  
                    // attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'],
                    attributes: [
                        'npsn', 
                        [Sequelize.fn('MIN', Sequelize.col('id')), 'id'], // Get the minimum id for each npsn
                        [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'], // Get the minimum name for each npsn
                        [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'], // Get the minimum latitude for each npsn
                        [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'], // Get the minimum longitude for each npsn
                        [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'], // Get the minimum capacity for each npsn
                        [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'], // Get the minimum address for each npsn
                        [Sequelize.fn('MIN', Sequelize.col('status_sekolah')), 'status_sekolah'] // Get the minimum address for each npsn
                       
                        
                    ],  
                    group: ['npsn']  
                });

            }

           
  
            // const resData = await SekolahTujuans.findAll({  
            //     where: {  
            //         bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,  
            //         kode_wilayah_kec: cekPendaftar.kecamatan_id  
            //     },  
            //     attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan']  
            // });  
  
            // Tambahkan properti nama_npsn ke setiap item dalam resData  
            // const formattedResData = resData.map(school => {  
            //     return {  
            //         ...school.dataValues,  
            //         nama_npsn: `${school.nama} ${school.npsn}`  
            //     };  
            // }); 
            
            const formattedResData = resData.map(school => {
                const namaNpsn = `${school.nama} ${school.npsn}`; 
                return {
                    ...school.dataValues,
                    nama_npsn: school.status_sekolah == 2 ? `*${namaNpsn}` : namaNpsn
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
  
        }else if(jalur_pendaftaran_id == 2){

            const cekPendaftar = await DataPendaftars.findOne({  
                where: {  
                    nisn: req.body.nisn,  
                    is_delete: 0  
                },  
            }); 

            let resData;

            // Fetch npsn values from SekolahZonasis
            const resDataZ = await SekolahZonasisKhusus.findAll({  
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
             resData = await SekolahTujuans.findAll({  
                where: {  
                    bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,  
                    kode_wilayah_kot: kabkota,
                    status_sekolah: 1,
                    nama_jurusan: {
                        [Op.not]: null,
                      },
                    npsn: { [Op.in]: npsnList }, // Use Op.in to filter by npsn
                    
                },  
                // attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'],
                attributes: [
                    'npsn', 
                    [Sequelize.fn('MIN', Sequelize.col('id')), 'id'], // Get the minimum id for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'], // Get the minimum name for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'], // Get the minimum latitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'], // Get the minimum longitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'], // Get the minimum address for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('status_sekolah')), 'status_sekolah'] // Get the minimum address for each npsn
                   
                    
                ],  
                group: ['npsn']  
            });

            const formattedResData = resData.map(school => {
                const namaNpsn = `${school.nama} ${school.npsn}`; 
                return {
                    ...school.dataValues,
                    nama_npsn: school.status_sekolah == 2 ? `*${namaNpsn}` : namaNpsn
                };
            });

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

            const whereCondition = {
                bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,
                nama_jurusan: {
                    [Op.not]: null,
                }
            };
            
            // Hanya tambahkan kondisi kode_wilayah_kot jika kabkota tidak null/undefined
            if (kabkota !== undefined && kabkota !== null) {
                whereCondition.kode_wilayah_kot = kabkota;
            }

            if(jalur_pendaftaran_id != 5 && jalur_pendaftaran_id != 9){
                whereCondition.status_sekolah = 1;
            }

            // Menentukan order berdasarkan jalur pendaftaran
            let orderCondition;
            if (jalur_pendaftaran_id == 5 || jalur_pendaftaran_id == 9) {
                orderCondition = [
                    [Sequelize.fn('MIN', Sequelize.col('status_sekolah')), 'DESC'],
                    ['id', 'ASC'] // Tambahan pengurutan sekunder jika diperlukan
                ];
            } else {
                orderCondition = ['id'];
            }

            const resData = await SekolahTujuans.findAll({  
                // where: {  
                //     bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,
                //     kode_wilayah_kot: kabkota,
                //     nama_jurusan: {
                //         [Op.not]: null,
                //       },
                    
                // }, 
                where: whereCondition,   
                // attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'] 
                attributes: [
                    'npsn', 
                    [Sequelize.fn('MIN', Sequelize.col('id')), 'id'], // Get the minimum id for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'], // Get the minimum name for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'], // Get the minimum latitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'], // Get the minimum longitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'], // Get the minimum address for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('status_sekolah')), 'status_sekolah'] // Get the minimum address for each npsn
                ],  
                order: ['id'],
                order: orderCondition,
                group: ['npsn'] 
                  
            });  
  
            // Tambahkan properti nama_npsn ke setiap item dalam resData  
            // const formattedResData = resData.map(school => {  
            //     return {  
            //         ...school.dataValues,  
            //         nama_npsn: `* ${school.nama} ${school.npsn}`  
            //     };  
            // });  

            const formattedResData = resData.map(school => {
                const namaNpsn = `${school.nama} ${school.npsn}`; 
                return {
                    ...school.dataValues,
                    nama_npsn: school.status_sekolah == 2 ? `*${namaNpsn}` : namaNpsn
                };
            });
  
            // If bentuk_pendidikan_id is 15, fetch jurusan data  
            if (req.body.bentuk_pendidikan_id == 15) {  
                const jurusanData = await SekolahJurusan.findAll({  
                    where: {  
                        id_sekolah_tujuan: formattedResData.map(school => school.id)  
                    },  
                    attributes: ['id', 'nama_jurusan', 'id_sekolah_tujuan', 'daya_tampung'],
                    order: ['id'],
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

export const getSekolahTujuanTanpaRedis = async (req, res) => {  
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
            
            
            let resData ;
            
            // Fetch npsn values from SekolahZonasis
            const resDataZ = await SekolahZonasis.findAll({  
                where: {  
                    kode_wilayah_kec: cekPendaftar.kecamatan_id  
                },
                attributes: ['npsn']  
            });

            // Extract npsn values from resDataZ
            // const npsnList = resDataZ.map(s => s.npsn); // Assuming resDataZ is an array of objects
            const npsnList = resDataZ.map(s => s.npsn).filter(npsn => npsn !== null); // Filter out null values

             // Fetch data from SekolahTujuans where npsn is in the list from resDataZ
             resData = await SekolahTujuans.findAll({  
                where: {  
                    bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,  
                    kode_wilayah_kot: kabkota,
                    status_sekolah: 1,
                    nama_jurusan: {
                        [Op.not]: null,
                      },
                    npsn: { [Op.in]: npsnList }, // Use Op.in to filter by npsn
                    
                },  
                // attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'],
                attributes: [
                    'npsn', 
                    [Sequelize.fn('MIN', Sequelize.col('id')), 'id'], // Get the minimum id for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'], // Get the minimum name for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'], // Get the minimum latitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'], // Get the minimum longitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'], // Get the minimum address for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('status_sekolah')), 'status_sekolah'] // Get the minimum address for each npsn
                   
                    
                ],  
                group: ['npsn']  
            });

            
            const formattedResData = resData.map(school => {
                const namaNpsn = `${school.nama} ${school.npsn}`; 
                return {
                    ...school.dataValues,
                    nama_npsn: school.status_sekolah == 2 ? `*${namaNpsn}` : namaNpsn
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
  
        }else if(jalur_pendaftaran_id == 2){

            const cekPendaftar = await DataPendaftars.findOne({  
                where: {  
                    nisn: req.body.nisn,  
                    is_delete: 0  
                },  
            }); 

            let resData;

            // Fetch npsn values from SekolahZonasis
            const resDataZ = await SekolahZonasisKhusus.findAll({  
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
             resData = await SekolahTujuans.findAll({  
                where: {  
                    bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,  
                    kode_wilayah_kot: kabkota,
                    status_sekolah: 1,
                    nama_jurusan: {
                        [Op.not]: null,
                      },
                    npsn: { [Op.in]: npsnList }, // Use Op.in to filter by npsn
                    
                },  
                // attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'],
                attributes: [
                    'npsn', 
                    [Sequelize.fn('MIN', Sequelize.col('id')), 'id'], // Get the minimum id for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'], // Get the minimum name for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'], // Get the minimum latitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'], // Get the minimum longitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'], // Get the minimum address for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('status_sekolah')), 'status_sekolah'] // Get the minimum address for each npsn
                   
                    
                ],  
                group: ['npsn']  
            });

            const formattedResData = resData.map(school => {
                const namaNpsn = `${school.nama} ${school.npsn}`; 
                return {
                    ...school.dataValues,
                    nama_npsn: school.status_sekolah == 2 ? `*${namaNpsn}` : namaNpsn
                };
            });

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

            const whereCondition = {
                bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,
                nama_jurusan: {
                    [Op.not]: null,
                }
            };
            
            // Hanya tambahkan kondisi kode_wilayah_kot jika kabkota tidak null/undefined
            if (kabkota !== undefined && kabkota !== null) {
                whereCondition.kode_wilayah_kot = kabkota;
            }

            if(jalur_pendaftaran_id != 5 && jalur_pendaftaran_id != 9){
                whereCondition.status_sekolah = 1;
            }

            // Menentukan order berdasarkan jalur pendaftaran
            let orderCondition;
            if (jalur_pendaftaran_id == 5 || jalur_pendaftaran_id == 9) {
                orderCondition = [
                    [Sequelize.fn('MIN', Sequelize.col('status_sekolah')), 'DESC'],
                    ['id', 'ASC'] // Tambahan pengurutan sekunder jika diperlukan
                ];
            } else {
                orderCondition = ['id'];
            }

            const resData = await SekolahTujuans.findAll({  
                // where: {  
                //     bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,
                //     kode_wilayah_kot: kabkota,
                //     nama_jurusan: {
                //         [Op.not]: null,
                //       },
                    
                // }, 
                where: whereCondition,   
                // attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'] 
                attributes: [
                    'npsn', 
                    [Sequelize.fn('MIN', Sequelize.col('id')), 'id'], // Get the minimum id for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'], // Get the minimum name for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'], // Get the minimum latitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'], // Get the minimum longitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'], // Get the minimum address for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('status_sekolah')), 'status_sekolah'] // Get the minimum address for each npsn
                ],  
                order: ['id'],
                order: orderCondition,
                group: ['npsn'] 
                  
            });  
  
            // Tambahkan properti nama_npsn ke setiap item dalam resData  
            // const formattedResData = resData.map(school => {  
            //     return {  
            //         ...school.dataValues,  
            //         nama_npsn: `* ${school.nama} ${school.npsn}`  
            //     };  
            // });  

            const formattedResData = resData.map(school => {
                const namaNpsn = `${school.nama} ${school.npsn}`; 
                return {
                    ...school.dataValues,
                    nama_npsn: school.status_sekolah == 2 ? `*${namaNpsn}` : namaNpsn
                };
            });
  
            // If bentuk_pendidikan_id is 15, fetch jurusan data  
            if (req.body.bentuk_pendidikan_id == 15) {  
                const jurusanData = await SekolahJurusan.findAll({  
                    where: {  
                        id_sekolah_tujuan: formattedResData.map(school => school.id)  
                    },  
                    attributes: ['id', 'nama_jurusan', 'id_sekolah_tujuan', 'daya_tampung'],
                    order: ['id'],
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
            
            
            let resData ;
            
            // Fetch npsn values from SekolahZonasis
            const resDataZ = await SekolahZonasis.findAll({  
                where: {  
                    kode_wilayah_kec: cekPendaftar.kecamatan_id  
                },
                attributes: ['npsn']  
            });

            // Extract npsn values from resDataZ
            // const npsnList = resDataZ.map(s => s.npsn); // Assuming resDataZ is an array of objects
            const npsnList = resDataZ.map(s => s.npsn).filter(npsn => npsn !== null); // Filter out null values

             // Fetch data from SekolahTujuans where npsn is in the list from resDataZ
             resData = await SekolahTujuans.findAll({  
                where: {  
                    bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,  
                    kode_wilayah_kot: kabkota,
                    status_sekolah: 1,
                    nama_jurusan: {
                        [Op.not]: null,
                      },
                    npsn: { [Op.in]: npsnList }, // Use Op.in to filter by npsn
                    
                },  
                // attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'],
                attributes: [
                    'npsn', 
                    [Sequelize.fn('MIN', Sequelize.col('id')), 'id'], // Get the minimum id for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'], // Get the minimum name for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'], // Get the minimum latitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'], // Get the minimum longitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'], // Get the minimum address for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('status_sekolah')), 'status_sekolah'] // Get the minimum address for each npsn
                   
                    
                ],  
                group: ['npsn']  
            });

            
            const formattedResData = resData.map(school => {
                const namaNpsn = `${school.nama} ${school.npsn}`; 
                return {
                    ...school.dataValues,
                    nama_npsn: school.status_sekolah == 2 ? `*${namaNpsn}` : namaNpsn
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
  
        }else if(jalur_pendaftaran_id == 2){

            const cekPendaftar = await DataPendaftars.findOne({  
                where: {  
                    nisn: req.body.nisn,  
                    is_delete: 0  
                },  
            }); 

            let resData;

            // Fetch npsn values from SekolahZonasis
            const resDataZ = await SekolahZonasisKhusus.findAll({  
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
             resData = await SekolahTujuans.findAll({  
                where: {  
                    bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,  
                    kode_wilayah_kot: kabkota,
                    status_sekolah: 1,
                    nama_jurusan: {
                        [Op.not]: null,
                      },
                    npsn: { [Op.in]: npsnList }, // Use Op.in to filter by npsn
                    
                },  
                // attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'],
                attributes: [
                    'npsn', 
                    [Sequelize.fn('MIN', Sequelize.col('id')), 'id'], // Get the minimum id for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'], // Get the minimum name for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'], // Get the minimum latitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'], // Get the minimum longitude for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'], // Get the minimum capacity for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'], // Get the minimum address for each npsn
                    [Sequelize.fn('MIN', Sequelize.col('status_sekolah')), 'status_sekolah'] // Get the minimum address for each npsn
                   
                    
                ],  
                group: ['npsn']  
            });

            const formattedResData = resData.map(school => {
                const namaNpsn = `${school.nama} ${school.npsn}`; 
                return {
                    ...school.dataValues,
                    nama_npsn: school.status_sekolah == 2 ? `*${namaNpsn}` : namaNpsn
                };
            });

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

            const redis_key = 'SekolahTujuansPublikWithJalur'+req.body.bentuk_pendidikan_id+req.body.kabkota+'-Jalur:'+jalur_pendaftaran_id;

            const cacheNya = await redisGet(redis_key);

            if (cacheNya) {

                res.status(200).json({
                    'status': 1,
                    'message': 'Data di ambil dari cache',
                    'data': JSON.parse(cacheNya)
                });
    
               
            }else{

                    const whereCondition = {
                        bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,
                        nama_jurusan: {
                            [Op.not]: null,
                        }
                    };
                    
                    // Hanya tambahkan kondisi kode_wilayah_kot jika kabkota tidak null/undefined
                    if (kabkota !== undefined && kabkota !== null) {
                        whereCondition.kode_wilayah_kot = kabkota;
                    }

                    if(jalur_pendaftaran_id != 5 && jalur_pendaftaran_id != 9){
                        whereCondition.status_sekolah = 1;
                    }

                    // Menentukan order berdasarkan jalur pendaftaran
                    let orderCondition;
                    if (jalur_pendaftaran_id == 5 || jalur_pendaftaran_id == 9) {
                        orderCondition = [
                            [Sequelize.fn('MIN', Sequelize.col('status_sekolah')), 'DESC'],
                            ['id', 'ASC'] // Tambahan pengurutan sekunder jika diperlukan
                        ];
                    } else {
                        orderCondition = ['id'];
                    }

                    const resData = await SekolahTujuans.findAll({  
                        // where: {  
                        //     bentuk_pendidikan_id: req.body.bentuk_pendidikan_id,
                        //     kode_wilayah_kot: kabkota,
                        //     nama_jurusan: {
                        //         [Op.not]: null,
                        //       },
                            
                        // }, 
                        where: whereCondition,   
                        // attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'] 
                        attributes: [
                            'npsn', 
                            [Sequelize.fn('MIN', Sequelize.col('id')), 'id'], // Get the minimum id for each npsn
                            [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'], // Get the minimum name for each npsn
                            [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'], // Get the minimum latitude for each npsn
                            [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'], // Get the minimum longitude for each npsn
                            [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'], // Get the minimum capacity for each npsn
                            [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'], // Get the minimum address for each npsn
                            [Sequelize.fn('MIN', Sequelize.col('status_sekolah')), 'status_sekolah'] // Get the minimum address for each npsn
                        ],  
                        order: ['id'],
                        order: orderCondition,
                        group: ['npsn'] 
                        
                    });  
        
                    // Tambahkan properti nama_npsn ke setiap item dalam resData  
                    // const formattedResData = resData.map(school => {  
                    //     return {  
                    //         ...school.dataValues,  
                    //         nama_npsn: `* ${school.nama} ${school.npsn}`  
                    //     };  
                    // });  

                    const formattedResData = resData.map(school => {
                        const namaNpsn = `${school.nama} ${school.npsn}`; 
                        return {
                            ...school.dataValues,
                            nama_npsn: school.status_sekolah == 2 ? `*${namaNpsn}` : namaNpsn
                        };
                    });
        
                    // If bentuk_pendidikan_id is 15, fetch jurusan data  
                    if (req.body.bentuk_pendidikan_id == 15) {  
                        const jurusanData = await SekolahJurusan.findAll({  
                            where: {  
                                id_sekolah_tujuan: formattedResData.map(school => school.id)  
                            },  
                            attributes: ['id', 'nama_jurusan', 'id_sekolah_tujuan', 'daya_tampung'],
                            order: ['id'],
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

                        await redisSet(redis_key, JSON.stringify(formattedResData), process.env.REDIS_EXPIRE_TIME_MASTER); 

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
    
    // Create Redis key based on parameters
    const redis_key = `sekolah_tujuan_kabkota_publik:${bentuk_pendidikan_id}:${kabkota}`;
  
    try {
        // Try to get data from Redis cache first
        const cacheNya = await redisGet(redis_key);
        if (cacheNya) {
            return res.status(200).json({
                'status': 1,
                'message': 'Data berhasil ditemukan (from cache)',
                'data': JSON.parse(cacheNya)
            });
        }

        // If not in cache, fetch from database
        const resData = await SekolahTujuans.findAll({  
            where: {  
                bentuk_pendidikan_id: bentuk_pendidikan_id,
                kode_wilayah_kot: kabkota,
                nama_jurusan: {
                    [Op.not]: null,
                }
            },  
            attributes: [
                'npsn', 
                [Sequelize.fn('MIN', Sequelize.col('id')), 'id'],
                [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'],
                [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'],
                [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'],
                [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'],
                [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'],
                [Sequelize.fn('MIN', Sequelize.col('status_sekolah')), 'status_sekolah']
            ],
            group: ['npsn'],  
            order: ['status_sekolah']
        });  

        // Format the data
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
                    id_sekolah_tujuan: formattedResData.map(school => school.id),  
                    is_active: true
                },
                attributes: ['id', 'nama_jurusan', 'id_sekolah_tujuan', 'daya_tampung'],
                order: ['id']
            });  

            const formattedJurusanData = jurusanData.map(jurusan => {  
                return {  
                    ...jurusan.dataValues,  
                    id_sekolah_tujuan: jurusan.id_sekolah_tujuan  
                };  
            });  

            formattedResData.forEach(school => {  
                school.jurusan = formattedJurusanData.filter(jurusan => jurusan.id_sekolah_tujuan === school.id);  
            });  
        }  

        if (formattedResData.length > 0) {  
            // Cache the data with your existing Redis setup
            await redisSet(redis_key, JSON.stringify(formattedResData), process.env.REDIS_EXPIRE_TIME_MASTER);
            
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
    
        const id_sekolah_tujuan = req.body.id_sekolah_tujuan
    
        const redis_key = `sekolah_jurusan_publik:${id_sekolah_tujuan}`;

        try {
            // Try to get data from Redis cache first
            const cacheNya = await redisGet(redis_key);
            if (cacheNya) {
                return res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan (from cache)',
                    'data': JSON.parse(cacheNya)
                });
            }

            const resData = await SekolahJurusan.findAll({
                where: {
                    id_sekolah_tujuan: id_sekolah_tujuan, // Filter dari EzSekolahTujuans
                    is_active: true,
                },
                // attributes: ['id', 'npsn' ,'nama_jurusan', 'id_jurusan', 'daya_tampung'], // Ambil atribut hanya dari EzSekolahJurusan
                attributes: ['id', 'nama_jurusan', 'npsn', 'id_jurusan', 'daya_tampung', 'kuota_jarak_terdekat_persentase', 'kuota_jarak_terdekat', 'kuota_afirmasi_persentase', 'kuota_afirmasi', 'kuota_prestasi_persentase', 'kuota_prestasi', 'kuota_prestasi_khusus_persentase', 'kuota_prestasi_khusus', 'is_larang_buta_warna'] // Specify the attributes to retrieve
            });

            await redisSet(redis_key, JSON.stringify(resData), process.env.REDIS_EXPIRE_TIME_MASTER);


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
        } catch (error) {  
            console.error(error);  
            res.status(500).json({  
                'status': 0,  
                'message': 'Terjadi kesalahan pada server',  
                'data': ''  
            });  
        }  

}

export const dayaTampungDetail = async (req, res) => {  

    

    const bentuk_pendidikan_id = req.body.bentuk_pendidikan_id;  
    const status_sekolahnya = req.body.status_sekolah;  
    const kabkota = req.body.kabkota;

    const redis_key = 'SekolahDayaTampungDetail-bentuk:'+bentuk_pendidikan_id+'-kabkota:'+kabkota+'-status_sekolah:'+status_sekolahnya;
    try {  

        const cacheNya = await redisGet(redis_key);

        if (cacheNya) {

            res.status(200).json({
                'status': 1,
                'message': 'Data di ambil dari cache',
                'data': JSON.parse(cacheNya)
            });

           
        }else{

            if(bentuk_pendidikan_id == 13){
             // Fetch data from SekolahTujuans where npsn is in the list from resDataZ
                const resData = await SekolahTujuans.findAll({  
                    where: {  
                        bentuk_pendidikan_id: bentuk_pendidikan_id,  
                        status_sekolah: status_sekolahnya,
                        kode_wilayah_kot: kabkota,
                        nama_jurusan: {
                            [Op.not]: null,
                        },       
                    },  
                    attributes: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 
                        'kuota_zonasi_persentase', 'kuota_zonasi', 'kuota_afirmasi_persentase', 'kuota_afirmasi',
                        'kuota_prestasi_persentase', 'kuota_prestasi', 'kuota_zonasi_khusus_persentase', 'kuota_zonasi_khusus', 
                        'kuota_pto_persentase', 'kuota_pto' ],
                    // attributes: { 
                    //     exclude: ['id', 'nama', 'npsn', 'lat', 'lng', 'daya_tampung', 'alamat_jalan'] 
                    //   }
                    // attributes: [
                    //     'npsn', 
                    //     [Sequelize.fn('MIN', Sequelize.col('id')), 'id'], // Get the minimum id for each npsn
                    //     [Sequelize.fn('MIN', Sequelize.col('nama')), 'nama'], // Get the minimum name for each npsn
                    //     [Sequelize.fn('MIN', Sequelize.col('lat')), 'lat'], // Get the minimum latitude for each npsn
                    //     [Sequelize.fn('MIN', Sequelize.col('lng')), 'lng'], // Get the minimum longitude for each npsn
                    //     [Sequelize.fn('MIN', Sequelize.col('daya_tampung')), 'daya_tampung'], // Get the minimum capacity for each npsn
                    //     [Sequelize.fn('MIN', Sequelize.col('alamat_jalan')), 'alamat_jalan'], // Get the minimum address for each npsn
                    //     [Sequelize.fn('MIN', Sequelize.col('status_sekolah')), 'status_sekolah'] // Get the minimum address for each npsn
                    
                        
                    // ],  
                    order: ['npsn']  
                });

                await redisSet(redis_key, JSON.stringify(resData), process.env.REDIS_EXPIRE_TIME_MASTER); 


                res.status(200).json({  
                    'status': 1,  
                    'message': 'Data berhasil ditemukan',  
                    'data': resData  
                });    

            }else if(bentuk_pendidikan_id == 15){

                const resData = await SekolahJurusan.findAll({
                    include: [{
                      model: SekolahTujuans,
                      as: 'sekolahTujuan',
                      where: {
                        bentuk_pendidikan_id: bentuk_pendidikan_id,
                        status_sekolah: status_sekolahnya,
                        kode_wilayah_kot: kabkota,
                        is_active: true
                      },
                      attributes: ['nama', 'npsn'] // Hanya ambil kolom nama dari tabel tujuan
                    }],
                    where: {
                      nama_jurusan: {
                        [Op.not]: null
                      }
                    },
                    attributes: ['id', 'nama_jurusan', 'npsn', 'daya_tampung', 'is_larang_buta_warna',
                        'kuota_jarak_terdekat_persentase', 'kuota_jarak_terdekat', 'kuota_afirmasi_persentase', 'kuota_afirmasi',
                        'kuota_prestasi_persentase', 'kuota_prestasi', 'kuota_prestasi_khusus_persentase', 'kuota_prestasi_khusus'],
                    // attributes: { 
                    order: [
                      ['npsn', 'ASC'] // atau order berdasarkan kolom lain yang sesuai
                    ]
                  });

                  await redisSet(redis_key, JSON.stringify(resData), process.env.REDIS_EXPIRE_TIME_MASTER); 


                  res.status(200).json({  
                    'status': 1,  
                    'message': 'Data berhasil ditemukan',  
                    'data': resData  
                });    


            }else{

                res.status(404).json({  
                    'status': 0,  
                    'message': 'Data tidak ditemukan',  
                    'data': []  
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

