**SportBooking-remove-activation-flow**

Đồ án: bộ mã nguồn WhereWeSport (bản rút gọn) với hướng dẫn cài đặt và chạy các thành phần Backend, Frontend và mô-đun AI/Moderation.

**Prerequisites**
- **Node.js**: >= 14 (cài npm đi kèm). Kiểm tra: `node -v` `npm -v`
- **Python**: 3.8+ (cho mô-đun moderation). Kiểm tra: `python --version` hoặc `python3 --version`
- **pip** / **venv**: để cài phụ thuộc Python và tạo môi trường ảo
- (Tuỳ chọn) **Redis / MSSQL**: nếu backend cấu hình dùng các dịch vụ này; cấu hình DB nằm ở [backend/config/db.js](backend/config/db.js)

**Cấu trúc chính**
- `backend/` : server Node.js (Express). Xem [backend/package.json](backend/package.json)
- `frontend/` : SPA React + Vite. Xem [frontend/package.json](frontend/package.json)
- `AI/` : module AI (Node + Python). Mô-đun moderation nằm ở [AI/moderation](AI/moderation) (xem [AI/moderation/model_server.py](AI/moderation/model_server.py) và [AI/moderation/requirements.txt](AI/moderation/requirements.txt))

**1) Cài đặt & chạy Backend**

- Vào thư mục backend và cài package:

```
cd backend
npm install
```

- Tạo file môi trường `.env` (nếu chưa có). Tham khảo cấu hình/giá trị cần thiết trong [backend/config/db.js](backend/config/db.js). Nếu repository có file `.env` trong `backend/` bạn có thể chỉnh sửa trực tiếp.

- Chạy server ở môi trường phát triển (hot-reload):

```
npm run dev
```

- Hoặc khởi động sản phẩm:

```
npm start
```

- Một số lệnh hữu ích:
- `npm run test` — chạy test (nếu có)
- `npm run migrate` — chạy migration (nếu có script/SQL nằm trong `backend/scripts`)

**2) Cài đặt & chạy Frontend**

- Vào thư mục frontend và cài package:

```
cd frontend
npm install
```

- Chạy dev server (Vite):

```
npm run dev
```

- Build sản phẩm:

```
npm run build
```

Sau khi chạy `npm run dev`, Vite sẽ hiển thị địa chỉ local (mặc định `http://localhost:5173`).

**3) Cài đặt & chạy mô-đun AI / Moderation**

- Node phần AI (nếu cần) nằm ở `AI/` nhưng module chính của moderation là Python under `AI/moderation`.

- Tạo môi trường ảo và cài phụ thuộc Python:

```
cd AI\moderation
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # PowerShell
# hoặc cho cmd: .\.venv\Scripts\activate.bat
pip install -r requirements.txt
```

- File `AI/moderation/requirements.txt` có các thư viện: `fastapi`, `uvicorn`, `transformers`, `torch`, `sentencepiece`, `numpy`, `pandas`, `datasets`.

- Chạy server mô hình (dev):

```
python model_server.py
```

hoặc chạy bằng `uvicorn`:

```
uvicorn model_server:app --host 0.0.0.0 --port 8000 --reload
```

- Môi trường và điểm cấu hình:
  - `MODEL_PATH`, `SENTIMENT_MODEL`, `MODERATION_LABELS`, `PORT` có thể đặt qua biến môi trường. Mặc định `MODEL_PATH` là `vinai/phobert-base` trong file `AI/moderation/model_server.py`.
  - Thư mục `AI/data` chứa `blacklist.txt` / `whitelist.txt` để tham khảo.

**4) Mẹo cấu hình và kết nối giữa các thành phần**
- Thông thường frontend gọi API backend; backend có thể gọi module AI qua HTTP (ví dụ tới `http://localhost:8000/predict`). Kiểm tra logic ở controller backend (thư mục `backend/controllers/AI/` ).
- Nếu backend sử dụng MSSQL hoặc Redis, đảm bảo service đó sẵn sàng và cập nhật `backend/.env` hoặc `backend/config/db.js` tương ứng.

**5) Debugging & Notes**
- Logs backend: `backend/logs/`.
- Nếu gặp lỗi package native (ví dụ `sharp`, `sharp` yêu cầu build tool), cài lại build tools cho Windows (Windows Build Tools) hoặc cài phiên bản phù hợp.
- Mô-đun moderation dùng mô hình lớn (transformers + torch) — cần GPU để tăng tốc, hoặc dùng CPU nhưng khởi động model có thể mất thời gian và tốn nhiều RAM.

**6) Lệnh tóm tắt**
- Backend (dev):
```
cd backend
npm install
npm run dev
```
- Frontend (dev):
```
cd frontend
npm install
npm run dev
```
- AI moderation:
```
cd AI\moderation
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python model_server.py
```

**7) Hướng dẫn cài đặt Ngrok cho VNPAY (nếu cần)**
**Cài đặt và Cấu hình Ngrok**
Mục tiêu: Tạo một đường dẫn công khai (Ví dụ: https://a1b2.ngrok-free.app) trỏ thẳng về http://localhost:5000 của bạn, để VNPAY có thể gửi kết quả thanh toán về Backend.
Thực hiện:
1.	Tải xuống:
    Truy cập https://ngrok.com/download.
    Tải phiên bản phù hợp với Windows (file .zip).
    Giải nén file .zip, bạn sẽ thấy file ngrok.exe.
2.	Đăng ký tài khoản Ngrok (Miễn phí):
    Vào dashboard.ngrok.com/signup để tạo tài khoản.
Bạn cần một ứng dụng "Tạo mã xác thực" trên điện thoại. Hãy làm theo 3 bước đơn giản sau:
1.	Tải ứng dụng:
o	Trên điện thoại, vào App Store (iPhone) hoặc CH Play (Android).
o	Tìm và tải ứng dụng Google Authenticator (hoặc Microsoft Authenticator).
2.	Quét mã:
o	Mở ứng dụng Google Authenticator lên.
o	Bấm dấu + $\rightarrow$ Chọn "Quét mã QR".
o	Đưa camera điện thoại lên màn hình máy tính để quét cái hình vuông đen trắng (QR Code) mà bạn đang thấy.
3.	Nhập mã:
o	Sau khi quét, trên điện thoại sẽ hiện ra một dòng số (6 chữ số) thay đổi liên tục mỗi 30 giây.
o	Nhập 6 số đó vào ô trống trên trang web Ngrok để xác nhận.
o	Sau khi đăng nhập, vào mục "Your Authtoken" ở menu bên trái.
o	Copy đoạn mã token (bắt đầu bằng 2...).
3.	Kích hoạt Ngrok trên máy:
o	Mở thư mục chứa file ngrok.exe vừa giải nén.
o	Nhấn chuột phải vào khoảng trắng, chọn "Open in Terminal" (hoặc mở CMD và cd tới thư mục đó).
o	Chạy lệnh sau để nạp token (chỉ làm 1 lần):
o	ngrok config add-authtoken <DÁN_MÃ_TOKEN_CỦA_BẠN_VÀO_ĐÂY>
4.	Chạy "Đường hầm" (Tunnel):
o	Đây là lệnh bạn sẽ dùng mỗi khi muốn test thanh toán.
o	Mở lại thư mục chứa Ngrok.exe, chuột phải vào khoảng trắng chạy terminal
o	Trong terminal của thư mục Ngrok, gõ lệnh:
.\ngrok http 5000
