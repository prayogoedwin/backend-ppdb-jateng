// File: models/config/EzIpWhitelist.js

import { Sequelize } from 'sequelize';
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const IpWhitelist = db.define('ez_ip_whitelist', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    nama: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    ip: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    createdby: {
        type: DataTypes.STRING,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updatedby: {
        type: DataTypes.STRING,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
},{
    freezeTableName: true,
    // tableName: 'ez_ip_whitelist', // Definisikan nama tabel di sini
});

export default IpWhitelist;
