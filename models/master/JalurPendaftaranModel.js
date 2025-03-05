// import sequelize 
import { Sequelize } from "sequelize";
// import connection 
import db from "../../config/Database.js";
// import DataPerangkingans from '../service/DataPerangkinganModel.js';

 
// init DataTypes
const { DataTypes } = Sequelize;
 
// Define schema
const JalurPendaftarans = db.define('ez_jalur_pendaftaran', {
  // Define attributes
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        unique: true,
        primaryKey: true
    },
    bentuk_pendidikan_id: {
      type: DataTypes.INTEGER
      //1 sma, 2 smk
    },
    nama: {
        type: DataTypes.STRING
    }
},{
  // Freeze Table Name
  freezeTableName: true
});

 
// Export model Product
export default JalurPendaftarans;
