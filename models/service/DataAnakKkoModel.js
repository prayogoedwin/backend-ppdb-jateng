// DataAnakKkoModel.js
import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const DataAnakKkos = db.define('ez_cmb_kko', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    satpend_penyelenggara_kko: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    cabang_dinas: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    npsn: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    alamat_satpend: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    nama_calon_murid_baru: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    nisn: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    nik: {
        type: DataTypes.STRING(20),
        allowNull: true
    }
}, {
    freezeTableName: true,
    timestamps: false // Disable automatic createdAt and updatedAt fields
});

export default DataAnakKkos;