const { sql, poolPromise } = require('../../config/db');
const moment = require('moment');
const querystring = require('qs');
const crypto = require('crypto');
// IMPORT MODEL (Đây là cái thiếu dẫn đến lỗi sql is not defined)
const bookingModel = require('../../models/Sport/Booking');

// Hàm sắp xếp object (Bắt buộc theo yêu cầu VNPAY)
function sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj){
        // Sửa dòng lỗi tại đây: dùng Object.prototype.hasOwnProperty.call để an toàn hơn
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            str.push(encodeURIComponent(key));
        }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
}

// === BƯỚC 13: TẠO URL THANH TOÁN ===
async function createPaymentUrl(req, res) {
    try {
        const { bookingId, amount, bankCode, language } = req.body;
        
        // 1. Kiểm tra đơn hàng có tồn tại không
        const booking = await bookingModel.getBookingById(bookingId);
        if (!booking) {
            return res.status(404).json({ msg: 'Không tìm thấy đơn hàng' });
        }

        // 2. Cấu hình VNPAY
        const tmnCode = process.env.VNP_TMN_CODE;
        const secretKey = process.env.VNP_HASH_SECRET;
        const vnpUrl = process.env.VNP_URL;
        const returnUrl = process.env.VNP_RETURN_URL;

        // 3. Tạo tham số
        let date = new Date();
        let createDate = moment(date).format('YYYYMMDDHHmmss');
        let orderId = bookingId; // Dùng luôn BookingID làm mã đơn hàng VNPAY

        let vnp_Params = {};
        vnp_Params['vnp_Version'] = '2.1.0';
        vnp_Params['vnp_Command'] = 'pay';
        vnp_Params['vnp_TmnCode'] = tmnCode;
        vnp_Params['vnp_Locale'] = language || 'vn';
        vnp_Params['vnp_CurrCode'] = 'VND';
        vnp_Params['vnp_TxnRef'] = orderId;
        vnp_Params['vnp_OrderInfo'] = 'Thanh toan don hang:' + orderId;
        vnp_Params['vnp_OrderType'] = 'other';
        vnp_Params['vnp_Amount'] = amount * 100; // VNPAY tính đơn vị là đồng (nhân 100)
        vnp_Params['vnp_ReturnUrl'] = returnUrl;
        vnp_Params['vnp_IpAddr'] = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
        vnp_Params['vnp_CreateDate'] = createDate;

        if (bankCode) {
            vnp_Params['vnp_BankCode'] = bankCode;
        }

        // 4. Sắp xếp và tạo chữ ký
        vnp_Params = sortObject(vnp_Params);
        let signData = querystring.stringify(vnp_Params, { encode: false });
        let hmac = crypto.createHmac("sha512", secretKey);
        let signed = hmac.update(new Buffer.from(signData, 'utf-8')).digest("hex"); 
        vnp_Params['vnp_SecureHash'] = signed;

        // 5. Tạo URL cuối cùng
        let paymentUrl = vnpUrl + '?' + querystring.stringify(vnp_Params, { encode: false });

        res.status(200).json({ paymentUrl });

    } catch (err) {
        console.error("Lỗi createPaymentUrl:", err);
        res.status(500).json({ msg: 'Lỗi server khi tạo thanh toán', error: err.message });
    }
}

