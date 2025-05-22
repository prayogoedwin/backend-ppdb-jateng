import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const { DataTypes } = Sequelize;

const EzAnakPondokKemenag = sequelize.define('ez_anak_pondok_kemenag', {
    sekolah_id_pondok: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    bentuk_pendidikan: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    bentuk_pendidikan_id: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    npsn_pondok: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    nama_pondok: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    kabupaten_pondok: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    kecamatan_pondok: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    lintang_pondok: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    bujur_pondok: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    kode_wilayah: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    sekolah_id: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    peserta_didik_id: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    nisn: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    nama: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    tempat_lahir: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    tanggal_lahir: {
        type: DataTypes.DATE,
        allowNull: true
    },
    jenis_kelamin: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    no_kk: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    nik: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    nik_ayah: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    nik_ibu: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    nik_wali: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    nama_ayah: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    nama_ibu_kandung: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    nama_wali: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    kode_provinsi: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    provinsi: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    kode_kabupaten: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    kabupaten: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    kode_kecamatan: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    kecamatan: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    desa_kelurahan: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    rt: {
        type: DataTypes.STRING(5),
        allowNull: true
    },
    rw: {
        type: DataTypes.STRING(5),
        allowNull: true
    },
    alamat_jalan: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    lintang: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    bujur: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    id_layak_pip: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    layak_PIP: {
        type: DataTypes.STRING(5),
        allowNull: true
    },
    no_KIP: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    no_KKS: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    no_KPS: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    kebutuhan_khusus_id: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    kebutuhan_khusus: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    validdukcapil: {
        type: DataTypes.STRING(5),
        allowNull: true
    },
    validnisn: {
        type: DataTypes.STRING(5),
        allowNull: true
    }
}, {
    tableName: 'ez_anak_pondok_kemenag',
    timestamps: false // Nonaktifkan timestamps otomatis
});

export default EzAnakPondokKemenag;