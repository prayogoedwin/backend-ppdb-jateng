import axios from 'axios';

export const verifyCloudflareCaptcha = async (req, res, next) => {
  try {
    const token = req.body.turnstileToken;

    if (!token) {
      return res.status(400).json({ 
        status: 0,
        message: 'Turnstile CAPTCHA token diperlukan',
        error_code: 'MISSING_INPUT_TOKEN'
      });
    }

    const { data } = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        secret: process.env.TURNSTILE_SECRET_KEY, // Selalu gunakan environment variable
        response: token,
        remoteip: req.ip // Validasi tambahan dengan IP pengguna
      },
      {
        timeout: 5000, // Timeout 5 detik
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Your-Service/1.0'
        }
      }
    );

    if (!data.success) {
      console.warn('Turnstile verification failed:', data['error-codes']);
      
      return res.status(403).json({
        status: 0,
        message: 'Verifikasi gagal. Silakan refresh halaman atau coba lagi',
        error_codes: data['error-codes'],
        suggested_action: 'refresh_page'
      });
    }

    // Tambahkan data verifikasi ke request untuk logging
    req.turnstileVerification = {
      hostname: data.hostname,
      action: data.action,
      timestamp: data.challenge_ts
    };

    next();
  } catch (error) {
    console.error('Turnstile verification error:', error);

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        status: 0,
        message: 'Timeout saat verifikasi CAPTCHA',
        error_code: 'TIMEOUT'
      });
    }

    if (error.response) {
      // Error dari Cloudflare API
      return res.status(502).json({
        status: 0,
        message: 'Layanan verifikasi sedang gangguan',
        error_code: 'SERVICE_UNAVAILABLE'
      });
    }

    // Error lainnya
    return res.status(500).json({
      status: 0,
      message: 'Internal server error',
      error_code: 'INTERNAL_ERROR'
    });
  }
};

// export const verifyCluodflareCaptcha = async (req, res, next) => {
//     next();
// }