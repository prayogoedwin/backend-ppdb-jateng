import DataSertifikats from "../../../models/service/DataSertifikatModel.js";
import { redisGet, redisSet } from '../../../redis.js'; // Import the Redis functions

//data sertifikat external
export const getSertifikats = async (req, res) => {
    const userId = req.user.userId; // Assuming userId is the ID you want to filter by
    try {
        const resData = await DataSertifikats.findAll({
            where: {
                created_by: userId // Filter results where created_by matches userId
            },
            order: [
                ['id', 'ASC']
            ]
        });

        if (resData.length > 0) { // Check if resData has any results
            res.status(200).json({
                'status': 1,
                'message': 'Data berhasil ditemukan',
                'data': resData
            });
        } else {
            res.status(200).json({
                'status': 0,
                'message': 'Data kosong',
            });
        }
    } catch (err) {
        console.error('Error fetching data:', err); // Log the error for debugging
        res.status(404).json({
            'status': 0,
            'message': 'Error'
        });
    }
}


// Function to handle POST request
export const insertSertifikat = async (req, res) => {
    const userId = req.user.userId;
    try {
        const {
            kejuaraan_id,
            nama_kejuaraan,
            tanggal_sertifikat,
            nomor_sertifikat,
            nisn,
            nik,
            url_file
        } = req.body;

        const newSertifikatData = {
            kejuaraan_id,
            nama_kejuaraan,
            tanggal_sertifikat,
            nomor_sertifikat,
            nisn,
            nik,
            url_file,
            created_at: new Date(),
            created_by: userId,
        };
        const resData = DataSertifikats.create(newSertifikatData);
        if (resData) { // Check if resData has any results
            res.status(200).json({
                'status': 1,
                'message': 'Data berhasil ditambahkan',
                'data': newSertifikatData
            });
        } else {
            res.status(200).json({
                'status': 0,
                'message': 'Data kosong',
            });
        }
        // res.status(201).json({
        //     status: 1,
        //     message: 'Daftar berhasil dibuat',
        //     data: newSertifikatData
        // });

    } catch (error) {
        console.error('Error daftar:', error);
        res.status(500).json({
            status: 0,
            message: error.message || 'Terjadi kesalahan saat proses daftar'
        });
    }
}