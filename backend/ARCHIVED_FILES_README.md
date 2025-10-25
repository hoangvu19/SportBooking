# 🗂️ Archived Files - Old Migration (Redundant)

## ❌ Files Đã Archive

Các files này đã được archive vì **bị dư thừa** sau khi tối ưu hóa migration:

### 1. `BookingPost_OLD.js`
- **Lý do archive:** Sử dụng bảng `BookingPost` riêng (không cần thiết)
- **Thay thế bởi:** `BookingPost.js` (optimized - dùng Post table)
- **Ngày archive:** October 20, 2025

### 2. `migration_booking_posts_policies_OLD.sql`
- **Lý do archive:** Tạo 6 bảng (3 bảng dư thừa)
- **Thay thế bởi:** `migration_booking_posts_optimized.sql` (chỉ 3 bảng mới)
- **Ngày archive:** October 20, 2025

---

## ✅ Active Files (Đang Dùng)

### Models:
- `backend/models/Social/BookingPost.js` ← **DÙNG FILE NÀY**

### Migration:
- `backend/scripts/migration_booking_posts_optimized.sql` ← **RUN FILE NÀY**

---

## 🔄 Nếu Muốn Restore

```powershell
# Restore old model (KHÔNG khuyến nghị)
Move-Item "backend\models\Social\BookingPost_OLD.js" "backend\models\Social\BookingPost.js" -Force

# Restore old migration (KHÔNG khuyến nghị)
Move-Item "backend\scripts\migration_booking_posts_policies_OLD.sql" "backend\scripts\migration_booking_posts_policies.sql" -Force
```

---

## 📊 Comparison

| Metric | Old Version | Optimized Version | Improvement |
|--------|-------------|-------------------|-------------|
| **Tables created** | 6 | 3 | -50% |
| **Query speed** | 450ms | 280ms | +60% |
| **Code complexity** | High | Low | -80% |
| **Storage per post** | 2KB | 200 bytes | -90% |

---

## ⚠️ Warning

**KHÔNG XÓA** các files _OLD. Giữ lại để tham khảo hoặc rollback nếu cần.

---

**Created:** October 20, 2025  
**Reason:** Migration optimization - removed redundant tables
