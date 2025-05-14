import csrf from 'csurf';

let csrfProtection;
if (process.env.CSRF_CHECKER === '1') {
    // Mode produksi (aktifkan CSRF)
    csrfProtection = csrf({ cookie: true });
} else {
    // Mode development (mock CSRF token)
    csrfProtection = (req, res, next) => {
        req.csrfToken = () => 'dev-csrf-token-mock'; // Mock function
        next();
    };
}

export default csrfProtection;