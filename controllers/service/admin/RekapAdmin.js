import DataPendaftars from "../../../models/service/DataPendaftarModel.js";
import DataPerangkingans from "../../../models/service/DataPerangkinganModel.js";
import { redisGet, redisSet } from '../../../redis.js';
import { clearCacheByKeyFunction } from '../../config/CacheControl.js';
import { Op } from 'sequelize';

export const countPendaftar = async (req, res) => {
  const sekolah_id = req.params.sekolah_id;
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

       // Count the total pendaftar
      //  const perangkinganSmaCount = await DataPerangkingans.count({
      //   where: {
      //     [Op.or]: [
      //       { is_delete: { [Op.is]: null } },
      //       { is_delete: 0 }
      //     ],
      //     bentuk_pendidikan_id: 13
      //   }
      // });
      // Define your where clause with the initial conditions
      let whereClause = {
        [Op.or]: [
          { is_delete: { [Op.is]: null } },
          { is_delete: 0 }
        ],
        is_verified: 1
      };

      // Add the sekolah_id condition if it's not an empty string
      if (sekolah_id !== '') {
        whereClause.sekolah_id = sekolah_id;
      }

      // Count the verified pendaftar
      const perangkinganSmaCount = await DataPendaftars.count({
        where: whereClause
      });


       // Count the total pendaftar
      //  const perangkinganSmkCount = await DataPerangkingans.count({
      //   where: {
      //     [Op.or]: [
      //       { is_delete: { [Op.is]: null } },
      //       { is_delete: 0 }
      //     ],
      //     bentuk_pendidikan_id: 15
      //   }
      // });

      let whereClause2 = {
        [Op.or]: [
          { is_delete: { [Op.is]: null } },
          { is_delete: 0 }
        ],
        bentuk_pendidikan_id: 15
      };

      // Add the sekolah_id condition if it's not an empty string
      if (sekolah_id !== '') {
        whereClause2.sekolah_id = sekolah_id;
      }

      // Count the verified pendaftar
      const perangkinganSmkCount = await DataPendaftars.count({
        where: whereClause2
      });

      // Structure the result
      const result = {
        pendaftar: pendaftarCount,
        pendaftar_terverifikasi: verifiedCount,
        pendaftar_aktivasi: activatedCount,
        daftar_sma: perangkinganSmaCount,
        daftar_smk: perangkinganSmkCount,
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
