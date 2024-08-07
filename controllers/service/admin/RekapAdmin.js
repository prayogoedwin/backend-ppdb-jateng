import DataPendaftars from "../../../models/service/DataPendaftarModel.js";
import { redisGet, redisSet } from '../../../redis.js';
import { clearCacheByKeyFunction } from '../../config/CacheControl.js';
import { Op } from 'sequelize';

export const countPendaftar = async (req, res) => {
  const redis_key = 'RekapAdminsAll'

  try {
    // Check if the data is already in cache
    const cacheNya = await redisGet(redis_key);
    if (cacheNya) {
      // Return the cached data
      res.status(200).json({
        success: true,
        message: 'Data di ambil dari cache',
        data: JSON.parse(cacheNya)
      });
    } else {
      // Count the total pendaftar
      const pendaftarCount = await DataPendaftars.count({
        where: {
          [Op.or]: [
            { is_delete: { [Op.is]: null } },
            { is_delete: 0 }
          ]
        }
      });

      // Count the verified pendaftar
      const verifiedCount = await DataPendaftars.count({
        where: {
          [Op.or]: [
            { is_delete: { [Op.is]: null } },
            { is_delete: 0 }
          ],
          is_verified: 1
        }
      });

      // Count the activated pendaftar
      const activatedCount = await DataPendaftars.count({
        where: {
          [Op.or]: [
            { is_delete: { [Op.is]: null } },
            { is_delete: 0 }
          ],
          is_active: 1
        }
      });

      // Structure the result
      const result = {
        pendaftar: pendaftarCount,
        pendaftar_terverifikasi: verifiedCount,
        pendaftar_aktivasi: activatedCount
      };

      // Store the result in Redis cache
      await redisSet(redis_key, JSON.stringify(result));

      // Return the result
      res.status(200).json({
        success: true,
        message: "Berhasil hitung data",
        data: result
      });
    }
  } catch (error) {
    console.error("Error hitung data:", error);
    res.status(500).json({
      success: false,
      message: "Error hitung data",
      error: error.message
    });
  }
};
