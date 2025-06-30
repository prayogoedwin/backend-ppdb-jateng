import express from "express";
import cors from "cors";
import dotenv from 'dotenv';
import db from '../config/Database.js';

dotenv.config();
const router = express.Router();
// router.use(cors());

//middleware
import ipWhitelistMiddleware from '../middleware/IpWhitelist.js';
import domainWhitelistMiddleware from '../middleware/IpWhitelist.js';
import simpleAuthMiddleware from '../middleware/simpleAuthMiddleware.js';


// import domainWhitelistMiddleware from '../middleware/domainWhitelist.js';
import { appKeyMiddleware, appKeynyaIntegrator} from '../middleware/AppKey.js';
import { authenticateTokenPublic, authenticateRefreshTokenPublic } from '../middleware/AuthPublic.js';
import { authenticateToken, authenticateRefreshToken } from '../middleware/Auth.js';
import { authenticateTokenClient, authenticateRefreshTokenClient } from '../middleware/AuthClient.js';
import { logAccess, logAccessAdmin, logAccessClient, logAccessPub } from '../middleware/LogAccessMiddleware.js'; // Import log middleware
import csrfProtection from '../middleware/csrfProtection.js';
import { validatePendaftar, validateResult } from '../middleware/validasiPendaftar.js';
import { verifyRecaptcha } from '../middleware/googleRecaptcha.js';
import { verifyCloudflareCaptcha } from '../middleware/cloudflareCaptcha.js';



//konfigurasi cache
import { clearCacheByKey, clearAllCache, getAllCacheKeys, getAllCacheKeysAndValues, clearCacheByPrefix } from '../controllers/config/CacheControl.js';


//download
import { downloadFile, viewFile, viewFileBase64 } from '../middleware/Donlod.js'; 

// Log Data
import { LogSiswaLoggedIn, LogAdminLoggedIn } from "../controllers/log/LogLog.js";

// Master Data
import { getStatusDomisili, getStatusDomisiliLuarProv } from "../controllers/master/StatusDomisili.js";
import { getSekolahAsal } from "../controllers/master/SekolahAsal.js";
import { getJenisLulusan } from "../controllers/master/JenisLulusan.js";
import { getJalurPendaftaran } from "../controllers/master/JalurPendaftaran.js";
import { getSekolahTujuan, getSekolahTujuanPublik, getSekolahTujuanJurusanPublik, getSekolahTujuanKabkota,
    dayaTampungDetail, cekZonasiByKecamatan, cekZonasiKhususByKecamatan
 } from "../controllers/master/SekolahTujuan.js";
import { getJenisKejuaraan } from "../controllers/master/JenisKejuaraan.js";
import { getProvinsi, getKabkota, getKecamatan, getKelurahan } from '../controllers/master/WilayahVerDapodik.js';

import { cekZonasiByKecamatanZ, cekZonasiBySekolahZ } from '../controllers/master/Zonasi.js';
import { cekZonasiKhususByKecamatanZ, cekZonasiKhususBySekolahZ } from '../controllers/master/ZonasiKhusus.js';

//kebutuhan beranda
import { getTimelinePublic } from "../controllers/service/TimelinePublic.js";

//Service
import { getPesertaDidikByNisnHandler, getDataDukungByNIK, getPesertaDidikByNisnNamaNamaNamaIbuHandler, getPesertaDidikByNisnTokHendler, getPesertaDidikByNisnHandlerTes, getPesertaDidikByNikTokHendler, getPesertaDidikSmaSmkAll, getKkoAll, getPesertaDidikByNisnHandlerUntukRevisi } from '../controllers/service/PesertaDidik.js';
import { createPendaftar, getPendaftarforCetak, aktivasiAkunPendaftar, getPendaftarDetail, getBatasWlayah, createPendaftarTanpaFile, createPendaftarTanpaFileWkatuKhusus, uploadPendaftarFiles } from '../controllers/service/Pendaftar.js';
import { cekPerangkingan, createPerangkingan, getPerangkingan, 
    uploadFileTambahan, cetakBuktiPerangkingan, cetakBuktiPerangkinganAdmin, 
    getPerangkinganSaya, softDeletePerangkingan, daftarUlangPerangkingan, daftarUlangPerangkinganBatal,
     getPerangkinganDetail, getInfoParam,  automasiPerangkingan,
     getPerangkinganPengumuman,
     getPerangkinganDaftarUlang, getPerangkinganCadangan,
     getPerangkinganCadanganHitungSisaDaftarUlang,
     getPerangkinganCadanganHitungSisaDaftarUlangAdmin,
     CariPengumumanByNoPendaftaran,
     generatePendaftarPrestasiKhususCache,
     getPerangkinganSayaUpdateKebutuhanKhusus,
     getPerangkinganDetailByNisn,
     getPotensiPerangkingan,
     getMonitoringSMA,
     getPerangkinganTanpaRedisMintaNDadakNdadak,
     getPerangkinganByLogNisn,
     getPerangkinganByLogPendaftaran,
     getPerangkinganDetailByNisnPengumuman


    } from '../controllers/service/Perangkingan.js';

