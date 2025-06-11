import SekolahZonasis from "../../models/master/SekolahZonasiModel.js";
import { redisGet, redisSet } from '../../redis.js'; // Import the Redis functions
import { Sequelize, Op } from "sequelize";



export const cekZonasiByKecamatanZ = async (req, res) => {

    const kec = req.body.kode_wilayah_kec;
    if(kec != 'all'){
        const resDataZ = await SekolahZonasis.findAll({  
            where: {  
                kode_wilayah_kec: req.body.kode_wilayah_kec  
            },
        });
    }else{
        const resDataZ = await SekolahZonasis.findAll();
    }

    if(!resDataZ){

        return res.status(200).json({  
            'status': 0,  
            'message': 'Data Tidak Ditemukan',  
            'data': []
        });  

    }else{

        return res.status(200).json({  
            'status': 0,  
            'message': 'Data Ditemukan',  
            'data': resDataZ
        });  


    }

}

export const cekZonasiBySekolahZ = async (req, res) => {

    // const resDataZ = await SekolahZonasis.findAll({  
    //     where: {  
    //         npsn: req.body.npsn  
    //     },
    // });

    const npsn = req.body.npsn;
    if(npsn != 'all'){
        const resDataZ = await SekolahZonasis.findAll({  
                where: {  
                    npsn: req.body.npsn  
                },
        });
    }else{
        const resDataZ = await SekolahZonasis.findAll();
    }

    if(!resDataZ){

        return res.status(200).json({  
            'status': 0,  
            'message': 'Data Tidak Ditemukan',  
            'data': []
        });  

    }else{

        return res.status(200).json({  
            'status': 0,  
            'message': 'Data Ditemukan',  
            'data': resDataZ
        });  


    }

}