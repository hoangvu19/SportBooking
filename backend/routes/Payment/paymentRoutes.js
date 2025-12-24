const express = require('express');
const paymentController = require('../../controllers/Payment/paymentController');

const router = express.Router();

// POST /api/payment/create_payment_url
// User nào cũng được phép thanh toán
router.post('/create_payment_url', paymentController.createPaymentUrl);
router.get('/vnpay_ipn', paymentController.vnpayIpn);
router.get('/vnpay_return', paymentController.vnpayReturn);

module.exports = router;