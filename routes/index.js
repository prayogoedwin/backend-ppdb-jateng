import express from "express";
import cors from "cors";
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
router.use(cors());

//middleware
import ipWhitelistMiddleware from '../middleware/IpWhitelist.js';
import appKeyMiddleware from '../middleware/AppKey.js';
import { authenticateTokenPublic, authenticateRefreshTokenPublic } from '../middleware/AuthPublic.js';
import { authenticateToken, authenticateRefreshToken } from '../middleware/Auth.js';
import logAccessMiddleware from '../middleware/logAccessMiddleware.js'; // Import log middleware



//konfigurasi cache
import { clearCacheByKey, clearAllCache, getAllCacheKeys, getAllCacheKeysAndValues } from '../controllers/config/CacheControl.js';


//download
import { downloadFile, viewFile } from '../middleware/Donlod.js'; 

// Master Data
import { getStatusDomisili } from "../controllers/master/StatusDomisili.js";
import { getSekolahAsal } from "../controllers/master/SekolahAsal.js";
import { getJenisLulusan } from "../controllers/master/JenisLulusan.js";
import { getJalurPendaftaran } from "../controllers/master/JalurPendaftaran.js";
import { getSekolahTujuan } from "../controllers/master/SekolahTujuan.js";
import { getJenisKejuaraan } from "../controllers/master/JenisKejuaraan.js";
import { getProvinsi, getKabkota, getKecamatan, getKelurahan } from '../controllers/master/WilayahVerDapodik.js';

//kebutuhan beranda
import { getTimelinePublic } from "../controllers/service/TimelinePublic.js";

//Service
import { getPesertaDidikByNisnHandler, getDataDukungByNIK } from '../controllers/service/PesertaDidik.js';
import { createPendaftar, getPendaftarforCetak, aktivasiAkunPendaftar, getPendaftarDetail } from '../controllers/service/Pendaftar.js';
import { cekPerangkingan, createPerangkingan, getPerangkingan, uploadFileTambahan, cetakBuktiPerangkingan, getPerangkinganSaya, softDeletePerangkingan, daftarUlangPerangkingan, getPerangkinganDetail } from '../controllers/service/Perangkingan.js';

//akun siswa
import { loginUser, logoutUser, resetPassword, forgotPassword, verifikasiOtpUser } from '../controllers/service/AuthPublic.js';


//Admin
//Auth
import { generateSuperAdmin, loginAdmin, logoutAdmin, verifikasiOtp } from '../controllers/service/admin/Auth.js';

//verifikasi pendaftar
import { getDataPendaftarForVerif, getDataPendaftarById, verifikasiPendaftar, updatePendaftar } from "../controllers/service/admin/VerifPendaftar.js";

//timenline
import { getTimeline, getTimelineById, updateTimeline } from "../controllers/service/admin/Timeline.js";

//sekolah tujuan
import { getSekolahTujuanAdmin, getSekolahTujuanAdminById, updateSekolahTujuanAdmin } from "../controllers/service/admin/SekolahTujuan.js";

//users
import { getUsers, getUserById, addUser, updateUser, softDeleteUser, resetPasswordById } from "../controllers/service/admin/Users.js";

//roles
import { getRoles } from "../controllers/service/admin/Role.js";

//rekap
import { countPendaftar } from "../controllers/service/admin/RekapAdmin.js";

// // Terapkan logAccessMiddleware ke semua route
// router.use(logAccessMiddleware);

// refresh token
router.post('/api/auth/refresh_token', authenticateRefreshTokenPublic);
router.post('/admin-api/auth/refresh_token', authenticateRefreshToken);

//downloadfile
router.get('/download/:nisn/:filename', viewFile);
// router.get('/geojson', viewGeoJson);
// router.get('/geojson_redis', viewGeoJsonRedis);



//konfigurasi cache
router.delete('/uapi/internal/clear_cache/:key', clearCacheByKey); // Clear specific cache key
router.delete('/uapi/internal/clear_all_cache', clearAllCache); // Clear all cache
router.get('/uapi/internal/cache/keys', getAllCacheKeys); // Get all cache keys
router.get('/uapi/internal/cache/key_values', getAllCacheKeysAndValues); 

// Master Data
router.get('/api/master/status_domisili', getStatusDomisili);
router.get('/api/master/sekolah_asal', getSekolahAsal);
router.get('/api/master/jenis_lulusan', getJenisLulusan);

router.post('/api/master/sekolah_tujuan', getSekolahTujuan);


router.get('/api/master/jenis_kejuaraan', getJenisKejuaraan);
router.post('/api/master/jalur_pendaftaran', getJalurPendaftaran);

router.get('/api/master/provinsi', getProvinsi);
router.post('/api/master/kabkota', getKabkota);
router.post('/api/master/kecamatan', getKecamatan); 
router.post('/api/master/kelurahan', getKelurahan); 


