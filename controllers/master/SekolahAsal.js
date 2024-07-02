// Import model Product
import SekolahAsals from "../../models/master/SekolahAsalModel.js";

// Get semua product
// export const getKabkotas = async (req, res) => {
//     try {
//         const kabkota = await Kabkotas.findAll();
//         res.send(kabkota);
//     } catch (err) {
//         console.log(err);
//     }
// }

export const getSekolahAsal = async (req, res) => {
    try {
        const resData = await SekolahAsals.findAll({
            attributes: ['id', 'nama'] // Specify the attributes to retrieve
        });
        if(resData.length > 0){
            res.status(200).json({
                'status': 1,
                'message': 'Data berhasil ditemukan',
                'data': resData
            });
        }else{

            res.status(200).json({
                'status': 1,
                'message': 'Data kosong',
                'data': resData
            });

        }
    } catch (err){
        console.error('Error fetching data:', err); // Log the error for debugging
        res.status(404).json({
            'status': 0,
            'message': 'Error'
        });
    }
}
