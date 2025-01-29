import DataUsers from '../../../models/service/DataIntegratorModel.js';
import { encodeId, decodeId } from '../../../middleware/EncodeDecode.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// User login
export const loginClient = async (req, res) => {

    const apiKey = req.headers['x-api-key'];
    const { userid, username, password } = req.body;

    try {
        // Check if user exists
        const user = await DataUsers.findOne({
            where: {
                username: username,
                is_active: 1,
                is_deleted: 0
            }
        });

        //com[are apiley
        if(user.xapikey != apiKey){
            return res.status(403).json({ status: 0, message: 'Forbidden - Your APP Key is not allowed to access this resource' });
        }


        // Compare password
        const isMatch = await bcrypt.compare(password, user.password_);
        if (!isMatch) {
            return res.status(200).json({ status: 0, message: 'User / Password Salah 1' });
        }

    
        if (!user) {
            return res.status(200).json({ status: 0, message: 'User / Password Salah 2' });
        }


         // Check if OTP has expired
        const currentTime = new Date();
        const login_ip = req.ip || req.connection.remoteAddress; 


        // Generate tokens
        const accessToken = jwt.sign({ userId: user.id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: process.env.ACCESS_TOKEN_SECRET_EXPIRE_TIME  });
        const refreshToken = jwt.sign({ userId: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: process.env.REFRESH_TOKEN_SECRET_EXPIRE_TIME  });

        // Save tokens to user record
        user.access_token = accessToken;
        user.access_token_refresh = refreshToken;
        user.updated_at = currentTime

        user.login_ip = login_ip;

        await user.save({ fields: ['access_token', 'access_token_refresh', 'updated_at', 'login_ip' ] });
        // await user.save({ fields: ['access_token', 'access_token_refresh', 'updated_at'] });
        

        res.status(200).json({
            status: 1,
            message: 'Berhasil masuk',
            data: {
                clientId: encodeId(user.id),
                username: user.username,
                nama: user.nama_instansi,
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
};

// User logout
export const logoutClient = async (req, res) => {
        const { clientId } = req.body;

        try {
            // Check if user exists
            const user = await DataUsers.findOne({
                where: {
                    id: decodeId(clientId),
                    is_active: 1,
                    is_delete: 0
                }
            });

            if (!user) {
                return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
            }

            // Invalidate tokens
            user.access_token = null;
            user.access_token_refresh = null;
            user.login_ip = null;


            await user.save({ fields: ['access_token', 'access_token_refresh', 'updated_at', 'login_ip'] });

            res.status(200).json({
                status: 1,
                message: 'Berhasil keluar',
            });
        } catch (error) {
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }
};