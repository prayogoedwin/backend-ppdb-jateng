import DataPendaftars from "../../models/service/DataPendaftarModel.js";
import { encodeId, decodeId } from '../../middleware/EncodeDecode.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';


// User login
export const loginUser = [

    async (req, res) => {

        const { nisn, password } = req.body;

        try {
            // Check if user exists
            const user = await DataPendaftars.findOne({
                where: {
                    nisn,
                    is_active: 1,
                    is_verified: 1,
                    is_delete: 0
                }
            });

            if (!user) {
                return res.status(200).json({ status: 0, message: 'Akun tidak ditemukan, indikasi akun belum di aktifasi / verifikasi' });
            }

            // Compare password
            const isMatch = await bcrypt.compare(password, user.password_);
            if (!isMatch) {
                return res.status(200).json({ status: 0, message: 'NISN / password salah' });
            }

            // Generate tokens
            const accessToken = jwt.sign({ userId: user.id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: process.env.ACCESS_TOKEN_SECRET_EXPIRE_TIME  });
            const refreshToken = jwt.sign({ userId: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: process.env.REFRESH_TOKEN_SECRET_EXPIRE_TIME  });

            // Save tokens to user record
            user.access_token = accessToken;
            user.access_token_refresh = refreshToken;
            await user.save({ fields: ['access_token', 'access_token_refresh', 'updated_at'] });

            res.status(200).json({
                status: 1,
                message: 'Berhasil masuk',
                data: {
                    userId: encodeId(user.id),
                    nisn: user.nisn,
                    accessToken,
                    refreshToken
                }
            });
        } catch (error) {
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }
    }
];


// User logout
export const logoutUser = [

    async (req, res) => {
        const { userId } = req.body;

        try {
            // Check if user exists
            const user = await DataPendaftars.findOne({
                where: {
                    id: decodeId(userId),
                }
            });

            if (!user) {
                return res.status(400).json({ status: 0, message: 'Invalid user ID' });
            }

            // Invalidate tokens
            user.access_token = null;
            user.access_token_refresh = null;
            await user.save({ fields: ['access_token', 'access_token_refresh', 'updated_at'] });

            res.status(200).json({
                status: 1,
                message: 'Logout successful',
            });
        } catch (error) {
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }
    }
];