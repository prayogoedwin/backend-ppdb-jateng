import DataPendaftars from "../../../models/service/DataPendaftarModel.js";
import { redisGet, redisSet } from '../../../redis.js';
import { clearCacheByKeyFunction } from '../../config/CacheControl.js';
import { Op } from 'sequelize';

export const countPendaftar = async (req, res) => {
  const redis_key = 'CountPendaftars'
  const nisn = req.body.bentuk_pendidikan_id;

  try {
    // Check if the data is already in cache
    const cacheNya = await redisGet(redis_key);
    if (cacheNya) {
      // Return the cached data
      res.status(200).json({
        status: 1,
        message: 'Data di ambil dari cache',
        data: JSON.parse(cacheNya)
      });
    } else {
      // Count the data from the database
      const count = await DataPendaftars.count({
        where: {
          deleted_at: {
            [Op.is]: null
          }
        }
      });

      // Store the result in Redis cache
      await redisSet(redis_key, JSON.stringify({ count }));

      // Return the result
      res.status(200).json({
        success: true,
        message: "Count of pendaftar retrieved successfully",
        data: { count }
      });
    }
  } catch (error) {
    console.error("Error counting pendaftar:", error);
    res.status(500).json({
      success: false,
      message: "Error counting pendaftar",
      error: error.message
    });
  }
};