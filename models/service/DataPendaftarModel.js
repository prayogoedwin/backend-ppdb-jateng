import { Sequelize } from "sequelize";
import db from "../../config/Database.js";
import EzSekolahs from '../master/SekolahModel.js';
import EzWilayahVerDapodiks from '../master/WilayahVerDapodikModel.js';
import StatusDomisilis from '../master/StatusDomisiliModel.js';
import SekolahAsals from '../master/SekolahAsalModel.js';


import { encodeId } from '../../middleware/EncodeDecode.js'; // Import fungsi encodeId
import DataUsers from './DataUsersModel.js';



const { DataTypes } = Sequelize;

const DataPesertaDidiks = db.define('ez_pendaftar', {
    id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true, // Add this line
    },
    nisn: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    sekolah_asal_id: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    jenis_lulusan_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    tahun_lulus: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    nama_sekolah_asal: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    nik: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nama_lengkap: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    jenis_kelamin: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    tanggal_lahir: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    tempat_lahir: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    status_domisili: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    alamat: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    provinsi_id: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    kabkota_id: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    kecamatan_id: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    kelurahan_id: {
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
    lat: {
        type: DataTypes.DOUBLE,
        allowNull: true,
    },
    lng: {
        type: DataTypes.DOUBLE,
        allowNull: true,
    },
    no_wa: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    tanggal_cetak_kk: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    kejuaraan_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    nama_kejuaraan: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    tanggal_sertifikat: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    umur_sertifikat: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nomor_sertifikat: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nilai_prestasi: {
        type: DataTypes.DOUBLE,
        allowNull: true,
    },
    nilai_raport: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nilai_raport_rata: {
        type: DataTypes.DOUBLE,
        allowNull: true,
    },
    dok_pakta_integritas: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    dok_kk: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    dok_suket_nilai_raport: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    dok_piagam: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    dok_pto: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    is_tidak_sekolah: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    is_anak_panti: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    is_anak_pondok: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    is_anak_keluarga_tidak_mampu: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    is_anak_guru_jateng: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    is_pip: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kode_verifikasi: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        get() {
            const rawValue = this.getDataValue('created_at');
            if (!rawValue) return null;
            
            // Format manual tanpa library
            const d = new Date(rawValue);
            // Adjust untuk WIB (UTC+7)
            d.setHours(d.getHours() + 7);
            
            return [
              d.getFullYear(),
              (d.getMonth() + 1).toString().padStart(2, '0'),
              d.getDate().toString().padStart(2, '0')
            ].join('-') + ' ' + [
              d.getHours().toString().padStart(2, '0'),
              d.getMinutes().toString().padStart(2, '0'),
              d.getSeconds().toString().padStart(2, '0')
            ].join(':');
          }
    },
    created_by: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    updated_by: {
        type: DataTypes.INTEGER,
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
    },
    verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    verified_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    is_verified: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    deleted_by: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    is_delete: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    saved_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    saved_by: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    is_saved: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    no_urut: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    is_diterima: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    password_: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    file_tambahan: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    verifikasikan_disdukcapil: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    is_verified_disdukcapil: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    disdukcapil_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    disdukcapil_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    otp_expiration: {
        type: DataTypes.DATE, // Gunakan DataTypes.DATE untuk TIMESTAMP
        allowNull: true,      // Sesuaikan dengan kebutuhan Anda
        defaultValue: null    // Atur defaultValue jika diperlukan
    },
    access_token: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    access_token_refresh: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    tanggal_kedatangan: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    tanggal_kedatangan_ibu: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    tanggal_kedatangan_ayah: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    keterangan_dukcapl: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    opened_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    is_big_unregistered: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    keterangan_verifikator: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    is_buta_warna: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    cek_list_dok: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    organisasi_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    nilai_organisasi: {
        type: DataTypes.DOUBLE,
        allowNull: true,
    },
    is_disabilitas: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kebutuhan_khusus_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kebutuhan_khusus: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    is_tidak_boleh_domisili: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    is_anak_pondok: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    status_kepindahan: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    status_kepindahan_ibu: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    status_kepindahan_ayah: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    status_kepindahan_wali: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    tanggal_kedatangan_wali: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    
    
    
}, {
    freezeTableName: true,
    timestamps: false, // Nonaktifkan timestamps
    
});
// 

//DataPesertaDidiks.belongsTo(EzSekolahs, { as: 'data_sekolah', foreignKey: 'sekolah_asal_id',  targetKey: 'kode_wilayah' });
DataPesertaDidiks.belongsTo(EzWilayahVerDapodiks, { as: 'data_wilayah', foreignKey: 'kelurahan_id', targetKey: 'kode_wilayah' });
DataPesertaDidiks.belongsTo(EzWilayahVerDapodiks, { as: 'data_wilayah_kec', foreignKey: 'kecamatan_id', targetKey: 'kode_wilayah' });
DataPesertaDidiks.belongsTo(EzWilayahVerDapodiks, { as: 'data_wilayah_kot', foreignKey: 'kabkota_id', targetKey: 'kode_wilayah' });
DataPesertaDidiks.belongsTo(EzWilayahVerDapodiks, { as: 'data_wilayah_prov', foreignKey: 'provinsi_id', targetKey: 'kode_wilayah' });
DataPesertaDidiks.belongsTo(StatusDomisilis, { as: 'status_domisili_name', foreignKey: 'status_domisili', targetKey: 'id' });
DataPesertaDidiks.belongsTo(DataUsers, { as: 'diverifikasi_oleh', foreignKey: 'verified_by', targetKey: 'id' });
DataPesertaDidiks.belongsTo(DataUsers, { as: 'sedang_diproses_oleh', foreignKey: 'opened_by', targetKey: 'id' });
DataPesertaDidiks.belongsTo(SekolahAsals, { as: 'wilayah_sekolah_asal', foreignKey: 'sekolah_asal_id', targetKey: 'id' });


export default DataPesertaDidiks;


