const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');
const ctrl = require('../controllers/orderController');

router.use(protect);

router.post('/checkout', restrictTo('customer'), validate(v.checkout), ctrl.checkout);
router.get('/', validate(v.orderQuery, 'query'), ctrl.list);
router.get('/:id', ctrl.get);
router.patch('/:id/status', restrictTo('seller', 'admin'), validate(v.orderStatus), ctrl.updateStatus);
router.post('/:id/cancel', restrictTo('customer'), validate(v.cancelOrder), ctrl.cancel);

module.exports = router;
