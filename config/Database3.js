// Import sequelize
import { Sequelize } from "sequelize";
// Import dotenv
import dotenv from "dotenv";
dotenv.config();

// Initialize Sequelize for Database 2
const db3 = new Sequelize(process.env.DB3_NAME, process.env.DB3_USER, process.env.DB3_PASSWORD, {
    host: process.env.DB3_HOST,
    port: process.env.DB3_PORT,
    dialect: process.env.DB3_DRIVER,
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
    //     max: 5, // Maximum connections  
    //     min: 0,  // Minimum connections  
    //     acquire: 30000, // Maximum time to acquire a connection  
    //     idle: 10000 // Maximum time a connection can be idle before being released  
    // }  
});

export default db3;
