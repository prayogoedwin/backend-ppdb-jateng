// controllers/PesertaDidik.js
import DataPesertaDidik from '../../models/service/DataPesertaDidik.js';
import Sekolah from '../../models/master/Sekolah.js';

// Service function
const getPesertaDidikByNisn = async (nisn) => {
    try {
        const pesertaDidik = await DataPesertaDidik.findOne({
            where: { nisn },
            include: [{
                model: Sekolah,
                attributes: ['npsn', 'nama']
            }]
        });

        if (!pesertaDidik) {
            throw new Error('Peserta didik tidak ditemukan');
        }

        return pesertaDidik;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const getPesertaDidikByNisnHandler = async (req, res) => {
    const { nisn } = req.body;
    try {
        if (!nisn) {
            return res.status(400).json({
                status: 0,
                message: 'NISN is required',
            });
        }

        const pesertaDidik = await getPesertaDidikByNisn(nisn);

        if (!pesertaDidik) {
            return res.status(404).json({
                status: 0,
                message: 'Peserta didik tidak ditemukan'
            });
        }

        res.status(200).json({
            status: 1,
            message: 'Data berhasil ditemukan',
            data: pesertaDidik
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: 0,
            message: err.message || 'Terjadi kesalahan saat mengambil data'
        });
    }
};

