const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');
const ctrl = require('../controllers/userController');

router.use(protect);
router.get('/me', ctrl.getMe);
router.patch('/me', validate(v.updateMe), ctrl.updateMe);

router.use(restrictTo('admin'));
router.get('/', validate(v.userQuery, 'query'), ctrl.listUsers);
router.get('/:id', ctrl.getUser);
router.patch('/:id', validate(v.adminUpdateUser), ctrl.updateUser);
router.delete('/:id', ctrl.deleteUser);

module.exports = router;
