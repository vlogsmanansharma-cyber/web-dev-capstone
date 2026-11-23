const router = require('express').Router();
const validate = require('../middleware/validate');
const v = require('../validators');
const ctrl = require('../controllers/authController');

router.post('/register', validate(v.register), ctrl.register);
router.post('/login', validate(v.login), ctrl.login);
router.post('/refresh', validate(v.refresh), ctrl.refresh);
router.post('/logout', validate(v.refresh), ctrl.logout);

module.exports = router;
