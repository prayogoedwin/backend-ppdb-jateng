// middleware/logAccess.js
import AccessLog from '../models/AccessLog.js';

async function logAccess(req, res, next) {

    // Extract token from the Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract token from Bearer

    let userId = null;

    // If there's a token, verify it
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
            userId = decoded.userId;  // Assuming userId is in the token payload
        } catch (err) {
            userId = null;
            console.error('Token verification failed:', err);
            return res.status(403).json({ message: 'Invalid token' });
        }
    }

    try {
        const logData = {
            url: req.originalUrl,
            akun: userId, // Jika menggunakan autentikasi, ambil dari `req.user`
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
