// import sequelize 
import { Sequelize } from "sequelize";
// import dotenv 
import dotenv from "dotenv";
dotenv.config();


const db = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DRIVER
});

export default db;