import express from "express";
import cors from "cors";

//middleware
import ipWhitelistMiddleware from '../middleware/IpWhitelist.js';
import appKeyMiddleware from '../middleware/AppKey.js';

//konfigurasi cache
import { clearCacheByKey, clearAllCache, getAllCacheKeys, getAllCacheKeysAndValues } from '../controllers/config/CacheControl.js';

// Master Data
import { getStatusDomisili } from "../controllers/master/StatusDomisili.js";
import { getSekolahAsal } from "../controllers/master/SekolahAsal.js";
import { getJenisLulusan } from "../controllers/master/JenisLulusan.js";
import { getProvinsi, getKabkota, getKecamatan, getKelurahan } from '../controllers/master/WilayahVerDapodik.js';

//Service
import { getPesertaDidikByNisnHandler } from '../controllers/service/PesertaDidik.js';

const router = express.Router();
router.use(cors());


//konfigurasi cache
router.delete('/internal/clear_cache/:key', clearCacheByKey); // Clear specific cache key
router.delete('/internal/clear_all_cache', clearAllCache); // Clear all cache
router.get('/internal/cache/keys', getAllCacheKeys); // Get all cache keys
router.get('/internal/cache/key_values', getAllCacheKeysAndValues); 

// Master Data
router.get('/api/master/status_domisili', getStatusDomisili);
router.get('/api/master/sekolah_asal', getSekolahAsal);
router.get('/api/master/jenis_lulusan', getJenisLulusan);
router.get('/api/master/provinsi', getProvinsi);
router.post('/api/master/kabkota', getKabkota);
router.post('/api/master/kecamatan', getKecamatan); 
router.post('/api/master/kelurahan', getKelurahan); 

//service
router.post('/api/servis/calon_peserta_didik', ipWhitelistMiddleware, appKeyMiddleware, getPesertaDidikByNisnHandler);
// router.post('/api/servis/calon_peserta_didik', ipWhitelistMiddleware, getPesertaDidikByNisnHandler);

export default router;