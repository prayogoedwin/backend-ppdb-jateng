import { encodeId, decodeId } from '../../../middleware/EncodeDecode.js';
import DataPendaftars from "../../../models/service/DataPendaftarModel.js";
import { redisGet, redisSet } from '../../../redis.js'; // Import the Redis functions
import { clearCacheByKeyFunction } from '../../config/CacheControl.js';
import WilayahVerDapodik from '../../../models/master/WilayahVerDapodikModel.js';
import multer from "multer";
import path from "path";
import fs from "fs";


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = `upload/berkas/${req.body.nisn}`;
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const hash = crypto.createHash('md5').update(file.originalname + Date.now().toString()).digest('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${hash}${ext}`);
    }
});

const upload = multer({ storage });

// Middleware for handling file uploads
const uploadFiles = upload.fields([
    { name: 'dok_pakta_integritas', maxCount: 1 },
    { name: 'dok_kk', maxCount: 1 },
    { name: 'dok_suket_nilai_raport', maxCount: 1 },
    { name: 'dok_piagam', maxCount: 1 }
]);

export const getDataPendaftarForVerif = async (req, res) => {
    const redis_key = 'DataPendaftarAllinAdmin';
    try {
        const cacheNya = await redisGet(redis_key);
        if (cacheNya) {

            res.status(200).json({
                'status': 1,
                'message': 'Data di ambil dari cache',
                'data': JSON.parse(cacheNya)
            });
           
        }else{

            const resData = await DataPendaftars.findAll({
                attributes: { exclude: ['password_'] },
                include: [
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah',
                        attributes: ['kode_wilayah','nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_kec',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_kot',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_prov',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    }
                ]
            });
            if(resData != null){

                // const resDatas = resData.map(item => ({
                //     ...item.toJSON(),
                //     encodedId: encodeId(item.id)
                // }));
                const resDatas = resData.map(item => {
                    const jsonItem = item.toJSON();
                    jsonItem.id_ = encodeId(item.id); // Add the encoded ID to the response
                    delete jsonItem.id; // Hapus kolom id dari output JSON
                   
                    return jsonItem;
                });

                // const resDatas = resData.map(item => {
                //     const jsonItem = item.toJSON();
                //     const encodedId = encodeId(jsonItem.id); // Encode the original ID
                //     delete jsonItem.id; // Remove the original ID from the response
                //     jsonItem.encodedId = encodedId; // Add the encoded ID to the response
                //     return jsonItem;
                // });

                const newCacheNya = resDatas;
                await redisSet(redis_key, JSON.stringify(newCacheNya), process.env.REDIS_EXPIRE_TIME_SOURCE_DATA); 

                res.status(200).json({
                    'status': 1,
                    'message': 'Data berhasil ditemukan',
                    'data': resDatas
                });
            }else{

                res.status(200).json({
                    'status': 0,
                    'message': 'Data kosong',
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

export const getDataPendaftarById = async (req, res) => {
        const { id } = req.params; // Ambil id dari params URL
        try {
            const resData = await DataPendaftars.findOne({
                where: {
                    id: decodeId(id),
                    is_delete: 0
                },
                include: [
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah',
                        attributes: ['kode_wilayah','nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_kec',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_kot',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_prov',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    }
                ],
                
            });
            if(resData != null){
                
    
                // res.status(200).json({
                //     status: 1,
                //     message: 'Data berhasil ditemukan',
                //     data: resData
                // });
               
                const data = {
                    id_: id, 
                    ...resData.toJSON(), // Convert Sequelize instance to plain object
                };
                delete data.id; // Remove original ID from the response
    
                res.status(200).json({
                    status: 1,
                    message: 'Data berhasil ditemukan',
                    data: data
                });

            }else{

                res.status(200).json({
                    'status': 0,
                    'message': 'Data tidak ditemukan',
                });

            }
        }catch (error) {
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }

        
}

export const verifikasiPendaftar = async (req, res) => {
        const { id, is_verified } = req.body;

        if (!id) {
            return res.status(400).json({ status: 0, message: 'Wajib kirim id' });
        }

        let decodedId;
        try {
            decodedId = decodeId(id);
            if (!decodedId) {
                return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
            }
        } catch (err) {
            console.error('Error decoding ID:', err);
            return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
        }

        console.log('Decoded ID:', decodedId); // For debugging

        try {
            const resData = await DataPendaftars.findOne({
                where: {
                    id: decodedId,
                    is_delete: 0
                }
            });

            if (!resData) {
                return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
            }

            await DataPendaftars.update(
                {
                    is_verified,
                    updated_at: new Date(), // Set the current date and time
                    updated_by: req.user.userId, // Extracted from token
                    verified_at: new Date(), // Set the current date and time
                    verified_by: req.user.userId, // Extracted from token
                },
                {
                    where: {
                        id: decodedId,
                        is_delete: 0
                    }
                }
            );

            await clearCacheByKeyFunction('DataPendaftarAllinAdmin');

            res.status(200).json({
                status: 1,
                message: 'Berhasil perbaharui data',
            });
        } catch (error) {
            console.error('Error updating data:', error);
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }
}

export const updatePendaftar = async (req, res) => {
    const {
        id,
        nisn,
        sekolah_asal_id,
        jenis_lulusan_id,
        tahun_lulus,
        nama_sekolah_asal,
        nik,
        nama_lengkap,
        jenis_kelamin,
        tanggal_lahir,
        tempat_lahir,
        status_domisili,
        alamat,
        provinsi_id,
        kabkota_id,
        kecamatan_id,
        kelurahan_id,
        rt,
        rw,
        lat,
        lng,
        no_wa,
        tanggal_cetak_kk,
        kejuaraan_id,
        nama_kejuaraan,
        tanggal_sertifikat,
        umur_sertifikat,
        nomor_sertifikat,
        nilai_prestasi,
        nilai_raport,
        nilai_raport_rata,
        is_tidak_sekolah,
        is_anak_panti,
        is_anak_keluarga_tidak_mampu,
        is_anak_guru_jateng,
        is_pip
    } = req.body;

    try {
        // Cek apakah pendaftar sudah ada dan belum dihapus
        const existingPendaftar = await DataPendaftars.findOne({
            where: {
                id: decodeId(id),
                [Op.or]: [
                    { is_delete: 0 }, // Entri yang belum dihapus
                    { is_delete: null } // Entri yang belum diatur
                ]
            }
        });

        if (!existingPendaftar) {
            return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
        }

        // Get file paths
        const files = req.files;
        const fileFields = {
            dok_pakta_integritas: files.dok_pakta_integritas ? files.dok_pakta_integritas[0].filename : null,
            dok_kk: files.dok_kk ? files.dok_kk[0].filename : null,
            dok_suket_nilai_raport: files.dok_suket_nilai_raport ? files.dok_suket_nilai_raport[0].filename : null,
            dok_piagam: files.dok_piagam ? files.dok_piagam[0].filename : null
        };

        // Prepare data for update
        const updateData = {
            nisn,
            sekolah_asal_id,
            jenis_lulusan_id,
            tahun_lulus,
            nama_sekolah_asal,
            nik,
            nama_lengkap,
            jenis_kelamin,
            tanggal_lahir: new Date(tanggal_lahir),
            tempat_lahir,
            status_domisili,
            alamat,
            provinsi_id,
            kabkota_id,
            kecamatan_id,
            kelurahan_id,
            rt,
            rw,
            lat,
            lng,
            no_wa,
            tanggal_cetak_kk: tanggal_cetak_kk ? new Date(tanggal_cetak_kk) : null,
            kejuaraan_id: kejuaraan_id || 0,
            nama_kejuaraan,
            tanggal_sertifikat: tanggal_sertifikat ? new Date(tanggal_sertifikat) : null,
            umur_sertifikat: umur_sertifikat || 0,
            nomor_sertifikat,
            nilai_prestasi,
            nilai_raport,
            nilai_raport_rata,
            dok_pakta_integritas: fileFields.dok_pakta_integritas || existingPendaftar.dok_pakta_integritas,
            dok_kk: fileFields.dok_kk || existingPendaftar.dok_kk,
            dok_suket_nilai_raport: fileFields.dok_suket_nilai_raport || existingPendaftar.dok_suket_nilai_raport,
            dok_piagam: fileFields.dok_piagam || existingPendaftar.dok_piagam,
            is_tidak_sekolah,
            is_anak_panti,
            is_anak_keluarga_tidak_mampu,
            is_anak_guru_jateng,
            is_pip,
            updated_at: new Date(),
            updated_by: req.user.userId
        };

        // Remove old files if new files are uploaded
        const oldFiles = ['dok_pakta_integritas', 'dok_kk', 'dok_suket_nilai_raport', 'dok_piagam'];
        for (const field of oldFiles) {
            if (fileFields[field] && existingPendaftar[field] && existingPendaftar[field] !== fileFields[field]) {
                const filePath = path.join(__dirname, `upload/berkas/${req.body.nisn}`, existingPendaftar[field]);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }

        // Update the pendaftar entry
        await DataPendaftars.update(updateData, {
            where: { id: decodeId(id), }
        });

        res.status(200).json({
            status: 1,
            message: 'Data berhasil diperbarui',
            data: updateData
        });

    } catch (error) {
        console.error('Gagal memperbarui data:', error);
        res.status(500).json({
            status: 0,
            message: error.message
        });
    }
};