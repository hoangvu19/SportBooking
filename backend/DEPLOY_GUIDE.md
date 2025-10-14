# Deploy Backend lên Railway

## Bước 1: Tạo tài khoản Railway
1. Truy cập [railway.app](https://railway.app)
2. Đăng ký tài khoản (có thể dùng GitHub)

## Bước 2: Tạo Database
1. Click **"New Project"** → **"Database"**
2. Chọn **"PostgreSQL"** (hoặc MySQL nếu bạn muốn)
3. Railway sẽ tạo database tự động

## Bước 3: Deploy Backend
1. Click **"New Project"** → **"Deploy from GitHub"**
2. Chọn repository **hoangvu19/SportBooking**
3. Chọn branch **integration/my-fixes**
4. Cấu hình:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

## Bước 4: Cấu hình Environment Variables
Trong Railway dashboard, thêm các biến:

```
DB_USER=railway_user
DB_PASSWORD=your_db_password
DB_SERVER=your_db_host
DB_DATABASE=your_db_name
PORT=5000
NODE_ENV=production
```

## Bước 5: Kết nối Database
Railway sẽ tự động inject DATABASE_URL, bạn có thể parse nó hoặc dùng các biến riêng.

## Bước 6: Cập nhật Frontend
Sau khi deploy backend thành công, cập nhật `frontend/src/utils/api.js`:

```javascript
const API_BASE_URL = 'https://your-backend-url.railway.app';
```