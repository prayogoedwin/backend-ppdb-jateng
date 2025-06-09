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
    },
    kode_random: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    
}
,{
    freezeTableName: true,
    defaultScope: {
        attributes: {
            exclude: ['kode_random'] // Sembunyikan secara default
        }
    },
    scopes: {
        withKodeRandom: {
            attributes: { include: ['kode_random'] } // Opsional: scope untuk include jika diperlukan
        }
    }
    // tableName: 'ez_app_key', // Definisikan nama tabel di sini
});

// cara manggilnya dengan kode_random
// const result = await EzAppKey.scope('withKodeRandom').findAll();

export default EzAppKey;