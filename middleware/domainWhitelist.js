import { parse } from 'url'; // Pastikan sudah mengimpor fungsi parse untuk memproses URL

const domainWhitelistMiddleware = async (req, res, next) => {
    try {
        // Cek jika Origin atau Referer ada di header request
        const origin = req.get('origin') || req.get('referer');
        
        // Jika tidak ada Origin/Referer, langsung blokir dengan 403
        if (!origin) {
            return res.status(403).json({
                status: 0,
                message: 'Forbidden - Origin/Referer header is missing',
            });
        }

        // Parse URL untuk mendapatkan domain dari Origin
        const parsedUrl = parse(origin);
        const originDomain = parsedUrl.protocol + '//' + parsedUrl.hostname;

        // Log untuk debugging
        console.log('Origin/Referer:', origin);
        console.log('Parsed Origin Domain:', originDomain);

        // Daftar domain yang diizinkan (whitelist)
        const allowedDomains = [
            'https://ujicoba.pdk.jatengprov.go.id/',
            'https://adminujicoba.pdk.jatengprov.go.id/'
        ];

        // Cek apakah domain yang didapatkan ada dalam whitelist
        const isAllowedDomain = allowedDomains.some(domain => originDomain === domain);

        // Jika domain tidak ada dalam whitelist, beri response Forbidden
        if (!isAllowedDomain) {
            return res.status(403).json({
                status: 0,
                message: 'Forbidden - Your domain is not allowed to access this resource',
            });
        }

        // Lanjutkan jika domain diizinkan
        next();
    } catch (error) {
        console.error('Error checking domain whitelist:', error);
        res.status(500).json({
            status: 0,
            message: 'Internal Server Error',
        });
    }
};

export default domainWhitelistMiddleware;
