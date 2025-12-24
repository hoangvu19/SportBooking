import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../utils/apiClient';
import { useI18n } from '../../i18n';

const SportFieldCalendar = ({ referenceData }) => {
  const [selectedField, setSelectedField] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedule, setSchedule] = useState([]);
  const [availableFields, setAvailableFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: ''
  });
  const { t } = useI18n();

  // Generate time slots from 6:00 to 23:00
  const timeSlots = Array.from({ length: 17 }, (_, i) => {
    const hour = i + 6;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  const fetchSchedule = useCallback(async (field, date) => {
    if (!field || !date) return;
    setLoading(true);
    try {
      // Use bookings availability endpoint
      const response = await apiClient.get(`/bookings/fields/${field}/availability?date=${date}`);
      // apiClient.get returns an object like { data: <serverBody> }
      // serverBody is { success: true, data: [...] }
      const serverBody = response && response.data ? response.data : null;
      setSchedule((serverBody && Array.isArray(serverBody.data)) ? serverBody.data : []);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedField && selectedDate) {
      fetchSchedule(selectedField, selectedDate);
    }
  }, [selectedField, selectedDate, fetchSchedule]);

  // If parent didn't pass referenceData.sportFields, try to load all sport fields
  useEffect(() => {
    let cancelled = false;
    const loadFields = async () => {
      try {
        if (referenceData && Array.isArray(referenceData.sportFields) && referenceData.sportFields.length > 0) {
          setAvailableFields(referenceData.sportFields);
          return;
        }
        const resp = await apiClient.get('/sport-fields').catch(() => null);
        const body = resp && resp.data ? resp.data : null;
        const list = (body && Array.isArray(body.data)) ? body.data : (body && Array.isArray(body) ? body : []);
        if (!cancelled) setAvailableFields(list);
      } catch (err) {
        console.error('Error loading sport fields:', err);
        if (!cancelled) setAvailableFields([]);
      }
    };
    loadFields();
    return () => { cancelled = true; };
  }, [referenceData]);

  

  const isTimeSlotBooked = (time) => {
    return schedule.some(booking => {
      const bookingStart = new Date(booking.StartTime);
      const bookingEnd = new Date(booking.EndTime);
      const slotTime = new Date(`${selectedDate}T${time}:00`);
      
      return slotTime >= bookingStart && slotTime < bookingEnd;
    });
  };

  const getBookingForSlot = (time) => {
    return schedule.find(booking => {
      const bookingStart = new Date(booking.StartTime);
      const bookingEnd = new Date(booking.EndTime);
      const slotTime = new Date(`${selectedDate}T${time}:00`);
      
      return slotTime >= bookingStart && slotTime < bookingEnd;
    });
  };

  const handleTimeSlotClick = (time) => {
    if (!isTimeSlotBooked(time)) {
      setSelectedTimeSlot(time);
      setShowBookingModal(true);
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    
    if (!bookingForm.customerName || !bookingForm.customerPhone) {
      alert('Vui lòng nhập đầy đủ thông tin khách hàng');
      return;
    }

    const endHour = parseInt(selectedTimeSlot.split(':')[0]) + 1;
    const endTime = `${endHour.toString().padStart(2, '0')}:00`;

    try {
      // Create booking via main bookings endpoint
      await apiClient.post('/bookings', {
        fieldId: selectedField,
        startTime: `${selectedDate}T${selectedTimeSlot}:00`,
        endTime: `${selectedDate}T${endTime}:00`,
        // For admin users creating bookings on behalf of guest, the backend
        // will use req.user as CustomerID; include guest info in payload
        customerName: bookingForm.customerName,
        customerPhone: bookingForm.customerPhone,
        customerEmail: bookingForm.customerEmail
      });

      alert(t('booking.success','Booking created successfully'));
      setShowBookingModal(false);
      setBookingForm({
        customerName: '',
        customerPhone: '',
        customerEmail: ''
      });
      fetchSchedule(selectedField, selectedDate);
    } catch (error) {
      console.error('Error creating booking:', error);
      alert(t('booking.errorOccurred','Error creating booking: ') + (error.response?.message || error.message));
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Confirmed': return 'bg-blue-200 text-blue-800 border-blue-400';
      case 'Completed': return 'bg-green-200 text-green-800 border-green-400';
      case 'Cancelled': return 'bg-red-200 text-red-800 border-red-400';
      case 'Pending': return 'bg-yellow-200 text-yellow-800 border-yellow-400';
      default: return 'bg-gray-200 text-gray-800 border-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('calendar.chooseField','Choose Field')}
            </label>
            <select
              value={selectedField}
              onChange={(e) => setSelectedField(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- {t('calendar.chooseFieldPlaceholder','Choose field')} --</option>
              {(availableFields || []).map(field => (
                <option key={field.FieldID || field.id || field.FieldId} value={field.FieldID || field.id || field.FieldId}>
                  {field.FieldName || field.name || field.TenSan} - {field.FacilityName || field.TenCoSo || ''} ({field.SportTypeName || field.MonTheThao || ''})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('calendar.chooseDate','Choose Date')}
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      {selectedField ? (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">
            {t('calendar.scheduleFor','Schedule') + ' - ' + new Date(selectedDate).toLocaleDateString()}
          </h3>
          
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <p>{t('common.loading','Loading...')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {timeSlots.map(time => {
                const booking = getBookingForSlot(time);
                const isBooked = !!booking;

                return (
                  <div
                    key={time}
                    onClick={() => !isBooked && handleTimeSlotClick(time)}
                    className={`p-3 rounded-lg border-2 text-center cursor-pointer transition-all ${
                      isBooked 
                        ? getStatusColor(booking.Status) + ' cursor-not-allowed' 
                        : 'bg-green-50 border-green-300 hover:bg-green-100 hover:border-green-500'
                    }`}
                  >
                    <div className="font-bold text-sm">{time}</div>
                    {isBooked ? (
                      <div className="mt-1">
                        <div className="text-xs font-semibold truncate" title={booking.CustomerName}>
                          {booking.CustomerName}
                        </div>
                        <div className="text-xs opacity-75">{booking.Status}</div>
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-green-600 font-semibold">
                        {t('calendar.emptySlot','Available')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 pt-4 border-t flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-50 border-2 border-green-300 rounded"></div>
              <span>{t('booking.legend.available', 'Available')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-200 border-2 border-blue-400 rounded"></div>
              <span>{t('booking.status.Confirmed', 'Confirmed')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-200 border-2 border-green-400 rounded"></div>
              <span>{t('booking.status.Completed', 'Completed')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-200 border-2 border-yellow-400 rounded"></div>
              <span>{t('booking.status.Pending', 'Pending')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-200 border-2 border-red-400 rounded"></div>
              <span>{t('booking.status.Cancelled', 'Cancelled')}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
          <p>{t('calendar.pleaseChooseField','Please select a field to view the schedule')}</p>
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">
                    {t('booking.newBooking','Book Field')}
                  </h2>
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">{t('booking.date','Date')}:</span> {new Date(selectedDate).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">{t('booking.time','Time')}:</span> {selectedTimeSlot} - {parseInt(selectedTimeSlot.split(':')[0]) + 1}:00
                </p>
              </div>

              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('booking.customerName','Customer Name')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bookingForm.customerName}
                    onChange={(e) => setBookingForm(prev => ({...prev, customerName: e.target.value}))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={t('booking.customerNamePlaceholder','Enter customer name')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('booking.customerPhone','Phone')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={bookingForm.customerPhone}
                    onChange={(e) => setBookingForm(prev => ({...prev, customerPhone: e.target.value}))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={t('booking.customerPhonePlaceholder','Enter phone number')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('booking.customerEmail','Email (optional)')}
                  </label>
                  <input
                    type="email"
                    value={bookingForm.customerEmail}
                    onChange={(e) => setBookingForm(prev => ({...prev, customerEmail: e.target.value}))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={t('booking.customerEmailPlaceholder','Enter email')}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowBookingModal(false)}
                    className="flex-1 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    {t('common.cancel','Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                  >
                    {t('booking.confirmBooking','Confirm Booking')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SportFieldCalendar;
