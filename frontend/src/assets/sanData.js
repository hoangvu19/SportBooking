// Dữ liệu ảo cho các trang đặt sân thể thao

// Dữ liệu chủ sân ảo
export const sanUsers = [
  {
    AccountID: 101,
    Username: "leminh",
    HoTen: "Lê Minh",
    Email: "leminh@fakesite.com",
    Avatar: "https://i.pravatar.cc/150?img=3"
  },
  {
    AccountID: 102,
    Username: "phamhoa",
    HoTen: "Phạm Hoa",
    Email: "phamhoa@fakesite.com",
    Avatar: "https://i.pravatar.cc/150?img=5"
  },
  {
    AccountID: 103,
    Username: "tranbinh",
    HoTen: "Trần Bình",
    Email: "tranbinh@fakesite.com",
    Avatar: "https://i.pravatar.cc/150?img=7"
  }
];

// Dữ liệu sân thể thao ảo đa môn
export const sanList = [
  // Bóng đá
  {
    SanID: 201,
    TenSan: "Sân Sao Mai",
    MonTheThao: "Bóng đá",
    LoaiSan: "Sân 5 người",
    GiaThue: 250000,
    TrangThai: "Còn trống",
    KhuVuc: "A1",
    HinhAnh: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80",
    ChuSoHuu: sanUsers[0]
  },
  {
    SanID: 202,
    TenSan: "Sân Bình Minh",
    MonTheThao: "Bóng đá",
    LoaiSan: "Sân 7 người",
    GiaThue: 400000,
    TrangThai: "Đã đặt",
    KhuVuc: "A2",
    HinhAnh: "https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=400&q=80",
    ChuSoHuu: sanUsers[1]
  },
  {
    SanID: 203,
    TenSan: "Sân Hòa Bình",
    MonTheThao: "Bóng đá",
    LoaiSan: "Sân 11 người",
    GiaThue: 600000,
    TrangThai: "Còn trống",
    KhuVuc: "A3",
    HinhAnh: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=400&q=80",
    ChuSoHuu: sanUsers[2]
  },
  // Bóng rổ
  {
    SanID: 301,
    TenSan: "Sân Rổ Sunrise",
    MonTheThao: "Bóng rổ",
    LoaiSan: "Sân tiêu chuẩn",
    GiaThue: 200000,
    TrangThai: "Còn trống",
    KhuVuc: "B",
    HinhAnh: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=400&q=80",
    ChuSoHuu: sanUsers[0]
  },
  {
    SanID: 302,
    TenSan: "Sân Rổ Victory",
    MonTheThao: "Bóng rổ",
    LoaiSan: "Sân mini",
    GiaThue: 150000,
    TrangThai: "Đã đặt",
    KhuVuc: "B",
    HinhAnh: "https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=400&q=80",
    ChuSoHuu: sanUsers[1]
  },
  {
    SanID: 303,
    TenSan: "Sân Rổ Dream",
    MonTheThao: "Bóng rổ",
    LoaiSan: "Sân ngoài trời",
    GiaThue: 180000,
    TrangThai: "Còn trống",
    KhuVuc: "B",
    HinhAnh: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80",
    ChuSoHuu: sanUsers[2]
  },
  // Tennis
  {
    SanID: 401,
    TenSan: "Sân Tennis Green",
    MonTheThao: "Tennis",
    LoaiSan: "Sân đất nện",
    GiaThue: 350000,
    TrangThai: "Còn trống",
    KhuVuc: "C",
    HinhAnh: "https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=400&q=80",
    ChuSoHuu: sanUsers[0]
  },
  {
    SanID: 402,
    TenSan: "Sân Tennis Pro",
    MonTheThao: "Tennis",
    LoaiSan: "Sân cỏ",
    GiaThue: 320000,
    TrangThai: "Đã đặt",
    KhuVuc: "C",
    HinhAnh: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=400&q=80",
    ChuSoHuu: sanUsers[1]
  },
  {
    SanID: 403,
    TenSan: "Sân Tennis Sun",
    MonTheThao: "Tennis",
    LoaiSan: "Sân cứng",
    GiaThue: 330000,
    TrangThai: "Còn trống",
    KhuVuc: "C",
    HinhAnh: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80",
    ChuSoHuu: sanUsers[2]
  },
  // Cầu lông
  {
    SanID: 501,
    TenSan: "Sân Cầu Lông Family",
    MonTheThao: "Cầu lông",
    LoaiSan: "Sân tiêu chuẩn",
    GiaThue: 120000,
    TrangThai: "Còn trống",
    KhuVuc: "A1",
    HinhAnh: "https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=400&q=80",
    ChuSoHuu: sanUsers[0]
  },
  {
    SanID: 502,
    TenSan: "Sân Cầu Lông Pro",
    MonTheThao: "Cầu lông",
    LoaiSan: "Sân mini",
    GiaThue: 100000,
    TrangThai: "Đã đặt",
    KhuVuc: "A2",
    HinhAnh: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=400&q=80",
    ChuSoHuu: sanUsers[1]
  },
  {
    SanID: 503,
    TenSan: "Sân Cầu Lông Sun",
    MonTheThao: "Cầu lông",
    LoaiSan: "Sân ngoài trời",
    GiaThue: 110000,
    TrangThai: "Còn trống",
    KhuVuc: "A3",
    HinhAnh: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80",
    ChuSoHuu: sanUsers[2]
  },
  // Bóng chuyền
  {
    SanID: 601,
    TenSan: "Sân Bóng Chuyền Star",
    MonTheThao: "Bóng chuyền",
    LoaiSan: "Sân tiêu chuẩn",
    GiaThue: 180000,
    TrangThai: "Còn trống",
    KhuVuc: "B",
    HinhAnh: "https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=400&q=80",
    ChuSoHuu: sanUsers[0]
  },
  {
    SanID: 602,
    TenSan: "Sân Bóng Chuyền Pro",
    MonTheThao: "Bóng chuyền",
    LoaiSan: "Sân mini",
    GiaThue: 160000,
    TrangThai: "Đã đặt",
    KhuVuc: "C",
    HinhAnh: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=400&q=80",
    ChuSoHuu: sanUsers[1]
  },
  {
    SanID: 603,
    TenSan: "Sân Bóng Chuyền Sun",
    MonTheThao: "Bóng chuyền",
    LoaiSan: "Sân ngoài trời",
    GiaThue: 170000,
    TrangThai: "Còn trống",
    KhuVuc: "B",
    HinhAnh: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80",
    ChuSoHuu: sanUsers[2]
  }
];

