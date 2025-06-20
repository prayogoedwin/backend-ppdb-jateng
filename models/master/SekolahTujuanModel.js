import { Sequelize } from "sequelize";
import db from "../../config/Database.js";
import EzWilayahVerDapodiks from '../master/WilayahVerDapodikModel.js';

const { DataTypes } = Sequelize;

const EzSekolahTujuans = db.define('ez_sekolah_tujuan', {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
    },
    npsn: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    nama: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    kode_wilayah: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    kode_wilayah_kec: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    kode_wilayah_kot: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    kode_wilayah_prov: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    bentuk_pendidikan_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    status_sekolah: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    alamat_jalan: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    desa_kelurahan: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    rt: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    rw: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    lat: {
        type: DataTypes.DOUBLE,
        allowNull: true,
    },
    lng: {
        type: DataTypes.DOUBLE,
        allowNull: true,
    },
    daya_tampung: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kuota_zonasi: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kuota_zonasi_persentase: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kuota_zonasi_khusus: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kuota_zonasi_khusus_persentase: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kuota_afirmasi: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kuota_afirmasi_persentase: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kuota_prestasi: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kuota_prestasi_persentase: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kuota_prestasi_khusus: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kuota_prestasi_khusus_persentase: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kuota_pto: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kuota_pto_persentase: {
        type: DataTypes.INTEGER,
        allowNull: true,
    }
}, {
    freezeTableName: true,
    timestamps: false, // Nonaktifkan timestamps
});

export default EzSekolahTujuans;
EzSekolahTujuans.belongsTo(EzWilayahVerDapodiks, { as: 'data_wilayah', foreignKey: 'kode_wilayah', targetKey: 'kode_wilayah' }); // Asosiasi dengan Wilayah
EzSekolahTujuans.belongsTo(EzWilayahVerDapodiks, { as: 'data_wilayah_kota', foreignKey: 'kode_wilayah_kot', targetKey: 'kode_wilayah' });


