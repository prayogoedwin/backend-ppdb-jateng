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
// import csrf from 'csurf';



// Load environment variables from .env files
// dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
dotenv.config(); // This will load variables from .env as well

 
// Init express
const app = express();

// Middleware untuk membaca cookies dan JSON body
app.use(cookieParser());
app.use(express.json());   // Parsing JSON
app.use(express.urlencoded({ extended: true }));  // Parsing form dat

const allowedOrigins = [
  process.env.ORIGIN_FRONTEND,
  process.env.ORIGIN_ADMIN
];


// Middleware CORS dengan pengecekan header dan origin
app.use(
  cors({
    origin: (origin, callback) => {
      // Jika request adalah dev access, izinkan tanpa origin

      // Jika ORIGIN_CHECKER diset ke '0', izinkan akses tanpa memeriksa origin
      if (process.env.ORIGIN_CHECKER === '0') {
        return callback(null, true); // Izinkan tanpa origin
      }

      // Jika header origin tidak ada, izinkan akses
      if (!origin) return callback(null, true);

      // Jika origin ada, cek apakah sesuai dengan origin yang diizinkan
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);


// Menangani error CORS secara global
// app.use((err, req, res, next) => {
//   if (err.message === 'Not allowed by CORS') {
//     // CORS Error
//     console.error('CORS Error: ', err.message);
//     return res.status(403).json({ message: 'Forbidden: CORS Not Allowed' });
//   }
  
//   // Jika ada error lain, lanjutkan ke error handler berikutnya
//   next(err);
// });


app.use(Router);

//Tangani error CSRF jika terjadi ForbiddenError
Router.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
      return res.status(403).json({ 
        status: 0,
        message: 'ForbiddenError: invalid csrf token'
     });
    }
    // Lanjutkan ke error handler lainnya jika bukan CSRF error
    next(err);
  })

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