//akun siswa
import { loginUser, logoutUser, resetPassword, forgotPassword, verifikasiOtpUser, loginTanpaOtp, mainTenisCek, mainTenisPublikCek, registerCustomCek, cekKodeRandomRegisterCek, cekKodeNarasiCek, narasiPerubahan, popUpPublikCek } from '../controllers/service/AuthPublic.js';

//akun client api
import { loginClient, logoutClient } from '../controllers/service/integration/Auth.js';


//Admin
//Auth
import { generateSuperAdmin, loginAdmin, logoutAdmin, verifikasiOtp, loginAdminTanpaOtp } from '../controllers/service/admin/Auth.js';

//verifikasi pendaftar
import { getDataPendaftarForVerif, 
    getDataPendaftarForVerifPagination, 
    getDataPendaftarById, 
    getDataPendaftarByIdKhususAfterVerif,
    resetOpenedBy,
    verifikasiPendaftar, 
    updateAfterCekLagiPendaftar,
    perintahCekUlangPendaftaranTerverif, //api cek ulang
    updateKotaMutasi, //untuk update yang sudah terlanjur daftar
    verifikasiPendaftarTidakJadi, 
    updatePendaftar,
    updatePendaftarCapil,
    updateDokumen,
    updatePassworPendaftar,
    updatePendaftarByUser,
    updatePendaftarToCapill,


    getDataPendaftarByWhere,
    getDataPendaftarByWhereCapil,
    getDataPendaftarByWhereNisn,
    getDataPendaftarByNisn,
    getDataPendaftarCount,
    getDataPendaftarByWhereHanyaUntukAdmin,
    getDataPendaftarByWhereHanyaUntukCekLagi,
    updatePendaftarKhususPrestasi,
    updatePendaftarHapusPerangkingan
} from "../controllers/service/admin/VerifPendaftar.js";

//timenline
import { getTimeline, getTimelineById, updateTimeline } from "../controllers/service/admin/Timeline.js";

//sekolah tujuan
import { getSekolahTujuanAdmin, getSekolahTujuanAdminById, updateSekolahTujuanAdmin, getSekolahTujuanJurusanAdmin, getSekolahTujuanJurusanAdminById, updateSekolahTujuanJurusanAdmin, updateSekolahTujuanProfil, getSekolahTujuanByCabdin, getSekolahTujuanAdminForUser } from "../controllers/service/admin/SekolahTujuan.js";

//users
import { getUsers, getUsersPagination, getUserById, addUser, updateUser, softDeleteUser, resetPasswordById, resetLoggedInById, bulkUpdateIsLoginUsers, updateUserPassword } from "../controllers/service/admin/Users.js";

//roles
import { getRoles } from "../controllers/service/admin/Role.js";

//roles
import { getSertifikats, insertSertifikat } from "../controllers/service/integration/Sertifikat.js";


//rekap
import { countPendaftar, countCheckedPesertaDidiks, listCheckedPesertaDidiks, countPendaftarFrontend, countPendaftarPerTanggal, pendaftarHarian } from "../controllers/service/admin/RekapAdmin.js";

// // Terapkan logAccessMiddleware ke semua route
// router.use(logAccessMiddleware);

