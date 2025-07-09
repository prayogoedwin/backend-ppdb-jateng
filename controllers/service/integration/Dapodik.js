import axios from 'axios';
import db3 from '../../../config/Database3.js';
import EzAppKey from '../../../models/config/AppKeyModel.js';
import { redisGet, redisSet } from '../../../redis.js'; // Import the Redis functions
import http from 'http';
import https from 'https';
import { execSync } from 'child_process';
import { URL } from 'url';

const API_URL = 'http://118.98.237.214'; // ganti dengan URL asli
const USERNAME = 'masthenol@gmail.com';  // ganti dengan username asli
const PASSWORD = 'Set@n2000$';          // ganti dengan password asli
const TOKEN_STATIS = '0CFA4030-9EBD-448B-A860-54EE711EA3A3';          // ganti dengan password asli

export const callAuthenticateV2 = async (req, res) => {
  const url = `${API_URL}/v1/api-gateway/authenticate/authenticateV2/`;
  const redis_key = `dapodik`;

  try {
    const response = await axios.get(url, {
      auth: {
        username: USERNAME,
        password: PASSWORD,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = response.data;

    if (result?.statusCode === 200 && result?.data?.token) {
      const token = result.data.token;
      
      // Simpan ke Redis terlebih dahulu
      await redisSet(
        redis_key,
        token,
        process.env.REDIS_EXPIRE_TIME_HARIAN
      );

      // Kemudian return response
      return res.status(200).json({
        status: 1,
        message: 'Token saved successfully',
        token: token
      });

    } else {
      return res.status(200).json({
        status: 0,
        message: result?.message || 'Unauthorized'
      });
    }
  } catch (error) {
    const errMsg = error.response?.data?.message || error.message;
    console.error('Authentication error:', error);
    return res.status(500).json({
      status: 0,
      message: errMsg,
      errorDetails: error.stack // Added for debugging
    });
  }
};

// const httpAgent = new http.Agent({
//   keepAlive: true,
//   keepAliveMsecs: 60000,
//   maxSockets: 100,
//   maxFreeSockets: 256,
//   timeout: 300000 // Increased to 5 minutes
// });

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 50, // Tidak perlu Infinity
  maxFreeSockets: 20,
  timeout: 300000,
  socketOptions: {
    keepAlive: true,
    timeout: 300000,
    noDelay: true, // Disable Nagle's algorithm
    keepAliveInitialDelay: 10000
  }
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 100,
  maxFreeSockets: 256,
  timeout: 300000, // Increased to 5 minutes
  rejectUnauthorized: false
});

const api = axios.create({
  baseURL: 'http://118.98.237.214',
  timeout: 300000, // Increased to 5 minutes
  httpAgent,
  httpsAgent,
  headers: {
    'Connection': 'keep-alive',
    'Keep-Alive': 'timeout=120, max=1000'
  },
  transitional: {
    silentJSONParsing: false,
    forcedJSONParsing: true,
    clarifyTimeoutError: true
  }
});

export const KirimSatuanResponsJsonAA = async (req, res) => {
  const { no_pendaftaran } = req.body;

  if (!no_pendaftaran) {
    return res.status(400).json({
      status: 0,
      message: 'Parameter no_pendaftaran diperlukan'
    });
  }

  const redis_key = 'dapodik';
  const tokenData = await redisGet(redis_key);
  const token_bearer = tokenData;
  const url = 'http://118.98.237.214/v1/api-gateway/pd/tambahDataHasilPPDB';

  if (!token_bearer) {
    return res.status(401).json({
      status: 0,
      message: 'Token tidak tersedia, silakan autentikasi terlebih dahulu'
    });
  }

  try {
    const results = await db3.query(`
      SELECT 
          b.id as peserta_didik_id, 
          b.sekolah_id as sekolah_id_asal,
          b.npsn as npsn_sekolah_asal,
          c.nama_sekolah_asal,
          a.nik, a.nisn, a.nama_lengkap as nama, b.tempat_lahir, b.tanggal_lahir, b.jenis_kelamin,
          b.nik_ibu, b.nama_ibu_kandung, b.nik_ayah, b.nama_ayah, b.nik_wali, b.nama_wali,
          c.alamat as alamat_jalan, c.rt, c.rw, NULL as nama_dusun, NULL as desa_kelurahan, 
          c.kelurahan_id as kode_wilayah_siswa,
          c.lat as lintang, c.lng as bujur, b.kebutuhan_khusus_id, NULL as agama_id,
          b.no_kk, a.sekolah_tujuan_id, d.sekolah_id as sekolah_id_tujuan, 
          d.npsn as npsn_sekolah_tujuan, d.nama as nama_sekolah_tujuan
      FROM ez_perangkingan a 
      INNER JOIN ez_peserta_didik b ON a.nik = b.nik
      INNER JOIN ez_pendaftar c ON b.nik = c.nik
      INNER JOIN ez_sekolah_tujuan d ON a.sekolah_tujuan_id = d.id
      WHERE a.is_delete = 0
      AND a.is_daftar_ulang = 1
      AND a.no_pendaftaran = :no_pendaftaran
      LIMIT 1
      `, {
      replacements: { no_pendaftaran },
      type: db3.QueryTypes.SELECT
    });

    if (results.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Data tidak ditemukan untuk no_pendaftaran tersebut'
      });
    }

    const row = results[0];
    const payload = {
      token: TOKEN_STATIS,
      peserta_didik_id: row.peserta_didik_id,
      sekolah_id_asal: row.sekolah_id_asal,
      npsn_sekolah_asal: row.npsn_sekolah_asal,
      nama_sekolah_asal: row.nama_sekolah_asal,
      nik: row.nik,
      nisn: row.nisn,
      nama: row.nama,
      tempat_lahir: row.tempat_lahir,
      tanggal_lahir: row.tanggal_lahir,
      jenis_kelamin: row.jenis_kelamin,
      nik_ibu: row.nik_ibu ? row.nik_ibu.substring(0, 16) : "",
      nama_ibu_kandung: row.nama_ibu_kandung,
      nama_ayah: row.nama_ayah,
      nik_ayah: row.nik_ayah ? row.nik_ayah.substring(0, 16) : "",
      nama_wali: "",
      nik_wali: "",
      alamat_jalan: row.alamat_jalan,
      rt: row.rt,
      rw: row.rw,
      nama_dusun: "",
      desa_kelurahan: "",
      kode_wilayah_siswa: row.kode_wilayah_siswa,
      lintang: row.lintang ? row.lintang.toString() : "",
      bujur: row.bujur ? row.bujur.toString() : "",
      kebutuhan_khusus_id: "0", 
      agama_id: "",
      no_kk: "",
      sekolah_id_tujuan: row.sekolah_id_tujuan,
      npsn_sekolah_tujuan: row.npsn_sekolah_tujuan,
      nama_sekolah_tujuan: row.nama_sekolah_tujuan
    };

    console.log('Mengirim payload:', JSON.stringify(payload, null, 2));
    console.log('Menggunakan token:', token_bearer);

    // Simplified Axios request with direct connection
    // const response = await axios({
    //   method: 'post',
    //   url: url,
    //   data: payload,
    //   headers: {
    //     'Authorization': `Bearer ${token_bearer}`,
    //     'Content-Type': 'application/json'
    //   },
    //   // Force direct connection (no proxy)
    //   proxy: false,
    //   // Disable any automatic proxy detection
    //   httpAgent: new http.Agent({ keepAlive: true, rejectUnauthorized: false }),
    //   httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: false })
    // });

    const response = await api.post('/v1/api-gateway/pd/tambahDataHasilPPDB', payload, {
        headers: {
            'Authorization': `Bearer ${token_bearer}`,
            'Content-Type': 'application/json'
        }
        });

    const datas = response;

    console.log(datas);  // Pretty-printed JSON

    if (datas.statusCode === 200) {
      await db3.query(
        `UPDATE ez_perangkingan 
         SET integrasi_id = :integrasi_id, 
             integrated_at = NOW() 
         WHERE no_pendaftaran = :no_pendaftaran`,
        {
          replacements: {
            integrasi_id: datas.data.uploadIntegrasiId,
            no_pendaftaran: no_pendaftaran
          }
        }
      );

       return res.status(200).json({
        status: 1,
        message: datas.message,
        data: {
            status: datas.statusCode, 
            no_pendaftaran,
            response: datas.data.uploadIntegrasiId,
        }
        });

    }else{

        return res.status(200).json({
            status: 1,
            message: datas.message,
            data: {
                status: datas.statusCode, 
                no_pendaftaran,
                response: datas.data,
            }
            });

    }

    

  } catch (error) {
    console.error('Error details:', error);
    return res.status(500).json({
      status: 0,
      message: 'Terjadi kesalahan server',
      error: error.message,
      stack: error.stack, // Include stack trace for debugging
      data: {
        no_pendaftaran
      }
    });
  }
};


