// import sequelize 
import { Sequelize } from "sequelize";
// import connection 
import db from "../../config/Database.js";
 
// init DataTypes
const { DataTypes } = Sequelize;
 
// Define schema
const JenisKejuaraans = db.define('ez_jenis_kejuaraan', {
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
    },
    bobot: {
      type: DataTypes.DECIMAL(5, 2), // Define bobot as DECIMAL(5, 2)
  }
},{
  // Freeze Table Name
  freezeTableName: true
});
 
// Export model Product
export default JenisKejuaraans;