const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');
const ctrl = require('../controllers/reportController');

router.use(protect, restrictTo('seller', 'admin'));

router.get('/sales-summary', validate(v.salesReportQuery, 'query'), ctrl.salesSummary);
router.get('/best-selling', validate(v.bestSellingQuery, 'query'), ctrl.bestSelling);
router.get('/inventory-summary', ctrl.inventorySummary);
router.get('/order-status', ctrl.orderStatusBreakdown);

module.exports = router;