// === BƯỚC 14: XỬ LÝ IPN (INSTANT PAYMENT NOTIFICATION) ===
async function vnpayIpn(req, res) {
    try {
        console.log("🔔 VNPAY IPN Called:", JSON.stringify(req.query, null, 2));

        let vnp_Params = req.query;
        let secureHash = vnp_Params['vnp_SecureHash'];

        // 1. Xóa các tham số hash để tính toán lại
        delete vnp_Params['vnp_SecureHash'];
        delete vnp_Params['vnp_SecureHashType'];

        // 2. Sắp xếp tham số (Bắt buộc phải dùng hàm sortObject đã sửa lỗi)
        vnp_Params = sortObject(vnp_Params);

        // 3. Lấy Secret Key và kiểm tra
        const secretKey = process.env.VNP_HASH_SECRET;
        if (!secretKey) {
            console.error("❌ LỖI: Không đọc được VNP_HASH_SECRET từ file .env");
            // Vẫn trả về 200 cho VNPAY để nó không gọi lại liên tục, nhưng log lỗi để mình biết
            return res.status(200).json({ RspCode: '99', Message: 'Server Config Error' });
        }

        // 4. Tạo chữ ký
        const signData = require('qs').stringify(vnp_Params, { encode: false });

        console.log("📝 Chuỗi cần tạo chữ ký (signData):", signData);
        console.log("🔑 Secret Key đang dùng (kiểm tra độ dài):", secretKey.length, secretKey);

        const crypto = require('crypto');
        const hmac = crypto.createHmac("sha512", secretKey);
        const signed = hmac.update(new Buffer.from(signData, 'utf-8')).digest("hex");

        // --- DEBUG LOG QUAN TRỌNG ---
        console.log("🔹 Hash từ VNPAY gửi về:", secureHash);
        console.log("🔹 Hash Server tự tính :", signed);
        // -----------------------------

        if (secureHash === signed) {
            // Chữ ký khớp -> Bắt đầu xử lý DB
            const orderId = vnp_Params['vnp_TxnRef'];
            const rspCode = vnp_Params['vnp_ResponseCode'];
            const amount = vnp_Params['vnp_Amount']; 
            const transactionNo = vnp_Params['vnp_TransactionNo'];

            // Lấy booking từ DB
            const booking = await bookingModel.getBookingById(orderId);
            if (!booking) {
                console.log(`❌ Không tìm thấy đơn hàng: ${orderId}`);
                return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
            }

            // Kiểm tra số tiền: DB (float) vs VNPAY (string * 100)
            const amountVNP = parseInt(amount) / 100;
            const amountBooking = parseFloat(booking.total_price);
            
            // So sánh chênh lệch nhỏ (phòng trường hợp số thực bị lệch 0.000001)
            if (Math.abs(amountBooking - amountVNP) > 1) { 
                console.log(`❌ Sai số tiền: DB=${amountBooking}, VNPAY=${amountVNP}`);
                return res.status(200).json({ RspCode: '04', Message: 'Amount invalid' });
            }

            if (booking.status === 'Confirmed') {
                console.log(`⚠️ Đơn ${orderId} đã xác nhận trước đó.`);
                return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
            }
            const pool = await poolPromise;
            if (rspCode === '00') {
                // --- THÀNH CÔNG ---
                await bookingModel.updateBookingStatus(orderId, 'Confirmed');
                
                // Dùng pool.request() thay vì new sql.Request()
                await pool.request().query(`
                    INSERT INTO Transactions 
                    (BookingID, amount, payment_method, status, transaction_ref, description, created_at)
                    VALUES 
                    (${orderId}, ${amountVNP}, 'VNPAY', 'Success', '${transactionNo}', N'Thanh toán qua VNPAY', GETDATE())
                `);
                
                console.log(`✅ CẬP NHẬT THÀNH CÔNG: Booking ${orderId}`);
                return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
            } else {
                // --- THẤT BẠI ---
                // Dùng pool.request()
                await pool.request().query(`
                    INSERT INTO Transactions 
                    (BookingID, amount, payment_method, status, transaction_ref, description, created_at)
                    VALUES 
                    (${orderId}, ${amountVNP}, 'VNPAY', 'Failed', '${transactionNo}', N'Thanh toán thất bại', GETDATE())
                `);
                
                console.log(`❌ Giao dịch thất bại mã lỗi: ${rspCode}`);
                return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
            }
        } else {
            // --- LỖI CHỮ KÝ ---
            console.error("❌ LỖI CHECKSUM: Chữ ký không khớp!");
            return res.status(200).json({ RspCode: '97', Message: 'Invalid Checksum' });
        }
    } catch (error) {
        console.error("❌ CRITICAL ERROR vnpayIpn:", error);
        return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
    }
}

// === BƯỚC 15: XỬ LÝ RETURN URL ===
async function vnpayReturn(req, res) {
    let vnp_Params = req.query;
    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    const secretKey = process.env.VNP_HASH_SECRET;
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(new Buffer.from(signData, 'utf-8')).digest("hex");

    // Thay bằng URL frontend của bạn (localhost hoặc production)
    const frontendUrl = 'http://localhost:5173/my-bookings'; 

    if (secureHash === signed) {
        if (vnp_Params['vnp_ResponseCode'] === '00') {
            res.redirect(`${frontendUrl}?status=success&orderId=${vnp_Params['vnp_TxnRef']}`);
        } else {
            res.redirect(`${frontendUrl}?status=failed&orderId=${vnp_Params['vnp_TxnRef']}`);
        }
    } else {
        res.redirect(`${frontendUrl}?status=error&msg=checksum_failed`);
    }
}

module.exports = {
    createPaymentUrl,
    vnpayIpn,
    vnpayReturn
};