# Hướng Dẫn Deploy lên Vercel

## ⚠️ Lỗi 404 trên Vercel

Nếu bạn gặp lỗi 404 khi truy cập `https://sport-booking-livid.vercel.app/`, đây là do Vercel không được cấu hình đúng cho monorepo (project có cả backend và frontend).

## 🛠️ Cách Fix

### Option 1: Cấu hình Vercel Dashboard (KHUYẾN NGHỊ)

1. Vào [Vercel Dashboard](https://vercel.com/dashboard)
2. Chọn project **SportBooking**
3. Vào **Settings** → **General**
4. Cấu hình như sau:

   **Framework Preset:** Vite
   
   **Root Directory:** `frontend` (bật "Include source files outside of the Root Directory in the Build Step")
   
   **Build Command:** `npm run build`
   
   **Output Directory:** `dist`
   
   **Install Command:** `npm install`

5. Nhấn **Save**
6. Vào **Deployments** → Chọn deployment mới nhất → Nhấn **Redeploy**

### Option 2: Deploy Frontend riêng biệt

Nếu Option 1 không work, tạo project Vercel mới chỉ cho frontend:

```bash
# Trong folder frontend
cd frontend
vercel --prod
```

Khi Vercel hỏi, chọn:
- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

## 📝 Giải thích

Project hiện tại có cấu trúc:
```
SportBooking/
├── backend/        # Node.js API
├── frontend/       # React + Vite
└── vercel.json     # Config cho root (KHÔNG DÙNG được)
```

Vercel mặc định cố build từ root, nhưng frontend nằm trong subfolder `frontend/`, nên cần cấu hình Root Directory.

## ✅ Sau khi Fix

URL sẽ hoạt động:
- ✅ `https://sport-booking-livid.vercel.app/` - Trang chủ
- ✅ `https://sport-booking-livid.vercel.app/feed` - Feed
- ✅ Tất cả routes khác

## 🔗 Backend API

Lưu ý: Frontend đang config gọi API từ:
- **Local:** `http://localhost:5000/api`
- **Production:** Bạn cần deploy backend riêng (Railway, Render, etc.) và cập nhật `VITE_API_BASE_URL` trong Vercel Environment Variables

### Cách set Environment Variable trên Vercel:

1. Vào **Settings** → **Environment Variables**
2. Thêm:
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** URL backend production của bạn (ví dụ: `https://your-backend.railway.app/api`)
3. **Save** và **Redeploy**
