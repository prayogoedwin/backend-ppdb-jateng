import DataPendaftars from "../../models/service/DataPendaftarModel.js";
import { encodeId, decodeId } from '../../middleware/EncodeDecode.js';
import { sendOtpToWhatsapp } from '../../helpers/HelpHelper.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import FormData from 'form-data';

// Fungsi untuk generate password acak 5 karakter dari A-Z, 1-9
const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
    let password = '';
    for (let i = 0; i < 5; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

// User login
export const loginUser_S = [

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


// User login
export const loginUser = [

    async (req, res) => {

        const { otp_via, nisn, password } = req.body;

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

            // Generate OTP
            // const otpCode = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit OTP
            const otpCode = generateOtp(5); // Generate 5-character OTP

        
            // Send OTP via WhatsApp
            const otpMessage = `Berikut kode OTP anda ${otpCode}`;
            // const whatsappResponse = await sendOtpToWhatsapp(user.no_wa, otpMessage);
            const whatsappResponse = 1;

            // Check if WhatsApp OTP sending was successful
            if (whatsappResponse.status === 0) {
                // Failed to send OTP via WhatsApp, return the error message from the API
                return res.status(500).json({
                    status: 0,
                    message: whatsappResponse.message || 'Gagal kirim OTP melalui whatsapp'
                });
            }



            const otp_expiration = new Date(Date.now() + 10 * 60000); // OTP valid for 10 minutes
            // await user.save({ fields: ['access_token', 'otp_expiration'] });
            // Save tokens to user record with where clause (based on user id)
            await DataPendaftars.update(
                {
                    access_token: otpCode,
                    otp_expiration: otp_expiration,
                },
                {
                    where: {
                        id: user.id
                    }
                }
            );


            res.status(200).json({
                status: 1,
                message: 'OTP berhasil dikirim via WhatsApp',
                data: {
                    userId: encodeId(user.id),
                    nisn: user.nisn,
                    otpRequired: true, // Inform client that OTP is required,
                    otp_expiration: user.otp_expiration
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

// User login
export const verifikasiOtpUser = [

    async (req, res) => {

        const { nisn, userid, otp } = req.body;

        try {
            // Check if user exists
            const user = await DataPendaftars.findOne({
                where: {
                    id: decodeId(userid),
                    nisn,
                    // access_token: otp,
                    is_active: 1,
                    is_verified: 1,
                    is_delete: 0
                }
                
            });

            if (!user) {
                return res.status(200).json({ status: 0, message: 'Akun tidak ditemukan, indikasi akun belum di aktifasi / verifikasi' });
            }

            // if(user.access_token != otp){
            //     return res.status(200).json({ status: 0, message: 'OTP salah' });
            // }

            // Check if OTP has expired
            const currentTime = new Date();
            // if (user.otp_expiration && user.otp_expiration < currentTime) {
            //     return res.status(200).json({ status: 0, message: 'OTP sudah kadaluarsa' });
            // }

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


// Function to generate OTP excluding 'O' and '0'
function generateOtp(length) {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789'; // Exclude 'O' and '0'
    let otpCode = '';
    for (let i = 0; i < length; i++) {
        otpCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return otpCode;
}

async function sendOtpToWhatsapp_BAK(phone, message) {
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

// Reset Password API
export const resetPassword = [
    async (req, res) => {
        const { nisn, password_lama, password_baru } = req.body;

        try {
            // Check if user exists
            const user = await DataPendaftars.findOne({
                where: {
                    nisn: nisn, // Assuming 'nisn' is the username field
                    is_active: 1,
                    is_verified: 1,
                    is_delete: 0
                }
            });

            if (!user) {
                return res.status(200).json({ status: 0, message: 'Akun tidak ditemukan, indikasi akun belum diaktifasi / verifikasi' });
            }

            // Compare old password
            const isMatch = await bcrypt.compare(password_lama, user.password_);
            if (!isMatch) {
                return res.status(200).json({ status: 0, message: 'Password lama salah' });
            }

            // Hash the new password
            const hashedNewPassword = await bcrypt.hash(password_baru, 10);

            // Update the password
            user.password_ = hashedNewPassword;
            await user.save({ fields: ['password_', 'updated_at'] });

            res.status(200).json({
                status: 1,
                message: 'Password berhasil diubah',
            });
        } catch (error) {
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }
    }
];

// Fungsi untuk mengecek apakah nomor WhatsApp valid (misal: diawali dengan +62 dan hanya berisi angka)
const isValidPhoneNumber = (phone) => {
    // Regex untuk mengecek apakah nomor diawali dengan +62 atau 08 (format nomor Indonesia)
    const regex = /^(?:\+62|62|08)[0-9]{9,13}$/;
    return regex.test(phone);
};

// Fitur Lupa Password
export const forgotPassword = [
    async (req, res) => {
        const { nisn } = req.body;

        try {
            // Cek apakah user dengan NISN tersebut ada
            const user = await DataPendaftars.findOne({
                where: {
                    nisn,
                    is_active: 1,
                    is_verified: 1,
                    is_delete: 0
                }
            });

            if (!user) {
                return res.status(200).json({ status: 0, message: 'Akun tidak ditemukan, indikasi akun belum diaktifasi / verifikasi' });
            }

            // Ambil no_wa dari user
            const noWa = user.no_wa;
            if (!noWa) {
                return res.status(200).json({ status: 0, message: 'Nomor WhatsApp tidak tersedia untuk akun ini' });
            }

             // Cek apakah nomor WhatsApp valid
             if (!isValidPhoneNumber(noWa)) {
                return res.status(200).json({ status: 0, message: 'Nomor WhatsApp tidak valid' });
            }

            // Generate password baru
            const newPassword = generateRandomPassword();

            // Hash password baru
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password di database
            user.password_ = hashedPassword;
            await user.save({ fields: ['password_', 'updated_at'] });

            // Kirim password baru ke nomor WhatsApp
            const waMessage = `Halo, ini adalah password baru Anda: ${newPassword}`;
            const waResponse = await sendWa(noWa, waMessage);

            // Jika berhasil mengirim WA
            res.status(200).json({
                status: 1,
                message: 'Password baru telah dikirim ke WhatsApp Anda',
                waResponse
            });
        } catch (error) {
            res.status(500).json({
                status: 0,
                message: 'Terjadi kesalahan: ' + error.message,
            });
        }
    }
];