const isBrowser = (userAgent) => {
    // Daftar beberapa browser populer yang perlu dideteksi
    const browserKeywords = [
        'Mozilla',    // Umum untuk banyak browser berbasis Gecko (Firefox, Brave, dll)
        'Chrome',     // Google Chrome, Brave, Edge (Chromium-based)
        'Safari',     // Safari
        'Firefox',    // Firefox
        'Edge',       // Microsoft Edge (Chromium-based)
        'Opera',      // Opera
    ];

    // Memeriksa apakah User-Agent mengandung kata kunci dari browser yang valid
    return browserKeywords.some(keyword => userAgent.includes(keyword));
};

// // Pakai csrfProtection
router.get('/api/csrf-token', domainWhitelistMiddleware, csrfProtection, (req, res) => {

    const userAgent = req.get('User-Agent') || '';
    
    //Jika bukan browser, kirimkan status 403
    // if (!isBrowser(userAgent)) {
    //     return res.status(403).json({
    //         status: 0,
    //         message: 'CSRF token cannot be retrieved from non-browser clients.'
    //     });
    // }

    // Jika permintaan datang dari browser, lanjutkan untuk mengembalikan CSRF token
    res.json({
        status: 1,
        csrfToken: req.csrfToken()
    });

    // res.json({ csrfToken: req.csrfToken() });
});

// refresh token
router.post('/api/auth/refresh_token', authenticateRefreshTokenPublic);
router.post('/admin-api/auth/refresh_token', authenticateRefreshToken);

//downloadfile
router.get('/download/:nisn/:filename', viewFile);
router.get('/download_new/:nisn/:filename', viewFileBase64);
// router.get('/geojson', viewGeoJson);
// router.get('/geojson_redis', viewGeoJsonRedis);

router.get('/api/cek_status_maintenis', mainTenisCek);
router.get('/api/cek_status_cocok_cocok', mainTenisCek);
router.get('/api/cek_status_maintenis_publik', mainTenisPublikCek);
router.get('/api/cek_status_register_custom', registerCustomCek);

router.get('/api/cek_popup', popUpPublikCek);

router.post('/api/open_form_pendaftaran', cekKodeRandomRegisterCek);
router.get('/api/open_form_narasi', cekKodeNarasiCek);
router.get('/api/narasi_perubahan', narasiPerubahan);





//konfigurasi cache
router.delete('/rahasia-api/internal/clear_cache/:key', clearCacheByKey); // Clear specific cache key
router.delete('/rahasia-api/internal/clear_all_cache', clearAllCache); // Clear all cache
router.get('/rahasia-api/internal/cache/keys', getAllCacheKeys); // Get all cache keys
router.get('/rahasia-api/internal/cache/key_values', getAllCacheKeysAndValues);
router.delete('/rahasia-api/internal/cache/clear_cache_by_prefix', simpleAuthMiddleware, clearCacheByPrefix);

router.delete('/rahasia-api/internal/cache/clear_cache_by_prefix_open', clearCacheByPrefix);

router.get('/rahasia-api/internal/cache/generate_cache_sma_smk', getPesertaDidikSmaSmkAll);

router.get('/rahasia-api/internal/cache/generate_cache_peserta_prestasi_khusus', generatePendaftarPrestasiKhususCache);

router.get('/rahasia-api/internal/cache/generate_siswa_kko', getKkoAll);





// Master Data
router.get('/api/master/status_domisili', getStatusDomisili);
router.get('/api/master/status_domisili_luar_provinsi', getStatusDomisiliLuarProv);
router.get('/api/master/sekolah_asal', getSekolahAsal);
router.get('/api/master/jenis_lulusan', getJenisLulusan);

router.post('/api/master/sekolah_tujuan', getSekolahTujuan);

router.post('/api/master/sekolah_tujuan_with_kabkota', getSekolahTujuanKabkota);


// router.post('/api/master/daya_tampung_detail', cekZonasiByKecamatan);






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
router.post('/api/servis/calon_peserta_didik', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, verifyCloudflareCaptcha, logAccessPub, validatePendaftar, validateResult, getPesertaDidikByNisnHandler);
router.post('/api/servis/calon_peserta_didik_tes', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, verifyCloudflareCaptcha, logAccessPub, validatePendaftar, validateResult, getPesertaDidikByNisnHandlerTes);
router.post('/api/servis/calon_peserta_didik_cek_revisi', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, verifyCloudflareCaptcha, logAccessPub, validatePendaftar, validateResult, getPesertaDidikByNisnHandlerUntukRevisi);



