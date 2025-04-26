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


import cookieParser from 'cookie-parser';
import csrf from 'csurf';

// import csrfProtection from './middleware/csrfProtection.js'; // ini middleware kamu tadi
// import routes from './routes/index.js'; // Sesuaikan path-nya



// Load environment variables from .env files
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
dotenv.config(); // This will load variables from .env as well

 
// Init express
const app = express();

app.use(cookieParser()); // <-- HARUS sebelum csrfProtection

// use cors
// app.use(cors());
app.use(cors({
  origin: 'http://localhost:3002', // sesuaikan asal front-end kamu
  credentials: true,              // INI HARUS TRUE supaya cookie ikut dikirim
}));

// use express json
app.use(express.json());
//use form data
app.use(express.urlencoded({ extended: true }));


const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

// Contoh route buat kirim csrf token
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});



app.use(Router);

// Tangani error CSRF jika terjadi ForbiddenError
// Router.use((err, req, res, next) => {
//     if (err.code === 'EBADCSRFTOKEN') {
//       return res.status(403).json({ 
//         status: 0,
//         message: 'ForbiddenError: invalid csrf token'
//      });
//     }
//     // Lanjutkan ke error handler lainnya jika bukan CSRF error
//     next(err);
//   })

// Testing database connection 
try {
    await db.authenticate();
    console.log('Connection has been established successfully.');
} catch (error) {
    console.error('Unable to connect to the database:', error);
}

// use router
// app.use(Router);
// listen on port
const port = process.env.PORT || 3033;
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
// app.listen(port, '0.0.0.0', () => console.log(`Server running at http://0.0.0.0:${port}`));
