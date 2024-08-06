import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const EzWilayahVerDapodiks = db.define('ez_wilayah_dapodik', {
    kode_wilayah: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
    },
    nama: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    id_level_wilayah: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    mst_kode_wilayah: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    kode_dagri: {
        type: DataTypes.STRING,
        allowNull: false,
    }
}, {
    freezeTableName: true,
    timestamps: false, // Nonaktifkan timestamps
});


export default EzWilayahVerDapodiks;
