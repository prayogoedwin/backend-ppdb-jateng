import { DataTypes } from 'sequelize';
import db2 from "../config/Database2.js";

const BlockIp = db2.define('block_ip', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  ipnya: {
    type: DataTypes.STRING(45),
    allowNull: false
  },
  tanggal_block: {
    type: DataTypes.DATEONLY,
    allowNull: false
  }
}, {
  freezeTableName: true,
  timestamps: false // Kalau kamu tidak mau fields createdAt dan updatedAt otomatis
});

export default BlockIp;
