// File: middleware/AppKey.js

import EzAppKey from '../models/config/AppKeyModel.js';
import EzAppKeyIntegrator from '../models/service/DataIntegratorModel.js';

export const appKeyMiddleware = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key']; // Mengambil secret key dari header 'x-api-key'
        // const apiKey = 'e86087bd-d805-407e-8e1d-a56c96490545';

        // Cari API Key yang sesuai di database
        const keyNya = await EzAppKey.findOne({
            where: {
                apikey: apiKey
            }
        });

        // Jika tidak ada kunci API yang sesuai, beri response Forbidden
        if (!keyNya) {
            return res.status(403).json({
                status: 0,
                message: 'Forbidden - Your APP Key is not allowed to access this resource',
            });
        }

        // Lanjutkan jika kunci API benar
        next();
    } catch (error) {
        console.error('Error checking APP Key:', error);
        res.status(500).json({
            status: 0,
            message: 'Internal Server Error',
        });
    }
};

export const appKeynyaIntegrator = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key']; // Mengambil secret key dari header 'x-api-key'
        // const apiKey = 'e86087bd-d805-407e-8e1d-a56c96490545';

        // Cari API Key yang sesuai di database
        const keyNya = await EzAppKeyIntegrator.findOne({
            where: {
                xapikey: apiKey
            }
        });

        // Jika tidak ada kunci API yang sesuai, beri response Forbidden
        if (!keyNya) {
            return res.status(403).json({
                status: 0,
                message: 'Forbidden - Your APP Key is not allowed to access this resource',
            });
        }

        // Lanjutkan jika kunci API benar
        next();
    } catch (error) {
        console.error('Error checking APP Key:', error);
        res.status(500).json({
            status: 0,
            message: 'Internal Server Error',
        });
    }
};

