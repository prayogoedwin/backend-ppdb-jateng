import { Sequelize } from 'sequelize';
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const EzIntegrator = db.define('ez_integrator', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING
  },
  password_: {
    type: DataTypes.STRING
  },
  xapikey: {
    type: DataTypes.STRING
  },
  nama_instansi: {
    type: DataTypes.STRING
  },
  tabletarget: {
    type: DataTypes.STRING
  },
  login_ip: {
    type: DataTypes.STRING
  },
  access_token: {
    type: DataTypes.TEXT
  },
  access_token_refresh: {
    type: DataTypes.TEXT
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  is_deleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_by: {
    type: DataTypes.STRING
  },
  created_at: {
    type: DataTypes.DATE
  },
  updated_by: {
    type: DataTypes.STRING
  },
  updated_at: {
    type: DataTypes.DATE
  },
  deleted_by: {
    type: DataTypes.STRING
  },
  deleted_at: {
    type: DataTypes.DATE
  }
}, {
  freezeTableName: true,
  timestamps: false // supaya Sequelize tidak auto-tambah createdAt/updatedAt default
});

export default EzIntegrator;
