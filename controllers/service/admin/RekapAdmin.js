import DataPendaftars from "../../../models/service/DataPendaftarModel.js";
import DataUsers from "../../../models/service/DataUsersModel.js";
import DataPerangkingans from "../../../models/service/DataPerangkinganModel.js";
import DataPesertaDidiks from '../../../models/service/DataPesertaDidikModel.js';
import WilayahVerDapodik from '../../../models/master/WilayahVerDapodikModel.js';
import SekolahTujuanModel from '../../../models/master/SekolahTujuanModel.js';

import { redisGet, redisSet } from '../../../redis.js';
import { clearCacheByKeyFunction } from '../../config/CacheControl.js';
import db from '../../../config/Database.js'; // Sesuaikan path berdasarkan struktur folder
import { Op, fn, col, QueryTypes } from 'sequelize';

import { getProvinsi, getKabupatenKota, getKecamatan, getDesaKelurahan } from '../../service/WilayahService.js';

export const countPendaftar_BAK = async (req, res) => {
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
          pendaftar_dalam: pendaftarDalam,
          pendaftar_luar: pendaftarLuar,
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


export const countPendaftar = async (req, res) => {
  // const sekolah_id = req.params.sekolah_id;
  const { sekolah_id, start_date, end_date } = req.params;
  const redis_key = `RekapAdminsAll_${sekolah_id}_${start_date}_${end_date}`;

  try {
      // const cacheNya = false;
      const cacheNya = await redisGet(redis_key); // ambil dari Redis
      if (cacheNya) {
         console.log(`[CACHE] →`, redis_key);
          return res.status(200).json({
              success: true,
              message: 'Data diambil dari cache',
              data: JSON.parse(cacheNya)
          });
      }

      
      console.log(`[DB] →`, redis_key);
      let whereClause = {
          [Op.or]: [{ is_delete: { [Op.is]: null } }, { is_delete: 0 }]
      };

      if (start_date && end_date) {
          whereClause.created_at = { [Op.between]: [start_date, end_date] };
      }

      const pendaftarCount = await DataPendaftars.count({ where: whereClause });

      const whereDalam = {
        ...whereClause,
        sekolah_asal_id: 1
      };
      
      const pendaftarDalam = await DataPendaftars.count({
        where: whereDalam
      });

      const whereLuar = {
        ...whereClause,
        sekolah_asal_id: { [Op.in]: [2, 9] }
      };
      
      const pendaftarLuar = await DataPendaftars.count({
        where: whereLuar
      });

      const genderCountsArray = await DataPendaftars.findAll({
          attributes: [
              'jenis_kelamin',
              [fn('COUNT', col('jenis_kelamin')), 'rekap_jenis_kelamin']
          ],
          where: whereClause,
          group: ['jenis_kelamin'],
          raw: true
      });

      const genderCounts = genderCountsArray.reduce((acc, item) => {
          const key = item.jenis_kelamin.trim();
          acc[key] = item.rekap_jenis_kelamin;
          return acc;
      }, {});

      
      let verifiedCount = 0;
      if (sekolah_id != 0) {
         verifiedCount = await DataPendaftars.count({
              where: {
                  is_verified: 1,
                  [Op.or]: [{ is_delete: { [Op.is]: null } }, { is_delete: 0 }]
              },
              include: [
                {
                    model: DataUsers,
                    as: "diverifikasi_oleh", // Sesuai alias di model
                    required: true,
                    include: [
                        {
                            model: SekolahTujuanModel,
                            as: "asal_sekolah_verifikator", // Sesuai alias di model
                            required: true,
                            where: { id: sekolah_id }
                        }
                    ]
                }
              ]
          });
      }else{
         verifiedCount = await DataPendaftars.count({
          where: { ...whereClause, is_verified: 1 }
        });
      }

      let activatedCount = 0
      if (sekolah_id != 0) {

        activatedCount = await DataPendaftars.count({
          where: {
              is_active: 1,
              [Op.or]: [{ is_delete: { [Op.is]: null } }, { is_delete: 0 }]
          },
          include: [
            {
                model: DataUsers,
                as: "diverifikasi_oleh", // Sesuai alias di model
                required: true,
                include: [
                    {
                        model: SekolahTujuanModel,
                        as: "asal_sekolah_verifikator", // Sesuai alias di model
                        required: true,
                        where: { id: sekolah_id }
                    }
                ]
            }
        ]
      });

      }else{
        activatedCount = await DataPendaftars.count({
            where: { ...whereClause, is_active: 1 }
        });
      }

      let  dikirimDukcapilCount = 0;
      if (sekolah_id != 0) {

        dikirimDukcapilCount = await DataPendaftars.count({
          where: {
              verifikasikan_disdukcapil: 1,
              [Op.or]: [{ is_delete: { [Op.is]: null } }, { is_delete: 0 }]
          },
          include: [
            {
                model: DataUsers,
                as: "diverifikasi_oleh", // Sesuai alias di model
                required: true,
                include: [
                    {
                        model: SekolahTujuanModel,
                        as: "asal_sekolah_verifikator", // Sesuai alias di model
                        required: true,
                        where: { id: sekolah_id }
                    }
                ]
            }
        ]
      });

      }else{
        dikirimDukcapilCount = await DataPendaftars.count({
            where: { ...whereClause, verifikasikan_disdukcapil: 1 }
        });
      }

      let verifDukcapilCount = 0;
      if (sekolah_id != 0) {

        verifDukcapilCount = await DataPendaftars.count({
          where: {
            is_verified_disdukcapil: 1,
              [Op.or]: [{ is_delete: { [Op.is]: null } }, { is_delete: 0 }]
          },
          include: [
            {
                model: DataUsers,
                as: "diverifikasi_oleh", // Sesuai alias di model
                required: true,
                include: [
                    {
                        model: SekolahTujuanModel,
                        as: "asal_sekolah_verifikator", // Sesuai alias di model
                        required: true,
                        where: { id: sekolah_id }
                    }
                ]
            }
        ]
      });

      }else{
        verifDukcapilCount = await DataPendaftars.count({
            where: { ...whereClause, is_verified_disdukcapil: 1 }
        });
      }

      let wherePerangkinganSmaCount = { ...whereClause, bentuk_pendidikan_id: 13 };
      let wherePerangkinganSmkCount = { ...whereClause, bentuk_pendidikan_id: 15 };

      if (sekolah_id != 0) {
          wherePerangkinganSmaCount.sekolah_tujuan_id = sekolah_id;
          wherePerangkinganSmkCount.sekolah_tujuan_id = sekolah_id;
      }

      const perangkinganSmaCount = await DataPerangkingans.count({ where: wherePerangkinganSmaCount });
      const perangkinganSmkCount = await DataPerangkingans.count({ where: wherePerangkinganSmkCount });

      let sekolahFilter = sekolah_id != 0 ? `WHERE sekolah_tujuan_id = ${sekolah_id}` : "";
      let sekolahFilter2 = sekolah_id != 0 ? `AND sekolah_tujuan_id = ${sekolah_id}` : "";

      if (start_date && end_date) {
          const dateFilter = `AND created_at BETWEEN '${start_date}' AND '${end_date}'`;
          sekolahFilter += ` ${dateFilter}`;
          sekolahFilter2 += ` ${dateFilter}`;
      }

      const queryJenjangPpendidikan = `
          SELECT 
              SUM(CASE WHEN jalur_pendaftaran_id IN (1, 2, 3, 4, 5) THEN 1 ELSE 0 END) AS jumlah_sma,
              SUM(CASE WHEN jalur_pendaftaran_id IN (6, 7, 8, 9) THEN 1 ELSE 0 END) AS jumlah_smk
          FROM ez_perangkingan
          ${sekolahFilter};
      `;

      const [jenjangPpendidikan] = await db.query(queryJenjangPpendidikan, { raw: true, type: db.QueryTypes.SELECT });

      const queryjaluePendaftaranSMA = `
          SELECT 
              jp.id AS jalur_pendaftaran_id,
              jp.nama,
              COALESCE(COUNT(p.id), 0) AS jumlah_pendaftar
          FROM ez_jalur_pendaftaran jp
          LEFT JOIN ez_perangkingan p ON jp.id = p.jalur_pendaftaran_id ${sekolahFilter2}
          WHERE jp.id IN (1, 2, 3, 4, 5)
          GROUP BY jp.id, jp.nama
          ORDER BY jp.id;
      `;

      const jaluePendaftaranSMA = await db.query(queryjaluePendaftaranSMA, { raw: true, type: db.QueryTypes.SELECT });

      const queryjaluePendaftaranSMK = `
          SELECT 
              jp.id AS jalur_pendaftaran_id,
              jp.nama,
              COALESCE(COUNT(p.id), 0) AS jumlah_pendaftar
          FROM ez_jalur_pendaftaran jp
          LEFT JOIN ez_perangkingan p ON jp.id = p.jalur_pendaftaran_id ${sekolahFilter2}
          WHERE jp.id IN (6, 7, 8, 9)
          GROUP BY jp.id, jp.nama
          ORDER BY jp.id;
      `;

      const jaluePendaftaranSMK = await db.query(queryjaluePendaftaranSMK, { raw: true, type: db.QueryTypes.SELECT });

      const result = {
          pendaftar: pendaftarCount,
          pendaftar_dalam: pendaftarDalam,
          pendaftar_luar: pendaftarLuar,
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

      // await redisSet(redis_key, JSON.stringify(result));
      await redisSet(
        redis_key,
        JSON.stringify(result),
        process.env.REDIS_EXPIRE_TIME_SOURCE_REKAP
      );

      res.status(200).json({
          success: true,
          message: "Berhasil hitung data",
          data: result
      });

  } catch (error) {
      console.error("Error hitung data:", error);
      res.status(500).json({
          success: false,
          message: "Error hitung data",
          error: error.message
      });
  }
};


export const countCheckedPesertaDidiks = async (req, res) => {
  try {
      const count = await DataPesertaDidiks.count({
          where: {
              is_checked: 1
          }
      });
      // Return the result
      res.status(200).json({
        success: true,
        message: "Berhasil hitung data",
        data: count
      });
  } catch (error) {
      console.error("Error hitung data:", error);
      res.status(500).json({
        success: false,
        message: "Error hitung data",
        error: error.message
      });
  }
};

export const listCheckedPesertaDidiks = async (req, res) => {
  try {
      const pesertaDidiks = await DataPesertaDidiks.findAll({
          where: {
              is_checked: 1
          },
          attributes: ['nisn', 'nama', 'nama_sekolah', 'checked_at'],
          include: [
              {
                  model: WilayahVerDapodik,
                  as: 'data_wilayah',
                  attributes: ['mst_kode_wilayah', 'nama'] // Ambil mst_kode_wilayah dan nama wilayah
              }
          ]
      });

      // Inisialisasi array untuk menyimpan data lengkap
      const result = [];

      for (const pesertaDidik of pesertaDidiks) {
          let dataKec = {};
          let dataKabKota = {};
          let dataProvinsi = {};

          // Pengecekan wilayah
          if (pesertaDidik.data_wilayah) {
              dataKec = await getKecamatan(pesertaDidik.data_wilayah.mst_kode_wilayah);
          }

          if (dataKec.mst_kode_wilayah) {
              dataKabKota = await getKabupatenKota(dataKec.mst_kode_wilayah);
          }

          if (dataKabKota.mst_kode_wilayah) {
              dataProvinsi = await getProvinsi(dataKabKota.mst_kode_wilayah);
          }

          // Menyusun data hasil
          result.push({
              nisn: pesertaDidik.nisn,
              nama: pesertaDidik.nama,
              nama_sekolah: pesertaDidik.nama_sekolah,
              checked_at: pesertaDidik.checked_at,
              data_wilayah_kec: dataKec,
              data_wilayah_kabkota: dataKabKota,
              data_wilayah_provinsi: dataProvinsi
          });
      }

      // Mengembalikan hasil
      res.status(200).json({
          success: true,
          message: "Data peserta didik berhasil diambil",
          data: result
      });
  } catch (error) {
      console.error("Error mengambil data peserta didik:", error);
      res.status(500).json({
          success: false,
          message: "Error mengambil data peserta didik",
          error: error.message
      });
  }
};


