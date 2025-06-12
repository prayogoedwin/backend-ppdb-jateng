import EzSekolahZonasisKhusus from "../../models/master/SekolahZonasiKhususModel.js";
import EzWilayahVerDapodiks from '../../models/master/WilayahVerDapodikModel.js';
import { redisGet, redisSet } from '../../redis.js'; // Import the Redis functions
import { Sequelize, Op } from "sequelize";


export const cekZonasiKhususByKecamatanZ = async (req, res) => {

    let resDataZ;
    const kec = req.body.kode_wilayah_kec;
    if(kec != 'all'){
        resDataZ = await EzSekolahZonasisKhusus.findAll({  
            include: [
                    {
                        model: EzWilayahVerDapodiks,
                        as: 'kecamatan',
                        foreignKey: 'kode_wilayah_kec',
                        targetKey: 'kode_wilayah',
                        attributes: ['nama','kode_wilayah']
                    },
                    {
                        model: EzWilayahVerDapodiks,
                        as: 'kota',
                        foreignKey: 'kode_wilayah_kot',
                        targetKey: 'kode_wilayah',
                        attributes: ['nama','kode_wilayah']
                    }
                ],
            where: {  
                kode_wilayah_kec: req.body.kode_wilayah_kec  
            },
        });
    }else{
        resDataZ = await EzSekolahZonasisKhusus.findAll({
            include: [
                    {
                        model: EzWilayahVerDapodiks,
                        as: 'kecamatan',
                        foreignKey: 'kode_wilayah_kec',
                        targetKey: 'kode_wilayah',
                         attributes: ['nama','kode_wilayah']
                    },
                    {
                        model: EzWilayahVerDapodiks,
                        as: 'kota',
                        foreignKey: 'kode_wilayah_kot',
                        targetKey: 'kode_wilayah',
                        attributes: ['nama','kode_wilayah']
                    }
                ]
        });
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


export const cekZonasiKhususBySekolahZ = async (req, res) => {

    let resDataZ;
    const npsn = req.body.npsn;
    if(npsn != 'all'){
        resDataZ = await EzSekolahZonasisKhusus.findAll({  
            include: [
                    {
                        model: EzWilayahVerDapodiks,
                        as: 'kecamatan',
                        foreignKey: 'kode_wilayah_kec',
                        targetKey: 'kode_wilayah',
                        attributes: ['nama','kode_wilayah']
                    },
                    {
                        model: EzWilayahVerDapodiks,
                        as: 'kota',
                        foreignKey: 'kode_wilayah_kot',
                        targetKey: 'kode_wilayah',
                        attributes: ['nama','kode_wilayah']
                    }
                ],
            where: {  
                npsn: req.body.npsn  
            },
        });
    }else{
        resDataZ = await EzSekolahZonasisKhusus.findAll({
            include: [
                    {
                        model: EzWilayahVerDapodiks,
                        as: 'kecamatan',
                        foreignKey: 'kode_wilayah_kec',
                        targetKey: 'kode_wilayah',
                         attributes: ['nama','kode_wilayah']
                    },
                    {
                        model: EzWilayahVerDapodiks,
                        as: 'kota',
                        foreignKey: 'kode_wilayah_kot',
                        targetKey: 'kode_wilayah',
                        attributes: ['nama','kode_wilayah']
                    }
                ]
        });
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