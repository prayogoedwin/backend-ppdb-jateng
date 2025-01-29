import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const DataSertifikat = db.define('ez_sertifikat', {
    id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
    },
    kejuaraan_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    nama_kejuaraan: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    tanggal_sertifikat: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    nomor_sertifikat: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    nisn: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    nik: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    url_file: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    app0_or_api1: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    }
}, {
    freezeTableName: true,
    timestamps: false
});

export default DataSertifikat;
