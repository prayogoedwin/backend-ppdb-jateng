// middleware/logAccess.js
import AccessLog from '../models/AccessLog.js';

async function logAccess(req, res, next) {


    try {
        const logData = {
            url: req.originalUrl,
            akun: req.user, // Jika menggunakan autentikasi, ambil dari `req.user`
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
