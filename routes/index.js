import express from "express";
import cors from "cors";
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
router.use(cors());

//middleware
import ipWhitelistMiddleware from '../middleware/IpWhitelist.js';
import { appKeyMiddleware, appKeynyaIntegrator} from '../middleware/AppKey.js';
import { authenticateTokenPublic, authenticateRefreshTokenPublic } from '../middleware/AuthPublic.js';
import { authenticateToken, authenticateRefreshToken } from '../middleware/Auth.js';
import { authenticateTokenClient, authenticateRefreshTokenClient } from '../middleware/AuthClient.js';
import { logAccess, logAccessAdmin, logAccessClient, logAccessPub } from '../middleware/LogAccessMiddleware.js'; // Import log middleware


//konfigurasi cache
import { clearCacheByKey, clearAllCache, getAllCacheKeys, getAllCacheKeysAndValues } from '../controllers/config/CacheControl.js';


//download
import { downloadFile, viewFile } from '../middleware/Donlod.js'; 

// Log Data
import { LogSiswaLoggedIn, LogAdminLoggedIn } from "../controllers/log/LogLog.js";

// Master Data
import { getStatusDomisili } from "../controllers/master/StatusDomisili.js";
import { getSekolahAsal } from "../controllers/master/SekolahAsal.js";
import { getJenisLulusan } from "../controllers/master/JenisLulusan.js";
import { getJalurPendaftaran } from "../controllers/master/JalurPendaftaran.js";
import { getSekolahTujuan, getSekolahTujuanPublik, getSekolahTujuanJurusanPublik } from "../controllers/master/SekolahTujuan.js";
import { getJenisKejuaraan } from "../controllers/master/JenisKejuaraan.js";
import { getProvinsi, getKabkota, getKecamatan, getKelurahan } from '../controllers/master/WilayahVerDapodik.js';

//kebutuhan beranda
import { getTimelinePublic } from "../controllers/service/TimelinePublic.js";

//Service
import { getPesertaDidikByNisnHandler, getDataDukungByNIK, getPesertaDidikByNisnNamaNamaNamaIbuHandler } from '../controllers/service/PesertaDidik.js';
import { createPendaftar, getPendaftarforCetak, aktivasiAkunPendaftar, getPendaftarDetail, getBatasWlayah, createPendaftarTanpaFile, uploadPendaftarFiles } from '../controllers/service/Pendaftar.js';
import { cekPerangkingan, createPerangkingan, getPerangkingan, uploadFileTambahan, cetakBuktiPerangkingan, getPerangkinganSaya, softDeletePerangkingan, daftarUlangPerangkingan, getPerangkinganDetail, getInfoParam } from '../controllers/service/Perangkingan.js';

//akun siswa
import { loginUser, logoutUser, resetPassword, forgotPassword, verifikasiOtpUser } from '../controllers/service/AuthPublic.js';

//akun client api
import { loginClient, logoutClient } from '../controllers/service/integration/Auth.js';


//Admin
//Auth
import { generateSuperAdmin, loginAdmin, logoutAdmin, verifikasiOtp } from '../controllers/service/admin/Auth.js';

//verifikasi pendaftar
import { getDataPendaftarForVerif, 
    getDataPendaftarForVerifPagination, 
    getDataPendaftarById, 
    getDataPendaftarByIdKhususAfterVerif,
    verifikasiPendaftar, 
    verifikasiPendaftarTidakJadi, 
    updatePendaftar,
    updatePendaftarCapil,
    updateDokumen,
    updatePassworPendaftar,
    updatePendaftarByUser,


    getDataPendaftarByWhere,
    getDataPendaftarByWhereNisn,
    getDataPendaftarCount
} from "../controllers/service/admin/VerifPendaftar.js";

//timenline
import { getTimeline, getTimelineById, updateTimeline } from "../controllers/service/admin/Timeline.js";

//sekolah tujuan
import { getSekolahTujuanAdmin, getSekolahTujuanAdminById, updateSekolahTujuanAdmin, getSekolahTujuanJurusanAdmin, getSekolahTujuanJurusanAdminById, updateSekolahTujuanJurusanAdmin, updateSekolahTujuanProfil } from "../controllers/service/admin/SekolahTujuan.js";

