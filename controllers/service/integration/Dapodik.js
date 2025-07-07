import axios from 'axios';
import jwt from 'jsonwebtoken'; // sudah kamu sebutkan terpakai
import EzAppKey from '../../../models/config/AppKeyModel.js';

const API_URL = 'http://118.98.237.214'; // ganti dengan URL asli
const USERNAME = 'masthenol@gmail.com';      // ganti dengan username asli
const PASSWORD = 'Set@n2000$';      // ganti dengan password asli
const TOKEN = '0CFA4030-9EBD-448B-A860-54EE711EA3A3';

export const callAuthenticateV2 = async (req, res) => {
    
  const url = `${API_URL}/v1/api-gateway/authenticate/authenticateV2/`;

  try {
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
        return res.status(200).json({
            status: 1,
            message: 'Token saved successfully'
            token: token
            // text: keyNya.kode_random
        });

    } else {
    
            return res.status(200).json({
                status:0,
                 message: result?.message || 'Unauthorized'
            });

    }
  } catch (error) {
    const errMsg = error.response?.data?.message || error.message;
    
    return res.status(200).json({
                status:0,
                 message: errMsg
    });

  }
};