import axios from 'axios';
import jwt from 'jsonwebtoken'; // sudah kamu sebutkan terpakai
import EzAppKey from '../../../models/config/AppKeyModel.js';

const API_URL = 'http://118.98.237.214'; // ganti dengan URL asli
const USERNAME = 'masthenol@gmail.com';      // ganti dengan username asli
const PASSWORD = 'Set@n2000$';      // ganti dengan password asli
const TOKEN = '0CFA4030-9EBD-448B-A860-54EE711EA3A3';

export const callAuthenticateV2 = async () => {

    return {
        success: 1,
        status: 403,
        message: result?.message || 'Unauthorized',
      };


//   const url = `${API_URL}/v1/api-gateway/authenticate/authenticateV2/`;

//   try {
//     const response = await axios.get(url, {
//       auth: {
//         username: USERNAME,
//         password: PASSWORD,
//       },
//       headers: {
//         'Content-Type': 'application/json',
//       },
//     });

//     const result = response.data;

//     if (result?.statusCode === 200 && result?.data?.token) {
//       const token = result.data.token;

//       // Update ke EzAppKey
//       const key = await EzAppKey.findOne({ where: { nama: 'dapodik' } });

//       if (key) {
//         await key.update({
//           apiKey: token,
//           kode_random: `Bearer ${token}`,
//         });
//       } else {
//         await EzAppKey.create({
//           nama: 'dapodik',
//           apiKey: token,
//           kode_random: `Bearer ${token}`,
//         });
//       }

//       return {
//         success: true,
//         status: 200,
//         message: 'Token saved successfully',
//         token: token,
//       };
//     } else {
//       return {
//         success: false,
//         status: 403,
//         message: result?.message || 'Unauthorized',
//       };
//     }
//   } catch (error) {
//     const errMsg = error.response?.data?.message || error.message;
//     return {
//       success: false,
//       status: error.response?.status || 500,
//       message: errMsg,
//     };
//   }
};