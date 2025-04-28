import axios from 'axios';

// Validator Turnstile (reusable)
// async function validateTurnstile(req, res, next) {
export const verifyCluodflareCaptcha = async (req, res, next) => {
    const token = req.body.turnstileToken;
    // if (!token) return res.status(400).json({ error: 'Token required' });
    if (!token) {
        // return res.status(400).json({ error: 'reCAPTCHA token diperlukan' });
        return res.status(400).json({ 
            status: 0,
            message: 'error: turnstile CAPTCHA token diperlukan' 
          });
    }

    // const result = await axios.post(
    //     'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    //     new URLSearchParams({
    //       secret: '6LcuUCYrAAAAAPbXRyNZA18berpj6V2nRfMWNAEb', // Ganti dengan secret key reCAPTCHA v3 Anda
    //       response: recaptchaToken,
    //     }),
    //     { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    //   );
  
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: JSON.stringify({
        secret: "0x4AAAAAABVkMumzcgp09oPqozVWkoK0IeI",
        response: token,
        remoteip: req.ip
      })
    });
    
    const data = await result.json();
    // if (!data.success) return res.status(403).json({ error: 'Verifikasi gagal' });
    if (!data.success) {
        return res.status(403).json({ 
          status: 0,
          message: 'Verifikasi turnstile CAPTCHA gagal, silahkan hard refresh browser anda atau ganti browser chrome / mozila terbaru' ,
        });
      }
    next();
  }