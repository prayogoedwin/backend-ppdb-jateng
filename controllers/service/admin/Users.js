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
                },
                order: [
                    ['id', 'DESC']
                ]
            });
        } else if (user.role_ == 77 || user.role_ == 89) {
            // Super, BPTIK
            resData = await DataUsers.findAll({
                where: {
                    role_: { [Op.ne]: 77 },
                    is_delete: 0
                },
                order: [
                    ['id', 'DESC']
                ]
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

        // Combine checks into a single query
        const existingUser = await DataUsers.findOne({
            where: {
                [Op.or]: [
                    { email, is_delete: 0 },
                    { username, is_delete: 0 },
                    { whatsapp, is_delete: 0 }
                ]
            }
        });

        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(200).json({ status: 0, message: 'Email sudah digunakan' });
            }
            if (existingUser.username === username) {
                return res.status(200).json({ status: 0, message: 'Username sudah digunakan' });
            }
            if (existingUser.whatsapp === whatsapp) {
                return res.status(200).json({ status: 0, message: 'Nomor WhatsApp sudah digunakan' });
            }
        }

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

        
        if(!newUser){
            return res.status(200).json({ status: 0, message: 'Gagal tambah pengguna' });
        }

        await clearCacheByKeyFunction('DataUsersAllinAdmin');
        res.status(200).json({
            status: 1,
            message: 'Berhasil tambah pengguna',
        });

    } catch (error) {
        console.error('Gagal tambah pengguna:', error);
        res.status(500).json({
            status: 0,
            message: error.message
        });
    }
};

// Update user by ID function
export const updateUser = async (req, res) => {
    const { id, username, email, nama, whatsapp, password, role, sekolah_id, is_active } = req.body;

    try {
    
        const user = await DataUsers.findOne({
            where: {
                id: decodeId(id),
                is_delete: 0,
            }
        });

        if (!user) {
            return res.status(200).json({
                status: 0,
                message: 'Data tidak ditemukan'
            });
        }

         // Combine checks into a single query
         const existingUser = await DataUsers.findOne({
            where: {
                [Op.or]: [
                    { email, is_delete: 0 },
                    { username, is_delete: 0 },
                    { whatsapp, is_delete: 0 }
                ],
                id: {
                    [Op.ne]: decodeId(id),
                }
            }
        });

        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(200).json({ status: 0, message: 'Email sudah digunakan' });
            }
            if (existingUser.username === username) {
                return res.status(200).json({ status: 0, message: 'Username sudah digunakan' });
            }
            if (existingUser.whatsapp === whatsapp) {
                return res.status(200).json({ status: 0, message: 'Nomor WhatsApp sudah digunakan' });
            }
        }

       
        if (user.email === email) {
            return res.status(200).json({ status: 0, message: 'Email sudah digunakan' });
        }
        if (user.username === username) {
            return res.status(200).json({ status: 0, message: 'Username sudah digunakan' });
        }
        if (user.whatsapp === whatsapp) {
            return res.status(200).json({ status: 0, message: 'Nomor WhatsApp sudah digunakan' });
        }

        const updateData = {
            username,
            email,
            nama,
            whatsapp,
            role_: role,
            sekolah_id,
            updated_at: new Date(),
            updated_by: req.user.userId, // Use user ID from token
            is_active
        };

        if (password) {
            // Hash the new password if provided
            updateData.password_ = await bcrypt.hash(password, 10);
        }

        await user.update(updateData);

        const updatedUser = {
            id_: encodeId(user.id), // Use the virtual id_ field which is already encoded
            ...user.toJSON()
        };
        delete updatedUser.id; // Remove the original ID from the response
        delete updatedUser.password_; // Remove the password from the response

        res.status(200).json({
            status: 1,
            message: 'Data berhasil diupdate',
            data: updatedUser
        });
    } catch (error) {
        res.status(500).json({
            status: 0,
            message: error.message,
        });
    }
};

export const softDeleteUser = async (req, res) => {
    const { id } = req.params; // Ambil id dari params URL
    try {
        const userId = decodeId(id); // Dekode ID
        const updatedById = req.user.userId; // Ambil userId dari token

        // Cari user berdasarkan id dan is_delete = 0
        const user = await DataUsers.findOne({
            where: {
                id: userId,
                is_delete: 0
            }
        });

        if (!user) {
            return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
        }

        // Update kolom is_delete, updated_at dan updated_by
        await user.update({
            is_delete: 1,
            updated_at: new Date(),
            updated_by: updatedById,
            deleted_at: new Date(),
            deleted_by: updatedById
        });

        res.status(200).json({
            status: 1,
            message: 'Data berhasil dihapus',
            data: user
        });
    } catch (error) {
        res.status(500).json({
            status: 0,
            message: error.message,
        });
    }
};


