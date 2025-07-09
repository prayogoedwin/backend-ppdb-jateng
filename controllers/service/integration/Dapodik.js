import axios from 'axios';
import db3 from '../../../config/Database3.js';
import EzAppKey from '../../../models/config/AppKeyModel.js';
import { redisGet, redisSet } from '../../../redis.js'; // Import the Redis functions

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

export const KirimSatuanResponsJson = async (req, res) => {
  const { no_pendaftaran } = req.body; // Ambil no_pendaftaran dari request body
  // atau bisa juga dari query params: const { no_pendaftaran } = req.query;
  
  if (!no_pendaftaran) {
    return res.status(400).json({
      status: 0,
      message: 'Parameter no_pendaftaran diperlukan'
    });
  }

  const redis_key = 'dapodik';

    // 1. Ambil token dari Redis terlebih dahulu
    const tokenData = await redisGet(redis_key);
    const token_bearer = tokenData;

    const url = `${API_URL}/v1/api-gateway/pd/tambahDataHasilPPDB`;
    // const token_bearer = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Im1hc3RoZW5vbEBnbWFpbC5jb20iLCJpbnN0YW5zaVBlbmdndW5hSWQiOiJBODVFNDZBQS03MDE5LTQ3RjYtQUJFOS1CNjIwRjkyMDk0M0QiLCJpcEFkZHJlc3MiOiIxMDMuMTA3LjI0NS4yNDQiLCJpYXQiOjE3NTIwNTc2MTYsImV4cCI6MTc1MjE0NDAxNiwiaXNzIjoia2VtZGlrYnVkLmdvLmlkIiwic3ViIjoicHVzZGF0aW5Aa2VtZGlrYnVkLmdvLmlkIn0.LlTFwdNjBeMwh6zM5o5zNYXsA0oBOQWcXWDloXgnnC6pd5lNxKO9TMvRAj7dmCyr1MFuhLCn7C9xR6h3Gt630w';

    if (!token_bearer) {
      return res.status(401).json({
        status: 0,
        message: 'Token tidak tersedia, silakan autentikasi terlebih dahulu'
      });
    }

  
  try {
    // Eksekusi query langsung menggunakan Sequelize dengan parameter
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

    // Kirim data ke API
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
      nik_ibu: row.nik_ibu.substring(0, 16),
      nama_ibu_kandung: row.nama_ibu_kandung,
      nama_ayah: row.nama_ayah,
      nik_ayah: row.nik_ayah.substring(0, 16),
      nama_wali: "",
      nik_wali: "",
      alamat_jalan: row.alamat_jalan,
      rt: row.rt,
      rw: row.rw,
      nama_dusun: "-",
      desa_kelurahan: "-",
      kode_wilayah_siswa: row.kode_wilayah_siswa,
      lintang: row.lintang.toString(),
      bujur: row.bujur.toString(),
      kebutuhan_khusus_id: row.kebutuhan_khusus_id.toString(),
      agama_id: "1",
      no_kk: "",
      sekolah_id_tujuan: row.sekolah_id_tujuan,
      npsn_sekolah_tujuan: row.npsn_sekolah_tujuan,
      nama_sekolah_tujuan: row.nama_sekolah_tujuan
    };

    console.log('Mengirim payload:', JSON.stringify(payload, null, 2));
    console.log('Menggunakan token:', token_bearer);

    const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${token_bearer}`,
          'Content-Type': 'application/json'
        }
      });

      // Jika response status code 200 dan ada uploadIntegrasiId
      if (response.status === 200 && response.data.uploadIntegrasiId) {
        // Update data di database
        await db3.query(
          `UPDATE ez_perangkingan 
           SET integrasi_id = :integrasi_id, 
               integrated_at = NOW() 
           WHERE no_pendaftaran = :no_pendaftaran`,
          {
            replacements: {
              integrasi_id: response.data.uploadIntegrasiId,

            }
          }
        );
      }

      console.log(response);

      return res.status(200).json({
        status: 1,
        message: 'Data berhasil dikirim',
        data: {
          no_pendaftaran,
          response: response.data,
        }
      });


  } catch (error) {
    return res.status(500).json({
      status: 0,
      message: 'Terjadi kesalahan server',
      error: error.message,
      data: {
          no_pendaftaran
        }
    });
  }
};
