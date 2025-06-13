import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const DataPesertaPrestasiKhusus = db.define('ez_peserta_prestasi_khusus', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nisn: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    sekolah_asal: {
        type: DataTypes.STRING,
        allowNull: false
    },
    sekolah_pilihan: {
        type: DataTypes.STRING,
        allowNull: false
    },
    sekolah_pilihan_npsn: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    program_keahlian: {
        type: DataTypes.STRING,
        allowNull: false
    },
    program_keahlian_sesuai_data: {
     type: DataTypes.STRING,
        allowNull: false
    },
    nama_lengkap: {
       type: DataTypes.STRING,
        allowNull: false
    }
}, {
    freezeTableName: true,
    timestamps: false
});

export default DataPesertaPrestasiKhusus;