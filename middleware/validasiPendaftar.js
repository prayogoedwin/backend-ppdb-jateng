import { check, validationResult } from 'express-validator';

const validatePendaftar = [
  // Validasi NISN: 10 digit
  check('nisn')
    .isLength({ min: 10, max: 10 })
    .withMessage('NISN harus 10 digit')
    .isNumeric()
    .withMessage('NISN harus berupa angka'),

  // Validasi NIK: 16 digit
  check('nik')
    .isLength({ min: 16, max: 16 })
    .withMessage('NIK harus 16 digit')
    .isNumeric()
    .withMessage('NIK harus berupa angka'),

    // Validasi sekolah_asal_id: hanya boleh 1 atau 2
    check('sekolah_asal_id')
     .isIn([1, 2])
     .withMessage('kode sekolah asal tidak diketahui'),

      // Validasi sjenis lulusan
    check('jenis_lulusan_id')
     .isIn([1, 2])
     .withMessage('kode jenis lulusan tidak diketahui'),

    // Validasi status domisili
    check('status_domisili')
      .isIn([1, 2, 3, 4])
      .withMessage('kode status domisili tidak diketahui'),
    
    check('is_tidak_sekolah')
      .optional({ nullable: true }) // boleh null
      .isIn(['0', '1']) // atau nilainya harus '0' atau '1'
      .withMessage('kode status anak tidak sekolah tidak di ketahui'),

    check('organisasi_id')
      .optional({ nullable: true }) // boleh null
      .isIn([0, 1, 2])
      .withMessage('kode organisasi tidak diketahui'),

];

const validateResult = (req, res, next) => {
    const errors = validationResult(req);
    console.log(errors.array());  // Untuk melihat apa yang ada di errors.array()
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 0,
        message: errors.array().map(error => ({
          field: error.param,  // Pastikan error.param ada
          message: error.msg
        }))
      });
    }
    next();
};
  
  
  
export { validatePendaftar, validateResult };
