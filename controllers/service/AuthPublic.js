import DataPendaftars from "../../models/service/DataPendaftarModel.js";
import { encodeId, decodeId } from '../../middleware/EncodeDecode.js';
import { sendOtpToWhatsapp, sendOtpToEmail } from '../../helpers/HelpHelper.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import FormData from 'form-data';
import Timelines from "../../models/service/TimelineModel.js";
import EzAppKey from '../../models/config/AppKeyModel.js';
import { redisGet, redisSet } from '../../redis.js'; // Import the Redis functions

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
                    // is_active: 1,
                    // is_verified: 1,
                    is_delete: 0
                }
            });

            if (!user) {
                return res.status(403).json({ status: 0, message: 'Akun tidak ditemukan!' });
            }

            if(user.is_verified == 0){
                return res.status(403).json({ status: 0, message: 'Akun belum diverifikasi, silahkan verifikasi terlebih dahulu ke sekolah!' });
            }

            if(user.is_active == 0){
                return res.status(403).json({ status: 0, message: 'Akun belum di aktivasi!' });
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
            const otpMessage = `Berikut kode OTP untuk login akun PPDB anda ${otpCode}`;
            if(otp_via == 'whatsapp'){

                // const otpResponse = await sendOtpToWhatsapp(user.no_wa, otpMessage);
                const otpResponse = 1;
                // Check if WhatsApp OTP sending was successful
                if (otpResponse.status === 0) {
                    // Failed to send OTP via WhatsApp, return the error message from the API
                    return res.status(500).json({
                        status: 0,
                        message: otpResponse.message || 'Gagal kirim OTP melalui whatsapp'
                    });
                }

            }else if(otp_via == 'email'){

                // const otpResponse = await sendOtpToEmail(user.email, otpMessage);
                const otpResponse = 1;
                // Check if WhatsApp OTP sending was successful
                if (otpResponse.status === 0) {
                    // Failed to send OTP via WhatsApp, return the error message from the API
                    return res.status(500).json({
                        status: 0,
                        message: otpResponse.message || 'Gagal kirim OTP melalui email'
                    });
                }

            }
        
            const login_ip = req.ip || req.connection.remoteAddress; 
            const otp_expiration = new Date(Date.now() + 10 * 60000); // OTP valid for 10 minutes
            const now = Date.now();
            // await user.save({ fields: ['access_token', 'otp_expiration'] });
            // Save tokens to user record with where clause (based on user id)
            await DataPendaftars.update(
                {
                    access_token: otpCode,
                    otp_expiration: otp_expiration,
                    // is_login: 1,
                    // login_at: now,
                    // login_ip: login_ip
                },
                {
                    where: {
                        id: user.id
                    }
                }
            );


            res.status(200).json({
                status: 1,
                message: 'OTP berhasil dikirim via '+otp_via,
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
                    // is_active: 1,
                    // is_verified: 1,
                    is_delete: 0
                }
                
            });

            // if (!user) {
            //     return res.status(200).json({ status: 0, message: 'Akun tidak ditemukan, indikasi akun belum di aktifasi / verifikasi' });
            // }

            if (!user) {
                return res.status(403).json({ status: 0, message: 'NISN / password salah' });
            }

            
            if(user.is_verified == 0){
                return res.status(403).json({ status: 0, message: 'Akun belum diverifikasi, silahkan verifikasi terlebih dahulu ke sekolah!' });
            }

            if(user.is_active == 0){
                return res.status(403).json({ status: 0, message: 'Akun belum di aktivasi!' });
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

            const login_ip = req.ip || req.connection.remoteAddress; 
            const now = Date.now();

            // Save tokens to user record
            user.access_token = accessToken;
            user.access_token_refresh = refreshToken;
            
            user.is_login = 1;
            user.login_at = currentTime;
            user.login_ip = login_ip;

            await user.save({ fields: ['access_token', 'access_token_refresh', 'updated_at', 'is_login', 'login_at', 'login_ip' ] });

            const fullName =  user.nama_lengkap;
            const nameParts = fullName.trim().split(' ');
            // Mengambil kata pertama sebagai nama depan

            const resTimeline = await Timelines.findOne({
                attributes: ['id', 'nama', 'status'],
                where: {
                    id: 4,
                },
            });

            res.status(200).json({
                status: 1,
                message: 'Berhasil masuk',
                data: {
                    userId: encodeId(user.id),
                    nisn: user.nisn,
                    nama: nameParts[0],
                    nama_lengkap: fullName,
                    accessToken,
                    refreshToken,
                    timline_dafatar_sekolah: resTimeline
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
export const loginTanpaOtp = [

    async (req, res) => {

        const { nisn, password} = req.body;

        try {
            // Check if user exists
            const user = await DataPendaftars.findOne({
                where: {
                    nisn,
                    // access_token: otp,
                    // is_active: 1,
                    // is_verified: 1,
                    is_delete: 0
                }
                
            });

            // if (!user) {
            //     return res.status(200).json({ status: 0, message: 'Akun tidak ditemukan, indikasi akun belum di aktifasi / verifikasi' });
            // }

            if (!user) {
                return res.status(403).json({ status: 0, message: 'Akun tidak ditemukan!' });
            }

            // Compare password
            const isMatch = await bcrypt.compare(password, user.password_);
            if (!isMatch) {
                return res.status(403).json({ status: 0, message: 'NISN / password salah' });
            }


            if(user.is_verified == 0){
                return res.status(403).json({ status: 0, message: 'Akun belum diverifikasi, silahkan verifikasi terlebih dahulu ke sekolah!' });
            }

            if(user.is_active == 0){
                return res.status(403).json({ status: 0, message: 'Akun belum di aktivasi!' });
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

            const login_ip = req.ip || req.connection.remoteAddress; 
            const now = Date.now();

            // Save tokens to user record
            user.access_token = accessToken;
            user.access_token_refresh = refreshToken;
            
            user.is_login = 1;
            user.login_at = currentTime;
            user.login_ip = login_ip;

            await user.save({ fields: ['access_token', 'access_token_refresh', 'updated_at', 'is_login', 'login_at', 'login_ip' ] });

            const fullName =  user.nama_lengkap;
            const nameParts = fullName.trim().split(' ');
            // Mengambil kata pertama sebagai nama depan

            const resTimeline = await Timelines.findOne({
                attributes: ['id', 'nama', 'status'],
                where: {
                    id: 4,
                },
            });

            res.status(200).json({
                status: 1,
                message: 'Berhasil masuk',
                data: {
                    userId: encodeId(user.id),
                    nisn: user.nisn,
                    nama: nameParts[0],
                    nama_lengkap: fullName,
                    status_domisili: user.status_domisili,
                    kabkota_kk: user.kabkota_id,
                    kabkota_mutasi: user.kabkota_id_mutasi,
                    ats: user.is_tidak_sekolah,
                    anak_panti: user.is_anak_panti,
                    anak_miskin: user.is_anak_keluarga_tidak_mampu,
                    anak_guru: user.is_anak_guru_jateng,
                    disabilitas: user.is_disabilitas,
                    accessToken,
                    refreshToken,
                    timline_dafatar_sekolah: resTimeline,
                    penanda_update_jarak: user.is_pip
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

export const mainTenisCek = async (req, res, next) => {
    try {
        const apiKey = 'maintenis'
        const redis_key = `Maintenis`; 
        let keyNya = await redisGet(redis_key);

        if (keyNya) {
            keyNya = JSON.parse(keyNya); // Convert dari string ke objek JS
            console.log(`[CACHE] Found cached maintenance key for ${apiKey}`);
            return res.status(200).json({
                status: 1,
                message: 'Mode Maintenance.'+keyNya.nama,
                data: keyNya,
                // text: keyNya.kode_random
            });
        } else {
            keyNya = await EzAppKey.findOne({
                where: {
                    apikey: apiKey
                }
            });

            if (!keyNya) {
                return res.status(403).json({
                    status: 0,
                    message: 'Forbidden - Your maintenance key is not found',
                });
            }

            await redisSet(
                redis_key,
                JSON.stringify(keyNya),
                process.env.REDIS_EXPIRE_TIME_HARIAN
            );

            console.log(`[DB] Maintenis(${apiKey}) →`, keyNya);

            return res.status(200).json({
                status: 1,
                message: 'Mode Maintenance.'+keyNya.nama,
                data: keyNya
                // text: keyNya.kode_random
            });
        }

    } catch (error) {
        console.error('Error checking Maintenance Key:', error);
        res.status(500).json({
            status: 0,
            message: 'Internal Server Error',
        });
    }
};

export const mainTenisPublikCek = async (req, res, next) => {
    try {
        const apiKey = 'maintenis_publik'
        const redis_key = `Maintenis_Publik`; 
        let keyNya = await redisGet(redis_key);

        if (keyNya) {
            keyNya = JSON.parse(keyNya); // Convert dari string ke objek JS
            console.log(`[CACHE] Found cached maintenance publik key for ${apiKey}`);
            return res.status(200).json({
                status: 1,
                message: 'Mode Maintenance Public.'+keyNya.nama,
                data: keyNya
                // text: keyNya.kode_random
            });
        } else {
            keyNya = await EzAppKey.findOne({
                where: {
                    apikey: apiKey
                }
            });

            // const result = await EzAppKey.scope('withKodeRandom').findAll();
            if (!keyNya) {
                return res.status(403).json({
                    status: 0,
                    message: 'Forbidden - Your maintenance key is not found',
                });
            }

            await redisSet(
                redis_key,
                JSON.stringify(keyNya),
                process.env.REDIS_EXPIRE_TIME_HARIAN
            );

            console.log(`[DB] Maintenis(${apiKey}) →`, keyNya);

            return res.status(200).json({
                status: 1,
                message: 'Mode Maintenance Public.'+keyNya.nama,
                data: keyNya
                // text: keyNya.kode_random
            });
        }

    } catch (error) {
        console.error('Error checking Maintenance Key:', error);
        res.status(500).json({
            status: 0,
            message: 'Internal Server Error',
        });
    }
};

export const registerCustomCek = async (req, res, next) => {
    try {
        const apiKey = 'register_custom'
        const redis_key = `Register_Custom`; 
        let keyNya = await redisGet(redis_key);

        if (keyNya) {
            keyNya = JSON.parse(keyNya); // Convert dari string ke objek JS
            console.log(`[CACHE] Found cached register_custom key for ${apiKey}`);
            return res.status(200).json({
                status: 1,
                message: 'Mode Register_Custom.'+keyNya.nama,
                data: keyNya
            });
        } else {
            keyNya = await EzAppKey.findOne({
                where: {
                    apikey: apiKey
                }
            });

            if (!keyNya) {
                return res.status(403).json({
                    status: 0,
                    message: 'Forbidden - Your register_custom key is not found',
                });
            }

            await redisSet(
                redis_key,
                JSON.stringify(keyNya),
                process.env.REDIS_EXPIRE_TIME_HARIAN
            );

            console.log(`[DB] Register_Custom:(${apiKey}) →`, keyNya);

            return res.status(200).json({
                status: 1,
                message: 'Mode Register_Custom:.'+keyNya.nama,
                data: keyNya
            });
        }

    } catch (error) {
        console.error('Error checking Maintenance Key:', error);
        res.status(500).json({
            status: 0,
            message: 'Internal Server Error',
        });
    }
};

export const cekKodeRandomRegisterCek = async (req, res, next) => {
    try {
        
        const apiKey = 'register_custom'
        const kode_random = req.body.random_code;
        const redis_key = `Register_Custom`; 
        let cached = await redisGet(redis_key);


        if (cached) {

            console.log(`[REDIS] Cek dari cache: ${redis_key}`);

            const allCacheKey = JSON.parse(cached);
            const keyRegister = allCacheKey.find(pd => pd.kode_random === kode_random && pd.nama === 1);

            if (!keyRegister) {
                
                return res.status(403).json({
                    status: 0,
                    message: 'Salah!, Silahkan hubungi operaotor / admin SPMB sekolah!'
                });

            }else{

                return res.status(200).json({
                    status: 1,
                    message: 'Berhasil, silahkan lanjutkan pendaftaran anda.',
                });

            }

            return pesertaDidik;


        }else{

            const keyNya = await EzAppKey.findOne({
                where: {
                    apikey: apiKey
                }
            });

            if (!keyNya) {
                return res.status(403).json({
                    status: 0,
                    message: 'Forbidden - Your register_custom key is not found',
                });
            }

            await redisSet(
                redis_key,
                JSON.stringify(keyNya),
                process.env.REDIS_EXPIRE_TIME_HARIAN
            );

            console.log(`[DB] Register_Custom:(${apiKey}) →`, keyNya);

        }
        

    } catch (error) {
        console.error('Error checking Maintenance Key:', error);
        res.status(500).json({
            status: 0,
            message: 'Internal Server Error',
        });
    }
};


export const cekKodeNarasiCek = async (req, res, next) => {
    try {
        const apiKey = 'register_custom'
        const redis_key = `Register_Custom`; 
        let keyNya = await redisGet(redis_key);

        if (keyNya) {
            keyNya = JSON.parse(keyNya); // Convert dari string ke objek JS
            console.log(`[CACHE] Found cached register_custom key for ${apiKey}`);
            return res.status(200).json({
                status: 1,
                message: 'Mode Register_Custom.'+keyNya.nama,
                data: keyNya
            });
        } else {
            keyNya = await EzAppKey.findOne({
                where: {
                    apikey: apiKey
                }
            });

            if (!keyNya) {
                return res.status(403).json({
                    status: 0,
                    message: 'Forbidden - Your register_custom key is not found',
                });
            }

            await redisSet(
                redis_key,
                JSON.stringify(keyNya),
                process.env.REDIS_EXPIRE_TIME_HARIAN
            );

            console.log(`[DB] Register_Custom:(${apiKey}) →`, keyNya);

            return res.status(200).json({
                status: 1,
                message: 'Mode Register_Custom:.'+keyNya.nama,
                data: keyNya
            });
        }

    } catch (error) {
        console.error('Error checking Maintenance Key:', error);
        res.status(500).json({
            status: 0,
            message: 'Internal Server Error',
        });
    }
};

export const narasiPerubahan = async (req, res, next) => {
    try {
        const redis_key = `narasi_narasi`; 
        let keyNya = await redisGet(redis_key);

        if (keyNya) {
            keyNya = JSON.parse(keyNya); // Convert dari string ke objek JS
            console.log(`[CACHE] Found cached register_custom key for ${apiKey}`);
            return res.status(200).json({
                status: 1,
                message: 'Narasi:'+keyNya.nama,
                data: keyNya
            });
        } else {
            keyNya = await EzAppKey.findOne({
                where: {
                    id: 6
                }
            });

            if (!keyNya) {
                return res.status(403).json({
                    status: 0,
                    message: 'Forbidden - Your narasi key is not found',
                });
            }

            await redisSet(
                redis_key,
                JSON.stringify(keyNya),
                process.env.REDIS_EXPIRE_TIME_HARIAN
            );

            console.log(`[DB] Register_Custom:(${apiKey}) →`, keyNya);

            return res.status(200).json({
                status: 1,
                message: 'Mode Register_Custom:.'+keyNya.nama,
                data: keyNya
            });
        }

    } catch (error) {
        console.error('Error checking Maintenance Key:', error);
        res.status(500).json({
            status: 0,
            message: 'Internal Server Error',
        });
    }
};


    // export const authCekAdmin = async (req, res, next) => {
    //     try {
    //         const apiKey = 'waktu_kerja_admin'
    //         const redis_key = `waktu_kerja_admin`; 
    //         let keyNya = await redisGet(redis_key);

    //         if (keyNya) {
    //             keyNya = JSON.parse(keyNya); // Convert dari string ke objek JS
    //             console.log(`[CACHE] Found cached waktu_kerja_admin key for ${apiKey}`);
    //             return res.status(403).json({
    //                 status: 1,
    //                 message: 'Dari cache.',
    //                 data: keyNya.nama
    //             });
    //         } else {
    //             keyNya = await EzAppKey.findOne({
    //                 where: {
    //                     apikey: apiKey
    //                 }
    //             });

    //             if (!keyNya) {
    //                 return res.status(403).json({
    //                     status: 0,
    //                     message: 'Forbidden - Your waktu_kerja_admin key is not found',
    //                 });
    //             }

    //             await redisSet(
    //                 redis_key,
    //                 JSON.stringify(keyNya),
    //                 process.env.REDIS_EXPIRE_TIME_HARIAN
    //             );

    //             console.log(`[DB] waktu_kerja_admin(${apiKey}) →`, keyNya);

    //             return res.status(403).json({
    //                 status: 1,
    //                 message: ' Maaf mode sedang aktif. coba lagi nanti!.',
    //                 data: keyNya.nama
    //             });
    //         }

    //     } catch (error) {
    //         console.error('Error checking Maintenance Key:', error);
    //         res.status(500).json({
    //             status: 0,
    //             message: 'Internal Server Error',
    //         });
    //     }
    // };


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
            user.is_login = 0;
            user.login_at = null;
            user.login_ip = null;

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