//users
import { getUsers, getUsersPagination, getUserById, addUser, updateUser, softDeleteUser, resetPasswordById, resetLoggedInById, bulkUpdateIsLoginUsers, updateUserPassword } from "../controllers/service/admin/Users.js";

//roles
import { getRoles } from "../controllers/service/admin/Role.js";

//roles
import { getSertifikats, insertSertifikat } from "../controllers/service/integration/Sertifikat.js";


//rekap
import { countPendaftar, countCheckedPesertaDidiks, listCheckedPesertaDidiks } from "../controllers/service/admin/RekapAdmin.js";

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
router.delete('/api/internal/clear_cache/:key', clearCacheByKey); // Clear specific cache key
router.delete('/api/internal/clear_all_cache', clearAllCache); // Clear all cache
router.get('/api/internal/cache/keys', getAllCacheKeys); // Get all cache keys
router.get('/api/internal/cache/key_values', getAllCacheKeysAndValues); 

// Master Data
router.get('/api/master/status_domisili', getStatusDomisili);
router.get('/api/master/sekolah_asal', getSekolahAsal);
router.get('/api/master/jenis_lulusan', getJenisLulusan);

router.post('/api/master/sekolah_tujuan', getSekolahTujuan);

router.post('/api/master/sekolah_tujuan_publik', getSekolahTujuanPublik);
router.post('/api/master/sekolah_tujuan_per_jurusan_publik', getSekolahTujuanJurusanPublik);


router.get('/api/master/jenis_kejuaraan', getJenisKejuaraan);
router.post('/api/master/jalur_pendaftaran', getJalurPendaftaran);

router.get('/api/master/provinsi', getProvinsi);
router.post('/api/master/kabkota', getKabkota);
router.post('/api/master/kecamatan', getKecamatan); 
router.post('/api/master/kelurahan', getKelurahan); 


//kebutuhan beranda
router.get('/api/beranda/timeline', getTimelinePublic);


//API CEK CEK SAJA
router.post('/api/servis/cek_data_calon_peserta_didik', ipWhitelistMiddleware, appKeyMiddleware, logAccessPub, getPesertaDidikByNisnNamaNamaNamaIbuHandler);



//========================================================================//
//API Pendaftaran

//service
router.post('/api/servis/calon_peserta_didik', ipWhitelistMiddleware, appKeyMiddleware, logAccessPub, getPesertaDidikByNisnHandler);
router.post('/api/servis/daftar_akun', ipWhitelistMiddleware, appKeyMiddleware, logAccess, createPendaftar);

router.post("/api/servis/daftar_akun_spmb", ipWhitelistMiddleware, appKeyMiddleware, logAccess, createPendaftarTanpaFile);
router.post("/api/servis/upload_data_dukung", ipWhitelistMiddleware, appKeyMiddleware, logAccess, uploadPendaftarFiles);

router.post('/api/servis/dokumen_update', ipWhitelistMiddleware, appKeyMiddleware, logAccess, updateDokumen);

router.post('/api/servis/revisi_data', ipWhitelistMiddleware, appKeyMiddleware, logAccess, updatePendaftarByUser);
// router.post('/api/servis/revisi_dokumen', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccess, updateDokumen);


//cari wilayah
router.post('/api/servis/cari_batas_wilayah', ipWhitelistMiddleware, appKeyMiddleware, getBatasWlayah);


router.post('/api/servis/cetak_pendaftaran', getPendaftarforCetak);
router.post('/api/servis/aktivasi_akun', ipWhitelistMiddleware, appKeyMiddleware, logAccess, aktivasiAkunPendaftar);
router.post('/api/servis/data_dukung', ipWhitelistMiddleware, appKeyMiddleware, getDataDukungByNIK);
router.post('/api/servis/detail_pendaftar', ipWhitelistMiddleware, appKeyMiddleware, getPendaftarDetail);




