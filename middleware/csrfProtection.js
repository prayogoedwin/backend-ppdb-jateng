import csrf from 'csurf';

const csrfProtection = csrf({ cookie: true });

// const csrfProtection = csrf({
//     cookie: {
//       httpOnly: true, // cookie tidak bisa diakses dari Javascript di browser
//       //sameSite: 'strict', // hanya kirim cookie ke origin yang sama
//       //maxAge: 24 * 60 * 60, // cookie expired dalam 1 hari (dalam detik)
//       maxAge: 1, // cookie expired dalam 1 detik
//     }
//   });

export default csrfProtection;