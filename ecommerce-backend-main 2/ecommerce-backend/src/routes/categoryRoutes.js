const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');
const ctrl = require('../controllers/categoryController');

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);

router.use(protect, restrictTo('admin'));
router.post('/', validate(v.category), ctrl.create);
router.patch('/:id', validate(v.categoryUpdate), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