//kebutuhan beranda
router.get('/api/beranda/timeline', getTimelinePublic);





//========================================================================//
//API Pendaftaran

//service
router.post('/api/servis/calon_peserta_didik', ipWhitelistMiddleware, appKeyMiddleware, getPesertaDidikByNisnHandler);
router.post('/api/servis/daftar_akun', ipWhitelistMiddleware, appKeyMiddleware, createPendaftar);
router.post('/api/servis/cetak_pendaftaran', getPendaftarforCetak);
router.post('/api/servis/aktivasi_akun', ipWhitelistMiddleware, appKeyMiddleware, aktivasiAkunPendaftar);
router.post('/api/servis/data_dukung', ipWhitelistMiddleware, appKeyMiddleware, getDataDukungByNIK);
router.post('/api/servis/detail_pendaftar', ipWhitelistMiddleware, appKeyMiddleware, getPendaftarDetail);




//========================================================================//
//API Calon Siswa After Aktivasi (Dashboard Calon Siswa)
router.post('/api/auth/login', ipWhitelistMiddleware, appKeyMiddleware, loginUser);
router.post('/api/auth/verifikasi_otp', ipWhitelistMiddleware, appKeyMiddleware, verifikasiOtpUser);
router.post('/api/auth/logout', ipWhitelistMiddleware, appKeyMiddleware, logoutUser);
router.post('/api/auth/ubah_password', ipWhitelistMiddleware, appKeyMiddleware, resetPassword);
router.post('/api/auth/lupa_password', ipWhitelistMiddleware, appKeyMiddleware, forgotPassword);



router.post('/api/servis/cek_daftar_sekolah', ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, cekPerangkingan, logAccessMiddleware);
router.post('/api/servis/daftar_sekolah', ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, createPerangkingan);
router.post('/api/servis/cetak_bukti_daftar', ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, cetakBuktiPerangkingan);


// router.post('/api/servis/upload_file_tambahan/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, uploadFileTambahan);
router.post('/api/servis/upload_file_tambahan/:id_jalur_pendaftaran/:id_pendaftar/:nisn', ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, uploadFileTambahan);


router.post('/api/servis/perangkingan', ipWhitelistMiddleware, appKeyMiddleware, getPerangkingan);

router.post('/api/servis/perangkingan_saya', ipWhitelistMiddleware, appKeyMiddleware, getPerangkinganSaya);

router.post('/api/servis/perangkingan_detail', ipWhitelistMiddleware, appKeyMiddleware, getPerangkinganDetail);

router.post('/api/servis/perangkingan_hapus', ipWhitelistMiddleware, appKeyMiddleware, softDeletePerangkingan);

router.post('/api/servis/daftar_ulang', ipWhitelistMiddleware, appKeyMiddleware, daftarUlangPerangkingan);








//========================================================================//
//API Khusus Admin

//Auth
router.get('/admin-api/jkt48/freya', ipWhitelistMiddleware, appKeyMiddleware, generateSuperAdmin);
router.post('/admin-api/auth/signin', ipWhitelistMiddleware, appKeyMiddleware, loginAdmin);
router.post('/admin-api/auth/verifikasi_otp', ipWhitelistMiddleware, appKeyMiddleware, verifikasiOtp);
router.post('/admin-api/auth/signout', ipWhitelistMiddleware, appKeyMiddleware, logoutAdmin);



//master data admin
router.post('/admin-api/master/sekolah_tujuan', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getSekolahTujuanAdmin);
router.get('/admin-api/master/sekolah_tujuan_detail/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getSekolahTujuanAdminById);
router.post('/admin-api/master/sekolah_tujuan_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, updateSekolahTujuanAdmin);




//menu menu & action admin

// menu pendaftaran
router.get('/admin-api/data/pendaftaran', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarForVerif);
router.get('/admin-api/data/pendaftar_detail/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarById);
router.post('/admin-api/data/pendaftar_verifikasi', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, verifikasiPendaftar);
router.post('/admin-api/data/pendaftar_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, updatePendaftar);

//menu timeline
router.get('/admin-api/setting/timeline', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getTimeline);
router.get('/admin-api/setting/timeline_detail/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getTimelineById);
router.post('/admin-api/setting/timeline_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, updateTimeline);

//menu user
router.get('/admin-api/setting/users', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getUsers);
router.get('/admin-api/setting/user_detail/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getUserById);
router.post('/admin-api/setting/user_tambah', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, addUser);
router.post('/admin-api/setting/user_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, updateUser);
router.post('/admin-api/setting/user_delete/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, softDeleteUser);
router.get('/admin-api/setting/user_reset_password/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, resetPasswordById);

//rekap
router.get('/admin-api/rekap/pendaftar/:sekolah_id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, countPendaftar);

//role
router.get('/admin-api/master/roles', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getRoles);







export default router;