router.post('/admin-api/oriental-servis/calon_peserta_didik', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, getPesertaDidikByNisnTokHendler);
router.post('/admin-api/oriental-servis/calon_peserta_didik_by_nik', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, getPesertaDidikByNikTokHendler);
router.post('/api/master/daya_tampung_detail', dayaTampungDetail);
router.post('/admin-api/oriental-servis/cek_zonasi_by_kec', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, cekZonasiByKecamatan);
router.post('/admin-api/oriental-servis/cek_zonasi_khusus_by_kec', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, cekZonasiKhususByKecamatan);


router.post('/api/servis/daftar_akun', ipWhitelistMiddleware, appKeyMiddleware, logAccess, createPendaftar);

router.post("/api/servis/daftar_akun_spmb", csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, verifyCloudflareCaptcha, logAccess, validatePendaftar, createPendaftarTanpaFile);
router.post("/api/servis/daftar_akun_spmb_waktu_khusus", csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, verifyCloudflareCaptcha, logAccess, validatePendaftar, createPendaftarTanpaFileWkatuKhusus);
router.post("/api/servis/upload_data_dukung", csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, logAccess, uploadPendaftarFiles);

router.post('/api/servis/dokumen_update', ipWhitelistMiddleware, appKeyMiddleware, logAccess, updateDokumen);

router.post('/api/servis/revisi_data', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, verifyCloudflareCaptcha, logAccess, updatePendaftarByUser);

router.post('/api/servis/update_kejuaraan_by_forum', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, logAccess, updatePendaftarKhususPrestasi);
router.post('/api/servis/hapus_kejuaraan_by_forum', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, logAccess, updatePendaftarHapusPerangkingan);


// router.post('/api/servis/revisi_dokumen', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccess, updateDokumen);


//cari wilayah
router.post('/api/servis/cari_batas_wilayah', ipWhitelistMiddleware, appKeyMiddleware, getBatasWlayah);

router.post('/api/servis/cetak_pendaftaran', getPendaftarforCetak);
router.post('/api/servis/aktivasi_akun', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, verifyCloudflareCaptcha, logAccess, aktivasiAkunPendaftar);
router.post('/api/servis/data_dukung', ipWhitelistMiddleware, appKeyMiddleware, getDataDukungByNIK);
router.post('/api/servis/detail_pendaftar', ipWhitelistMiddleware, appKeyMiddleware, getPendaftarDetail);


//========================================================================//
//API Calon Siswa After Aktivasi (Dashboard Calon Siswa)
router.post('/api/auth/login', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, verifyCloudflareCaptcha, logAccess, loginUser);
router.post('/api/auth/verifikasi_otp', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, logAccess, verifikasiOtpUser);

router.post('/api/auth/login_new', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, verifyCloudflareCaptcha, logAccess, loginTanpaOtp);
router.post('/api/auth/pengecekan_jarak', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, logAccess, getPerangkinganSayaUpdateKebutuhanKhusus);


router.post('/air/cek/monitoring/internal', ipWhitelistMiddleware, appKeyMiddleware, csrfProtection, getPerangkinganDetailByNisn);



router.post('/api/auth/logout', ipWhitelistMiddleware, appKeyMiddleware, logAccess, logoutUser);
router.post('/api/auth/ubah_password', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, resetPassword);
router.post('/api/auth/lupa_password', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, verifyCloudflareCaptcha, forgotPassword);



router.post('/api/servis/cek_daftar_sekolah', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, logAccess,  cekPerangkingan);
router.post('/api/servis/daftar_sekolah', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, logAccess, createPerangkingan);
router.post('/api/servis/cetak_bukti_daftar', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, logAccess, cetakBuktiPerangkingan);





// router.post('/api/servis/upload_file_tambahan/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, uploadFileTambahan);
router.post('/api/servis/upload_file_tambahan/:id_jalur_pendaftaran/:id_pendaftar/:nisn', ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, logAccess, uploadFileTambahan);


router.post('/api/servis/perangkingan', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, getPerangkingan);

router.post('/api/servis/perangkingan_with_created_at', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, getPerangkinganTanpaRedisMintaNDadakNdadak);

router.post('/api/servis/perangkingan_spk', getPotensiPerangkingan);

router.post('/api/servis/cari_rangking_by_no_pendaftaran', ipWhitelistMiddleware, appKeyMiddleware, CariPengumumanByNoPendaftaran);

