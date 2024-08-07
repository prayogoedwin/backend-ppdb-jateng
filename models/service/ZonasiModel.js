import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const Zonasis = db.define('ez_wilayah_zonasi', {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true, // Add this line
    },
    id_sekolah: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    npsn: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    kode_kecamatan_dapodik: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    kode_kecamatan_dagri: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
},{
    freezeTableName: true,
    timestamps: false, // Nonaktifkan timestamps
});


export default Zonasis;