// Fungsi utama dengan retry mechanism
async function postWithRetryAndTracking(payload, no_pendaftaran, token_bearer, maxRetries = 3) {
  let attempt = 0;
  let lastError;
  
  // Catat waktu mulai
  const requestId = `req-${no_pendaftaran}-${Date.now()}`;
  const startTime = new Date();
  
  // Simpan ke tracking table
  await db3.query(
    `INSERT INTO api_request_tracking 
     (request_id, no_pendaftaran, payload, status, attempt, created_at)
     VALUES (:request_id, :no_pendaftaran, :payload, 'pending', 0, NOW())`,
    {
      replacements: {
        request_id: requestId,
        no_pendaftaran: no_pendaftaran,
        payload: JSON.stringify(payload)
      }
    }
  );

  while (attempt < maxRetries) {
    attempt++;
    try {
      // Update status attempt
      await db3.query(
        `UPDATE api_request_tracking 
         SET attempt = :attempt, last_attempt_at = NOW() 
         WHERE request_id = :request_id`,
        { replacements: { attempt, request_id: requestId } }
      );

      const response = await api.post('/v1/api-gateway/pd/tambahDataHasilPPDB', payload, {
        headers: {
          'Authorization': `Bearer ${token_bearer}`,
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        }
      });

      // Jika berhasil, update status
      await db3.query(
        `UPDATE api_request_tracking 
         SET status = 'success', 
             response_data = :response_data,
             completed_at = NOW()
         WHERE request_id = :request_id`,
        { 
          replacements: { 
            response_data: JSON.stringify(response.data),
            request_id: requestId 
          } 
        }
      );

      return response.data;

    } catch (error) {
      lastError = error;
      
      // Update status error
      await db3.query(
        `UPDATE api_request_tracking 
         SET status = 'retrying', 
             last_error = :error_message,
             last_error_at = NOW()
         WHERE request_id = :request_id`,
        { 
          replacements: { 
            error_message: error.message,
            request_id: requestId 
          } 
        }
      );

      if (attempt < maxRetries) {
        const delay = Math.min(2000 * attempt, 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Update status final error
  await db3.query(
    `UPDATE api_request_tracking 
     SET status = 'failed', 
         completed_at = NOW()
     WHERE request_id = :request_id`,
    { replacements: { request_id: requestId } }
  );

  throw lastError;
}

export const KirimSatuanResponsJson = async (req, res) => {
  const { no_pendaftaran } = req.body;

  // ... validasi dan query data seperti sebelumnya ...

  try {
    const row = results[0];
    const payload = {
      // ... konstruksi payload seperti sebelumnya ...
    };

    console.log('Mengirim payload:', JSON.stringify(payload, null, 2));

    // Gunakan fungsi dengan retry
    const responseData = await postWithRetryAndTracking(payload, no_pendaftaran, token_bearer);

    // Update database dengan ID kembalian
    if (responseData.uploadIntegrasiId) {
      await db3.query(
        `UPDATE ez_perangkingan 
         SET integrasi_id = :integrasi_id, 
             integrated_at = NOW() 
         WHERE no_pendaftaran = :no_pendaftaran`,
        {
          replacements: {
            integrasi_id: responseData.uploadIntegrasiId,
            no_pendaftaran: no_pendaftaran
          }
        }
      );
    }

    return res.status(200).json({
      status: 1,
      message: responseData.message || 'Data berhasil dikirim',
      data: {
        status: responseData.statusCode || 200,
        no_pendaftaran,
        response: responseData.uploadIntegrasiId || null
      }
    });

  } catch (error) {
    console.error('Error details:', error);
    
    // Cek apakah mungkin data sudah terkirim
    const possibleSuccess = await checkPossibleSuccess(no_pendaftaran);
    if (possibleSuccess) {
      return res.status(200).json({
        status: 1,
        message: 'Data mungkin sudah terkirim sebelumnya',
        data: {
          no_pendaftaran,
          response: possibleSuccess.integrasi_id
        }
      });
    }

    return res.status(500).json({
      status: 0,
      message: 'Gagal mengirim data setelah beberapa percobaan',
      error: error.message,
      data: {
        no_pendaftaran
      }
    });
  }
};

// Fungsi untuk cek kemungkinan data sudah terkirim
async function checkPossibleSuccess(no_pendaftaran) {
  try {
    const result = await db3.query(
      `SELECT integrasi_id FROM ez_perangkingan 
       WHERE no_pendaftaran = :no_pendaftaran 
       AND integrasi_id IS NOT NULL
       LIMIT 1`,
      { replacements: { no_pendaftaran }, type: db3.QueryTypes.SELECT }
    );
    
    return result[0] || null;
  } catch (e) {
    console.error('Error checking possible success:', e);
    return null;
  }
}
