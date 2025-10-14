# Hướng Dẫn Deploy Backend lên Railway

## ✅ Bước 1: Chuẩn bị Backend

Backend hiện tại đã sẵn sàng với:
- ✅ `package.json` với script `start`
- ✅ `server.js` - entry point
- ✅ Environment variables support (`.env`)

## 🚀 Bước 2: Deploy lên Railway (Miễn phí)

### 2.1. Tạo tài khoản Railway
1. Vào https://railway.app
2. Click **"Start a New Project"** → **"Deploy from GitHub repo"**
3. Login bằng GitHub của bạn
4. Cho phép Railway truy cập repository `SportBooking`

### 2.2. Setup Project
1. Chọn repository `hoangvu19/SportBooking`
2. Railway sẽ hỏi **"Root Directory"** → Nhập: `backend`
3. Railway sẽ tự detect Node.js và install dependencies

### 2.3. Cấu hình Environment Variables
Vào **Variables** tab, thêm các biến sau:

```
PORT=5000
NODE_ENV=production

# Database (nếu dùng SQL Server trên Azure/Railway)
DB_SERVER=your-db-server.database.windows.net
DB_DATABASE=SportBookingDB
DB_USER=sqladmin
DB_PASSWORD=YourStrongPassword123!
DB_ENCRYPT=true

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### 2.4. Deploy
1. Click **"Deploy"**
2. Đợi 2-3 phút build
3. Sau khi deploy xong, Railway sẽ cung cấp URL: `https://your-backend-xxx.railway.app`

## 🔗 Bước 3: Kết nối Frontend với Backend

### 3.1. Lấy Backend URL từ Railway
- Vào Railway dashboard → Project → Settings
- Copy URL (ví dụ: `https://sportbooking-production-abc.up.railway.app`)

### 3.2. Set Environment Variable trên Vercel
1. Vào https://vercel.com/dashboard
2. Chọn project "frontend"
3. **Settings** → **Environment Variables**
4. Thêm:
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** `https://your-backend-xxx.railway.app/api` (thêm `/api` vào cuối!)
   - **Environment:** Production (hoặc All)
5. Click **Save**

### 3.3. Redeploy Frontend
1. Vào **Deployments** tab
2. Click deployment mới nhất → **Redeploy**
3. Đợi 1-2 phút

## ✅ Bước 4: Test

Mở frontend URL: https://frontend-xxx-hoangvu19s-projects.vercel.app

- Login sẽ gọi backend Railway
- Không còn lỗi CORS
- Tất cả API sẽ hoạt động!

---

## 📝 Alternative: Deploy Backend khác

### Render.com (Miễn phí)
1. Vào https://render.com → **New** → **Web Service**
2. Connect GitHub repo `SportBooking`
3. Root Directory: `backend`
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Add Environment Variables (giống Railway)

### Heroku (Có phí sau free tier)
```bash
cd backend
heroku create your-app-name
git push heroku main
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret
```

---

## 🎯 Tóm tắt

1. ✅ **Tạm thời:** Frontend đã có mock data để test UI
2. 🚀 **Lâu dài:** Deploy backend lên Railway/Render
3. 🔗 **Kết nối:** Set `VITE_API_BASE_URL` trên Vercel
4. ✅ **Hoàn tất:** Frontend + Backend đều production-ready!

**URL hiện tại:**
- Frontend: https://frontend-3jiie5145-hoangvu19s-projects.vercel.app (đang dùng mock data)
- Backend: Chưa deploy (cần làm theo hướng dẫn trên)