//========================================================================//
//API Calon Siswa After Aktivasi (Dashboard Calon Siswa)
router.post('/api/auth/login', ipWhitelistMiddleware, appKeyMiddleware, logAccess, loginUser);
router.post('/api/auth/verifikasi_otp', ipWhitelistMiddleware, appKeyMiddleware, logAccess, verifikasiOtpUser);
router.post('/api/auth/logout', ipWhitelistMiddleware, appKeyMiddleware, logAccess, logoutUser);
router.post('/api/auth/ubah_password', ipWhitelistMiddleware, appKeyMiddleware, resetPassword);
router.post('/api/auth/lupa_password', ipWhitelistMiddleware, appKeyMiddleware, forgotPassword);



router.post('/api/servis/cek_daftar_sekolah', ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, logAccess,  cekPerangkingan);
router.post('/api/servis/daftar_sekolah', ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, logAccess, createPerangkingan);
router.post('/api/servis/cetak_bukti_daftar', ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, logAccess, cetakBuktiPerangkingan);


// router.post('/api/servis/upload_file_tambahan/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, uploadFileTambahan);
router.post('/api/servis/upload_file_tambahan/:id_jalur_pendaftaran/:id_pendaftar/:nisn', ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, logAccess, uploadFileTambahan);


router.post('/api/servis/perangkingan', ipWhitelistMiddleware, appKeyMiddleware, getPerangkingan);

router.post('/api/servis/perangkingan_info_param', ipWhitelistMiddleware, appKeyMiddleware, getInfoParam);



router.post('/api/servis/perangkingan_saya', ipWhitelistMiddleware, appKeyMiddleware, getPerangkinganSaya);

router.post('/api/servis/perangkingan_detail', ipWhitelistMiddleware, appKeyMiddleware, getPerangkinganDetail);

router.post('/api/servis/perangkingan_hapus', ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, logAccess, softDeletePerangkingan);

// router.post('/api/servis/daftar_ulang', ipWhitelistMiddleware, appKeyMiddleware, daftarUlangPerangkingan);








//========================================================================//
//API Khusus Admin

//cek log siswa
router.post('/admin-api/log/cpd', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, LogSiswaLoggedIn); 
// log admin dan operator
router.post('/admin-api/log/admin-operator', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, LogAdminLoggedIn); 

//Auth
router.get('/admin-api/jkt48/freya', ipWhitelistMiddleware, appKeyMiddleware, generateSuperAdmin);
router.post('/admin-api/auth/signin', ipWhitelistMiddleware, appKeyMiddleware, logAccessAdmin, loginAdmin);
router.post('/admin-api/auth/verifikasi_otp', ipWhitelistMiddleware, appKeyMiddleware, logAccessAdmin, verifikasiOtp);
router.post('/admin-api/auth/signout', ipWhitelistMiddleware, appKeyMiddleware, logAccessAdmin, logoutAdmin);



