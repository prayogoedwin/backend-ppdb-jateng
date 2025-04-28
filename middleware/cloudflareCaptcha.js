import axios from 'axios';

// Validator Turnstile (reusable)
// async function validateTurnstile(req, res, next) {
export const verifyCluodflareCaptcha = async (req, res, next) => {

    try {
        const token = req.body.turnstileToken;

        if (!token) {
            // return res.status(400).json({ error: 'reCAPTCHA token diperlukan' });
            return res.status(400).json({ 
                status: 0,
                message: 'error: turnstile CAPTCHA token diperlukan' 
            });
        }

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
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return res.status(500).json({ 
                status: 0,
                message: 'Turnstile Captca timeout' ,
            });
             console.error('Turnstile timeout');
        }
        // return res.status(500).json({ 
        //     status: 0,
        //     message: 'Turnstile Captca service unavailable' ,
        // });
        throw new Error('Turnstile service unavailable');
      }
}

// export const verifyCluodflareCaptcha = async (req, res, next) => {
//     next();
// }