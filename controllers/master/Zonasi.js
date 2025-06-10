import SekolahZonasis from "../../models/master/SekolahZonasiModel.js";
import { redisGet, redisSet } from '../../redis.js'; // Import the Redis functions
import { Sequelize, Op } from "sequelize";



export const cekZonasiByKecamatan = async (req, res) => {

    const resDataZ = await SekolahZonasis.findAll({  
        where: {  
            kode_wilayah_kec: req.body.kode_wilayah_kec  
        },
    });

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

export const cekZonasiBySekolah = async (req, res) => {

    const resDataZ = await SekolahZonasis.findAll({  
        where: {  
            npsn: req.body.npsn  
        },
    });

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