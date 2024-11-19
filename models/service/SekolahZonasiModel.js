import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const SekolahZonasis = db.define('ez_sekolah_zonasi', {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true, // Add this line
    },
    sekolah_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    npsn: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nama: {
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
    }
},{
    freezeTableName: true,
    timestamps: false, // Nonaktifkan timestamps
});


export default SekolahZonasis;


