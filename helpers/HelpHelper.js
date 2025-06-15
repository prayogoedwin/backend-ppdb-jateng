import axios from 'axios';
import FormData from 'form-data';
import nodemailer from 'nodemailer';
import { redisGet, redisSet } from '../redis.js'; // Import the Redis functions
import Timelines from "../models/service/TimelineModel.js";
import FileTambahans from "../models/master/FileTambahanModel.js";
import SekolahTujuan from "../models/master/SekolahTujuanModel.js";
import SekolahJurusan from "../models/master/SekolahJurusanModel.js";
import EzAppKey from '../models/config/AppKeyModel.js';

import SekolahZonasiKhusus from "../models/master/SekolahZonasiKhususModel.js";

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
  

      const resTm = await FileTambahans.findAll({
        where: {
            id_jalur_pendaftaran: id,
            is_active: 1
        }
    }   );
  
      // 3) Kalau ada, ubah ke POJO, simpan ke Redis, dan return
      if (resTm) {
        const data = resTm;              // → plain object
        await redisSet(redis_key,
                       JSON.stringify(data),
                       process.env.REDIS_EXPIRE_TIME_MASTER);
        console.log(`[DB] FileTambahans(${id}) →`, data);
        return data;
      }
  

  
    } catch (err) {
      console.error(`Error in FileTambahans(${id}):`, err);
      return null;
    }
};

export const getSekolahTujuanById = async (id) => {
  const redis_key = `sekolah_tujuan:byid:${id}`;

  try {
    // 1) Cek Redis
    const cached = await redisGet(redis_key);
    if (cached) {
      const data = JSON.parse(cached);
      console.log(`[CACHE] getSekolahTujuanById(${id}) →`, data);
      return data;
    }

    // 2) Ambil dari DB
    const resSek = await SekolahTujuan.findOne({
      where: { id }
    });

    // 3) Kalau ada, ubah ke POJO, simpan ke Redis, dan return
    if (resSek) {
      const data = resSek.toJSON();
      await redisSet(
        redis_key,
        JSON.stringify(data),
        process.env.REDIS_EXPIRE_TIME_SOURCE_DATA
      );
      console.log(`[DB] getSekolahTujuanById(${id}) →`, data);
      return data;
    }

    // 4) Kalau tidak ketemu di DB
    console.log(`[DB] getSekolahTujuanById(${id}) → null`);
    return null;

  } catch (err) {
    console.error(`Error in getSekolahTujuanById(${id}):`, err);
    return null;
  }
};

export const getSekolahJurusanById = async (sekolah_tujuan_id, jurusan_id) => {
  const redis_key = `sekolah_jurusan:byid:${sekolah_tujuan_id}:${jurusan_id}`;

  try {
    // 1) Cek Redis
    const cached = await redisGet(redis_key);
    if (cached) {
      const data = JSON.parse(cached);
      console.log(`[CACHE] getSekolahJurusanById(${sekolah_tujuan_id}, ${jurusan_id}) →`, data);
      return data;
    }

    if (jurusan_id == '' || jurusan_id == 'undefined') {
        return null;
    }

    // 2) Ambil dari DB
    const resJurSek = await SekolahJurusan.findOne({
      where: {
        id_sekolah_tujuan: sekolah_tujuan_id,
        id: jurusan_id,
      }
    });

    // 3) Kalau ada, ubah ke POJO, simpan ke Redis, dan return
    if (resJurSek) {
      const data = resJurSek.toJSON();
      await redisSet(
        redis_key,
        JSON.stringify(data),
        process.env.REDIS_EXPIRE_TIME_SOURCE_DATA
      );
      console.log(`[DB] getSekolahJurusanById(${sekolah_tujuan_id}, ${jurusan_id}) →`, data);
      return data;
    }

    // 4) Kalau tidak ketemu
    console.log(`[DB] getSekolahJurusanById(${sekolah_tujuan_id}, ${jurusan_id}) → null`);
    return null;

  } catch (err) {
    console.error(`Error in getSekolahJurusanById(${sekolah_tujuan_id}, ${jurusan_id}):`, err);
    return null;
  }
};

export const SekolahZonasiKhususByNpsn = async (npsn) => {

  const redis_key = `zonasi_khusus:by_npsn:${npsn}`;
  let data;
  try {
    // 1) Cek Redis
    const cached = await redisGet(redis_key);
    if (cached) {
      data = JSON.parse(cached);
      console.log(`[CACHE] SekolahZonasiKhususByNpsn(${npsn} →`, data);
      return data;
    }

    // 2) Ambil dari DB
    const resZonKh = await SekolahZonasiKhusus.findAll({
      where: {
        npsn: npsn,
      }
    });

    // 3) Kalau ada, ubah ke POJO, simpan ke Redis, dan return

    if (resZonKh) {
      data = resZonKh;
      await redisSet(
        redis_key,
        JSON.stringify(data),
        process.env.REDIS_EXPIRE_TIME_SOURCE_DATA
      );
      console.log(`[DB] SekolahZonasiKhususByNpsn(${npsn} →`, data);
      return data;
    }

    // 4) Kalau tidak ketemu
    console.log(`[DB] SekolahZonasiKhususByNpsn(${npsn} →`, data);
    return null;

  } catch (err) {
   
    return null;
  }

}


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
                       process.env.REDIS_EXPIRE_TIME_SOURCE_DATA);
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
          process.env.REDIS_EXPIRE_TIME_SOURCE_DATA
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


