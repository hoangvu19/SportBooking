import  { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import "../../App.css";
import { bookingAPI, facilityAPI } from "../../utils/api";
import { timeSlots, getEndTime } from "../../utils/bookingUtils";
import React from "react";
import { useI18n } from '../../i18n/hooks';
import toast from 'react-hot-toast';

export default function Booking() {
	const location = useLocation();
	const { t } = useI18n();
	const [selectedSlots, setSelectedSlots] = useState([]);
	const [showModal, setShowModal] = useState(false);
	const [form, setForm] = useState({ name: "", phone: "", email: "", note: "" });
	const [field, setField] = useState(null);
	const [availability, setAvailability] = useState([]);
	const [availLoading, setAvailLoading] = useState(false);
	const [availError, setAvailError] = useState(null);

	const queryParams = new URLSearchParams(location.search);
	const sanId = queryParams.get('sanId');
	const queryTimeSlot = queryParams.get('timeSlot');

	// Map of status -> tailwind background classes (safe defaults)
	const statusColors = {
		trong: 'bg-white',
		dadat: 'bg-red-100',
		khoa: 'bg-gray-100',
		chon: 'bg-indigo-600 text-white'
	};

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			if (!sanId) return;
			setAvailLoading(true);
			setAvailError(null);
			try {
				const fResp = await facilityAPI.getById(Number(sanId));
				if (fResp && fResp.success && fResp.data) setField(fResp.data);

				const dateStr = new Date().toISOString().split('T')[0];
				const resp = await bookingAPI.getFieldAvailability(Number(sanId), dateStr);
				if (!cancelled) {
					if (resp && resp.success && Array.isArray(resp.data)) {
						setAvailability(resp.data);
						if (queryTimeSlot) {
							const slotIndex = parseInt(queryTimeSlot) - 1;
							if (slotIndex >= 0 && slotIndex < resp.data.length) {
								const slot = resp.data[slotIndex];
								const startTime = slot.StartTime ? new Date(slot.StartTime).toTimeString().slice(0,5) : slot.start || slot.Start;
								const sStatus = slot.Status ? String(slot.Status).toLowerCase() : '';
								if (sStatus === 'available' || sStatus === 'trong' || sStatus === '0' || sStatus === '') {
									setSelectedSlots([startTime]);
								}
							}
						}
					} else if (Array.isArray(resp)) {
						setAvailability(resp);
					} else {
						setAvailability([]);
					}
				}
			} catch (err) {
				console.error('Load availability error', err);
				if (!cancelled) setAvailError('Unable to load availability');
			} finally {
				if (!cancelled) setAvailLoading(false);
			}
		};
		load();
		return () => { cancelled = true; };
	}, [sanId, queryTimeSlot]);

	const giaSan = field?.GiaThue || 90000;
	const handleSelectSlot = (slot) => {
		const slotObj = availability.find(s => {
			const st = s.StartTime ? new Date(s.StartTime).toTimeString().slice(0,5) : (s.start || s.Start);
			return st === slot;
		});
		const status = slotObj?.Status ?? slotObj?.status ?? '';
		const s = String(status).toLowerCase();
		const isAvailable = (s === 'available' || s === 'trong' || s === '0' || s === '' || s === 'free');
		if (!isAvailable) return;
		setSelectedSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]);
	};

	const tongTien = selectedSlots.length * giaSan;

	const openBookingModal = () => setShowModal(true);
	const handleFormChange = (e) => {
		const { name, value } = e.target;
		setForm(prev => ({ ...prev, [name]: value }));
	};
	const handleBooking = (e) => {
		e.preventDefault();
		toast.success(t('booking.bookingSuccessWithTotal').replace('{total}', tongTien.toLocaleString()));
		setForm({ name: "", phone: "", email: "", note: "" });
		setSelectedSlots([]);
		setShowModal(false);
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-2xl font-bold mb-4">{t('booking.book')} {field?.TenSan || field?.Name}</h1>
      
			{/* Bảng đặt sân */}
			<div className="bg-white rounded-lg shadow-md p-6 mb-6">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">{t('booking.scheduleFor').replace('{date}', new Date().toLocaleDateString())}</h2>
					<div className="flex gap-2">
						<div className="flex items-center gap-1">
							<div className={`w-4 h-4 ${statusColors.trong} border border-gray-300 rounded-sm`}></div>
							<span className="text-sm">{t('booking.legend.available')}</span>
						</div>
						<div className="flex items-center gap-1">
							<div className={`w-4 h-4 ${statusColors.dadat} border border-gray-300 rounded-sm`}></div>
							<span className="text-sm">{t('booking.legend.booked')}</span>
						</div>
						<div className="flex items-center gap-1">
							<div className={`w-4 h-4 ${statusColors.khoa} border border-gray-300 rounded-sm`}></div>
							<span className="text-sm">{t('booking.legend.locked')}</span>
						</div>
						<div className="flex items-center gap-1">
							<div className={`w-4 h-4 ${statusColors.chon} border border-gray-300 rounded-sm`}></div>
							<span className="text-sm">{t('booking.legend.selected')}</span>
						</div>
					</div>
				</div>
        
				{availLoading ? (
					<div className="text-sm text-gray-500">{t('booking.loadingAvailability')}</div>
				) : availError ? (
					<div className="text-sm text-red-500">{availError}</div>
				) : (
					<div className="grid grid-cols-4 gap-3 md:grid-cols-7">
						{timeSlots.map(slot => {
							// derive status from availability entries
							const slotObj = availability.find(s => {
								const st = s?.StartTime ? new Date(s.StartTime).toTimeString().slice(0,5) : (s.start || s.Start || slot);
								return st === slot;
							});
							const status = slotObj ? (slotObj.Status ?? slotObj.status ?? slotObj.StatusName ?? '') : 'trong';
							const isSelected = selectedSlots.includes(slot);
							let bgClass = (typeof statusColors !== 'undefined' && statusColors[status]) ? statusColors[status] : 'bg-white';
							if (isSelected) bgClass = (typeof statusColors !== 'undefined' && statusColors.chon) ? statusColors.chon : 'bg-indigo-600';

							return (
								<div
									key={slot}
									onClick={() => handleSelectSlot(slot)}
									className={`${bgClass} border border-gray-300 rounded-md p-3 text-center cursor-pointer transition-colors duration-200 hover:shadow-md ${status !== "trong" && !isSelected ? "cursor-not-allowed opacity-70" : ""}`}
								>
									<div className="font-medium">{slot}</div>
									<div className="text-xs text-gray-600">{getEndTime(slot)}</div>
									{status === "dadat" && <div className="text-xs font-semibold mt-1 text-red-700">{t('booking.legend.booked')}</div>}
											{status === "khoa" && <div className="text-xs font-semibold mt-1 text-gray-700">{t('booking.legend.locked')}</div>}
								</div>
							);
							})}
						</div>
					)}
			</div>
      
			{/* Thông tin đặt sân */}
			<div className="bg-white rounded-lg shadow-md p-6">
				<h2 className="text-lg font-semibold mb-4">{t('booking.bookingInfoHeading')}</h2>
        
				<div className="space-y-3">
					<div className="flex items-center justify-between">
							<span>{t('booking.fieldLabel')}:</span>
						<span className="font-medium">{field?.TenSan || field?.Name}</span>
					</div>
					<div className="flex items-center justify-between">
							<span>{t('booking.dateLabel')}:</span>
						<span className="font-medium">{new Date().toLocaleDateString()}</span>
					</div>
					<div className="flex items-center justify-between">
							<span>{t('booking.timeSlotsLabel')}:</span>
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
									<span className="text-gray-500">{t('booking.noSlotsSelected')}</span>
							)}
						</div>
					</div>
					<div className="flex items-center justify-between">
							<span>{t('booking.numberOfSlots')}:</span>
						<span className="font-medium">{selectedSlots.length}</span>
					</div>
					<div className="flex items-center justify-between">
							<span>{t('booking.unitPrice')}:</span>
							<span className="font-medium">{giaSan.toLocaleString()} / 30 min</span>
					</div>
					<div className="border-t border-gray-200 pt-3 mt-3">
						<div className="flex items-center justify-between text-lg">
								<span className="font-semibold">{t('booking.totalAmountLabel')}:</span>
								<span className="font-bold text-indigo-600">{tongTien.toLocaleString()}</span>
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
						{t('booking.bookButton')}
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
            
						<h2 className="text-xl font-bold mb-4">Confirm booking</h2>
            
						<div className="mb-4 pb-4 border-b border-gray-200">
							<div className="flex justify-between mb-1">
								<span className="text-gray-600">Field:</span>
								<span className="font-medium">{field?.TenSan || field?.Name}</span>
							</div>
							<div className="flex justify-between mb-1">
								<span className="text-gray-600">Time:</span>
								<div className="text-right">
									{selectedSlots.map(slot => (
										<div key={slot} className="font-medium">
											{slot} - {getEndTime(slot)}
										</div>
									))}
								</div>
							</div>
							<div className="flex justify-between font-bold">
								<span>Total:</span>
								<span className="text-indigo-600">{tongTien.toLocaleString()}</span>
							</div>
						</div>
            
						<form onSubmit={handleBooking} className="space-y-4">
							<div>
									<label className="block text-sm font-medium mb-1" htmlFor="name">
									Full name
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
									Phone number
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
									Note
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
								Confirm booking
							</button>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

