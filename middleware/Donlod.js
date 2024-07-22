import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';

// Utility function to get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Folder tempat file yang akan diunduh

export const downloadFile =  async (req, res) => {
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

export const viewFile = async (req, res) => {
    try {
        const filename = req.params.filename;
        const nisn = req.params.nisn;

        const fileDirectory = path.join(__dirname, '../upload/berkas/', nisn);
        const filePath = path.join(fileDirectory, filename);

        // Cek apakah file ada di folder
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                res.status(404).json({
                    status: 0,
                    message: 'File tidak ditemukan',
                });
            } else {
                // Tampilkan file
                res.sendFile(filePath, (err) => {
                    if (err) {
                        res.status(500).json({
                            status: 0,
                            message: 'Terjadi kesalahan saat menampilkan file',
                        });
                    } else {
                        console.log(`File ${filename} berhasil ditampilkan.`);
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error View:', error);
        res.status(500).json({
            status: 0,
            message: 'Internal Server Error',
        });
    }
};