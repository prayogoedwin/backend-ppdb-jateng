import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const DataIntegrator = db.define('ez_integrator', {
    id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    password_: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    xapikey: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    nama_instansi: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    tabletarget: {
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
    updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    deleted_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    is_deleted: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    }
}, {
    freezeTableName: true,
    timestamps: false
});

export default DataIntegrator;
