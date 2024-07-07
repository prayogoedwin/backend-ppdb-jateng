import { Sequelize } from 'sequelize';
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const EzAppKey = db.define('ez_app_key', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    nama: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    apikey: {
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
    }
}
,{
    freezeTableName: true,
    // tableName: 'ez_app_key', // Definisikan nama tabel di sini
});

export default EzAppKey;