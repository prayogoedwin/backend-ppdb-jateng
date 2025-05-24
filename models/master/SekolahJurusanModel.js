import { Sequelize } from "sequelize";
import db from "../../config/Database.js";
import EzSekolahTujuans from '../master/SekolahTujuanModel.js';

const { DataTypes } = Sequelize;

const EzSekolahJurusan = db.define('EzSekolahJurusan', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_sekolah_tujuan: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sekolah_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    npsn: {
        type: DataTypes.STRING,
      allowNull: true,
    },
    id_jurusan: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    daya_tampung: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    kuota_jarak_terdekat: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    kuota_jarak_terdekat_persentase: {
        type: DataTypes.DOUBLE,
      allowNull: true,
    },
    kuota_afirmasi: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    kuota_afirmasi_persentase: {
        type: DataTypes.DOUBLE,
      allowNull: true,
    },
    kuota_prestasi: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    kuota_prestasi_persentase: {
        type: DataTypes.DOUBLE,
      allowNull: true,
    },
    kuota_pto: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    kuota_pto_persentase: {
        type: DataTypes.DOUBLE,
      allowNull: true,
    },
    kuota_prestasi_khusus: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    kuota_prestasi_khusus_persentase: {
        type: DataTypes.DOUBLE,
      allowNull: true,
    },
    jumlah_rombel: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    jumlah_peserta_per_rombel: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    deleted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    nama_jurusan: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_larang_buta_warna: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'ez_sekolah_jurusan',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });
  
export default EzSekolahJurusan;
EzSekolahJurusan.belongsTo(EzSekolahTujuans, {
    foreignKey: 'id_sekolah_tujuan',
    as: 'sekolahTujuan',
  });


