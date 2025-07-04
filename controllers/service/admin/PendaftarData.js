import { encodeId, decodeId } from '../../../middleware/EncodeDecode.js';
import DataPendaftars from "../../../models/service/DataPendaftarModel.js";
import DataPerangkingans from "../../../models/service/DataPerangkinganModel.js";
import { redisGet, redisSet } from '../../../redis.js'; // Import the Redis functions
import { clearCacheByKeyFunction } from '../../config/CacheControl.js';
import WilayahVerDapodik from '../../../models/master/WilayahVerDapodikModel.js';
import SekolahTujuanModel from '../../../models/master/SekolahTujuanModel.js';
import StatusDomisilis from '../../../models/master/StatusDomisiliModel.js';
import JenisKejuaraans from '../../../models/master/JenisKejuaraanModel.js';
import DataUsers from '../../../models/service/DataUsersModel.js';
import { klasifikasiPindah, getTimelineSatuan } from '../../../helpers/HelpHelper.js';


import Timelines from "../../../models/service/TimelineModel.js";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { Sequelize, Op } from 'sequelize';
import bcrypt from 'bcrypt';

import { fileURLToPath } from 'url';

//untuk yang sudah verif
export const getDataPendaftarTokByWhere = async (req, res) => {

    const page = parseInt(req.query.page) || 1; // Default page is 1
    const limit = parseInt(req.query.limit) || 10; // Default limit is 10
    const offset = (page - 1) * limit;
    const { nisn, kabkota_id, kecamatan_id, kelurahan_id } = req.query;



    // const redis_key = 'DataPendaftarAllinAdmin-IdSekolah:';
    const redis_key = `DataPendaftarPencarian:${kabkota_id}--kec:${kecamatan_id}--kel:${kelurahan_id}--page:${page}--limit:${limit}--offset:${offset}`;
    try {
        const cacheNya = await redisGet(redis_key);
        // const cacheNya = false;
        if (cacheNya && nisn != 0) {

            const cachedData = JSON.parse(cacheNya);
            res.status(200).json({
                status: 1,
                message: 'Data diambil dari cache',
                currentPage: cachedData.currentPage,
                totalPages: cachedData.totalPages,
                totalItems: cachedData.totalItems,
                data: cachedData.data
            });

        } else {
            const adminNya = req.user.userId;
            // const adminNya = 19;

            const dataAdminNya = await DataUsers.findOne({
                where: {
                    id: adminNya,
                    is_active: 1,
                    is_delete: 0
                }
            });

            let whereFor = {
                [Op.or]: [
                    { is_delete: { [Op.is]: null } },
                    { is_delete: 0 }
                ]
            };

            whereFor.is_verified = 1;  
            
            if(kabkota_id != 0){
                whereFor.kabkota_id = kabkota_id;  
            }

            if(kecamatan_id != 0){
                whereFor.kecamatan_id = kecamatan_id;  
            }

             if(kelurahan_id != 0){
                whereFor.kelurahan_id = kelurahan_id;  
            }

            if(nisn != 0){
                whereFor.nisn = nisn;   
            }

            // Pagination logic
            // const page = parseInt(req.query.page) || 1; // Default page is 1
            // const limit = parseInt(req.query.limit) || 10; // Default limit is 10
            // const offset = (page - 1) * limit;

            const { count, rows } = await DataPendaftars.findAndCountAll({
                attributes: { exclude: ['password_', 'nik', 'nilai_raport'] },
                include: [
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_kec',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_kot',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_prov',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: WilayahVerDapodik,
                        as: 'data_wilayah_prov',
                        attributes: ['kode_wilayah', 'nama', 'mst_kode_wilayah']
                    },
                    {
                        model: DataUsers,
                        as: 'diverifikasi_oleh',
                        attributes: ['id', 'nama', 'sekolah_id'],
                        include: [
                            {
                                model: SekolahTujuanModel,
                                as: 'asal_sekolah_verifikator',
                                attributes: ['id', 'nama'], // Ganti 'nama_sekolah' dengan nama kolom yang sesuai di model SekolahTujuanModel
                                required: true // INNER JOIN
                            }
                            
                        ],
                        
                    },
                    {
                        model: DataUsers,
                        as: 'sedang_diproses_oleh',
                        attributes: ['id', 'nama', 'sekolah_id'],
                        include: [
                            {
                                model: SekolahTujuanModel,
                                as: 'asal_sekolah_admin',
                                attributes: ['id', 'nama'] // Ganti 'nama_sekolah' dengan nama kolom yang sesuai di model SekolahTujuanModel
                            }
                           
                        ]
                        
                    }
                ],
                where: whereFor,
                order: [['created_at', 'DESC']], // Added this line for ordering
                limit,
                offset
            });

            if (rows.length > 0) {
                const resDatas = rows.map(item => {
                    const jsonItem = item.toJSON();
                    jsonItem.id_ = encodeId(item.id); // Add the encoded ID to the response
                    jsonItem.opened_by_generated = encodeId(item.opened_by); // Add the encoded ID to the response
                    delete jsonItem.id; // Hapus kolom id dari output JSON
                    return jsonItem;
                });

                const redisData = {
                    currentPage: page,
                    totalPages: Math.ceil(count / limit),
                    totalItems: count,
                    data: resDatas
                };

                if(nisn != 0){
                    const newCacheNya = redisData;
                    await redisSet(redis_key, JSON.stringify(newCacheNya), process.env.REDIS_EXPIRE_TIME_SOURCE_PERANGKINGAN);
                }
    
               
                res.status(200).json({
                    status: 1,
                    message: 'Data berhasil ditemukan',
                    currentPage: page,
                    totalPages: Math.ceil(count / limit),
                    totalItems: count,
                    data: resDatas
                });

                // res.status(200).json({
                //     status: 1,
                //     message: 'Data berhasil ditemukan',
                //     currentPage: page,
                //     totalPages: Math.ceil(count / limit),
                //     totalItems: count,
                //     data: resDatas
                // });

            } else {
                res.status(200).json({
                    status: 0,
                    message: 'Data kosong',
                    currentPage: 0,
                    totalPages: 1,
                    totalItems: 0,
                    data: []
                });
            }
        }
    } catch (err) {
        console.error('Error fetching data:', err); // Log the error for debugging
        res.status(404).json({
            status: 0,
            message: 'Error'
        });
    }
};