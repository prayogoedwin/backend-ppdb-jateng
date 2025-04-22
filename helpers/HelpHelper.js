import axios from 'axios';
import FormData from 'form-data';
import nodemailer from 'nodemailer';
import { redisGet, redisSet } from '../redis.js'; // Import the Redis functions
import Timelines from "../models/service/TimelineModel.js";
import FileTambahans from "../models/master/FileTambahanModel.js";
import EzIntegrator from "../models/config/EzIntegrator.js";
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

// export const getTimelineSatuan = async (id) => {
//     const redis_key = `timeline:byid:${id}`;

//     // Cek di Redis
//     const cached = await redisGet(redis_key);
//     if (cached) {
//         return JSON.parse(cached);
//     }

//     // Kalau tidak ada di cache, ambil dari DB
//     const resTm = await Timelines.findOne({
//         where: { id: id },
//         attributes: ['id', 'nama', 'status', 'tanggal_buka', 'tanggal_tutup']
//     });

//     await redisSet(redis_key, JSON.stringify(resTm), process.env.REDIS_EXPIRE_TIME_MASTER); 

//     return resTm;
// };

export const getFileTambahanByJalurPendaftaran = async (id) => {
    const redis_key = `file_tambahan:by-jalur-pendaftaran:${id}`;
  
    try {
      // 1) Cek Redis
      const cached = await redisGet(redis_key);
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`[CACHE] FileTambahans(${id}) →`, data);
        return data;
      }
  
      // 2) Ambil dari DB
    //   const resTm = await Timelines.findOne({
    //     where: { id },
    //     attributes: ['id', 'nama', 'status', 'tanggal_buka', 'tanggal_tutup']
    //   });

      const resTm = await FileTambahans.findAll({
        where: {
            id_jalur_pendaftaran: id,
            is_active: 1
        }
    }   );
  
      // 3) Kalau ada, ubah ke POJO, simpan ke Redis, dan return
      if (resTm) {
        const data = resTm.toJSON();                  // → plain object
        await redisSet(redis_key,
                       JSON.stringify(data),
                       process.env.REDIS_EXPIRE_TIME_MASTER);
        console.log(`[DB] FileTambahans(${id}) →`, data);
        return data;
      }
  
      // 4) Kalau tidak ketemu di DB
      console.log(`[DB] FileTambahans(${id}) → null`);
      return null;
  
    } catch (err) {
      console.error(`Error in FileTambahans(${id}):`, err);
      return null;
    }
};


export const getTimelineSatuan = async (id) => {
    const redis_key = `timeline:byid:${id}`;
  
    try {
      // 1) Cek Redis
      const cached = await redisGet(redis_key);
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`[CACHE] getTimelineSatuan(${id}) →`, data);
        return data;
      }
  
      // 2) Ambil dari DB
      const resTm = await Timelines.findOne({
        where: { id },
        attributes: ['id', 'nama', 'status', 'tanggal_buka', 'tanggal_tutup']
      });
  
      // 3) Kalau ada, ubah ke POJO, simpan ke Redis, dan return
      if (resTm) {
        const data = resTm.toJSON();                  // → plain object
        await redisSet(redis_key,
                       JSON.stringify(data),
                       process.env.REDIS_EXPIRE_TIME_MASTER);
        console.log(`[DB] getTimelineSatuan(${id}) →`, data);
        return data;
      }
  
      // 4) Kalau tidak ketemu di DB
      console.log(`[DB] getTimelineSatuan(${id}) → null`);
      return null;
  
    } catch (err) {
      console.error(`Error in getTimelineSatuan(${id}):`, err);
      return null;
    }
};

export const getIntegratorSatuan = async (id) => {
    const redis_key = `integrasi_data:byid:${id}`;
  
    try {
      // 1) Cek Redis
      const cached = await redisGet(redis_key);
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`[CACHE] getIntegratorSatuan(${id}) →`, data);
        return data;
      }
  
      // 2) Ambil dari DB
      const resTm = await EzIntegrator.findOne({
        where: { id },
        attributes: ['id', 'username', 'password_', 'nama_instansi', 'is_active']
      });
  
      // 3) Kalau ada, ubah ke POJO, simpan ke Redis, dan return
      if (resTm) {
        const data = resTm.toJSON();                  // → plain object
        await redisSet(redis_key,
                       JSON.stringify(data),
                       process.env.REDIS_EXPIRE_TIME_MASTER);
        console.log(`[DB] getIntegratorSatuan(${id}) →`, data);
        return data;
      }
  
      // 4) Kalau tidak ketemu di DB
      console.log(`[DB] getIntegratorSatuan(${id}) → null`);
      return null;
  
    } catch (err) {
      console.error(`Error in getIntegratorSatuan(${id}):`, err);
      return null;
    }
};

export const getTimelineAll = async () => {
    const redis_key = 'TimelineAll';
  
    try {
      // 1) Cek Redis
      const cached = await redisGet(redis_key);
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`[CACHE] getTimelineAll →`, data);
        return data;                  // array of plain objects
      }
  
      // 2) Ambil semua dari DB
      const resList = await Timelines.findAll({
        attributes: ['id', 'nama', 'status', 'tanggal_buka', 'tanggal_tutup']
      });
  
      // 3) Konversi ke POJO dan simpan ke Redis
      const data = resList.map(item => item.toJSON());
      if (data.length) {
        await redisSet(
          redis_key,
          JSON.stringify(data),
          process.env.REDIS_EXPIRE_TIME_MASTER
        );
      }
      console.log(`[DB] getTimelineAll →`, data);
      return data;
  
    } catch (err) {
      console.error(`Error in getTimelineAll:`, err);
      return [];
    }
  };

export const getStatusKepindahanByCode = (code) => {
    const statusMap = {
        0: 'TIDAK ADA / LEBIH DARI 1 TAHUN',
        1: 'DALAM SATU DESA/KELURAHAN',
        2: 'ANTAR DESA/KELURAHAN',
        3: 'ANTAR KECAMATAN',
        4: 'ANTAR KAB/KOTA',
        5: 'ANTAR PROVINSI'
    };

    // Return the status based on the code, or a default message if not found
    return statusMap[code] || 'Unknown Status';
}

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
        prestasi: 3,
    };

    return data[key] || 0; // Jika key tidak ditemukan, return 0
};

export const DomiNilaiHelper = (key) => {
    const data = {
        nilai: 3,
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
