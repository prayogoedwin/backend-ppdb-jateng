import jwt from 'jsonwebtoken';
import DataUsers from '../models/service/DataUsersModel.js';

// Middleware to check authentication
export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ status: 0, message: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        // console.log('Decoded Token:', decoded); // Log payload token
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(403).json({ status: 0, message: 'Access token expired' });
        } else {
            return res.status(403).json({ status: 0, message: 'Invalid access token' });
        }
    }
};

// Middleware to check authentication
export const authenticateRefreshToken = async (req, res, next) => {
   
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ status: 0, message: 'Refresh token required' });
    }

    try {
        const decodedRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await DataUsers.findByPk(decodedRefresh.userId);



        if (!user) {
            return res.status(403).json({ status: 0, message: 'Invalid refresh token' });
        }

        const newAccessToken = jwt.sign({ userId: user.id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
        user.access_token = newAccessToken;
        await user.save({ fields: ['access_token', 'updated_at'] });

        res.status(200).json({
            status: 1,
            message: 'Access token refreshed',
            accessToken: newAccessToken,
            // decodedRefresh: decodedRefresh.userId,
            // user: user,

        });
    } catch (err) {
        return res.status(403).json({ status: 0, message: 'Invalid refresh token' });
    }

};
