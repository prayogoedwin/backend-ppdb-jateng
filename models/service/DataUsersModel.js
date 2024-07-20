import { Sequelize} from "sequelize";
import db from "../../config/Database.js";
import EzRoles from '../service/RolesModel.js';
import { encodeId } from '../../middleware/EncodeDecode.js'; // Import fungsi encodeId

const { DataTypes } = Sequelize;

const DataUsers = db.define('ez_users', {
    id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true, // Add this line
    },
    id_: {
        type: DataTypes.VIRTUAL,
        get() {
            return encodeId(this.getDataValue('id')); // Menggunakan fungsi encodeId untuk mendapatkan nilai encoded
        }
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
        type: DataTypes.STRING,
        allowNull: true,
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: true,
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
    }
    
}, {
    freezeTableName: true,
    timestamps: false, // Nonaktifkan timestamps
});

DataUsers.belongsTo(EzRoles, { as: 'data_roles', foreignKey: 'role_'});
export default DataUsers;


