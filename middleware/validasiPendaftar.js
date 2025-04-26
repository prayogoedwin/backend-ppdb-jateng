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
