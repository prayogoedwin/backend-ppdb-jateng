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

// use router
app.use(Router);
// listen on port
const port = process.env.PORT || 3033;
// app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
app.listen(port, '0.0.0.0', () => console.log(`Server running at http://0.0.0.0:${port}`));
