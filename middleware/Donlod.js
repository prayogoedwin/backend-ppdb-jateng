import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { redisGet, redisSet } from '../redis.js'; // Import the Redis functions

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

export const viewFileTanpaDotPdf = async (req, res) => {
    try {
        let filename = req.params.filename;
        const nisn = req.params.nisn;

        // Jika filename tidak memiliki ekstensi, tambahkan .pdf
        if (!path.extname(filename)) {
            filename += '.pdf';
        }

        const fileDirectory = path.join(__dirname, '../upload/berkas/', nisn);
        const filePath = path.join(fileDirectory, filename);

        // Cek apakah file ada
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                status: 0,
                message: 'File tidak ditemukan',
            });
        }

        // Set header untuk force download
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': fs.statSync(filePath).size
        });

        // Stream file ke client
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            status: 0,
            message: 'Internal Server Error',
        });
    }
};

export const viewFileBase64 = async (req, res) => {
    try {
        const nisn = req.params.nisn;
        const base64Filename = req.params.filename;
        
        // Decode base64 filename
        let originalFilename;
        try {
            originalFilename = Buffer.from(base64Filename, 'base64').toString('utf8');
        } catch (decodeError) {
            return res.status(400).json({
                status: 0,
                message: 'Format nama file tidak valid',
            });
        }

        // Validasi filename untuk mencegah directory traversal
        if (originalFilename.includes('/') || originalFilename.includes('..')) {
            return res.status(400).json({
                status: 0,
                message: 'Nama file tidak valid',
            });
        }

        const fileDirectory = path.join(__dirname, '../upload/berkas/', nisn);
        const filePath = path.join(fileDirectory, originalFilename);

        // Cek apakah file ada
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                status: 0,
                message: 'File tidak ditemukan',
            });
        }

        // Set header untuk force download
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${originalFilename}"`,
            'Content-Length': fs.statSync(filePath).size
        });

        // Stream file ke client
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            status: 0,
            message: 'Internal Server Error',
        });
    }
};

// export const viewGeoJson = async (req, res) => {
//     try {
//         const filename = 'ADM_JATENG.json';

//         const fileDirectory = path.join(__dirname, '../json');
//         const filePath = path.join(fileDirectory, filename);

//         // Cek apakah file ada di folder
//         fs.access(filePath, fs.constants.F_OK, (err) => {
//             if (err) {
//                 res.status(404).json({
//                     status: 0,
//                     message: 'File tidak ditemukan',
//                 });
//             } else {
//                 // Tampilkan file
//                 res.sendFile(filePath, (err) => {
//                     if (err) {
//                         res.status(500).json({
//                             status: 0,
//                             message: 'Terjadi kesalahan saat menampilkan file',
//                         });
//                     } else {
//                         console.log(`File ${filename} berhasil ditampilkan.`);
//                     }
//                 });
//             }
//         });
//     } catch (error) {
//         console.error('Error View:', error);
//         res.status(500).json({
//             status: 0,
//             message: 'Internal Server Error',
//         });
//     }
// };



// export const viewGeoJsonRedis = async (req, res) => {
//     const redis_key = 'GeoJsonNya'; // Define the redis_key here
//     const filename = 'ADM_JATENG.json';
//     const fileDirectory = path.join(__dirname, '../json');
//     const filePath = path.join(fileDirectory, filename);

//     try {
//         // Check if cache exists
//         const cacheNya = await redisGet(redis_key);
//         if (cacheNya) {
//             return res.status(200).json({
//                 status: 1,
//                 message: 'Data diambil dari cache',
//                 data: JSON.parse(cacheNya),
//             });
//         }

//         // If not in cache, read from the file
//         const fileData = await fs.readFile(filePath, 'utf8');
        
//         // Store the data in Redis cache
//         await redisSet(redis_key, fileData, process.env.REDIS_EXPIRE_TIME_MASTER);

//         return res.status(200).send(fileData);
//     } catch (err) {
//         console.error('Error:', err);
//         return res.status(500).json({
//             status: 0,
//             message: 'Internal Server Error',
//         });
//     }
// };
