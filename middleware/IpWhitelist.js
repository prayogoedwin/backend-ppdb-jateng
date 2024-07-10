import IpWhitelist from '../models/config/IpWhitelistModel.js';

const ipWhitelistMiddleware = async (req, res, next) => {
    try {
        // const clientIP = req.ip;
        const clientServerIp = req.connection.remoteAddress;
        // const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        // Cari IP yang sesuai dengan clientIP di database
        const whitelistEntry = await IpWhitelist.findOne({
            where: {
                ip: clientServerIp
            }
        });

        // Jika tidak ada whitelist entry yang sesuai, beri response Forbidden
        if (!whitelistEntry) {
            return res.status(403).json({
                status: 0,
                message: 'Forbidden - Your IP is not allowed to access this resource',
            });
        }

        // Lanjutkan jika alamat IP diizinkan
        next();
    } catch (error) {
        console.error('Error checking IP whitelist:', error);
        res.status(500).json({
            status: 0,
            message: 'Internal Server Error',
        });
    }
};

export default ipWhitelistMiddleware;