import DataPendaftars from "../../../models/service/DataPendaftarModel.js";
import DataPerangkingans from "../../../models/service/DataPerangkinganModel.js";
import JalurPendaftarans from "../../../models/master/JalurPendaftaranModel.js";
import { redisGet, redisSet } from '../../../redis.js';
import { clearCacheByKeyFunction } from '../../config/CacheControl.js';
import db from '../../../config/Database.js'; // Sesuaikan path berdasarkan struktur folder
import { Op, fn, col, QueryTypes } from 'sequelize';

export const countPendaftar = async (req, res) => {
  const sekolah_id = req.params.sekolah_id
  const redis_key = 'RekapAdminsAll'

  try {
    // Check if the data is already in cache
    // const cacheNya = await redisGet(redis_key);
    const cacheNya = false;
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

      const genderCountsArray = await DataPendaftars.findAll({
          attributes: [
              'jenis_kelamin',
              [fn('COUNT', col('jenis_kelamin')), 'rekap_jenis_kelamin']
          ],
          where: {
              [Op.or]: [
                  { is_delete: { [Op.is]: null } },
                  { is_delete: 0 }
              ]
          },
          group: ['jenis_kelamin'],
          raw: true
       });
       // Konversi hasil array ke objek
      // const genderCounts = genderCountsArray.reduce((acc, item) => {
      //   acc[item.jenis_kelamin] = item.rekap_jenis_kelamin;
      //   return acc;
      // }, {});

      const genderCounts = genderCountsArray.reduce((acc, item) => {
        const key = item.jenis_kelamin.trim(); // Hilangkan spasi dari jenis_kelamin
        acc[key] = item.rekap_jenis_kelamin;
        return acc;
       }, {});

      // Count the ve
      // rified pendaftar
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

       // Count the activated pendaftar
       const dikirimDukcapilCount = await DataPendaftars.count({
        where: {
          [Op.or]: [
            { is_delete: { [Op.is]: null } },
            { is_delete: 0 }
          ],
          verifikasikan_disdukcapil: 1
        }
      });

       // Count the activated pendaftar
       const verifDukcapilCount = await DataPendaftars.count({
        where: {
          [Op.or]: [
            { is_delete: { [Op.is]: null } },
            { is_delete: 0 }
          ],
          is_verified_disdukcapil: 1
        }
      });


       let wherePerangkinganSmaCount = {
          [Op.or]: [
            { is_delete: { [Op.is]: null } },
            { is_delete: 0 }
          ],
          bentuk_pendidikan_id: 13
        };

        if (sekolah_id != 0) {
          wherePerangkinganSmaCount.sekolah_tujuan_id = sekolah_id;
        }

        //statistik pendaftara sekolah
        const perangkinganSmaCount = await DataPerangkingans.count({
          where: wherePerangkinganSmaCount
        });
      
        let wherePerangkinganSmkCount = {
          [Op.or]: [
            { is_delete: { [Op.is]: null } },
            { is_delete: 0 }
          ],
          bentuk_pendidikan_id: 15
        };

        if (sekolah_id != 0) {
          wherePerangkinganSmkCount.sekolah_tujuan_id = sekolah_id;
        }

        const perangkinganSmkCount = await DataPerangkingans.count({
          where: wherePerangkinganSmkCount
        });


        //ini untuk perangkingan query manual

        let sekolahFilter = ""; // Default tanpa filter
        let sekolahFilter2 = ""; // Default tanpa filter

        if (sekolah_id != 0) {
            sekolahFilter = `WHERE sekolah_tujuan_id = ${sekolah_id}`; 
        }

        const queryJenjangPpendidikan = `
            SELECT 
                SUM(CASE 
                    WHEN jalur_pendaftaran_id IN (1, 2, 3, 4, 5) THEN 1 
                    ELSE 0 
                END) AS jumlah_sma,
                SUM(CASE 
                    WHEN jalur_pendaftaran_id IN (6, 7, 8, 9) THEN 1 
                    ELSE 0 
                END) AS jumlah_smk
            FROM ez_perangkingan
             ${sekolahFilter};
        `;

        const [jenjangPpendidikan] = await db.query(queryJenjangPpendidikan, { raw: true, type: db.QueryTypes.SELECT });

        //jalur

        if (sekolah_id != 0) {
          sekolahFilter2 = `AND sekolah_tujuan_id = ${sekolah_id}`; 
         }
        const queryjaluePendaftaranSMA = `
            SELECT 
                jp.id AS jalur_pendaftaran_id,
                jp.nama,
                COALESCE(COUNT(p.id), 0) AS jumlah_pendaftar
            FROM ez_jalur_pendaftaran jp
            LEFT JOIN ez_perangkingan p ON jp.id = p.jalur_pendaftaran_id  ${sekolahFilter2}
           WHERE jp.id IN (1, 2, 3, 4, 5)
            GROUP BY jp.id, jp. nama
            ORDER BY jp.id;
        `;

        const jaluePendaftaranSMA = await db.query(queryjaluePendaftaranSMA, { 
          raw: true, 
          type: db.QueryTypes.SELECT 
      });

      const queryjaluePendaftaranSMK = `
          SELECT 
              jp.id AS jalur_pendaftaran_id,
              jp.nama,
              COALESCE(COUNT(p.id), 0) AS jumlah_pendaftar
          FROM ez_jalur_pendaftaran jp
          LEFT JOIN ez_perangkingan p ON jp.id = p.jalur_pendaftaran_id  ${sekolahFilter2}
        WHERE jp.id IN (6, 7, 8, 9)
          GROUP BY jp.id, jp. nama
          ORDER BY jp.id;
      `;

      const jaluePendaftaranSMK = await db.query(queryjaluePendaftaranSMK, { 
        raw: true, 
        type: db.QueryTypes.SELECT 
      });

      const result = {
        pendaftar: pendaftarCount,
        pendaftar_jenis_kelamin: genderCounts,
        pendaftar_terverifikasi: verifiedCount,
        pendaftar_aktivasi: activatedCount,
        pendaftar_dikirim_kecapil: dikirimDukcapilCount,
        pendaftar_diverif_capil: verifDukcapilCount,
        daftar_sma: perangkinganSmaCount,
        daftar_smk: perangkinganSmkCount,
        jenjang_pendidikan: jenjangPpendidikan,
        jalur_pendaftaran_sma: jaluePendaftaranSMA, 
        jalur_pendaftaran_smk: jaluePendaftaranSMK
     
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


