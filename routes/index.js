import express from "express";
import cors from "cors";

import { clearCacheByKey, clearAllCache, getAllCacheKeys, getAllCacheKeysAndValues } from '../controllers/config/CacheControl.js';

import {getStatusDomisili} from "../controllers/master/StatusDomisili.js";
import {getSekolahAsal} from "../controllers/master/SekolahAsal.js";
import {getJenisLulusan} from "../controllers/master/JenisLulusan.js";

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


export default router;