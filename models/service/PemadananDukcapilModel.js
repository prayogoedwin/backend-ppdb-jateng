import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const PemadananDukcapil = db.define('ez_pemadanan_dukcapil', {
  peserta_didik_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nik: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nik_ibu: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nik_ayah: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nik_wali: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nama: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nama_ibu: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nama_ayah: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nama_wali: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tgl_kepindahan_anak: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status_kepindahan_anak: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  ket_status_kepindahan_anak: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tgl_kepindahan_ibu: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status_kepindahan_ibu: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  ket_status_kepindahan_ibu: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tgl_kepindahan_ayah: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status_kepindahan_ayah: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  ket_status_kepindahan_ayah: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tgl_kepindahan_wali: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status_kepindahan_wali: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  ket_status_kepindahan_wali: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  shdk_kode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  shdk_name: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  freezeTableName: true,
  timestamps: false,
  id: false // Ini akan mencegah Sequelize menambahkan kolom id
});

export default PemadananDukcapil;
