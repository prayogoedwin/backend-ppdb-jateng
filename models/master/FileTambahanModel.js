// import sequelize 
import { Sequelize } from "sequelize";
// import connection 
import db from "../../config/Database.js";
 
// init DataTypes
const { DataTypes } = Sequelize;
 
// Define schema
const FileTambahans = db.define('ez_file_tambahan', {
  // Define attributes
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        unique: true,
        primaryKey: true
    },
    nama_file: {
        type: DataTypes.STRING
    },
    id_jalur_pendaftaran: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    keterangan_file: {
      type: DataTypes.STRING
  },
},{
  // Freeze Table Name
  freezeTableName: true,
  timestamps: false, // Nonaktifkan timestamps
});
 
// Export model Product
export default FileTambahans;