import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import "../../App.css";
import { sanList, bookingSanList, timeSlots, statusColors, fakeBookingData, getEndTime } from "../../assets/sanData";

export default function Booking() {
	const location = useLocation();
	const [selectedSlots, setSelectedSlots] = useState([]);
	const [showModal, setShowModal] = useState(false);
	const [form, setForm] = useState({ name: "", phone: "", email: "", note: "" });
  
	const queryParams = new URLSearchParams(location.search);
	const sanId = queryParams.get('sanId');
	const queryTimeSlot = queryParams.get('timeSlot');
  
	const san = sanList.find(s => s.SanID === Number(sanId)) || 
							bookingSanList.find(s => s.SanID === Number(sanId)) || 
							bookingSanList[0];
  
	useEffect(() => {
		if (queryTimeSlot) {
			const slotIndex = parseInt(queryTimeSlot) - 1;
			if (slotIndex >= 0 && slotIndex < timeSlots.length) {
				const timeSlot = timeSlots[slotIndex];
				const status = fakeBookingData[san.SanID]?.[timeSlot];
				if (status === "trong") {
					setSelectedSlots([timeSlot]);
				}
			}
		}
	}, [queryTimeSlot, san.SanID]);

	const giaSan = 90000;
	const handleSelectSlot = (slot) => {
		const status = fakeBookingData[san.SanID][slot];
		if (status !== "trong") return;
		setSelectedSlots(prev =>
			prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
		);
	};

	const tongTien = selectedSlots.length * giaSan;

	const openBookingModal = () => setShowModal(true);
	const handleFormChange = (e) => {
		const { name, value } = e.target;
		setForm(prev => ({ ...prev, [name]: value }));
	};
	const handleBooking = (e) => {
		e.preventDefault();
		alert(`Đặt sân thành công! Tổng thanh toán: ${tongTien.toLocaleString()}đ`);
		setForm({ name: "", phone: "", email: "", note: "" });
		setSelectedSlots([]);
		setShowModal(false);
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-2xl font-bold mb-4">Đặt sân {san?.TenSan}</h1>
      
			{/* Bảng đặt sân */}
			<div className="bg-white rounded-lg shadow-md p-6 mb-6">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">Lịch đặt sân ngày {new Date().toLocaleDateString()}</h2>
					<div className="flex gap-2">
						<div className="flex items-center gap-1">
							<div className={`w-4 h-4 ${statusColors.trong} border border-gray-300 rounded-sm`}></div>
							<span className="text-sm">Trống</span>
						</div>
						<div className="flex items-center gap-1">
							<div className={`w-4 h-4 ${statusColors.dadat} border border-gray-300 rounded-sm`}></div>
							<span className="text-sm">Đã đặt</span>
						</div>
						<div className="flex items-center gap-1">
							<div className={`w-4 h-4 ${statusColors.khoa} border border-gray-300 rounded-sm`}></div>
							<span className="text-sm">Khóa</span>
						</div>
						<div className="flex items-center gap-1">
							<div className={`w-4 h-4 ${statusColors.chon} border border-gray-300 rounded-sm`}></div>
							<span className="text-sm">Đang chọn</span>
						</div>
					</div>
				</div>
        
				<div className="grid grid-cols-4 gap-3 md:grid-cols-7">
					{timeSlots.map(slot => {
						const status = fakeBookingData[san.SanID][slot];
						const isSelected = selectedSlots.includes(slot);
						let bgClass = statusColors[status];
						if (isSelected) bgClass = statusColors.chon;
            
						return (
							<div
								key={slot}
								onClick={() => handleSelectSlot(slot)}
								className={`${bgClass} border border-gray-300 rounded-md p-3 text-center cursor-pointer transition-colors duration-200 hover:shadow-md ${status !== "trong" && !isSelected ? "cursor-not-allowed opacity-70" : ""}`}
							>
								<div className="font-medium">{slot}</div>
								<div className="text-xs text-gray-600">{getEndTime(slot)}</div>
								{status === "dadat" && <div className="text-xs font-semibold mt-1 text-red-700">Đã đặt</div>}
								{status === "khoa" && <div className="text-xs font-semibold mt-1 text-gray-700">Khóa</div>}
							</div>
						);
					})}
				</div>
			</div>
      
			{/* Thông tin đặt sân */}
			<div className="bg-white rounded-lg shadow-md p-6">
				<h2 className="text-lg font-semibold mb-4">Thông tin đặt sân</h2>
        
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<span>Sân:</span>
						<span className="font-medium">{san?.TenSan}</span>
					</div>
					<div className="flex items-center justify-between">
						<span>Ngày:</span>
						<span className="font-medium">{new Date().toLocaleDateString()}</span>
					</div>
					<div className="flex items-center justify-between">
						<span>Khung giờ:</span>
						<div className="text-right">
							{selectedSlots.length > 0 ? (
								<div className="space-y-1">
									{selectedSlots.map(slot => (
										<div key={slot} className="font-medium">
											{slot} - {getEndTime(slot)}
										</div>
									))}
								</div>
							) : (
								<span className="text-gray-500">Chưa chọn khung giờ</span>
							)}
						</div>
					</div>
					<div className="flex items-center justify-between">
						<span>Số khung giờ:</span>
						<span className="font-medium">{selectedSlots.length}</span>
					</div>
					<div className="flex items-center justify-between">
						<span>Đơn giá:</span>
						<span className="font-medium">{giaSan.toLocaleString()}đ / 30 phút</span>
					</div>
					<div className="border-t border-gray-200 pt-3 mt-3">
						<div className="flex items-center justify-between text-lg">
							<span className="font-semibold">Tổng thanh toán:</span>
							<span className="font-bold text-indigo-600">{tongTien.toLocaleString()}đ</span>
						</div>
					</div>
				</div>
        
				<button
					onClick={openBookingModal}
					disabled={selectedSlots.length === 0}
					className={`w-full mt-6 py-2.5 rounded-md font-medium ${
						selectedSlots.length > 0 
							? "bg-indigo-600 text-white hover:bg-indigo-700" 
							: "bg-gray-300 text-gray-500 cursor-not-allowed"
					}`}
				>
					Đặt sân
				</button>
			</div>
      
			{/* Modal đặt sân */}
			{showModal && (
				<div className="fixed inset-0 z-50 overflow-y-auto bg-white flex items-center justify-center p-4">
					<div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
						<button
							onClick={() => setShowModal(false)}
							className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
						>
							<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
            
						<h2 className="text-xl font-bold mb-4">Xác nhận đặt sân</h2>
            
						<div className="mb-4 pb-4 border-b border-gray-200">
							<div className="flex justify-between mb-1">
								<span className="text-gray-600">Sân:</span>
								<span className="font-medium">{san?.TenSan}</span>
							</div>
							<div className="flex justify-between mb-1">
								<span className="text-gray-600">Thời gian:</span>
								<div className="text-right">
									{selectedSlots.map(slot => (
										<div key={slot} className="font-medium">
											{slot} - {getEndTime(slot)}
										</div>
									))}
								</div>
							</div>
							<div className="flex justify-between font-bold">
								<span>Tổng tiền:</span>
								<span className="text-indigo-600">{tongTien.toLocaleString()}đ</span>
							</div>
						</div>
            
						<form onSubmit={handleBooking} className="space-y-4">
							<div>
								<label className="block text-sm font-medium mb-1" htmlFor="name">
									Họ tên
								</label>
								<input
									type="text"
									id="name"
									name="name"
									value={form.name}
									onChange={handleFormChange}
									required
									className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium mb-1" htmlFor="phone">
									Số điện thoại
								</label>
								<input
									type="tel"
									id="phone"
									name="phone"
									value={form.phone}
									onChange={handleFormChange}
									required
									className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium mb-1" htmlFor="email">
									Email
								</label>
								<input
									type="email"
									id="email"
									name="email"
									value={form.email}
									onChange={handleFormChange}
									required
									className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium mb-1" htmlFor="note">
									Ghi chú
								</label>
								<textarea
									id="note"
									name="note"
									value={form.note}
									onChange={handleFormChange}
									rows={3}
									className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
								></textarea>
							</div>
							<button
								type="submit"
								className="w-full bg-indigo-600 text-white py-2.5 rounded-md font-medium hover:bg-indigo-700 transition-colors"
							>
								Xác nhận đặt sân
							</button>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

