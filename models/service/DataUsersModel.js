import { Sequelize} from "sequelize";
import db from "../../config/Database.js";
import EzRoles from '../service/RolesModel.js';
import SekolahTujuanModel from '../master/SekolahTujuanModel.js';


const { DataTypes } = Sequelize;

const DataUsers = db.define('ez_users', {
    id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true, // Add this line
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    nama: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    whatsapp: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    password_: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    role_: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    access_token: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    access_token_refresh: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    sekolah_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    cabdin_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kabkota_id: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        get() {
            // Ambil nilai mentah yang sudah di-parse sebagai string
            const rawValue = this.getDataValue('created_at');
            return rawValue ? 
              new Date(rawValue).toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              }).replace(/\//g, '-').replace(',', '') : 
              null;
          }
    },
    created_by: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    created_by_ip: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        get() {
            // Ambil nilai mentah yang sudah di-parse sebagai string
            const rawValue = this.getDataValue('updated_at');
            return rawValue ? 
              new Date(rawValue).toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              }).replace(/\//g, '-').replace(',', '') : 
              null;
          }
    },
    updated_by: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    activated_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    activated_by: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    is_active: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    deleted_by: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    is_delete: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    otp_expiration: {
        type: DataTypes.DATE, // Gunakan DataTypes.DATE untuk TIMESTAMP
        allowNull: true,      // Sesuaikan dengan kebutuhan Anda
        defaultValue: null    // Atur defaultValue jika diperlukan
    },
    is_login: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    login_at: {
        type: DataTypes.DATE,
        allowNull: true,
        get() {
            // Ambil nilai mentah yang sudah di-parse sebagai string
            const rawValue = this.getDataValue('login_at');
            return rawValue ? 
              new Date(rawValue).toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              }).replace(/\//g, '-').replace(',', '') : 
              null;
          }
    },
    login_ip: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    
}, {
    freezeTableName: true,
    timestamps: false, // Nonaktifkan timestamps
});

DataUsers.belongsTo(EzRoles, { as: 'data_role', foreignKey: 'role_'});
DataUsers.belongsTo(SekolahTujuanModel, { as: 'asal_sekolah_verifikator', foreignKey: 'sekolah_id', targetKey: 'id'});
DataUsers.belongsTo(SekolahTujuanModel, { as: 'asal_sekolah_admin', foreignKey: 'sekolah_id', targetKey: 'id'});
export default DataUsers;


