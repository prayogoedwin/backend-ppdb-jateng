// import sequelize 
import { Sequelize } from "sequelize";
// import dotenv 
import dotenv from "dotenv";
dotenv.config();


const db = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: process.env.DB_DRIVER,
    dialectOptions: {
        useUTC: false // Non-aktifkan UTC
      },
    timezone: 'Asia/Jakarta',

    // dialectOptions: {
    //     useUTC: true, // Biarkan database handle sebagai UTC
    //   },
    //   timezone: '+00:00' // Nonaktifkan konversi timezone di Sequelize
    // timezone: '+07:00', // Tambahkan ini agar waktu disimpan dalam WIB
    // pool: {  
    //     max: 5, // Maksimum koneksi  
    //     min: 0,  // Minimum koneksi  
    //     acquire: 30000, // Waktu maksimum untuk mendapatkan koneksi  
    //     idle: 10000 // Waktu maksimum koneksi idle sebelum dilepaskan  
    // }  
});

export default db;