// ===========

export const convertNameToBase64 = (name) => {

  // const originalFilename = '2a09324fc3900814d749090a54b3bb2c.pdf';
  const originalFilename = name || 'default_filename.pdf'; // Use the provided name or a default value
  const base64Filename = Buffer.from(originalFilename).toString('base64');

  return base64Filename;

}


export const klasifikasiPindah = (key) => {
  const data = {
      0: 'TIDAK ADA DATA KEPINDAHAN',
      1: 'DALAM SATU DESA/KELURAHAN',
      2: 'ANTAR DESA/KELURAHAN',
      3: 'ANTAR KECAMATAN',
      4: 'ANTAR KAB/KOTA',
      5: 'ANTAR PROVINSI'
  };

  return data[key] || 'TIDAK ADA DATA KEPINDAHAN'; // Jika key tidak ditemukan, return 0
};

export function parseKodeWilayah(kodeKelurahan) {
  if (kodeKelurahan == '') {
      // throw new Error('Kode kelurahan harus di input');
      return {
        kode_kelurahan: null,
        kode_kecamatan: null,
        kode_kabupaten: null,
        kode_provinsi: null
    };
  }

  let kode = kodeKelurahan.toString();

  if (kode.length == 6) {

    // Kode kabupaten adalah 4 digit pertama + '00'
    const kodeKabupaten = kode.substring(0, 4) + '00';
    
    // Kode provinsi adalah 2 digit pertama + '0000'
    const kodeProvinsi = kode.substring(0, 2) + '0000';
    
    return {
        kode_kelurahan: kode,
        kode_kecamatan: kode,
        kode_kabupaten: kodeKabupaten,
        kode_provinsi: kodeProvinsi
    };


  }

  // Kode kecamatan adalah 6 digit pertama
  const kodeKecamatan = kode.substring(0, 6);

  // Kode kabupaten adalah 4 digit pertama + '00'
  const kodeKabupaten = kode.substring(0, 4) + '00';
    
  // Kode provinsi adalah 2 digit pertama + '0000'
  const kodeProvinsi = kode.substring(0, 2) + '0000';
  
  return {
      kode_kelurahan: kode,
      kode_kecamatan: kodeKecamatan,
      kode_kabupaten: kodeKabupaten,
      kode_provinsi: kodeProvinsi
  };
}

export const checkMaintenancePublicStatus = async (apiKey) => {
    try {
        const redis_key = `Maintenis_Publik`;
        let maintenanceData = await redisGet(redis_key);

        if (maintenanceData) {
            maintenanceData = JSON.parse(maintenanceData);
            console.log(`[CACHE] Found cached maintenance publik key for ${apiKey}`);
            return maintenanceData.nama;
        }

        maintenanceData = await EzAppKey.findOne({
            where: { apikey: apiKey }
        });

        if (!maintenanceData) {
            return null;
        }

        await redisSet(
            redis_key,
            JSON.stringify(maintenanceData),
            process.env.REDIS_EXPIRE_TIME_HARIAN
        );

        console.log(`[DB] Maintenis(${apiKey}) →`, maintenanceData);
        return maintenanceData.nama;

    } catch (error) {
        console.error('Error checking Maintenance Key:', error);
        throw error; // Let the caller handle the error
    }
};

export const checkWaktuCachePerangkingan = async () => {
    try {

        const apiKey = 'waktu_cache_perangkingan14045';
        const redis_key = `waktu_cache_perangkingan`;
        let maintenanceData = await redisGet(redis_key);

        if (maintenanceData) {
            maintenanceData = JSON.parse(maintenanceData);
            console.log(`[CACHE] Found cached jurnal time key for ${redis_key}`);
            return maintenanceData.nama;
        }

        maintenanceData = await EzAppKey.findOne({
            where: { apikey: apiKey }
        });

        if (!maintenanceData) {
            return null;
        }

        await redisSet(
            redis_key,
            JSON.stringify(maintenanceData),
            process.env.REDIS_EXPIRE_TIME_HARIAN
        );

        console.log(`[DB] Cached(${redis_key}) →`, maintenanceData);
        return maintenanceData.nama;

    } catch (error) {
        console.error('Error checking jurnal time Key:', error);
        throw error; // Let the caller handle the error
    }
};

