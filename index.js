// Import express
import express from "express";
// Import cors
import cors from "cors";
// Import connection
import db from "./config/Database.js";
// Import router
import Router from "./routes/index.js";

//Import dotenv
import dotenv from "dotenv";

// Di file server utama Anda (misalnya app.js atau index.js)
import logAccessMiddleware from './middleware/logAccessMiddleware.js';



// Load environment variables from .env files
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
dotenv.config(); // This will load variables from .env as well

 
// Init express
const app = express();
// use express json
app.use(express.json());

//use form data
app.use(express.urlencoded({ extended: true }));

// use cors
app.use(cors());

// Testing database connection 
try {
    await db.authenticate();
    console.log('Connection has been established successfully.');
} catch (error) {
    console.error('Unable to connect to the database:', error);
}

// app.use(logAccessMiddleware);
// use router
app.use(Router);
// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));