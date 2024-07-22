import path from 'path';
import fs from 'fs';

// Folder tempat file yang akan diunduh

export const downloadFile =  async (req, res, next) => {
    try {
        const filename = req.params.filename;
        const nisn = req.params.nisn;

        const fileDirectory = path.join(__dirname, '../upload/berkas/'+nisn+'/');
        const filePath = path.join(fileDirectory, filename);

        // Cek apakah file ada di folder
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                res.status(404).json({
                    status: 0,
                    message: 'File tidak ditemukan',
                });
            } else {
                // Unduh file
                res.download(filePath, (err) => {
                    if (err) {
                        res.status(500).json({
                            status: 0,
                            message: 'Terjadi kesalahan saat mengunduh file',
                        });
                    } else {
                        console.log(`File ${filename} berhasil diunduh.`);
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error Download:', error);
        res.status(500).json({
            status: 0,
            message: 'Internal Server Error',
        });
    }
};