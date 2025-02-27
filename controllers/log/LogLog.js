import AccessLog from '../../models/AccessLog.js';
import AccessLogPub from '../../models/AccessLogPublic.js';

export const LogSiswaLoggedIn = async (req, res) => {
    try {
        
        const resData = await AccessLog.findAll({
            where: {
                akun: req.body.nisn
            }
        });

        // const resData2 = await AccessLogPub.findAll({
        //     where: {
        //         akun: nisn
        //     }
        // });
        
        if(resData != null){

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

export const LogAdminLoggedIn = async (req, res) => {
    try {
        
        const resData = await AccessLog.findAll({
            where: {
                akun: req.body.nisn
            }
        });

        if(resData != null){

            res.status(200).json({
                'status': 1,
                'message': 'Data berhasil ditemukan',
                'data': resData,
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
