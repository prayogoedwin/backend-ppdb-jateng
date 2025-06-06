import axios from 'axios';

export const verifyRecaptcha = async (req, res, next) => {
  const { recaptchaToken } = req.body;
//   return true;
  
  if (!recaptchaToken) {
    // return res.status(400).json({ error: 'reCAPTCHA token diperlukan' });
    return res.status(400).json({ 
        status: 0,
        message: 'error: reCAPTCHA token diperlukan' 
      });
  }

  try {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      new URLSearchParams({
        secret: '6LcuUCYrAAAAAPbXRyNZA18berpj6V2nRfMWNAEb', // Ganti dengan secret key reCAPTCHA v3 Anda
        response: recaptchaToken,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { success, score } = response.data;

    //  if (!success || score < 0.3) {
    //     return res.status(400).json({ 
    //       status: 0,
    //       message: 'Verifikasi reCAPTCHA gagal atau skor terlalu rendah' ,
    //       score: score // Optional: kirim skor untuk debugging
    //     });
    //   }

      if (!success) {
        return res.status(400).json({ 
          status: 0,
          message: 'Verifikasi reCAPTCHA gagal, silahkan hard refresh browser anda atau ganti browser chrome / mozila terbaru' ,
          score: score // Optional: kirim skor untuk debugging
        });
      }

      if (score < 0.3) {
        return res.status(400).json({ 
          status: 0,
          message: 'Skor Verifikasi reCAPTCHA terlalu rendah, silahkan refresh browser atau rubah ke mode incognito atau ganti jaringan internet' ,
          score: score // Optional: kirim skor untuk debugging
        });
      }

    next();
  } catch (error) {
    console.error('Error verifikasi reCAPTCHA:', error);
   // res.status(500).json({ error: 'Internal server error' });
    return res.status(500).json({ 
        status: 0,
        message: 'Error verifikasi reCAPTCHA' 
      });
    
  }
};

// export const verifyRecaptcha = async (req, res, next) => {
//         next();
// };