import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../../App.css";
import BookingModal from "../../components/Sport/BookingModal";
import { facilityAPI } from "../../utils/api";
import DEFAULT_AVATAR from "../../utils/defaults";
import Loading from "../../components/Shared/Loading";

function SanList() {
  const navigate = useNavigate();
  const [showBooking, setShowBooking] = useState(false);
  const [bookingSan, setBookingSan] = useState(null);
  const [bookingInitialArea, setBookingInitialArea] = useState(null);
  const [searchTenSan, setSearchTenSan] = useState('');
  const [filterMonTheThao, setFilterMonTheThao] = useState('');
  const [filterLoaiSan, setFilterLoaiSan] = useState('');
  const [filterKhuVuc, setFilterKhuVuc] = useState('');
  const [filterTrangThai, setFilterTrangThai] = useState('');
  const [sanList, setSanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch facilities from API
  useEffect(() => {
    fetchFacilities();
  }, []);

  const fetchFacilities = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await facilityAPI.getAll();
      if (result.success && result.data) {
        // SportField API returns data in correct format already
        const facilities = result.data.map(field => ({
          SanID: field.SanID || field.FieldID,
          FieldID: field.FieldID,
          TenSan: field.TenSan || field.FieldName,
          LoaiSan: field.LoaiSan || field.FieldType || 'Không rõ',
          MonTheThao: field.MonTheThao || field.SportName || 'Không rõ',
          GiaThue: field.GiaThue || field.RentalPrice || 0,
          TrangThai: field.TrangThai || field.Status || 'Còn trống',
          KhuVuc: field.KhuVuc || field.AreaName || 'Không rõ',
          FieldArea: field.FieldArea || field.KhuVuc || 'Không rõ',
          HinhAnh: field.HinhAnh || field.Image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="%23E2E8F0"%3E%3Crect width="200" height="140" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23718096"%3ENo Image%3C/text%3E%3C/svg%3E',
          ChuSoHuu: field.ChuSoHuu || {
            HoTen: field.OwnerName || 'Chưa rõ',
            Avatar: field.OwnerAvatar || DEFAULT_AVATAR
          }
        }));
        setSanList(facilities);
      } else {
        setError(result.message || 'Không thể tải danh sách sân');
      }
    } catch (err) {
      console.error('Fetch facilities error:', err);
      setError('Lỗi khi tải danh sách sân');
    } finally {
      setLoading(false);
    }
  };

  // Lấy các tùy chọn bộ lọc duy nhất từ dữ liệu
  const monTheThaoOptions = [...new Set(sanList.map(san => san.MonTheThao))];
  const loaiSanOptions = [...new Set(sanList.map(san => san.LoaiSan))];
  const khuVucOptions = [...new Set(sanList.map(san => san.KhuVuc))];
  const trangThaiOptions = [...new Set(sanList.map(san => san.TrangThai))];

  // Lọc danh sách sân theo các tiêu chí
  const filteredSanList = sanList.filter(san => {
    return (
      san.TenSan.toLowerCase().includes(searchTenSan.toLowerCase()) &&
      (filterMonTheThao === '' || san.MonTheThao === filterMonTheThao) &&
      (filterLoaiSan === '' || san.LoaiSan === filterLoaiSan) &&
      (filterKhuVuc === '' || san.KhuVuc === filterKhuVuc) &&
      (filterTrangThai === '' || san.TrangThai === filterTrangThai)
    );
  });

  // Xử lý khi người dùng muốn đặt sân
  const handleDatSan = (san) => {
    setBookingSan(san);
    setBookingInitialArea(san.KhuVuc || null);
    setShowBooking(true);
  };

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="h-full overflow-y-scroll no-scrollbar py-6 xl:pr-5">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button 
            onClick={fetchFacilities}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-scroll no-scrollbar py-6 xl:pr-5">
      <h2 className="text-2xl font-bold mb-4">Đặt sân thể thao ngay</h2>
      <div className="bg-white rounded-xl shadow p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div>
          <label className="block text-sm font-medium mb-1">Tên sân</label>
          <input
            type="text"
            value={searchTenSan}
            onChange={e => setSearchTenSan(e.target.value)}
            className="border rounded px-2 py-1 w-40"
            placeholder="Tìm kiếm tên sân..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Môn thể thao</label>
          <select value={filterMonTheThao} onChange={e => setFilterMonTheThao(e.target.value)} className="border rounded px-2 py-1">
            <option value="">Tất cả</option>
            {monTheThaoOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Loại sân</label>
          <select value={filterLoaiSan} onChange={e => setFilterLoaiSan(e.target.value)} className="border rounded px-2 py-1">
            <option value="">Tất cả</option>
            {loaiSanOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Khu vực</label>
          <select value={filterKhuVuc} onChange={e => setFilterKhuVuc(e.target.value)} className="border rounded px-2 py-1">
            <option value="">Tất cả</option>
            {khuVucOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Trạng thái</label>
          <select value={filterTrangThai} onChange={e => setFilterTrangThai(e.target.value)} className="border rounded px-2 py-1">
            <option value="">Tất cả</option>
            {trangThaiOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSanList.length === 0 ? (
          <div className="col-span-3 text-center text-gray-500">Không có sân phù hợp</div>
        ) : (
          filteredSanList.map((san) => (
            <div
              key={san.SanID}
              data-testid="san-card"
              data-sanid={san.SanID}
              className="bg-white rounded-2xl border border-gray-200 shadow-md p-4 flex flex-col items-center cursor-pointer hover:shadow-lg hover:border-indigo-300 transition-all relative"
              style={{ minHeight: 340 }}
              onClick={() => navigate(`/san/${san.SanID}`)}
            >
              <div className="w-full flex justify-center mb-3 relative">
                <img
                  src={san.HinhAnh || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="%23E2E8F0"%3E%3Crect width="200" height="140" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23718096"%3ENo Image%3C/text%3E%3C/svg%3E'}
                  alt={san.TenSan}
                  className="rounded-lg object-cover bg-gray-100"
                  style={{ width: 200, height: 140 }}
                />
                <span className="absolute top-2 right-2 bg-yellow-400 text-white text-xs font-bold px-2 py-1 rounded">4.9 ★</span>
              </div>
              <h3 className="font-semibold text-base mb-1 text-center line-clamp-2" style={{ minHeight: 48 }}>{san.TenSan}</h3>
              <div className="mb-2 text-center">Giá thuê: <span className="font-bold text-indigo-600">{san.GiaThue.toLocaleString()}đ</span></div>
              <div className="mb-2 text-center">Trạng thái: <span className={san.TrangThai === "Còn trống" ? "text-green-600" : "text-red-600"}>{san.TrangThai}</span></div>
              <div className="flex items-center justify-center mt-2 mb-2">
                <img src={san.ChuSoHuu?.Avatar || DEFAULT_AVATAR} alt={san.ChuSoHuu.HoTen} className="w-7 h-7 rounded-full mr-2" onError={(e)=>{e.target.src = DEFAULT_AVATAR}} />
                <span className="text-xs text-gray-700">{san.ChuSoHuu.HoTen}</span>
              </div>
              <button
                data-testid={`san-book-btn-${san.SanID}`}
                className="mt-auto px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 w-full font-semibold"
                onClick={e => { 
                  e.stopPropagation(); // Prevent navigation to detail page
                  handleDatSan(san); 
                }}
                disabled={san.TrangThai !== "Còn trống"}
              >
                Đặt sân
              </button>
            </div>
          ))
        )}
      </div>
      {/* Hiển thị Booking modal nếu showBooking true */}
      {showBooking && (
  <BookingModal san={bookingSan} onClose={() => setShowBooking(false)} initialArea={bookingInitialArea} />
      )}
    </div>
  );
}

export default SanList;
