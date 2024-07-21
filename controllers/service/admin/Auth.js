import DataUsers from '../../../models/service/DataUsersModel.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

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
                    // username,
                    [Sequelize.Op.or]: [
                        { username: username },
                        { email: username },
                        { whatsapp: username },
                    ],
                    is_active: 1,
                    is_delete: 0
                }
            });

            if (!user) {
                return res.status(200).json({ status: 0, message: 'User / Password Salah 1' });
            }

            // Compare password
            const isMatch = await bcrypt.compare(password, user.password_);
            if (!isMatch) {
                return res.status(200).json({ status: 0, message: 'User / Password Salah 2' });
            }

            // Generate tokens
            const accessToken = jwt.sign({ userId: user.id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: process.env.ACCESS_TOKEN_SECRET_EXPIRE_TIME  });
            const refreshToken = jwt.sign({ userId: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: process.env.REFRESH_TOKEN_SECRET_EXPIRE_TIME  });

            // Save tokens to user record
            user.access_token = accessToken;
            user.access_token_refresh = refreshToken;
            await user.save({ fields: ['access_token', 'access_token_refresh', 'updated_at'] });

            res.status(200).json({
                status: 1,
                message: 'Berhasil masuk',
                data: {
                    userId: user.id,
                    username: user.username,
                    role: user.role_,
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


// User logout
export const logoutAdmin = [

    async (req, res) => {
        const { userId } = req.body;

        try {
            // Check if user exists
            const user = await DataUsers.findOne({
                where: {
                    id: userId,
                    is_active: 1,
                    is_delete: 0
                }
            });

            if (!user) {
                return res.status(400).json({ status: 0, message: 'Data tidak ditemukan' });
            }

            // Invalidate tokens
            user.access_token = null;
            user.access_token_refresh = null;
            await user.save({ fields: ['access_token', 'access_token_refresh', 'updated_at'] });

            res.status(200).json({
                status: 1,
                message: 'Berhasil keluar',
            });
        } catch (error) {
            res.status(500).json({
                status: 0,
                message: error.message,
            });
        }
    }
];