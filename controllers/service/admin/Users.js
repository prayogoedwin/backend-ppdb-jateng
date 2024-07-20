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

            const resDatas = resData.map(item => ({
                ...item.toJSON(),
                encodedId: encodeId(item.id)
            }));

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
