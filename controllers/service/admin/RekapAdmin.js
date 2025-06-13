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

      // if (start_date) {

      //   if (start_date && end_date) {
      //     whereClause.created_at = { [Op.between]: [start_date, end_date] };
      //   }else if (start_date) {
      //     whereClause.created_at = { [Op.gte]: start_date };
      //   }
      // }

      if (start_date && end_date) {
        // Range tanggal (antara start_date dan end_date)
        whereClause.created_at = { 
            [Op.between]: [
                new Date(`${start_date} 00:00:00`), 
                new Date(`${end_date} 23:59:59`)
            ] 
        };
      } else if (start_date) {
          // Hanya tanggal tertentu (misal: 2025-06-05)
          const nextDay = new Date(start_date);
          nextDay.setDate(nextDay.getDate() + 1); // Tambah 1 hari (untuk batas atas)
      
          whereClause.created_at = { 
              [Op.gte]: new Date(`${start_date} 00:00:00`), // Mulai dari awal hari
              [Op.lt]: nextDay // Sampai sebelum hari berikutnya
          };
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


      const whereKejuaraan = {
        ...whereClause,
        kejuaraan_id: { [Op.notIn]: [0, 9] }
      };
      const pendaftarKejuaraan = await DataPendaftars.count({
        where: whereKejuaraan
      });

      const whereOrganisasi = {
        ...whereClause,
        nilai_organisasi: { [Op.notIn]: [0, 9] }
      };
      const pendaftarOrganisasi = await DataPendaftars.count({
        where: whereOrganisasi
      });

      const whereAbk = {
        ...whereClause,
        kebutuhan_khusus_id: {
          [Op.and]: [
            { [Op.ne]: 0 },  // Tidak sama dengan 0
            { [Op.ne]: 9 }   // Tidak sama dengan 9
          ]
        }
      };
      const pendaftarAbk = await DataPendaftars.count({
        where: whereAbk
      });

      const whereMiskin = {
        ...whereClause,
        is_anak_keluarga_tidak_mampu: '1'
      };
      const pendaftarMiskin = await DataPendaftars.count({
        where: whereMiskin
      });

      const whereAnakGuru = {
        ...whereClause,
        is_anak_guru_jateng: '1'
      };
      const pendaftarAnakGuru = await DataPendaftars.count({
        where: whereAnakGuru
      });

      const whereAts = {
        ...whereClause,
        is_tidak_sekolah: '1'
      };
      const pendaftarAts = await DataPendaftars.count({
        where: whereAts
      });

      const whereAdaKepindahan = {
        ...whereClause,
        status_kepindahan: { 
          [Op.ne]: 0 // Tidak sama dengan 0
        }
      };
      const pendaftarAdaKepindahan = await DataPendaftars.count({
        where: whereAdaKepindahan
      });

      const whereAdaKepindahanIbu = {
        ...whereClause,
        status_kepindahan_ibu: { 
          [Op.ne]: 0 // Tidak sama dengan 0
        }
      };
      const pendaftarAdaKepindahanIbu = await DataPendaftars.count({
        where: whereAdaKepindahanIbu
      });

      const whereAdaKepindahanAyah = {
        ...whereClause,
        status_kepindahan_ayah: { 
          [Op.ne]: 0 // Tidak sama dengan 0
        }
      };
      const pendaftarAdaKepindahanAyah = await DataPendaftars.count({
        where: whereAdaKepindahanAyah
      });

      const whereDomisiliKK = {
        ...whereClause,
        status_domisili: 1
      };
      const pendaftarDomisiliKK = await DataPendaftars.count({
        where: whereDomisiliKK
      });


      const whereDomisiliMutasi = {
        ...whereClause,
        status_domisili: 2
      };
      const pendaftarDomisiliMutasi = await DataPendaftars.count({
        where: whereDomisiliMutasi
      });

      const whereDomisiliPondok = {
        ...whereClause,
        status_domisili: 3
      };
      const pendaftarDomisiliPondok = await DataPendaftars.count({
        where: whereDomisiliPondok
      });

      const whereDomisiliPanti = {
        ...whereClause,
        status_domisili: 4
      };
      const pendaftarDomisiliPanti = await DataPendaftars.count({
        where: whereDomisiliPanti
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

      let  countVerifikasikan1 = 0;
      if (sekolah_id != 0) {

        countVerifikasikan1 = await DataPendaftars.count({
          // where: {
          //     verifikasikan_disdukcapil: 1,
          //     is_verified: { [Op.ne]: 1 },
          //     [Op.or]: [{ is_delete: { [Op.is]: null } }, { is_delete: 0 }]
          // },
          where: { ...whereClause, verifikasikan_disdukcapil: 1 },
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
        countVerifikasikan1 = await DataPendaftars.count({
            where: { 
              ...whereClause, 
              verifikasikan_disdukcapil: 1,
             }
        });
      }

      let countVerifikasikan1AndVerified1 = 0;
      if (sekolah_id != 0) {

        countVerifikasikan1AndVerified1 = await DataPendaftars.count({
          // where: {
          //   is_verified_disdukcapil: 1,
          //     [Op.or]: [{ is_delete: { [Op.is]: null } }, { is_delete: 0 }]
          // },
          where: { 
              ...whereClause, 
              verifikasikan_disdukcapil: 1,
              is_verified_disdukcapil: 1,
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
        countVerifikasikan1AndVerified1 = await DataPendaftars.count({
            where: { ...whereClause, verifikasikan_disdukcapil: 1, is_verified_disdukcapil: 1 }
        });
      }

      let countVerifikasikan1AndVerifiedCapil0AndVerified1 = 0;
      if (sekolah_id != 0) {

        countVerifikasikan1AndVerifiedCapil0AndVerified1 = await DataPendaftars.count({
          // where: {
          //   is_verified_disdukcapil: 1,
          //     [Op.or]: [{ is_delete: { [Op.is]: null } }, { is_delete: 0 }]
          // },
          where: { 
              ...whereClause, 
              verifikasikan_disdukcapil: 1,
              is_verified_disdukcapil: 0,
              is_verified : 1
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
        countVerifikasikan1AndVerifiedCapil0AndVerified1 = await DataPendaftars.count({ 
          where: { 
              ...whereClause, 
              verifikasikan_disdukcapil: 1,
              is_verified_disdukcapil: 0,
              is_verified : 1
          },

        });
      }

      let countVerifikasikan1AndMasihRevisiCMB = 0;
      if (sekolah_id != 0) {

        countVerifikasikan1AndMasihRevisiCMB = await DataPendaftars.count({
          // where: {
          //   is_verified_disdukcapil: 1,
          //     [Op.or]: [{ is_delete: { [Op.is]: null } }, { is_delete: 0 }]
          // },
          where: { 
              ...whereClause, 
              verifikasikan_disdukcapil: 1,
              is_verified_disdukcapil: 0,
              is_verified: { 
                    [Op.and]: [
                        { [Op.ne]: 0 },
                        { [Op.ne]: 1 }
                    ]
                }
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
        countVerifikasikan1AndMasihRevisiCMB = await DataPendaftars.count({
            where: { ...whereClause, 
              verifikasikan_disdukcapil: 1,
              is_verified_disdukcapil: 0,
              is_verified: { 
                        [Op.and]: [
                            { [Op.ne]: 0 },
                            { [Op.ne]: 1 }
                        ]
                    }
            }
        });
      }

       let countVerifikasikan1AndVerifiedNullOr0 = 0;
        if (sekolah_id != 0) {

          countVerifikasikan1AndVerifiedNullOr0 = await DataPendaftars.count({
            // where: {
            //   is_verified_disdukcapil: 1,
            //     [Op.or]: [{ is_delete: { [Op.is]: null } }, { is_delete: 0 }]
            // },
            where: { 
                ...whereClause, 
                verifikasikan_disdukcapil: 1,
                is_verified_disdukcapil: 0,
                is_verified: 0
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
          countVerifikasikan1AndVerifiedNullOr0 = await DataPendaftars.count({
              where: { ...whereClause, 
                verifikasikan_disdukcapil: 1,
                is_verified_disdukcapil: 0,
                is_verified: 0
                // is_verified: { 
                //           [Op.and]: [
                //               { [Op.ne]: 0 },
                //               { [Op.ne]: 1 }
                //           ]
                //       }
              }
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

      // let sekolahFilter = sekolah_id != 0 ? `WHERE sekolah_tujuan_id = ${sekolah_id}` : "";
      // let sekolahFilter2 = sekolah_id != 0 ? `AND sekolah_tujuan_id = ${sekolah_id}` : "";

      // if (start_date && end_date) {
      //     const dateFilter = `AND created_at BETWEEN '${start_date}' AND '${end_date}'`;
      //     sekolahFilter += ` ${dateFilter}`;
      //     sekolahFilter2 += ` ${dateFilter}`;
      // }

      let sekolahFilter = sekolah_id != 0 ? `WHERE sekolah_tujuan_id = ${sekolah_id}` : "";
      let sekolahFilter2 = sekolah_id != 0 ? `AND sekolah_tujuan_id = ${sekolah_id}` : "";

      if (start_date && end_date) {
        const dateFilter = `created_at BETWEEN '${start_date} 00:00:00' AND '${end_date} 23:59:59'`;
        
        // Handle kasus WHERE/AND dengan benar
        sekolahFilter += sekolahFilter ? ` AND ${dateFilter}` : ` WHERE ${dateFilter}`;
        sekolahFilter2 += ` AND ${dateFilter}`;
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

          pendaftar_kejuaraan: pendaftarKejuaraan,
          pendaftar_organisasi: pendaftarOrganisasi,

          pendaftar_abk: pendaftarAbk,
          pendaftar_miskin: pendaftarMiskin,

          pendaftar_anak_guru: pendaftarAnakGuru,
          pendaftar_ats: pendaftarAts,
          
          pendaftar_ada_kepindahan: pendaftarAdaKepindahan,
          pendaftar_ada_kepindahan_ibu: pendaftarAdaKepindahanIbu,
          pendaftar_ada_kepindahan_ayah: pendaftarAdaKepindahanAyah,

          pendaftar_domisili_kk: pendaftarDomisiliKK,
          pendaftar_domisili_mutasi: pendaftarDomisiliMutasi,
          pendaftar_domisili_pondok: pendaftarDomisiliPondok,
          pendaftar_domisili_panti: pendaftarDomisiliPanti,

          pendaftar_jenis_kelamin: genderCounts,
          pendaftar_terverifikasi: verifiedCount,
          pendaftar_aktivasi: activatedCount,
          // pendaftar_dikirim_kecapil: dikirimDukcapilCount,
          // pendaftar_diverif_capil: verifDukcapilCount,
          daftar_sma: perangkinganSmaCount,
          daftar_smk: perangkinganSmkCount,
          jenjang_pendidikan: jenjangPpendidikan,
          jalur_pendaftaran_sma: jaluePendaftaranSMA,
          jalur_pendaftaran_smk: jaluePendaftaranSMK,

          masuk_dukcapil: countVerifikasikan1,
          masuk_dukcapil_sudah_aksi: countVerifikasikan1AndVerified1,
          masuk_dukcapil_belum_aksi_tp_sudah_clear_oleh_operator_sekolah: countVerifikasikan1AndVerifiedCapil0AndVerified1, //sempat di ajukan capil, belum di aksi, sudah di verifikasi operator
          masuk_dukcapil_tapi_sedang_dikembalikan_ke_cmb_oleh_operator_sekolah : countVerifikasikan1AndMasihRevisiCMB,
          masuk_dukcapil_menunggu_aksi: countVerifikasikan1AndVerifiedNullOr0


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

export const countPendaftarPerTanggal = async (req, res) => {

      const redis_key = `RekapPertanggalPendaftar`;

      try {
      
        const cacheNya = await redisGet(redis_key); // ambil dari Redis
        if (cacheNya) {
          console.log(`[CACHE] →`, redis_key);
            return res.status(200).json({
                success: true,
                message: 'Data diambil dari cache',
                data: JSON.parse(cacheNya)
            });
        }
        // Mengambil semua data pendaftar yang tidak dihapus
        const allData = await DataPendaftars.findAll({
            where: {
                is_delete: 0
            },
            attributes: [
                [sequelize.fn('DATE', sequelize.col('created_at')), 'tanggal'],
                [sequelize.fn('COUNT', sequelize.col('*')), 'ajuan_akun'],
                [sequelize.literal(`COUNT(CASE WHEN sekolah_asal_id = 1 THEN 1 END)`), 'dalam_provinsi'],
                [sequelize.literal(`COUNT(CASE WHEN sekolah_asal_id = 2 THEN 1 END)`), 'luar_provinsi'],
                [sequelize.literal(`COUNT(CASE WHEN is_anak_keluarga_tidak_mampu = '1' THEN 1 END)`), 'Anak_keluarga_tidak_mampu'],
                [sequelize.literal(`COUNT(CASE WHEN status_domisili = 3 THEN 1 END)`), 'anak_pondok'],
                [sequelize.literal(`COUNT(CASE WHEN is_tidak_sekolah = '1' THEN 1 END)`), 'ats'],
                [sequelize.literal(`COUNT(CASE WHEN is_anak_panti = '1' THEN 1 END)`), 'anak_panti'],
                [sequelize.literal(`COUNT(CASE WHEN is_anak_guru_jateng = '1' THEN 1 END)`), 'anak_guru'],
                [sequelize.literal(`COUNT(CASE WHEN status_domisili = 2 THEN 1 END)`), 'domisili_mutasi'],
                [sequelize.literal(`COUNT(CASE WHEN is_verified = 1 THEN 1 END)`), 'terverifikasi'],
                [sequelize.literal(`COUNT(CASE WHEN is_verified = 1 AND is_active = 1 THEN 1 END)`), 'teraktivasi']
            ],
            group: [sequelize.fn('DATE', sequelize.col('created_at'))],
            order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
            raw: true
        });

        await redisSet(
          redis_key,
          JSON.stringify(allData),
          process.env.REDIS_EXPIRE_TIME_SOURCE_REKAP
        );

        return res.status(200).json({
            success: true,
            message: "Berhasil hitung data",
            data: allData
        });

        // return allData;
    } catch (error) {
        console.error("Error hitung data:", error);
        return res.status(500).json({
            success: false,
            message: "Error hitung data",
            error: error.message
        });
    }

}

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

export const countPendaftarFrontendBAK = async (req, res) => {
  // const sekolah_id = req.params.sekolah_id;
  const redis_key = `RekapAdminsAllFrontend`;

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

      // if (start_date && end_date) {
      //     whereClause.created_at = { [Op.between]: [start_date, end_date] };
      // }

      const pendaftarCount = await DataPendaftars.count({ where: whereClause });

      // const whereDalam = {
      //   ...whereClause,
      //   sekolah_asal_id: 1
      // };
      
      // const pendaftarDalam = await DataPendaftars.count({
      //   where: whereDalam
      // });

      // const whereLuar = {
      //   ...whereClause,
      //   sekolah_asal_id: { [Op.in]: [2, 9] }
      // };
      
      
      // const pendaftarLuar = await DataPendaftars.count({
      //   where: whereLuar
      // });


      // const whereKejuaraan = {
      //   ...whereClause,
      //   kejuaraan_id: { [Op.notIn]: [0, 9] }
      // };
      // const pendaftarKejuaraan = await DataPendaftars.count({
      //   where: whereKejuaraan
      // });

      // const whereOrganisasi = {
      //   ...whereClause,
      //   nilai_organisasi: { [Op.notIn]: [0, 9] }
      // };
      // const pendaftarOrganisasi = await DataPendaftars.count({
      //   where: whereOrganisasi
      // });

      // const whereAbk = {
      //   ...whereClause,
      //   kebutuhan_khusus_id: {
      //     [Op.and]: [
      //       { [Op.ne]: 0 },  // Tidak sama dengan 0
      //       { [Op.ne]: 9 }   // Tidak sama dengan 9
      //     ]
      //   }
      // };
      // const pendaftarAbk = await DataPendaftars.count({
      //   where: whereAbk
      // });

      // const whereMiskin = {
      //   ...whereClause,
      //   is_anak_keluarga_tidak_mampu: '1'
      // };
      // const pendaftarMiskin = await DataPendaftars.count({
      //   where: whereMiskin
      // });

      // const whereAdaKepindahan = {
      //   ...whereClause,
      //   status_kepindahan: { 
      //     [Op.ne]: 0 // Tidak sama dengan 0
      //   }
      // };
      // const pendaftarAdaKepindahan = await DataPendaftars.count({
      //   where: whereAdaKepindahan
      // });

      // const whereAdaKepindahanIbu = {
      //   ...whereClause,
      //   status_kepindahan_ibu: { 
      //     [Op.ne]: 0 // Tidak sama dengan 0
      //   }
      // };
      // const pendaftarAdaKepindahanIbu = await DataPendaftars.count({
      //   where: whereAdaKepindahanIbu
      // });

      // const whereAdaKepindahanAyah = {
      //   ...whereClause,
      //   status_kepindahan_ayah: { 
      //     [Op.ne]: 0 // Tidak sama dengan 0
      //   }
      // };
      // const pendaftarAdaKepindahanAyah = await DataPendaftars.count({
      //   where: whereAdaKepindahanAyah
      // });

      // const whereDomisiliKK = {
      //   ...whereClause,
      //   status_domisili: 1
      // };
      // const pendaftarDomisiliKK = await DataPendaftars.count({
      //   where: whereDomisiliKK
      // });


      // const whereDomisiliMutasi = {
      //   ...whereClause,
      //   status_domisili: 2
      // };
      // const pendaftarDomisiliMutasi = await DataPendaftars.count({
      //   where: whereDomisiliMutasi
      // });

      // const whereDomisiliPondok = {
      //   ...whereClause,
      //   status_domisili: 3
      // };
      // const pendaftarDomisiliPondok = await DataPendaftars.count({
      //   where: whereDomisiliPondok
      // });

      // const whereDomisiliPanti = {
      //   ...whereClause,
      //   status_domisili: 4
      // };
      // const pendaftarDomisiliPanti = await DataPendaftars.count({
      //   where: whereDomisiliPanti
      // });

      // const genderCountsArray = await DataPendaftars.findAll({
      //     attributes: [
      //         'jenis_kelamin',
      //         [fn('COUNT', col('jenis_kelamin')), 'rekap_jenis_kelamin']
      //     ],
      //     where: whereClause,
      //     group: ['jenis_kelamin'],
      //     raw: true
      // });

      // const genderCounts = genderCountsArray.reduce((acc, item) => {
      //     const key = item.jenis_kelamin.trim();
      //     acc[key] = item.rekap_jenis_kelamin;
      //     return acc;
      // }, {});

      
      // let verifiedCount = 0;
      // if (sekolah_id != 0) {
      //    verifiedCount = await DataPendaftars.count({
      //         where: {
      //             is_verified: 1,
      //             [Op.or]: [{ is_delete: { [Op.is]: null } }, { is_delete: 0 }]
      //         },
      //         include: [
      //           {
      //               model: DataUsers,
      //               as: "diverifikasi_oleh", // Sesuai alias di model
      //               required: true,
      //               include: [
      //                   {
      //                       model: SekolahTujuanModel,
      //                       as: "asal_sekolah_verifikator", // Sesuai alias di model
      //                       required: true,
      //                       where: { id: sekolah_id }
      //                   }
      //               ]
      //           }
      //         ]
      //     });
      // }else{
      //    verifiedCount = await DataPendaftars.count({
      //     where: { ...whereClause, is_verified: 1 }
      //   });
      // }

      // let activatedCount = 0
      // if (sekolah_id != 0) {

      //   activatedCount = await DataPendaftars.count({
      //     where: {
      //         is_active: 1,
      //         [Op.or]: [{ is_delete: { [Op.is]: null } }, { is_delete: 0 }]
      //     },
      //     include: [
      //       {
      //           model: DataUsers,
      //           as: "diverifikasi_oleh", // Sesuai alias di model
      //           required: true,
      //           include: [
      //               {
      //                   model: SekolahTujuanModel,
      //                   as: "asal_sekolah_verifikator", // Sesuai alias di model
      //                   required: true,
      //                   where: { id: sekolah_id }
      //               }
      //           ]
      //       }
      //   ]
      // });

      // }else{
      //   activatedCount = await DataPendaftars.count({
      //       where: { ...whereClause, is_active: 1 }
      //   });
      // }

      // let  dikirimDukcapilCount = 0;
      // if (sekolah_id != 0) {

      //   dikirimDukcapilCount = await DataPendaftars.count({
      //     where: {
      //         verifikasikan_disdukcapil: 1,
      //         [Op.or]: [{ is_delete: { [Op.is]: null } }, { is_delete: 0 }]
      //     },
      //     include: [
      //       {
      //           model: DataUsers,
      //           as: "diverifikasi_oleh", // Sesuai alias di model
      //           required: true,
      //           include: [
      //               {
      //                   model: SekolahTujuanModel,
      //                   as: "asal_sekolah_verifikator", // Sesuai alias di model
      //                   required: true,
      //                   where: { id: sekolah_id }
      //               }
      //           ]
      //       }
      //   ]
      // });

      // }else{
      //   dikirimDukcapilCount = await DataPendaftars.count({
      //       where: { ...whereClause, verifikasikan_disdukcapil: 1 }
      //   });
      // }

      // let verifDukcapilCount = 0;
      // if (sekolah_id != 0) {

      //   verifDukcapilCount = await DataPendaftars.count({
      //     where: {
      //       is_verified_disdukcapil: 1,
      //         [Op.or]: [{ is_delete: { [Op.is]: null } }, { is_delete: 0 }]
      //     },
      //     include: [
      //       {
      //           model: DataUsers,
      //           as: "diverifikasi_oleh", // Sesuai alias di model
      //           required: true,
      //           include: [
      //               {
      //                   model: SekolahTujuanModel,
      //                   as: "asal_sekolah_verifikator", // Sesuai alias di model
      //                   required: true,
      //                   where: { id: sekolah_id }
      //               }
      //           ]
      //       }
      //   ]
      // });

      // }else{
      //   verifDukcapilCount = await DataPendaftars.count({
      //       where: { ...whereClause, is_verified_disdukcapil: 1 }
      //   });
      // }

      // let wherePerangkinganSmaCount = { ...whereClause, bentuk_pendidikan_id: 13 };
      // let wherePerangkinganSmkCount = { ...whereClause, bentuk_pendidikan_id: 15 };

      // if (sekolah_id != 0) {
      //     wherePerangkinganSmaCount.sekolah_tujuan_id = sekolah_id;
      //     wherePerangkinganSmkCount.sekolah_tujuan_id = sekolah_id;
      // }

      // const perangkinganSmaCount = await DataPerangkingans.count({ where: wherePerangkinganSmaCount });
      // const perangkinganSmkCount = await DataPerangkingans.count({ where: wherePerangkinganSmkCount });

      // let sekolahFilter = sekolah_id != 0 ? `WHERE sekolah_tujuan_id = ${sekolah_id}` : "";
      // let sekolahFilter2 = sekolah_id != 0 ? `AND sekolah_tujuan_id = ${sekolah_id}` : "";

      // if (start_date && end_date) {
      //     const dateFilter = `AND created_at BETWEEN '${start_date}' AND '${end_date}'`;
      //     sekolahFilter += ` ${dateFilter}`;
      //     sekolahFilter2 += ` ${dateFilter}`;
      // }

      // const queryJenjangPpendidikan = `
      //     SELECT 
      //         SUM(CASE WHEN jalur_pendaftaran_id IN (1, 2, 3, 4, 5) THEN 1 ELSE 0 END) AS jumlah_sma,
      //         SUM(CASE WHEN jalur_pendaftaran_id IN (6, 7, 8, 9) THEN 1 ELSE 0 END) AS jumlah_smk
      //     FROM ez_perangkingan
      //     ${sekolahFilter};
      // `;

      // const [jenjangPpendidikan] = await db.query(queryJenjangPpendidikan, { raw: true, type: db.QueryTypes.SELECT });

      // const queryjaluePendaftaranSMA = `
      //     SELECT 
      //         jp.id AS jalur_pendaftaran_id,
      //         jp.nama,
      //         COALESCE(COUNT(p.id), 0) AS jumlah_pendaftar
      //     FROM ez_jalur_pendaftaran jp
      //     LEFT JOIN ez_perangkingan p ON jp.id = p.jalur_pendaftaran_id ${sekolahFilter2}
      //     WHERE jp.id IN (1, 2, 3, 4, 5)
      //     GROUP BY jp.id, jp.nama
      //     ORDER BY jp.id;
      // `;

      // const jaluePendaftaranSMA = await db.query(queryjaluePendaftaranSMA, { raw: true, type: db.QueryTypes.SELECT });

      // const queryjaluePendaftaranSMK = `
      //     SELECT 
      //         jp.id AS jalur_pendaftaran_id,
      //         jp.nama,
      //         COALESCE(COUNT(p.id), 0) AS jumlah_pendaftar
      //     FROM ez_jalur_pendaftaran jp
      //     LEFT JOIN ez_perangkingan p ON jp.id = p.jalur_pendaftaran_id ${sekolahFilter2}
      //     WHERE jp.id IN (6, 7, 8, 9)
      //     GROUP BY jp.id, jp.nama
      //     ORDER BY jp.id;
      // `;

      // const jaluePendaftaranSMK = await db.query(queryjaluePendaftaranSMK, { raw: true, type: db.QueryTypes.SELECT });

      const result = {
          pendaftar: pendaftarCount,
          // pendaftar_dalam: pendaftarDalam,
          // pendaftar_luar: pendaftarLuar,

          // pendaftar_kejuaraan: pendaftarKejuaraan,
          // pendaftar_organisasi: pendaftarOrganisasi,

          // pendaftar_abk: pendaftarAbk,
          // pendaftar_miskin: pendaftarMiskin,
          // pendaftar_ada_kepindahan: pendaftarAdaKepindahan,
          // pendaftar_ada_kepindahan_ibu: pendaftarAdaKepindahanIbu,
          // pendaftar_ada_kepindahan_ayah: pendaftarAdaKepindahanAyah,

          // pendaftar_domisili_kk: pendaftarDomisiliKK,
          // pendaftar_domisili_mutasi: pendaftarDomisiliMutasi,
          // pendaftar_domisili_pondok: pendaftarDomisiliPondok,
          // pendaftar_domisili_panti: pendaftarDomisiliPanti,

          // pendaftar_jenis_kelamin: genderCounts,
          // pendaftar_terverifikasi: verifiedCount,
          // pendaftar_aktivasi: activatedCount,
          // pendaftar_dikirim_kecapil: dikirimDukcapilCount,
          // pendaftar_diverif_capil: verifDukcapilCount,
          // daftar_sma: perangkinganSmaCount,
          // daftar_smk: perangkinganSmkCount,
          // jenjang_pendidikan: jenjangPpendidikan,
          // jalur_pendaftaran_sma: jaluePendaftaranSMA,
          // jalur_pendaftaran_smk: jaluePendaftaranSMK
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

export const countPendaftarFrontend = async (req, res) => {
  // const sekolah_id = req.params.sekolah_id;
  const redis_key = `RekapAdminsAllFrontend`;

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

      const pendaftarCount = await DataPendaftars.count({ where: whereClause });

      let wherePerangkinganSmaCount = { ...whereClause, bentuk_pendidikan_id: 13 };
      let wherePerangkinganSmkCount = { ...whereClause, bentuk_pendidikan_id: 15 };

      const perangkinganSmaCount = await DataPerangkingans.count({ where: wherePerangkinganSmaCount });
      const perangkinganSmkCount = await DataPerangkingans.count({ where: wherePerangkinganSmkCount });

      const result = {
          pendaftar: pendaftarCount,
          daftar_sma: perangkinganSmaCount,
          daftar_smk: perangkinganSmkCount,
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

export const pendaftarHarian = async (req, res) => {

  try {

    const query = `
            SELECT
                DATE(created_at) AS tanggal,
                COUNT(*) AS ajuan_akun,
                COUNT(CASE WHEN sekolah_asal_id = 1 THEN 1 END) AS dalam_provinsi,
                COUNT(CASE WHEN sekolah_asal_id = 2 THEN 1 END) AS luar_provinsi,
                COUNT(CASE WHEN is_anak_keluarga_tidak_mampu = '1' THEN 1 END) AS Anak_keluarga_tidak_mampu,
                COUNT(CASE WHEN status_domisili = 3 THEN 1 END) AS anak_pondok,
                COUNT(CASE WHEN is_tidak_sekolah = '1' THEN 1 END) AS ats,
                COUNT(CASE WHEN is_anak_panti = '1' THEN 1 END) AS anak_panti,
                COUNT(CASE WHEN is_anak_guru_jateng = '1' THEN 1 END) AS anak_guru,
                COUNT(CASE WHEN status_domisili = 2 THEN 1 END) AS domisili_mutasi,
                COUNT(CASE WHEN is_verified = 1 THEN 1 END) AS terverifikasi,
                COUNT(CASE WHEN is_verified = 1 AND is_active = 1 THEN 1 END) AS teraktivasi
            FROM
                ez_pendaftar
            WHERE
                is_delete = 0
            GROUP BY
                DATE(created_at)
            ORDER BY
                DATE(created_at) ASC
        `;

        const [results] = await db.query(query);
        
        res.json({
            status: 1,
            message: 'Data statistik pendaftaran harian berhasil diambil',
            data: results,

        });
    
  } catch (error) {

    console.error("Error hitung data:", error);
      res.status(500).json({
          status: 0,
          message: "Error hitung data",
          error: error.message
      });
    
  }

}


