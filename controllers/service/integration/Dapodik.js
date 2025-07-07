import axios from 'axios';
import EzAppKey from '../../../models/config/AppKeyModel.js';
import { redisGet, redisSet } from '../../../redis.js'; // Import the Redis functions

const API_URL = 'http://118.98.237.214'; // ganti dengan URL asli
const USERNAME = 'masthenol@gmail.com';  // ganti dengan username asli
const PASSWORD = 'Set@n2000$';          // ganti dengan password asli

export const callAuthenticateV2 = async (req, res) => {
  const url = `${API_URL}/v1/api-gateway/authenticate/authenticateV2/`;

  const redis_key = `dapodik`; 

  let keyNya = await redisGet(redis_key);

  try {

    if (keyNya) {
            data = JSON.parse(keyNya); // Convert dari string ke objek JS
            console.log(`[CACHE] Found cached maintenance key for ${apiKey}`);
             return res.status(200).json({
                    status: 1,
                    message: 'Token by cache',
                    token: data.token
                });

        } else {

                const response = await axios.get(url, {
                auth: {
                    username: USERNAME,
                    password: PASSWORD,
                },
                headers: {
                    'Content-Type': 'application/json',
                },
                });

                const result = response.data;

                if (result?.statusCode === 200 && result?.data?.token) {
                const token = result.data.token;

                // Update ke EzAppKey
                const key = await EzAppKey.findOne({ where: { nama: 'dapodik' } });

                if (key) {
                    await key.update({
                    apiKey: token,
                    kode_random: `Bearer ${token}`,
                    });
                } else {
                    await EzAppKey.create({
                    nama: 'dapodik',
                    apiKey: token,
                    kode_random: `Bearer ${token}`,
                    });
                }

                await redisSet(
                        redis_key,
                        JSON.stringify(keyNya),
                        process.env.REDIS_EXPIRE_TIME_HARIAN
                    );
                
                return res.status(200).json({
                    status: 1,
                    message: 'Token saved successfully',
                    token: token
                });

                } else {
                return res.status(200).json({
                    status: 0,
                    message: result?.message || 'Unauthorized'
                });
                }
        }
} catch (error) {
    const errMsg = error.response?.data?.message || error.message;
    
    return res.status(200).json({
      status: 0,
      message: errMsg
    });
  }
};