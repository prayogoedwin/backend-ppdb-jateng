import { Sequelize } from "sequelize";
import db from "../../config/Database.js";
import EzWilayahVerDapodiks from '../master/WilayahVerDapodikModel.js';

const { DataTypes } = Sequelize;

const EzSekolahZonasis = db.define('ez_sekolah_zonasi', {
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
        allowNull: false,
    },

    kode_wilayah_kec: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    kode_wilayah_kot: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    kode_wilayah_kot: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    freezeTableName: true,
    timestamps: false, // Nonaktifkan timestamps
});

export default EzSekolahZonasis;

// Di file model SekolahZonasis
EzSekolahZonasis.belongsTo(EzWilayahVerDapodiks, {
  foreignKey: 'kode_wilayah_kec',
  targetKey: 'kode_wilayah',
  as: 'kecamatan'
});

EzSekolahZonasis.belongsTo(EzWilayahVerDapodiks, {
  foreignKey: 'kode_wilayah_kot',
  targetKey: 'kode_wilayah',
  as: 'kota'
});// Di file model SekolahZonasis