router.post('/api/servis/pengumuman', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, getPerangkinganPengumuman);

router.post('/api/servis/perangkingan_info_param', ipWhitelistMiddleware, appKeyMiddleware, getInfoParam);

router.post('/api/servis/cek_perangkingan_by_nisn', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, getPerangkinganByLogNisn)

router.post('/api/servis/cek_perangkingan_by_no_pendaftaran', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, getPerangkinganByLogPendaftaran)






// csrf masih mati
router.post('/api/servis/perangkingan_saya', ipWhitelistMiddleware, appKeyMiddleware, getPerangkinganSaya);

router.post('/api/servis/perangkingan_detail', ipWhitelistMiddleware, appKeyMiddleware, getPerangkinganDetail);

//router.post('/api/servis/perangkingan_pengumuman', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, getPerangkinganDetailByNisnPengumuman);
router.post('/api/servis/perangkingan_pengumuman', getPerangkinganDetailByNisnPengumuman);

router.post('/api/servis/perangkingan_hapus', ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, logAccess, softDeletePerangkingan);

// router.post('/api/servis/daftar_ulang', ipWhitelistMiddleware, appKeyMiddleware, daftarUlangPerangkingan);








//========================================================================//
//API Khusus Admin

//cek log siswa
router.post('/admin-api/log/lihat_log_cm', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, LogSiswaLoggedIn); 
// log admin dan operator
router.post('/admin-api/log/admin-operator', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, LogAdminLoggedIn); 

//Auth
// router.get('/admin-api/jkt48/freya', generateSuperAdmin_);
router.post('/admin-api/jkt48/freya', generateSuperAdmin);
router.post('/admin-api/auth/signin', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, logAccessAdmin, loginAdmin);
router.post('/admin-api/auth/verifikasi_otp', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, logAccessAdmin, verifikasiOtp);

router.post('/admin-api/auth/signin_new', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, logAccessAdmin, loginAdminTanpaOtp);

router.post('/admin-api/auth/signout', ipWhitelistMiddleware, appKeyMiddleware, logAccessAdmin, logoutAdmin);

router.post('/admin-api/servis/cetak_bukti_daftar', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, logAccessAdmin, cetakBuktiPerangkinganAdmin);



//master data admin
router.post('/admin-api/master/sekolah_tujuan', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getSekolahTujuanAdmin);
router.post('/admin-api/master/sekolah_tujuan_user', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getSekolahTujuanAdminForUser);


