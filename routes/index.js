import express from "express";
import cors from "cors";
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
router.use(cors());

//middleware
import ipWhitelistMiddleware from '../middleware/IpWhitelist.js';
import appKeyMiddleware from '../middleware/AppKey.js';

//konfigurasi cache
import { clearCacheByKey, clearAllCache, getAllCacheKeys, getAllCacheKeysAndValues } from '../controllers/config/CacheControl.js';

// Master Data
import { getStatusDomisili } from "../controllers/master/StatusDomisili.js";
import { getSekolahAsal } from "../controllers/master/SekolahAsal.js";
import { getJenisLulusan } from "../controllers/master/JenisLulusan.js";
import { getJenisKejuaraan } from "../controllers/master/JenisKejuaraan.js";

import { getProvinsi, getKabkota, getKecamatan, getKelurahan } from '../controllers/master/WilayahVerDapodik.js';

//Service
import { getPesertaDidikByNisnHandler, getDataDukungByNIK } from '../controllers/service/PesertaDidik.js';
import { createPendaftar, getPendaftarforCetak, aktivasiAkunPendaftar } from '../controllers/service/Pendaftar.js';


//Admin
//Auth
import { generateSuperAdmin, loginAdmin, logoutAdmin } from '../controllers/service/admin/Auth.js';

//verifikasi pendaftar
import { getDataPendaftarForVerif, getDataPendaftarById, verifikasiPendaftar } from "../controllers/service/admin/VerifPendaftar.js";




//konfigurasi cache
router.delete('/uapi/internal/clear_cache/:key', clearCacheByKey); // Clear specific cache key
router.delete('/uapi/internal/clear_all_cache', clearAllCache); // Clear all cache
router.get('/uapi/internal/cache/keys', getAllCacheKeys); // Get all cache keys
router.get('/uapi/internal/cache/key_values', getAllCacheKeysAndValues); 

// Master Data
router.get('/api/master/status_domisili', getStatusDomisili);
router.get('/api/master/sekolah_asal', getSekolahAsal);
router.get('/api/master/jenis_lulusan', getJenisLulusan);
router.get('/api/master/jenis_kejuaraan', getJenisKejuaraan);

router.get('/api/master/provinsi', getProvinsi);
router.post('/api/master/kabkota', getKabkota);
router.post('/api/master/kecamatan', getKecamatan); 
router.post('/api/master/kelurahan', getKelurahan); 

//========================================================================//
//API Pendaftaran

//service
router.post('/api/servis/calon_peserta_didik', ipWhitelistMiddleware, appKeyMiddleware, getPesertaDidikByNisnHandler);
router.post('/api/servis/daftar_akun', ipWhitelistMiddleware, appKeyMiddleware, createPendaftar);
router.post('/api/servis/cetak_pendaftaran', getPendaftarforCetak);
router.post('/api/servis/aktivasi_akun', ipWhitelistMiddleware, appKeyMiddleware, aktivasiAkunPendaftar);
router.post('/api/servis/data_dukung', ipWhitelistMiddleware, appKeyMiddleware, getDataDukungByNIK);


//========================================================================//
//API Calon Siswa After Login






//========================================================================//
//API Khusus Admin

//Auth
router.get('/admin-api/jkt48/freya', ipWhitelistMiddleware, appKeyMiddleware, generateSuperAdmin);
router.post('/admin-api/auth/signin', ipWhitelistMiddleware, appKeyMiddleware, loginAdmin);
router.post('/admin-api/auth/signout', ipWhitelistMiddleware, appKeyMiddleware, logoutAdmin);

//menu menu & action admin
router.get('/admin-api/data/pendaftaran', ipWhitelistMiddleware, appKeyMiddleware, getDataPendaftarForVerif);
router.get('/admin-api/data/pendaftar_detail', ipWhitelistMiddleware, appKeyMiddleware, getDataPendaftarById);
router.post('/admin-api/data/pendaftar_verifikasi', ipWhitelistMiddleware, appKeyMiddleware, verifikasiPendaftar);



export default router;