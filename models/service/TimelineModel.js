import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const Timelines = db.define('ez_timeline', {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true, // Add this line
    },
    nama: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    keterangan: {
        type: DataTypes.STRING,
        allowNull: true,
    },
   
    tanggal_buka: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    tanggal_tutup: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    status: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    createdby: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    updatedby: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    icon: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    url_route: {
        type: DataTypes.STRING,
        allowNull: true,
    },
},{
    freezeTableName: true,
    timestamps: false, // Nonaktifkan timestamps
});


export default Timelines;


