import express from "express";
import cors from "cors";

import {getStatusDomisili} from "../controllers/master/StatusDomisili.js";
import {getSekolahAsal} from "../controllers/master/SekolahAsal.js";
import {getJenisLulusan} from "../controllers/master/JenisLulusan.js";

const router = express.Router();
router.use(cors());

// Master Data
router.get('/api/master/status_domisili', getStatusDomisili);
router.get('/api/master/sekolah_asal', getSekolahAsal);
router.get('/api/master/jenis_lulusan', getJenisLulusan);


export default router;