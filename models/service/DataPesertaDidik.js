import { Sequelize } from "sequelize";
import db from "../../config/Database.js";
import EzSekolah from '../master/Sekolah.js';

const { DataTypes } = Sequelize;

const EzPesertaDidiks = db.define('ez_peserta_didik', {
    id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
    },
    sekolah_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    kode_wilayah: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nama: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    tempat_lahir: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    tanggal_lahir: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    jenis_kelamin: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nik: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    no_kk: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nisn: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    alamat_jalan: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    desa_kelurahan: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    rt: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    rw: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nama_dusun: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nama_ibu_kandung: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    pekerjaan_ibu: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    penghasilan_ibu: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nama_ayah: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    pekerjaan_ayah: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    penghasilan_ayah: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nama_wali: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    pekerjaan_wali: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    penghasilan_wali: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    kebutuhan_khusus: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    no_kip: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    no_pkh: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    lat: {
        type: DataTypes.DOUBLE,
        allowNull: true,
    },
    lng: {
        type: DataTypes.DOUBLE,
        allowNull: true,
    },
    flag_pip: {
        type: DataTypes.STRING,
        allowNull: true,
    }
}, {
    freezeTableName: true,
    timestamps: false, // Nonaktifkan timestamps
});

EzPesertaDidiks.belongsTo(EzSekolah, { foreignKey: 'sekolah_id', targetKey: 'id' });

export default EzPesertaDidiks;
