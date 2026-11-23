const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');
const ctrl = require('../controllers/productController');


router.get('/', validate(v.productQuery, 'query'), ctrl.list);


router.get('/seller/mine', protect, restrictTo('seller'), validate(v.productQuery, 'query'), ctrl.listMine);
router.get('/alerts/low-stock', protect, restrictTo('seller', 'admin'), ctrl.lowStock);

router.get('/:id', ctrl.get);
router.post('/', protect, restrictTo('seller', 'admin'), validate(v.productCreate), ctrl.create);
router.patch('/:id', protect, restrictTo('seller', 'admin'), validate(v.productUpdate), ctrl.update);
router.delete('/:id', protect, restrictTo('seller', 'admin'), ctrl.remove);

module.exports = router;
