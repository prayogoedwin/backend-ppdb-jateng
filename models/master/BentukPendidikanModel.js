// models/master/BentukPendidikan.js
import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const EzBentukPendidikan = db.define('ez_bentuk_pendidikan', {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
    },
    nama: {
        type: DataTypes.STRING,
        allowNull: false,
    }
}, {
    freezeTableName: true,
    timestamps: false, // Nonaktifkan timestamps
});

export default EzBentukPendidikan;
