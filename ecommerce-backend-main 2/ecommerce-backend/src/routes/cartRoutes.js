const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');
const ctrl = require('../controllers/cartController');

router.use(protect, restrictTo('customer')); 

router.get('/', ctrl.getCart);
router.post('/items', validate(v.cartAdd), ctrl.addItem);
router.patch('/items/:productId', validate(v.cartUpdate), ctrl.updateItem);
router.delete('/items/:productId', ctrl.removeItem);
router.delete('/', ctrl.clear);

module.exports = router;
