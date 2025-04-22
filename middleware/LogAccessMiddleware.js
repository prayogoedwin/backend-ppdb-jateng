// middleware/logAccess.js
import AccessLog from '../models/AccessLog.js';
import AccessLogAdmin from '../models/AccessLogAdmin.js';
import AccessLogClient from '../models/AccessLogClient.js';
import AccessLogPub from '../models/AccessLogPublic.js';

// async function logAccess(req, res, next) {
export const logAccess = async (req, res, next) => {

    // const akun = req.user && req.user.userId ? req.user.userId : req.body.nisn;
    // if(akun == ''){
    //     akun = req.body.nisn
    // }
    // const akun = req.body?.nisn  || (req.user?.userId || null);

    // const akun = req.user && req.user.userId ? req.user.userId : req.body.username;
    // if(akun == ''){
    //     akun = req.body.username
    // }

    const akun = req.body.nisn || req.params.nisn || req.query.nisn || (req.user ? req.user.userId : null); // Hanya gunakan req.user.userId jika req.user ada

    try {
        const logData = {
            id:1,
            url: req.originalUrl,
            akun: akun, // Jika menggunakan autentikasi, ambil dari `req.user`
            json_data:  JSON.stringify(req.body), // Ambil data JSON dari body
            created_at: new Date(),
            created_by: req.body.nisn,
            created_by_ip: req.ip // Alamat IP pengguna
        };

        // Simpan ke dalam database
        // await AccessLog.create(logData);
        AccessLog.create(logData);
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

// async function logAccessAdmin(req, res, next) {

export const logAccessAdmin = async (req, res, next) => {

    const akun = req.user && req.user.userId ? req.user.userId : req.body.username;
    if(akun == ''){
        akun = req.body.username
    }

    const usernya = req.body.nisn || req.params.nisn || req.query.nisn;
    const now = new Date();

    try {
        const logData = {
            id:1,
            url: req.originalUrl,
            akun: usernya, // Jika menggunakan autentikasi
            json_data:  req.body, // Ambil data JSON dari body
            created_at: new Date(),
            // created_at: now.toLocaleString('id-ID', {
            //     timeZone: 'Asia/Jakarta',
            //     year: 'numeric',
            //     month: '2-digit',
            //     day: '2-digit',
            //     hour: '2-digit',
            //     minute: '2-digit',
            //     second: '2-digit',
            //     hour12: false
            //   }).replace(/\//g, '-').replace(',', '').replace(/\./g, ':'),
            created_by: akun,
            created_by_ip: req.ip // Alamat IP pengguna
        };

        // Simpan ke dalam database
        // await AccessLogAdmin.create(logData);
        AccessLogAdmin.create(logData);
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

export const logAccessClient = async (req, res, next) => {

    const akun = req.user && req.user.userId ? req.user.userId : req.body.username;
    const now = new Date();
    try {
        const logData = {
            id:1,
            url: req.originalUrl,
            akun: akun, // Jika menggunakan autentikasi, ambil dari `req.user`
            json_data:  '',
            created_at: new Date(),
            // created_at: now.toLocaleString('id-ID', {
            //     timeZone: 'Asia/Jakarta',
            //     year: 'numeric',
            //     month: '2-digit',
            //     day: '2-digit',
            //     hour: '2-digit',
            //     minute: '2-digit',
            //     second: '2-digit',
            //     hour12: false
            //   }).replace(/\//g, '-').replace(',', '').replace(/\./g, ':'),
            created_by: req.body.username,
            created_by_ip: req.ip // Alamat IP pengguna
        };

        // Simpan ke dalam database
        // await AccessLogClient.create(logData);
        AccessLogClient.create(logData);
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

export const logAccessPub = async (req, res, next) => {

    try {

        const now = new Date();

        // const logData = {
        //     id:1,
        //     url: req.originalUrl,
        //     akun: req.body.nisn,
        //     json_data:  req.body.nisn,
        //     created_at: new Date(),
        //     created_by: req.body.nisn,
        //     created_by_ip: req.ip // Alamat IP pengguna
        // };

        const logData = {
            id: 1,
            url: req.originalUrl,
            akun: req.body.nisn,
            json_data: req.body.nisn,
            created_at: new Date(),
            // created_at: now.toLocaleString('id-ID', {
            //     timeZone: 'Asia/Jakarta',
            //     year: 'numeric',
            //     month: '2-digit',
            //     day: '2-digit',
            //     hour: '2-digit',
            //     minute: '2-digit',
            //     second: '2-digit',
            //     hour12: false
            //   }).replace(/\//g, '-').replace(',', '').replace(/\./g, ':'),
            created_by: req.body.nisn,
            created_by_ip: req.ip
          };

        // Simpan ke dalam database
        AccessLogPub.create(logData);
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
