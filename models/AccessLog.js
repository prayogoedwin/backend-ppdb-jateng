// models/AccessLog.js
import { Sequelize } from "sequelize";
import db2 from "../config/Database2.js";

const { DataTypes } = Sequelize;

const AccessLog = db2.define('AccessLog', {
    id: {
        type: DataTypes.INTEGER,
        // autoIncrement: true,
        // primaryKey: true
    },
    url: {
        type: DataTypes.STRING,
        allowNull: false
    },
    akun: {
        type: DataTypes.STRING,
        allowNull: true
    },
    json_data: {
        type: DataTypes.JSON, 
        allowNull: true
    },
    created_by: {
        type: DataTypes.STRING,
        allowNull: true
    },
    created_by_ip: {
        type: DataTypes.STRING,
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'access_logs',
    timestamps: false
});

export default AccessLog;
