import WilayahVerDapodiks from '../../models/master/WilayahVerDapodikModel.js';

export const getProvinsi = async (kode_wilayah_prov) => {
    try {
        const provinsi = await WilayahVerDapodiks.findOne({
            where: { kode_wilayah: kode_wilayah_prov },
            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
        });
        return provinsi;
    } catch (error) {
        console.error('Error while fetching provinsi:', error);
        throw error;
    }
};

export const getKabupatenKota = async (kode_wilayah_kab) => {
    try {
        const kabupatenKota = await WilayahVerDapodiks.findOne({
            where: { kode_wilayah: kode_wilayah_kab },
            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
        });
        return kabupatenKota;
    } catch (error) {
        console.error('Error while fetching kabupaten/kota:', error);
        throw error;
    }
};


export const getKecamatan = async (kode_wilayah_kec) => {
    try {
        const kecamatan = await WilayahVerDapodiks.findOne({
            where: { kode_wilayah: kode_wilayah_kec },
            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
        });
        return kecamatan;
    } catch (error) {
        console.error('Error while fetching kecamatan:', error);
        throw error;
    }
};


export const getDesaKelurahan = async (kode_wilayah_des) => {
    try {
        const desaKelurahan = await WilayahVerDapodiks.findOne({
            where: { kode_wilayah: kode_wilayah_des },
            attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah', 'kode_dagri']
        });
        return desaKelurahan;
    } catch (error) {
        console.error('Error while fetching desa/kelurahan:', error);
        throw error;
    }
};
