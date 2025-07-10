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

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: Infinity,
  maxFreeSockets: 256,
  timeout: 300000 // Increased to 5 minutes
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: Infinity,
  maxFreeSockets: 256,
  timeout: 300000, // Increased to 5 minutes
  rejectUnauthorized: false
});

const api = axios.create({
  baseURL: 'http://118.98.237.214',
  timeout: 120000, // Naikkan timeout menjadi 120 detik
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

export const KirimSatuanResponsJson = async (req, res) => {
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
        const updateResult = await db3.query(
        `UPDATE ez_perangkingan 
        SET integrasi_id = :integrasi_id, 
            integrated_at = NOW() 
        WHERE no_pendaftaran = :no_pendaftaran`,
        {
            replacements: {
            integrasi_id: datas.data.uploadIntegrasiId,
            no_pendaftaran: no_pendaftaran
            },
            logging: console.log // Ini akan menampilkan query SQL yang dijalankan
        }
        );

        console.log('Hasil update:', updateResult);
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
}

export const downloadCsvDonk = async (req, res) => {
  try {
    const results = await db3.query(`
      SELECT 
      	DISTINCT ON (a.nisn)
        b.id AS peserta_didik_id, 
                b.npsn AS npsn_sekolah_asal,
                c.nama_sekolah_asal,
                a.nik, a.nisn, a.nama_lengkap AS nama, 
                b.tempat_lahir, b.tanggal_lahir, b.jenis_kelamin,
                b.nama_ibu_kandung, '1' AS agama_id, 
                b.kebutuhan_khusus_id, NULL AS no_kk, 
                c.kelurahan_id AS kode_desa_peserta_didik,
                d.sekolah_id AS sekolah_id_tujuan, 
                d.npsn AS npsn_sekolah_tujuan, 
                d.nama AS nama_sekolah_tujuan
      FROM ez_perangkingan a 
      INNER JOIN ez_peserta_didik b ON a.nik = b.nik
      INNER JOIN ez_pendaftar c ON a.nik = c.nik
      INNER JOIN ez_sekolah_tujuan d ON a.sekolah_tujuan_id = d.id
      WHERE a.is_delete = 0
      AND a.is_daftar_ulang = 1
      ORDER BY a.nisn
    `, {
      type: db3.QueryTypes.SELECT
    });

    const rows = results;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).send('No data found');
    }

    // Bangun isi CSV
    let csvContent = '';

    // Header
    const headers = Object.keys(rows[0]).map(header => `"${header.replace(/"/g, '""')}"`).join('|');
    csvContent += headers + '\n';

    // Baris data
    // rows.forEach(row => {
    //   const line = Object.values(row).map(val => {
    //     if (val === null || val === undefined) return '';
    //     const str = String(val).replace(/"/g, '""');
    //     return str.includes('|') || str.includes('\n') ? `"${str}"` : str;
    //   }).join('|');
    //   csvContent += line + '\n';
    // });
    const delimiter = '|';

    // Baris data: semua nilai di-enclose juga
    for (const row of rows) {
      const line = Object.values(row).map(val => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""'); // escape double quotes
        return `"${str}"`; // always enclose with quotes
      }).join(delimiter);
      csvContent += line + '\n';
    }

    // Kirim file CSV sebagai download
      const bom = '\uFEFF'; // Excel-compatible BOM
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="data_peserta_didik.csv"');
    // return res.status(200).send(csvContent);
     return res.status(200).send(bom + csvContent);

  } catch (error) {
    console.error('Export Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal generate CSV',
      error: error.message
    });
  }
};

