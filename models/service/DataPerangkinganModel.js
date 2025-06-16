import { DataTypes } from 'sequelize';
import db from "../../config/Database.js";
import SekolahTujuan from '../master/SekolahTujuanModel.js';
import SekolahJurusan from '../master/SekolahJurusanModel.js';
import JalurPendaftarans from '../master/JalurPendaftaranModel.js';
import DataPendaftars from "../../models/service/DataPendaftarModel.js";
import DataUsers from '../../models/service/DataUsersModel.js';

const PerangkinganModels = db.define('ez_perangkingan', {
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    },
    bentuk_pendidikan_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    id_pendaftar: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    no_pendaftaran: {
        type: DataTypes.STRING,
        allowNull: true
    },
    jalur_pendaftaran_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    sekolah_tujuan_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    jurusan_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    nisn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    nik: {
        type: DataTypes.STRING,
        allowNull: true
    },
    nama_lengkap: {
        type: DataTypes.STRING,
        allowNull: true
    },
    tanggal_lahir: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    umur: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tahun_lulus: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    umur_sertifikat: {
        type: DataTypes.STRING,
        allowNull: true
    },
    jarak: {
        type: DataTypes.STRING,
        allowNull: true
    },
    nilai_raport: {
        type: DataTypes.DOUBLE,
        allowNull: true
    },
    nilai_prestasi: {
        type: DataTypes.DOUBLE,
        allowNull: true
    },
    nilai_akhir: {
        type: DataTypes.DOUBLE,
        allowNull: true
    },
    is_tidak_sekolah: {
        type: DataTypes.CHAR(1),
        allowNull: true
    },
    is_anak_panti: {
        type: DataTypes.CHAR(1),
        allowNull: true
    },
    is_anak_keluarga_tidak_mampu: {
        type: DataTypes.CHAR(1),
        allowNull: true
    },
    is_anak_guru_jateng: {
        type: DataTypes.CHAR(1),
        allowNull: true
    },
    is_pip: {
        type: DataTypes.CHAR(1),
        allowNull: true
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
        type: DataTypes.INTEGER,
        allowNull: true
    },
    created_by_ip: {
        type: DataTypes.INET,
        allowNull: true
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
        type: DataTypes.INTEGER,
        allowNull: true
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        get() {
            // Ambil nilai mentah yang sudah di-parse sebagai string
            const rawValue = this.getDataValue('deleted_at');
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
    deleted_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    is_delete: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: true
    },
    saved_at: {
        type: DataTypes.DATE,
        allowNull: true,
        get() {
            // Ambil nilai mentah yang sudah di-parse sebagai string
            const rawValue = this.getDataValue('saved_at');
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
    saved_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    is_saved: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: true
    },
    no_urut: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: true
    },
    is_diterima: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: true
    },
    is_daftar_ulang: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: true
    },
    daftar_ulang_at: {
        type: DataTypes.DATE,
        allowNull: true,
        get() {
            // Ambil nilai mentah yang sudah di-parse sebagai string
            const rawValue = this.getDataValue('daftar_ulang_at');
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
    is_disabilitas: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: true
    },
    is_buta_warna: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: true
    },
    daftar_ulang_by: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: true
    },
    order_berdasar: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: true
    },
    npsn_anak_guru: {
        type: DataTypes.STRING,
        allowNull: true
    },
     kode_kecamatan: {
        type: DataTypes.STRING,
        allowNull: true,
    },
      is_tidak_boleh_domisili: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },

}, {
    freezeTableName: true,
    tableName: 'ez_perangkingan',
    timestamps: false
});

export default PerangkinganModels;
PerangkinganModels.belongsTo(SekolahTujuan, { as: 'sekolah_tujuan', foreignKey: 'sekolah_tujuan_id' });
PerangkinganModels.belongsTo(JalurPendaftarans, { as: 'jalur_pendaftaran', foreignKey: 'jalur_pendaftaran_id' });
PerangkinganModels.belongsTo(DataPendaftars, { as: 'data_pendaftar', foreignKey: 'id_pendaftar' });
PerangkinganModels.belongsTo(SekolahJurusan, { as: 'sekolah_jurusan', foreignKey: 'jurusan_id' });
PerangkinganModels.belongsTo(DataUsers, { as: 'daftarulang_oleh', foreignKey: 'daftar_ulang_by', targetKey: 'id' });



