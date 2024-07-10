import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const DataAnakMiskins = db.define('ez_anak_miskin', {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
    },
    idjtg: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    nik: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    nama: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    tgllahir: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nama_ibu_kandung: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    prioritas: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    freezeTableName: true,
    timestamps: false, // Nonaktifkan timestamps
});


export default DataAnakMiskins;


