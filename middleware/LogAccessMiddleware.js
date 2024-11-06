// middleware/logAccess.js
import AccessLog from '../models/AccessLog.js';
import db from "../config/Database.js";

async function logAccess(req, res, next) {

    const nisn_p = req.params.nisn;
    const nisn_b = req.body.nisn;

    try {
        const logData = {
            url: req.originalUrl,
            akun: nisn_p ? nisn_b : null, // Jika menggunakan autentikasi, ambil dari `req.user`
            json_data:  null, // Ambil data JSON dari body
            created_at: new Date(),
            created_by: req.user ? req.user.id : null, // ID user jika tersedia
            created_by_ip: req.ip // Alamat IP pengguna
        };

        // Simpan ke dalam database
        await AccessLog.create(logData);
        console.log("Log entry created:", logData); // 

        next(); // Lanjutkan ke handler berikutnya
    } catch (error) {
        console.error('Error logging access:', error);
        next(error); // Lanjutkan ke error handler jika ada masalah
    }

    // db.sync().then(() => {
    //     console.log("Database synchronized");
    // }).catch(error => {
    //     console.error("Error synchronizing database:", error);
    // })

}


export default logAccess;
