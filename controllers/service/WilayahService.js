import WilayahVerDapodiks from '../../models/master/WilayahVerDapodikModel.js';

// export const getProvinsi = async (kode_wilayah_prov) => {
//     try {
//         const provinsi = await WilayahVerDapodiks.findOne({
//             where: { kode_wilayah: kode_wilayah_prov },
//             attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
//         });
//         return provinsi;
//     } catch (error) {
//         console.error('Error while fetching provinsi:', error);
//         throw error;
//     }
// };

export const getProvinsi = async (kode_wilayah_prov) => {
    const redis_key = `wilayah:provinsi:${kode_wilayah_prov}`;
  
    try {
      // 1) Cek Redis
      const cached = await redisGet(redis_key);
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`[CACHE] Provinsi(${kode_wilayah_prov}) →`, data);
        return data;
      }
  
      // 2) Ambil dari DB
      const provinsi = await WilayahVerDapodiks.findOne({
        where: { kode_wilayah: kode_wilayah_prov },
        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
      });
  
      // 3) Simpan ke Redis kalau ketemu
      if (provinsi) {
        const data = provinsi.toJSON();
        await redisSet(
          redis_key,
          JSON.stringify(data),
          process.env.REDIS_EXPIRE_TIME_MASTER
        );
        console.log(`[DB] Provinsi(${kode_wilayah_prov}) →`, data);
        return data;
      }
  
      // 4) Tidak ketemu
      console.log(`[DB] Provinsi(${kode_wilayah_prov}) → null`);
      return null;
    } catch (error) {
      console.error(`Error in getProvinsi(${kode_wilayah_prov}):`, error);
      return null;
    }
  };

// export const getKabupatenKota = async (kode_wilayah_kab) => {
//     try {
//         const kabupatenKota = await WilayahVerDapodiks.findOne({
//             where: { kode_wilayah: kode_wilayah_kab },
//             attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
//         });
//         return kabupatenKota;
//     } catch (error) {
//         console.error('Error while fetching kabupaten/kota:', error);
//         throw error;
//     }
// };

export const getKabupatenKota = async (kode_wilayah_kab) => {
    const redis_key = `wilayah:kabupatenkota:${kode_wilayah_kab}`;
  
    try {
      // 1) Cek Redis
      const cached = await redisGet(redis_key);
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`[CACHE] KabupatenKota(${kode_wilayah_kab}) →`, data);
        return data;
      }
  
      // 2) Ambil dari DB
      const kabupatenKota = await WilayahVerDapodiks.findOne({
        where: { kode_wilayah: kode_wilayah_kab },
        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
      });
  
      // 3) Simpan ke Redis kalau data ditemukan
      if (kabupatenKota) {
        const data = kabupatenKota.toJSON();
        await redisSet(
          redis_key,
          JSON.stringify(data),
          process.env.REDIS_EXPIRE_TIME_MASTER
        );
        console.log(`[DB] KabupatenKota(${kode_wilayah_kab}) →`, data);
        return data;
      }
  
      // 4) Tidak ditemukan
      console.log(`[DB] KabupatenKota(${kode_wilayah_kab}) → null`);
      return null;
    } catch (error) {
      console.error(`Error in getKabupatenKota(${kode_wilayah_kab}):`, error);
      return null;
    }
  };
  


// export const getKecamatan = async (kode_wilayah_kec) => {
//     try {
//         const kecamatan = await WilayahVerDapodiks.findOne({
//             where: { kode_wilayah: kode_wilayah_kec },
//             attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
//         });
//         return kecamatan;
//     } catch (error) {
//         console.error('Error while fetching kecamatan:', error);
//         throw error;
//     }
// };

export const getKecamatan = async (kode_wilayah_kec) => {
    const redis_key = `wilayah:kecamatan:${kode_wilayah_kec}`;
  
    try {
      // 1) Cek Redis
      const cached = await redisGet(redis_key);
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`[CACHE] Kecamatan(${kode_wilayah_kec}) →`, data);
        return data;
      }
  
      // 2) Ambil dari DB
      const kecamatan = await WilayahVerDapodiks.findOne({
        where: { kode_wilayah: kode_wilayah_kec },
        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
      });
  
      // 3) Simpan ke Redis kalau ditemukan
      if (kecamatan) {
        const data = kecamatan.toJSON();
        await redisSet(
          redis_key,
          JSON.stringify(data),
          process.env.REDIS_EXPIRE_TIME_MASTER
        );
        console.log(`[DB] Kecamatan(${kode_wilayah_kec}) →`, data);
        return data;
      }
  
      // 4) Tidak ditemukan
      console.log(`[DB] Kecamatan(${kode_wilayah_kec}) → null`);
      return null;
    } catch (error) {
      console.error(`Error in getKecamatan(${kode_wilayah_kec}):`, error);
      return null;
    }
  };
  


// export const getDesaKelurahan = async (kode_wilayah_des) => {
//     try {
//         const desaKelurahan = await WilayahVerDapodiks.findOne({
//             where: { kode_wilayah: kode_wilayah_des },
//             attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
//         });
//         return desaKelurahan;
//     } catch (error) {
//         console.error('Error while fetching desa/kelurahan:', error);
//         throw error;
//     }
// };

export const getDesaKelurahan = async (kode_wilayah_des) => {
    const redis_key = `wilayah:desakelurahan:${kode_wilayah_des}`;
  
    try {
      // 1) Cek Redis
      const cached = await redisGet(redis_key);
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`[CACHE] DesaKelurahan(${kode_wilayah_des}) →`, data);
        return data;
      }
  
      // 2) Ambil dari DB
      const desaKelurahan = await WilayahVerDapodiks.findOne({
        where: { kode_wilayah: kode_wilayah_des },
        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
      });
  
      // 3) Simpan ke Redis kalau ditemukan
      if (desaKelurahan) {
        const data = desaKelurahan.toJSON();
        await redisSet(
          redis_key,
          JSON.stringify(data),
          process.env.REDIS_EXPIRE_TIME_MASTER
        );
        console.log(`[DB] DesaKelurahan(${kode_wilayah_des}) →`, data);
        return data;
      }
  
      // 4) Tidak ditemukan
      console.log(`[DB] DesaKelurahan(${kode_wilayah_des}) → null`);
      return null;
    } catch (error) {
      console.error(`Error in getDesaKelurahan(${kode_wilayah_des}):`, error);
      return null;
    }
  };
  
