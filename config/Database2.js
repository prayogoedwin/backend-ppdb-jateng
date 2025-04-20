// Import sequelize
import { Sequelize } from "sequelize";
// Import dotenv
import dotenv from "dotenv";
dotenv.config();

// Initialize Sequelize for Database 2
const db2 = new Sequelize(process.env.DB2_NAME, process.env.DB2_USER, process.env.DB2_PASSWORD, {
    host: process.env.DB2_HOST,
    port: process.env.DB2_PORT,
    dialect: process.env.DB2_DRIVER,
    // dialectOptions: {
    //     useUTC: false // Non-aktifkan UTC
    //   },
    // timezone: 'Asia/Jakarta',
    dialectOptions: {
        useUTC: true, // Biarkan database handle sebagai UTC
      },
      timezone: '+00:00' // Nonaktifkan konversi timezone di Sequelize
    // timezone: '+07:00', // Tambahkan ini agar waktu disimpan dalam WIB
    // pool: {  
    //     max: 5, // Maximum connections  
    //     min: 0,  // Minimum connections  
    //     acquire: 30000, // Maximum time to acquire a connection  
    //     idle: 10000 // Maximum time a connection can be idle before being released  
    // }  
});

export default db2;