router.get('/admin-api/master/sekolah_tujuan_detail/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,getSekolahTujuanAdminById);
router.post('/admin-api/master/sekolah_tujuan_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updateSekolahTujuanAdmin);
router.post('/admin-api/master/sekolah_profil_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updateSekolahTujuanProfil);
router.post('/admin-api/master/sekolah_tujuan_by_cabdin', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getSekolahTujuanByCabdin);



router.post('/admin-api/master/sekolah_tujuan_jurusan', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getSekolahTujuanJurusanAdmin);
router.get('/admin-api/master/sekolah_tujuan_jurusan_detail/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getSekolahTujuanJurusanAdminById);
router.post('/admin-api/master/sekolah_tujuan_jurusan_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updateSekolahTujuanJurusanAdmin);

//menu menu & action admin

// menu pendaftaran
router.get('/admin-api/data/pendaftaran', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarForVerif);
// router.get('/admin-api/data/pendaftaran_data_', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarByWhere);
router.get('/admin-api/data/pendaftaran_data', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarByWhere);
router.get('/admin-api/data/pendaftaran_data_capil', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarByWhereCapil);
router.get('/admin-api/data/pendaftaran_data_nisn', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarByWhereNisn);

router.get('/admin-api/data/pencarian_by_nisn/:nisn', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarByNisn);

router.get('/admin-api/data/sudah_verifikasi', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarByWhereHanyaUntukAdmin);
router.get('/admin-api/data/sudah_verifikasi_cek_ulang', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarByWhereHanyaUntukCekLagi);


// router.get('/admin-api/data/pendaftaran_data', getDataPendaftarByWhere);
router.get('/admin-api/data/pendaftaran_count', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarCount);

router.get('/admin-api/data/pendaftaran', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarForVerifPagination);
router.get('/admin-api/data/pendaftar_detail/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarById);
router.get('/admin-api/data/pendaftar_reset_password/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updatePassworPendaftar);


router.get('/admin-api/data/pendaftar_detail_after_verif/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getDataPendaftarByIdKhususAfterVerif);
router.get('/admin-api/data/pendaftar_reset_opened_by/:nisn', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, resetOpenedBy);


router.post('/admin-api/data/update_lokasi_mutasi', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, updateKotaMutasi);
router.post('/admin-api/data/pendaftar_verifikasi', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, verifikasiPendaftar);
router.post('/admin-api/data/tolak_ajuan_akun', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, verifikasiPendaftar);
router.post('/admin-api/data/tolak_ajuan_akun_karena_pernah_nikah_pny_anak', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, verifikasiPendaftar);
router.post('/admin-api/data/tolak_ajuan_akun_plus_alasan_alamat', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, verifikasiPendaftar);
router.post('/admin-api/data/tolak_ajuan_akun_plus_buka_batas_wilayah', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, verifikasiPendaftar);
router.post('/admin-api/data/tolak_ajuan_akun_plus_update_nik', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, verifikasiPendaftar); //96
router.post('/admin-api/data/tolak_ajuan_akun_sepenuhnya', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, verifikasiPendaftar); //95



router.post('/admin-api/data/perintah_cek_ulang', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, perintahCekUlangPendaftaranTerverif); //api cek ulang
router.post('/admin-api/data/aksi_cek_ulang', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updateAfterCekLagiPendaftar); //api cek ulang

router.post('/admin-api/data/fm_ajuan_akun', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, verifikasiPendaftar);
router.post('/admin-api/data/batalkan_verifikasi', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, verifikasiPendaftar);
router.post('/admin-api/data/pendaftar_verifikasi_no_action', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken,  logAccessAdmin, verifikasiPendaftarTidakJadi);
router.post('/admin-api/data/pendaftar_update', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updatePendaftar);
router.post('/admin-api/data/kirim_capil', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updatePendaftarToCapill);
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
router.post('/admin-api/setting/user_tambah', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, addUser);
router.post('/admin-api/setting/user_update', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updateUser);
router.post('/admin-api/setting/user_update_password', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, updateUserPassword);
router.get('/admin-api/setting/reset_is_login_masal', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, bulkUpdateIsLoginUsers);
router.post('/admin-api/setting/user_delete/:id', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, softDeleteUser);
router.get('/admin-api/setting/user_reset_password/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, resetPasswordById);
router.get('/admin-api/setting/user_reset_status_login/:id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, resetLoggedInById);

//menu zonasi
//router.post('/admin-api/zonasi/per_kecamatan', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, cekZonasiByKecamatanZ);
router.post('/admin-api/zonasi/per_kecamatan', csrfProtection, logAccessAdmin, cekZonasiByKecamatanZ);
router.post('/admin-api/zonasi/per_sekolah', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, cekZonasiBySekolahZ);

//router.post('/admin-api/zonasi_khusus/per_kecamatan', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, cekZonasiKhususByKecamatanZ);
router.post('/admin-api/zonasi_khusus/per_kecamatan', csrfProtection, logAccessAdmin, cekZonasiKhususByKecamatanZ);
router.post('/admin-api/zonasi_khusus/per_sekolah', csrfProtection, ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, logAccessAdmin, cekZonasiKhususBySekolahZ);





//rekap
// router.get('/admin-api/rekap/pendaftar/:sekolah_id', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, countPendaftar);
router.get('/admin-api/rekap/pendaftar/:sekolah_id?/:start_date?/:end_date?', ipWhitelistMiddleware, appKeyMiddleware, countPendaftar);
router.get('/admin-api/rekap/pendaftar_per_tanggal', ipWhitelistMiddleware, appKeyMiddleware, countPendaftarPerTanggal);

router.get('/api/rekap/pendaftar/', ipWhitelistMiddleware, appKeyMiddleware, countPendaftarFrontend);



router.get('/admin-api/rekap/pendaftar_dashboard/:sekolah_id', ipWhitelistMiddleware, appKeyMiddleware, countPendaftar);

router.get('/admin-api/rekap/cek_nisn', ipWhitelistMiddleware, appKeyMiddleware, countCheckedPesertaDidiks);

router.get('/admin-api/rekap/cek_nisn_list', ipWhitelistMiddleware, appKeyMiddleware, listCheckedPesertaDidiks);




//role
router.get('/admin-api/master/roles', ipWhitelistMiddleware, appKeyMiddleware, authenticateToken, getRoles);



//daftar ulang & perangkingan
router.post('/admin-api/servis/daftar_ulang', ipWhitelistMiddleware, appKeyMiddleware,  authenticateToken, logAccessAdmin, daftarUlangPerangkingan);
router.post('/admin-api/servis/batal_daftar_ulang_by_admin', ipWhitelistMiddleware, appKeyMiddleware,  authenticateToken, logAccessAdmin, daftarUlangPerangkinganBatal);

// router.post('/api/servis/automasi_perangkingan', ipWhitelistMiddleware, appKeyMiddleware, authenticateTokenPublic, logAccess, automasiPerangkingan);
router.post('/admin-api/servis/automasi_perangkingan', ipWhitelistMiddleware, automasiPerangkingan); 
router.post('/admin-api/servis/perangkingan_daftar_ulang', ipWhitelistMiddleware, getPerangkinganDaftarUlang); 
router.post('/api/servis/perangkingan_cadangan', ipWhitelistMiddleware, getPerangkinganCadangan); 

router.post('/api/servis/perangkingan_daftar_ulang_cadangan', ipWhitelistMiddleware, getPerangkinganCadanganHitungSisaDaftarUlang); 

router.post('/admin-api/servis/perangkingan_daftar_ulang_cadangan_admin', ipWhitelistMiddleware, getPerangkinganCadanganHitungSisaDaftarUlangAdmin); 

// ============================ API UNTUK EXTERNAL ==============================//

//Auth
router.post('/client-api/auth/signin', ipWhitelistMiddleware, appKeynyaIntegrator, logAccessClient, loginClient);
router.post('/client-api/auth/signout', ipWhitelistMiddleware, appKeynyaIntegrator, logAccessClient, logoutClient);


//sertfikat
router.get('/client-api/external/jenis_kejuaraan', logAccessClient, getJenisKejuaraan);
router.get('/client-api/external/sertifikat', ipWhitelistMiddleware, appKeynyaIntegrator, authenticateTokenClient, getSertifikats);
router.post('/client-api/external/insert_sertifikat', ipWhitelistMiddleware, appKeynyaIntegrator, authenticateTokenClient, logAccessClient, insertSertifikat);


router.get('/rekap-api/external/rekap_harian', pendaftarHarian);

router.get('/rekap-api/monitoring/sma', getMonitoringSMA);




// Define the version as a constant
const VERSION = '2.1.26'; 
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
    // Mengatur header untuk mencegah caching
    res.set('Cache-Control', 'no-store');

    // Mengirimkan HTML sebagai respons
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Version Info</title>
            <style>
                .ok-logo {
                    font-family: monospace;
                    white-space: pre;
                    text-align: center;
                    color: #2ecc71;
                    margin: 20px 0;
                    font-size: 12px;
                    line-height: 12px;
                    font-weight: bold;
                }
                body {
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    text-align: center;
                    background-color: #f9f9f9;
                }
                h1 {
                    color: #333;
                }
            </style>
        </head>
        <body>
            <h1>Application Version</h1>
            <p><strong>App Name:</strong> ${APPNAME}</p>
            <p><strong>App Version:</strong> ${VERSION}</p>
            
            <div class="ok-logo">tes
               ██████╗ ██╗  ██╗
              ██╔═══██╗██║ ██╔╝
              ██║   ██║█████╔╝ 
              ██║   ██║██╔═██╗ 
              ╚██████╔╝██║  ██╗
               ╚═════╝ ╚═╝  ╚═╝
            </div>
            <p><em>Everything is OK</em></p>
        </body>
        </html>
    `);
});;

// Buat rute GET di '/version' yang mengirimkan HTML sebagai respons
router.get('/dokumen/not-found', (req, res) => {
    // Mengatur header untuk mencegah caching
    res.set('Cache-Control', 'no-store');

    // Mengirimkan HTML sebagai respons
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Version Info</title>
        </head>
        <body>
           
            <h1>DOKUMEN TIDAK DITEMUKAN</h1>
             <h1>SILAHKAN REVISI</h1>   
        </body>
        </html>
    `);
});;






export default router;