import axios from 'axios';
import FormData from 'form-data';

async function sendOtpToWhatsapp(phone, message) {
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

module.exports = {
    sendOtpToWhatsapp
};
