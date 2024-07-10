import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const DataAnakPantis = db.define('ez_anak_panti', {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
    },
    nmkab: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    nik: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nama: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    nokk: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nama_panti: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    alamat_panti: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    status_panti: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    freezeTableName: true,
    timestamps: false, // Nonaktifkan timestamps
});


export default DataAnakPantis;