//master data admin
router.post('/admin-api/master/sekolah_tujuan', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getSekolahTujuanAdmin);
router.get('/admin-api/master/sekolah_tujuan_detail/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,getSekolahTujuanAdminById);
router.post('/admin-api/master/sekolah_tujuan_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updateSekolahTujuanAdmin);
router.post('/admin-api/master/sekolah_profil_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updateSekolahTujuanProfil);



router.post('/admin-api/master/sekolah_tujuan_jurusan', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getSekolahTujuanJurusanAdmin);
router.get('/admin-api/master/sekolah_tujuan_jurusan_detail/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getSekolahTujuanJurusanAdminById);
router.post('/admin-api/master/sekolah_tujuan_jurusan_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updateSekolahTujuanJurusanAdmin);


//menu menu & action admin

// menu pendaftaran
router.get('/admin-api/data/pendaftaran', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarForVerif);
router.get('/admin-api/data/pendaftaran_data', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarByWhere);
router.get('/admin-api/data/pendaftaran_data_nisn', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarByWhereNisn);

// router.get('/admin-api/data/pendaftaran_data', getDataPendaftarByWhere);
router.get('/admin-api/data/pendaftaran_count', getDataPendaftarCount);

router.get('/admin-api/data/pendaftaran', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarForVerifPagination);
router.get('/admin-api/data/pendaftar_detail/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarById);
router.get('/admin-api/data/pendaftar_reset_password/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updatePassworPendaftar);


router.get('/admin-api/data/pendaftar_detail_after_verif/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarByIdKhususAfterVerif);

router.post('/admin-api/data/pendaftar_verifikasi', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, verifikasiPendaftar);
router.post('/admin-api/data/tolak_ajuan_akun', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, verifikasiPendaftar);
router.post('/admin-api/data/batalkan_verifikasi', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, verifikasiPendaftar);
router.post('/admin-api/data/pendaftar_verifikasi_no_action', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, verifikasiPendaftarTidakJadi);
router.post('/admin-api/data/pendaftar_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updatePendaftar);
router.post('/admin-api/data/capil_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updatePendaftarCapil);

router.post('/admin-api/data/dokumen_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updateDokumen);
router.post('/api/servis/dokumen_update', ipWhitelistMiddleware, appKeyMiddleware, logAccessAdmin, updateDokumen);



//menu timeline
router.get('/admin-api/setting/timeline', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getTimeline);
router.get('/admin-api/setting/timeline_detail/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getTimelineById);
router.post('/admin-api/setting/timeline_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updateTimeline);

//menu user
// router.get('/admin-api/setting/users', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,logAccessAdmin, getUsers);
router.get('/admin-api/setting/users', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getUsersPagination);
router.get('/admin-api/setting/user_detail/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getUserById);
router.post('/admin-api/setting/user_tambah', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, addUser);
router.post('/admin-api/setting/user_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updateUser);
router.post('/admin-api/setting/user_update_password', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updateUserPassword);
router.get('/admin-api/setting/reset_is_login_masal', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, bulkUpdateIsLoginUsers);
router.post('/admin-api/setting/user_delete/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, softDeleteUser);
router.get('/admin-api/setting/user_reset_password/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, resetPasswordById);
router.get('/admin-api/setting/user_reset_status_login/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, resetLoggedInById);





//rekap
// router.get('/admin-api/rekap/pendaftar/:sekolah_id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, countPendaftar);
router.get('/admin-api/rekap/pendaftar/:sekolah_id/:start_date/:end_date', ipWhitelistMiddleware, appKeyMiddleware, countPendaftar);
router.get('/admin-api/rekap/pendaftar_dashboard/:sekolah_id', ipWhitelistMiddleware, appKeyMiddleware, countPendaftar);

router.get('/admin-api/rekap/cek_nisn', ipWhitelistMiddleware, appKeyMiddleware, countCheckedPesertaDidiks);

router.get('/admin-api/rekap/cek_nisn_list', ipWhitelistMiddleware, appKeyMiddleware, listCheckedPesertaDidiks);




//role
router.get('/admin-api/master/roles', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getRoles);



//daftar ulang & perangkingan
router.post('/admin-api/servis/daftar_ulang', ipWhitelistMiddleware, appKeyMiddleware,  authenticateToken, logAccessAdmin, daftarUlangPerangkingan);


// ============================ API UNTUK EXTERNAL ==============================//

//Auth
router.post('/client-api/auth/signin', ipWhitelistMiddleware, appKeynyaIntegrator, logAccessClient, loginClient);
router.post('/client-api/auth/signout', ipWhitelistMiddleware, appKeynyaIntegrator, logAccessClient, logoutClient);


//sertfikat
router.get('/client-api/external/jenis_kejuaraan', logAccessClient, getJenisKejuaraan);
router.get('/client-api/external/sertifikat', ipWhitelistMiddleware, appKeynyaIntegrator, authenticateTokenClient, getSertifikats);
router.post('/client-api/external/insert_sertifikat', ipWhitelistMiddleware, appKeynyaIntegrator, authenticateTokenClient, logAccessClient, insertSertifikat);




// Define the version as a constant
const VERSION = '1.20.7';
const APPNAME = 'Backend PPDB';

// // Create a GET route at '/' that sends the version as a JSON response
// router.get('/version', (req, res) => {
//     res.json({
//          app_name: APPNAME,
//          app_version: VERSION 
//         });
// });

// Buat rute GET di '/version' yang mengirimkan HTML sebagai respons
router.get('/api/version', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Version Info</title>
        </head>
        <body>
            <h1>Application Version</h1>
            <p><strong>App Name:</strong> ${APPNAME}</p>
            <p><strong>App Version:</strong> ${VERSION}</p>
        </body>
        </html>
    `);
});






export default router;