import React from 'react';
import { getEndTime, timeSlots } from '../assets/sanData';

// Modal đặt sân
const BookingModal = ({ san, onClose, initialDate = null, initialSelectedSlots = [], initialArea = null }) => {
  const [date, setDate] = React.useState(initialDate || new Date().toISOString().split('T')[0]);
  const [activeArea, setActiveArea] = React.useState(initialArea || 'A1');
  const [selectedSlots, setSelectedSlots] = React.useState(Array.isArray(initialSelectedSlots) ? initialSelectedSlots : []);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", phone: "", email: "", note: "" });
  
  // Make sure san is defined - render guard is moved to after hooks to avoid conditional hook calls
  
  // Dữ liệu khu vực mẫu
  const areas = ['A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2', 'C3', 'D1'];

  // Ảnh cho từng khu vực (mỗi khu vực 1 ảnh khác nhau)
  const areaImages = {
    A1: 'https://images.unsplash.com/photo-1508609349937-5ec4ae374ebf?auto=format&fit=crop&w=1200&q=80',
    A2: 'https://images.unsplash.com/photo-1495567720989-cebdbdd97913?auto=format&fit=crop&w=1200&q=80',
    A3: 'https://images.unsplash.com/photo-1514511442896-0f0b2f7f9b9d?auto=format&fit=crop&w=1200&q=80',
    B1: 'https://images.unsplash.com/photo-1505765051613-1b3f3b8b6f7a?auto=format&fit=crop&w=1200&q=80',
    B2: 'https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=1200&q=80',
    C1: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
    C2: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    C3: 'https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=1200&q=80',
    D1: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=1200&q=80'
  };
  
  // Lấy tình trạng trống hay đã đặt (giả lập)
  const getSlotStatus = (area, slot) => {
    if (date === '2025-09-12' && slot > '18:00') return 'đã đặt';
    if (slot < '08:00' && area === 'A1') return 'đã đặt';
    if (slot > '20:00' && (area === 'A3' || area === 'B1')) return 'đã đặt';
    return 'trống';
  };

  // Chọn slot
  const handleSelectSlot = (slot) => {
    if (getSlotStatus(activeArea, slot) === 'đã đặt') return;
    
    if (selectedSlots.includes(slot)) {
      setSelectedSlots(prev => prev.filter(s => s !== slot));
    } else {
      setSelectedSlots(prev => [...prev, slot].sort());
    }
  };

  // Initialize from props when they change
  React.useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  // Sync initialArea prop
  React.useEffect(() => {
    if (initialArea) setActiveArea(initialArea);
  }, [initialArea]);

  React.useEffect(() => {
    if (Array.isArray(initialSelectedSlots) && initialSelectedSlots.length) {
      setSelectedSlots(initialSelectedSlots);
    }
  }, [initialSelectedSlots]);

  // When active area changes, clear selected slots (user should reselect for that area)
  React.useEffect(() => {
    setSelectedSlots([]);
  }, [activeArea]);

  // Tổng tiền
  const tongTien = selectedSlots.length * (san?.GiaThue || 200000);

  // Form xác nhận
  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Đặt sân thành công! Hệ thống sẽ liên hệ xác nhận trong thời gian sớm nhất.');
    onClose();
  };

  // Render guard after hooks
  if (!san) {
    console.error("BookingModal: san is undefined");
    return (
      <div data-testid="booking-modal" className="fixed inset-0 bg-white flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="text-xl font-bold">Lỗi: Không tìm thấy thông tin sân</h3>
            <button data-testid="booking-close" onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
          </div>
          <div className="p-4">Có lỗi xảy ra khi tải thông tin sân</div>
        </div>
      </div>
    );
  }

  return (
  <div data-testid="booking-modal" className="fixed inset-0 bg-white flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-0 border-b sticky top-0 bg-white">
          {/* Area image */}
          <div className="w-full h-40 overflow-hidden rounded-t-xl">
            <img src={areaImages[activeArea] || san?.HinhAnh} alt={`Khu vực ${activeArea}`} className="w-full h-full object-cover" />
          </div>
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="text-xl font-bold">Đặt sân - {san?.TenSan || ''} (Khu {activeArea})</h3>
            <button data-testid="booking-close" onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
          </div>
        </div>

        {!showConfirm ? (
          <>
            {/* Chọn ngày và khu vực */}
            <div className="p-4 flex flex-wrap gap-4 border-b">
              <div>
                <label className="block font-medium mb-2">Ngày</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-3 py-2" min={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label className="block font-medium mb-2">Khu vực</label>
                  <div className="flex flex-wrap gap-2">
                    {areas.map(area => {
                      const imgSrc = areaImages[area] || san?.HinhAnh;
                      const isSelected = activeArea === area;
                      return (
                        <button
                          key={area}
                          onClick={() => setActiveArea(area)}
                          className={`flex flex-col items-center overflow-hidden rounded-md border ${isSelected ? 'ring-2 ring-indigo-500' : 'hover:shadow-md'} focus:outline-none`}
                          aria-pressed={isSelected}
                          type="button"
                        >
                          <img src={imgSrc} alt={`Khu ${area}`} className="w-20 h-12 object-cover" />
                          <div className={`w-full text-center text-xs py-1 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>{area}</div>
                        </button>
                      );
                    })}
                  </div>
              </div>
            </div>

            {/* Bảng chọn giờ */}
            <div className="p-4">
              <h4 className="text-lg font-semibold mb-3">Chọn giờ đặt sân - Khu vực {activeArea}</h4>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-56 overflow-y-auto">
                {timeSlots.map((slot) => {
                  const status = getSlotStatus(activeArea, slot);
                  const isSelected = selectedSlots.includes(slot);
                  return (
                    <button
                      key={slot}
                      className={`px-2 py-3 rounded text-sm ${
                        isSelected ? 'bg-green-500 text-white' : 
                        status === 'đã đặt' ? 'bg-red-100 text-red-500 cursor-not-allowed' : 
                        'bg-gray-100 hover:bg-gray-200'
                      }`}
                      onClick={() => handleSelectSlot(slot)}
                      disabled={status === 'đã đặt'}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Giờ đã chọn */}
            <div className="p-4 border-t">
              <h4 className="text-lg font-semibold mb-2">Giờ đã chọn</h4>
              {selectedSlots.length === 0 ? (
                <p className="text-gray-500">Chưa chọn giờ nào</p>
              ) : (
                <div className="mb-4">
                  <ul className="flex flex-wrap gap-2 mb-3">
                    {selectedSlots.map(slot => (
                      <li key={slot} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg flex items-center">
                        <span>{slot} - {getEndTime(slot)}</span>
                        <button 
                          className="ml-2 text-blue-500 hover:text-blue-700"
                          onClick={() => setSelectedSlots(prev => prev.filter(s => s !== slot))}
                        >
                          &times;
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="font-bold text-lg">Tổng tiền: <span className="text-green-600">{tongTien.toLocaleString()}đ</span></div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t flex justify-end">
              <button 
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded mr-2"
                onClick={onClose}
              >
                Hủy
              </button>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
                disabled={selectedSlots.length === 0}
                onClick={() => setShowConfirm(true)}
              >
                Tiếp tục
              </button>
            </div>
          </>
        ) : (
          <div className="p-4 flex flex-col md:flex-row gap-6">
            <div className="md:w-1/2">
              <h4 className="text-lg font-semibold mb-4">Thông tin liên hệ</h4>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="block font-medium mb-1">Tên người đặt *</label>
                  <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-blue-500" placeholder="Nhập tên của bạn" />
                </div>
                <div className="mb-3">
                  <label className="block font-medium mb-1">Số điện thoại *</label>
                  <input type="text" required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-blue-500" placeholder="Nhập số điện thoại" />
                </div>
                <div className="mb-3">
                  <label className="block font-medium mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-blue-500" placeholder="Nhập email (không bắt buộc)" />
                </div>
                <div className="mb-3">
                  <label className="block font-medium mb-1">Ghi chú</label>
                  <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-blue-500" placeholder="Ghi chú thêm (nếu có)" />
                </div>

                <div className="flex gap-2 mt-4">
                  <button type="button" className="px-4 py-2 bg-gray-200 text-gray-700 rounded" onClick={() => setShowConfirm(false)}>Quay lại</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Xác nhận đặt sân</button>
                </div>
              </form>
            </div>

            <div className="md:w-1/2 bg-gray-50 p-4 rounded-lg">
              <h4 className="text-lg font-semibold mb-3">Thông tin đặt sân</h4>
              <div className="mb-3">
                <div className="mb-3">Tên sân: {san?.TenSan}</div>
                <div className="mb-3">Địa chỉ: Hà Nội</div>
                <div className="mb-3">Khung giờ:</div>
                <ul className="mb-3">
                  {selectedSlots.map(slot => (
                    <li key={slot} className="inline-block bg-blue-100 text-blue-700 px-3 py-2 rounded-lg mr-2 mb-2"><span className="mr-2">🕒</span>{slot} - {getEndTime(slot)}</li>
                  ))}
                </ul>
                <div className="mb-3">Tổng thời lượng: {selectedSlots.length * 30} phút</div>
                <div className="mb-3 font-bold text-xl">Tổng tiền: <span className="text-green-600">{tongTien.toLocaleString()}đ</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingModal;
