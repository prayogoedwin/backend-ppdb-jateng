import axios from 'axios';
import FormData from 'form-data';
import nodemailer from 'nodemailer';

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

        // Check if the message was sent
        if (info.accepted.length > 0) {
            return {
                status: 1,
                message: 'OTP berhasil dikirim melalui email'
            };
        } else {
            return {
                status: 0,
                message: 'OTP gagal dikirim melalui email'
            };
        }
    } catch (error) {
        console.error('OTP gagal dikirim melalui email:', error.message);
        return {
            status: 0,
            message: 'OTP gagal dikirim melalui email'
        };
    }
}
