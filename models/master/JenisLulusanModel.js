// import sequelize 
import { Sequelize } from "sequelize";
// import connection 
import db from "../../config/Database.js";
 
// init DataTypes
const { DataTypes } = Sequelize;
 
// Define schema
const JenisLulusans = db.define('ez_jenis_lulusan', {
  // Define attributes
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        unique: true,
        primaryKey: true
    },
    nama: {
        type: DataTypes.STRING
    }
},{
  // Freeze Table Name
  freezeTableName: true,
  timestamps: false, // Nonaktifkan timestamps
});
 
// Export model Product
export default JenisLulusans;