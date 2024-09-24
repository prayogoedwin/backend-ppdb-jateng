import DataUsers from '../../../models/service/DataUsersModel.js';
import { encodeId, decodeId } from '../../../middleware/EncodeDecode.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Sequelize, Op } from "sequelize";
import axios from 'axios'; 
import FormData from 'form-data';
 
export const generateSuperAdmin = async (req, res) => {
    try {
        // Hash password
        const hashedPassword = await bcrypt.hash('10Juli2024GOgoo=', 10);

        const newUser = await DataUsers.create({
            username: 'superadmin@localhost.com',
            email: 'superadmin@localhost.com',
            nama: 'Super Admin',
            whatsapp: '081111111111',
            password_: hashedPassword , // Sesuaikan dengan password yang di-hash
            role_: 77,
            sekolah_id: null,
            is_active: 1,
        }, {
            fields: ['username', 'email', 'nama', 'whatsapp', 'password_', 'role_', 'is_active'] // Tentukan kolom-kolom yang ingin Anda masukkan nilainya
        });

        res.status(200).json({
            status: 1,
            message: 'Berhasil',
        });

    } catch (error) {
        console.error('Error creating super admin:', error);
    }
};

// User login
export const loginAdmin_BAK = async (req, res) => {

        const { username, password } = req.body;

        try {
            // Check if user exists
            const user = await DataUsers.findOne({
                where: {
                    // username,
                    [Sequelize.Op.or]: [
                        { username: username },
                        { email: username },
                        { whatsapp: username },
                    ],
                    is_active: 1,
                    is_delete: 0
                }
            });

            if (!user) {
                return res.status(200).json({ status: 0, message: 'User / Password Salah 1' });
            }

            // Compare password
            const isMatch = await bcrypt.compare(password, user.password_);
            if (!isMatch) {
                return res.status(200).json({ status: 0, message: 'User / Password Salah 2' });
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
                    userId: user.id,
                    username: user.username,
                    nama: user.nama,
                    role: user.role_,
                    sekolah_id: user.sekolah_id,
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

export const loginAdmin = async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check if user exists
        const user = await DataUsers.findOne({
            where: {
                [Sequelize.Op.or]: [
                    { username: username },
                    { email: username },
                    { whatsapp: username },
                ],
                is_active: 1,
                is_delete: 0
            }
        });

        if (!user) {
            return res.status(200).json({ status: 0, message: 'User / Password Salah 1' });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password_);
        if (!isMatch) {
            return res.status(200).json({ status: 0, message: 'User / Password Salah 2' });
        }

        // Generate OTP
        // const otpCode = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit OTP
        const otpCode = generateOtp(5); // Generate 5-character OTP

       
        // Send OTP via WhatsApp
        const otpMessage = `Your OTP code is ${otpCode}`;
        const whatsappResponse = await sendOtpToWhatsapp(user.whatsapp, otpMessage);

        // Check if WhatsApp OTP sending was successful
        if (whatsappResponse.status === 0) {
            // Failed to send OTP via WhatsApp, return the error message from the API
            return res.status(500).json({
                status: 0,
                message: whatsappResponse.message || 'Failed to send OTP via WhatsApp'
            });
        }



        // Save OTP to access_token field
        user.access_token = otpCode; // Store OTP in access_token field
        user.otp_expiration = new Date(Date.now() + 10 * 60000); // OTP valid for 10 minutes
        await user.save({ fields: ['access_token', 'otp_expiration', 'updated_at'] });

        // Respond with OTP status
        return res.status(200).json({
            status: 1,
            message: 'OTP has been sent via WhatsApp',
            data: {
                userId: encodeId(user.id),
                username: user.username,
                otpRequired: true // Inform client that OTP is required
            }
        });
        


    } catch (error) {
        res.status(500).json({
            status: 0,
            message: error.message,
        });
    }
};

// Function to generate OTP excluding 'O' and '0'
function generateOtp(length) {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789'; // Exclude 'O' and '0'
    let otpCode = '';
    for (let i = 0; i < length; i++) {
        otpCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return otpCode;
}

async function sendOtpToWhatsapp(phone, message) {
    const url = 'https://nusagateway.com/api/send-message.php';
    const token = process.env.WA_TOKEN; // Ganti dengan token Anda

    try {
        // Buat form-data untuk request
        const formData = new FormData();
        formData.append('token', token);
        formData.append('phone', phone);
        formData.append('message', message);

        // Kirim request POST dengan form-data
        const response = await axios.post(url, formData, {
            headers: {
                ...formData.getHeaders() // Dapatkan header form-data otomatis
            }
        });

        // Log respons dari API untuk debugging
        // console.log('WhatsApp API Response:', response.data);

        // Cek apakah pesan berhasil dikirim
        if (response.data.result === 'true') {
            return {
                status: 1,
                message: 'OTP berhasil dikirim melalui whatsapp'
            };
        } else {
            return {
                status: 0,
                message: response.data.message || 'OTP gagal dikirim melalui whatsapp'
            };
        }
    } catch (error) {
        console.error('OTP gagal dikirim melalui whatsapp:', error.message);
        return {
            status: 0,
            message: 'OTP gagal dikirim melalui whatsapp'
        };
    }
}



// User logout
export const logoutAdmin = async (req, res) => {
        const { userId } = req.body;

        try {
            // Check if user exists
            const user = await DataUsers.findOne({
                where: {
                    id: userId,
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
            await user.save({ fields: ['access_token', 'access_token_refresh', 'updated_at'] });

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