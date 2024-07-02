// import sequelize 
import { Sequelize } from "sequelize";
// import connection 
import db from "../../config/Database.js";
 
// init DataTypes
const { DataTypes } = Sequelize;
 
// Define schema
const SekolahAsals = db.define('ez_sekolah_asal', {
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
  freezeTableName: true
});
 
// Export model Product
export default SekolahAsals;