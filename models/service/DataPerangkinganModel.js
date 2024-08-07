import { DataTypes } from 'sequelize';
import db from "../../config/Database.js";
import SekolahTujuan from '../master/SekolahTujuanModel.js';
import JalurPendaftarans from '../master/JalurPendaftaranModel.js';

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
        type: DataTypes.STRING,
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
        allowNull: true
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
        allowNull: true
    },
    updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
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
        allowNull: true
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
        allowNull: true
    }
}, {
    freezeTableName: true,
    tableName: 'ez_perangkingan',
    timestamps: false
});

export default PerangkinganModels;
PerangkinganModels.belongsTo(SekolahTujuan, { as: 'sekolah_tujuan', foreignKey: 'sekolah_tujuan_id' });
PerangkinganModels.belongsTo(JalurPendaftarans, { as: 'jalur_pendaftaran', foreignKey: 'jalur_pendaftaran_id' });

