import { Sequelize } from "sequelize";
import db from "../../config/Database.js";
import EzBentukPendidikan from './BentukPendidikanModel.js';

const { DataTypes } = Sequelize;

const EzSekolahs = db.define('ez_sekolah', {
    id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
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
    }
}, {
    freezeTableName: true
});

EzSekolahs.belongsTo(EzBentukPendidikan, { as: 'bentuk_pendidikan', foreignKey: 'bentuk_pendidikan_id' });

export default EzSekolahs;
