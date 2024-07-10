import DataUsers from '../../../models/service/DataUsersModel.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult, check } from 'express-validator';

export const generateSuperAdmin = async (req, res) => {
    try {
        // Hash password
        const hashedPassword = await bcrypt.hash('10Juli2024GOgoo=', 10);

        const newUser = await DataUsers.create({
            username: 'superadmin@localhost.com',
            email: 'superadmin@localhost.com',
            nama: 'Super Admin',
            whatsapp: '081111111111',
            password_: hashedPassword , // Sesuaikan dengan password yang di-hash
            role_: 86,
            is_active: 1,
        }, {
            fields: ['username', 'email', 'nama', 'whatsapp', 'password_', 'role_', 'is_active'] // Tentukan kolom-kolom yang ingin Anda masukkan nilainya
        });

        res.status(200).json({
            status: 1,
            message: 'Berhasil',
        });

    } catch (error) {
        console.error('Error creating super admin:', error);
    }
};



// User login
export const loginAdmin = [

    async (req, res) => {

        const { username, password } = req.body;

        try {
            // Check if user exists
            const user = await DataUsers.findOne({
                where: {
                    username,
                    is_active: 1,
                    is_delete: 0
                }
            });

            if (!user) {
                return res.status(400).json({ status: 0, message: 'Invalid username or password 1' });
            }

            // Compare password
            const isMatch = await bcrypt.compare(password, user.password_);
            if (!isMatch) {
                return res.status(400).json({ status: 0, message: 'Invalid username or password 2' });
            }

            // Generate tokens
            const accessToken = jwt.sign({ userId: user.id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            const refreshToken = jwt.sign({ userId: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

            // Save tokens to user record
            user.access_token = accessToken;
            user.access_token_refresh = refreshToken;
            await user.save({ fields: ['access_token', 'access_token_refresh', 'updated_at'] });

            res.status(200).json({
                status: 1,
                message: 'Login successful',
                data: {
                    userId: user.id,
                    username: user.username,
                    role: user.role,
                    accessToken,
                    refreshToken
                }
            });
        } catch (error) {
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }
    }
];