// Dữ liệu booking
export const bookingSanList = [
  { SanID: 1, TenSan: "Sân 1" },
  { SanID: 2, TenSan: "Sân 2" },
  { SanID: 3, TenSan: "Sân 3" },
  { SanID: 4, TenSan: "Sân 4" },
  { SanID: 5, TenSan: "Sân 5" },
  { SanID: 6, TenSan: "Sân 6" },
  { SanID: 7, TenSan: "Sân 7" },
  { SanID: 8, TenSan: "Sân 8" },
  { SanID: 9, TenSan: "Sân 9" },
  { SanID: 10, TenSan: "Sân 10" },
];

export const timeSlots = [
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"
];

// Trạng thái: trống, đã đặt, khóa
export const statusColors = {
  "trong": "bg-white",
  "dadat": "bg-red-300",
  "khoa": "bg-gray-400",
  "chon": "bg-green-300"
};

// Dữ liệu lịch đặt sân ảo
export const fakeBookingData = {};

// Khởi tạo dữ liệu booking
bookingSanList.forEach(san => {
  fakeBookingData[san.SanID] = {};
  timeSlots.forEach((slot, idx) => {
    // Random trạng thái
    if (idx < 6) fakeBookingData[san.SanID][slot] = "khoa";
    else if (san.SanID === 1 && ["14:00", "14:30", "15:00", "16:00"].includes(slot)) fakeBookingData[san.SanID][slot] = "dadat";
    else if (san.SanID === 2 && slot === "15:00") fakeBookingData[san.SanID][slot] = "dadat";
    else fakeBookingData[san.SanID][slot] = "trong";
  });
});

// Hàm lấy giờ kết thúc (giả lập: mỗi slot 30 phút)
export function getEndTime(start) {
  const [h, m] = start.split(":").map(Number);
  let endM = m + 30;
  let endH = h;
  if (endM >= 60) {
    endH += 1;
    endM -= 60;
  }
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}
