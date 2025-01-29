import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const DataAnakGurus = db.define('anak_asn_gtt_ptt', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      id_dikdaya: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      npsn: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      nama_sekolah: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      kabkota: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      nama_asn: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      status: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      nip: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      nik: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      nama_cpd: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      nisn_cpd: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      nik_cpd: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      no_sk: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      no_kk: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      created_by: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
}, {
    freezeTableName: true,
    timestamps: false, // Nonaktifkan timestamps
});


export default DataAnakGurus;