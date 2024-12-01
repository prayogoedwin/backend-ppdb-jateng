import { Sequelize } from "sequelize";
import db from "../../config/Database.js";
import EzWilayahVerDapodiks from './WilayahVerDapodikModel.js';

const { DataTypes } = Sequelize;

const GeoJsons = db.define('geo_data', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
    },
    objectid: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    provinsi: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    kecamatan: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    kabupaten: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    desa: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    kode_dagri: {
        type: DataTypes.STRING,
        allowNull: true,
    },  
    geometry: {
        type: DataTypes.JSON,
        allowNull: false,
    },
    coordinates: {
        type: DataTypes.JSON,
        allowNull: false,
    },
    kode_dapodik: {
        type: DataTypes.STRING,
        allowNull: true,
    }
}, {
    freezeTableName: true,
    timestamps: false // Menonaktifkan kolom createdAt dan updatedAt
});
export default GeoJsons;
