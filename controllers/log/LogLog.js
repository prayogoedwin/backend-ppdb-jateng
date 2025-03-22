import AccessLog from '../../models/AccessLog.js';
import AccessLogPub from '../../models/AccessLogPublic.js';
import AccessLogAdmin from '../../models/AccessLogAdmin.js';
import { encodeId, decodeId } from '../../middleware/EncodeDecode.js';
import { Sequelize, Op } from 'sequelize';

export const LogSiswaLoggedIn = async (req, res) => {
    try {
        
        const resData = await AccessLog.findAll({
            // where: {
            //     akun: req.body.nisn
            // }
            where: {
                [Op.or]: [
                    { akun: req.body.nisn },
                    { akun: decodeId(req.body.id_pendaftar) }
                ]
            }
        });
        
        const resData2 = 1;
        // const resData2 = await AccessLogAdmin.findAll({
        //     // where: {
        //     //     akun: req.body.nisn
        //     // }
        //     where: {
        //         [Op.or]: [
        //             { akun: req.body.nisn }
        //         ]
        //     }
        // });


        // const resData2 = await AccessLogPub.findAll({
        //     where: {
        //         akun: nisn
        //     }
        // });
        
        if (resData && resData.length > 0) { // Check if resData has data

            res.status(200).json({
                'status': 1,
                'message': 'Data berhasil ditemukan',
                'data': resData,
                'data_admin': resData2,
                // 'other_data': resData2,
            });

        }else{

            res.status(200).json({
                'status': 0,
                'message': 'Data kosong',
            });

        }


    } catch (err){
        console.error('Error fetching data:', err); // Log the error for debugging
        res.status(404).json({
            'status': 0,
            'message': 'Error'
        });
    }
}

export const LogAdminLoggedIn = async (req, res) => {
    try {
        
        const resData = await AccessLogAdmin.findAll({
            // where: {
            //     akun: req.body.nisn
            // }
            where: {
                [Op.or]: [
                    { created_by: req.body.username },
                    { created_by: req.body.email },
                    { created_by: decodeId(req.body.user_id) }
                ]
            }
        });

        // const resData2 = await AccessLogPub.findAll({
        //     where: {
        //         akun: nisn
        //     }
        // });
        
        if (resData && resData.length > 0) { // Check if resData has data

            res.status(200).json({
                'status': 1,
                'message': 'Data berhasil ditemukan',
                'data': resData,
                // 'other_data': resData2,
            });

        }else{

            res.status(200).json({
                'status': 0,
                'message': 'Data kosong',
            });

        }


    } catch (err){
        console.error('Error fetching data:', err); // Log the error for debugging
        res.status(404).json({
            'status': 0,
            'message': 'Error'
        });
    }
}
