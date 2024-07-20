import DataUsers from '../../../models/service/DataUsersModel.js';
import { encodeId, decodeId } from '../../../middleware/EncodeDecode.js';
import { Op } from 'sequelize';
import { redisGet, redisSet } from '../../../redis.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const getUsers = async (req, res) => {
    const userId = req.user.userId;

    try {
        // Dapatkan data user berdasarkan userId
        const user = await DataUsers.findOne({
            where: { id: userId }
        });

        if (!user) {
            return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
        }
        const redis_key = 'DataUsersAllinAdmin';

        // Cek apakah data ada di Redis cache
        const cacheNya = await redisGet(redis_key);
        if (cacheNya) {
            return res.status(200).json({
                status: 1,
                message: 'Data diambil dari cache',
                data: JSON.parse(cacheNya)
            });
        }

        let resData;

        if (user.role_ == 93) {
            // Admin sekolah
            resData = await DataUsers.findAll({
                where: {
                    [Op.and]: [
                        { role_: { [Op.ne]: 77 } },
                        { role_: { [Op.in]: [93, 94, 95] } },
                        { sekolah_id: user.sekolah_id },
                        { is_delete: 0 }
                    ]
                }
            });
        } else if (user.role_ == 77 || user.role_ == 89) {
            // Super, BPTIK
            resData = await DataUsers.findAll({
                where: {
                    role_: { [Op.ne]: 77 },
                    is_delete: 0
                }
            });
        } else {
            return res.status(400).json({ status: 0, message: 'Anda tidak memilik hak akses' });
        }

        if (resData.length > 0) {

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


            // Simpan hasil query di Redis cache
            await redisSet(redis_key, JSON.stringify(resDatas), process.env.REDIS_EXPIRE_TIME_SOURCE_DATA);
            return res.status(200).json({
                status: 1,
                message: 'Data berhasil ditemukan',
                data: resDatas
            });
        } else {
            return res.status(200).json({
                status: 0,
                message: 'Data kosong',
            });
        }
    } catch (err) {
        console.error('Error fetching data:', err); // Log the error for debugging
        return res.status(500).json({
            status: 0,
            message: 'Error'
        });
    }
};

export const getUserById = async (req, res) => {
    const { id } = req.params; // Ambil id dari params URL
    try {
        const resData = await DataUsers.findOne({
            where: {
                id: decodeId(id),
                is_delete: 0
            },
            
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

export const addUser = async (req, res) => {
    const { username, email, nama, whatsapp, password, role, sekolah_id, is_active } = req.body;

    // Validate request data
    if (!username || !email || !nama || !whatsapp || !password) {
        return res.status(400).json({ status: 0, message: 'Semua kolom harus diisi' });
    }

    try {
        // Hash the password before saving it to the database
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user record in the database
        const newUser = await DataUsers.create({
            username,
            email,
            nama,
            whatsapp,
            password_: hashedPassword,
            role_: role,
            sekolah_id,
            created_at: new Date(),
            created_by: req.user.userId, // Use user ID from token
            created_by_ip: req.ip,
            is_active // Set the new user as active
        });

        const data = {
            id_: encodeId(newUser.id), // Use the virtual id_ field which is already encoded
            ...newUser.toJSON()
        };
        delete data.id; // Remove the original ID from the response
        delete data.password_ // Remove the original ID from the response

        res.status(200).json({
            status: 1,
            message: 'Berhasil tambah pengguna',
            data: data
        });
    } catch (error) {
        console.error('Gagal tambah pengguna:', error);
        res.status(500).json({
            status: 0,
            message: error.message
        });
    }
};


