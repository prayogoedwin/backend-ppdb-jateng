import axios from 'axios';
import FormData from 'form-data';
import nodemailer from 'nodemailer';
import { redisGet, redisSet } from '../redis.js'; // Import the Redis functions
// import EzSekolahTujuans from '../models/master/EzSekolahTujuansModel.js'; // Adjusted path to EzSekolahTujuans model
// import EzWilayahVerDapodiks from '../models/master/WilayahVerDapodikModel.js'; // Adjusted path to WilayahVerDapodik model

export async function sendOtpToWhatsapp(phone, message) {
    const url = 'https://nusagateway.com/api/send-message.php';
    const token = process.env.WA_TOKEN; // Ambil token dari environment variables

    try {
        // Buat form-data untuk request
        const formData = new FormData();
        formData.append('token', token);
        formData.append('phone', phone);
        formData.append('message', message);

        // Kirim request POST dengan form-data
        const response = await axios.post(url, formData, {
            headers: {
                ...formData.getHeaders() // Header otomatis untuk form-data
            }
        });

        // Cek apakah pesan berhasil dikirim
        if (response.data.result === 'true') {
            return {
                status: 1,
                message: 'OTP berhasil dikirim melalui WhatsApp'
            };
        } else {
            return {
                status: 0,
                message: response.data.message || 'OTP gagal dikirim melalui WhatsApp'
            };
        }
    } catch (error) {
        console.error('OTP gagal dikirim melalui WhatsApp:', error.message);
        return {
            status: 0,
            message: 'OTP gagal dikirim melalui WhatsApp'
        };
    }
}

export async function sendOtpToEmail(email, message) {
    const smtpHost = process.env.SMTP_HOST; // SMTP server host
    const smtpPort = process.env.SMTP_PORT; // SMTP server port
    const smtpUser = process.env.SMTP_USER; // SMTP username
    const smtpPass = process.env.SMTP_PASS; // SMTP password

    try {
        // Create a reusable transporter object using SMTP transport
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465, // true for 465, false for other ports
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });

        // Setup email data
        const mailOptions = {
            from: '"PPDB SMA/SMK Jateng" <no-reply@yourdomain.com>', // sender address
            to: email, // list of receivers
            subject: 'Kode OTP PPDB anda', // Subject line
            text: message, // plain text body
        };

        // Send mail
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ', info);

        // Check if the message was sent
        if (info.accepted.length > 0) {
            return {
                status: 1,
                message: 'OTP berhasil dikirim melalui email 1'
            };
        } else {
            return {
                status: 0,
                message: 'OTP gagal dikirim melalui email 2'
            };
        }
    } catch (error) {
        console.error('OTP gagal dikirim melalui email:', error.message);
        return {
            status: 0,
            message: 'OTP gagal dikirim melalui email 3'
        };
    }
}

export const getTimelineSatuan = async (id) => {
    const cacheKey = `timeline:byid:${id}`;

    // Cek di Redis
    const cached = await redisGet(redis_key);
    if (cached) {
        return JSON.parse(cached);
    }

    // Kalau tidak ada di cache, ambil dari DB
    const resTm = await Timelines.findOne({
        where: { id: id },
        attributes: ['id', 'nama', 'status', 'tanggal_buka', 'tanggal_tutup']
    });

    await redis.set(cacheKey, JSON.stringify(resTm), 'EX', process.env.REDIS_EXPIRE_TIME_SOURCE_DATA);

    return resTm;
};

//SMA
export const afirmasiSmaHelper = (key) => {
    const data = {
        is_anak_keluarga_miskin: 26,
        is_anak_panti: 3,
        is_tidak_sekolah: 3
    };

    return data[key] || 0; // Jika key tidak ditemukan, return 0
};

export const DomiRegHelper = (key) => {
    const data = {
        murni: 30,
        prestasi: 0,
    };

    return data[key] || 0; // Jika key tidak ditemukan, return 0
};

//===================================================//

//SMK
export const afirmasiSmkHelper = (key) => {
    const data = {
        is_anak_keluarga_miskin: 9,
        is_anak_panti: 3,
        is_tidak_sekolah: 3
    };

    return data[key] || 0; // Jika key tidak ditemukan, return 0
};
export const DomiSmkHelper = (key) => {
    const data = {
        terdekat: 8,
        anak_guru: 2,
    };

    return data[key] || 0; // Jika key tidak ditemukan, return 0
};
