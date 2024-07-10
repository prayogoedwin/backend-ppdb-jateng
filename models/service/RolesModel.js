import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const DataRoles = db.define('ez_roles', {
    id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true, // Add this line
    },
    nama: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    } 
},{
    freezeTableName: true,
    timestamps: false, // Nonaktifkan timestamps
});


export default DataRoles;


