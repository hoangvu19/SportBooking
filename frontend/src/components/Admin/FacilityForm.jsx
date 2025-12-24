import React, { useState, useEffect } from 'react';
import { facilityAPI } from '../../utils/api';
import { useI18n } from '../../i18n/hooks';

const FacilityForm = ({ isOpen, onClose, onSubmit, facility, referenceData }) => {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    FacilityName: '',
    AreaID: '',
    OwnerID: '',
    // Address and Description removed per request
  });

  const [remoteFacility, setRemoteFacility] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedPreviews, setSelectedPreviews] = useState([]);
  const previewsRef = React.useRef([]);
  const [uploading, setUploading] = useState(false);

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (facility) {
      setFormData({
        FacilityName: facility.FacilityName || '',
        AreaID: facility.AreaID || '',
        OwnerID: facility.OwnerID || ''
      });
      // fetch full facility detail to get images
      (async () => {
        try {
          const res = await facilityAPI.getById(Number(facility.FacilityID));
          if (res && res.success) setRemoteFacility(res.data);
        } catch (err) {
          console.debug('Could not fetch facility detail for images', err && err.message);
          setRemoteFacility(null);
        }
      })();
    } else {
      setFormData({
        FacilityName: '',
        AreaID: '',
        OwnerID: ''
      });
      setRemoteFacility(null);
      // clear any selected previews when opening create form
      try { previewsRef.current.forEach(u => URL.revokeObjectURL(u.url)); } catch {};
      previewsRef.current = [];
      setSelectedFiles([]);
      setSelectedPreviews([]);
    }
    setErrors({});
  }, [facility, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    // revoke previous object URLs
    try { previewsRef.current.forEach(u => { try { URL.revokeObjectURL(u.url); } catch {} }); } catch {}
    const previews = files.map(f => ({ file: f, url: URL.createObjectURL(f) }));
    previewsRef.current = previews;
    setSelectedPreviews(previews);
    setSelectedFiles(files);
  };

  const removeSelectedPreview = (index) => {
    const prev = selectedPreviews.slice();
    const removed = prev.splice(index, 1)[0];
    try { URL.revokeObjectURL(removed.url); } catch {}
    previewsRef.current = prev;
    setSelectedPreviews(prev);
    const files = (selectedFiles || []).slice();
    files.splice(index, 1);
    setSelectedFiles(files);
  };

  useEffect(() => {
    return () => {
      try { previewsRef.current.forEach(u => { try { URL.revokeObjectURL(u.url); } catch {} }); } catch {}
      previewsRef.current = [];
    };
  }, []);

  const handleDeleteImage = async (image) => {
    if (!facility || !facility.FacilityID) return;
    if (!confirm('Bạn có chắc muốn xóa ảnh này?')) return;
    try {
      const res = await facilityAPI.deleteImage(facility.FacilityID, image.MediaID || image.MediaId || image.id || image.ImageID);
      if (res && res.success) {
        alert('Đã xóa ảnh');
        // refresh remoteFacility
        try {
          const refreshed = await facilityAPI.getById(Number(facility.FacilityID));
          if (refreshed && refreshed.success) setRemoteFacility(refreshed.data);
        } catch (e) { console.debug('Could not refresh facility after delete', e && e.message); }
      } else {
        alert((res && res.message) || 'Không thể xóa ảnh');
      }
    } catch (err) {
      console.error('Error deleting facility image:', err);
      alert('Lỗi khi xóa ảnh: ' + (err.message || ''));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.FacilityName || formData.FacilityName.trim() === '') {
      newErrors.FacilityName = t('admin.facilityForm.facilityNameRequired');
    }
    
    if (!formData.AreaID) {
      newErrors.AreaID = t('admin.facilityForm.areaRequired');
    }
    
    if (!formData.OwnerID) {
      newErrors.OwnerID = t('admin.facilityForm.ownerRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    (async () => {
      if (!validate()) return;

      try {
        const resp = await onSubmit(facility ? { ...formData, FacilityID: facility.FacilityID } : formData);
        if (!resp) throw new Error('No response from server');
        const success = (resp.data && resp.data.success) || resp.success;
        const data = (resp.data && resp.data.data) || resp.data || resp;
        if (!success) {
          const msg = (resp.data && resp.data.message) || resp.message || 'Lỗi khi lưu cơ sở';
          alert(msg);
          return;
        }

        // At this point facility created/updated. If user selected new files, replace images now
        const facilityId = (facility && facility.FacilityID) || (data && (data.FacilityID || data.id));
        if (selectedFiles && selectedFiles.length > 0) {
          setUploading(true);
          try {
            // delete old images
            if (remoteFacility && Array.isArray(remoteFacility.images) && remoteFacility.images.length > 0) {
              for (const img of remoteFacility.images) {
                try { await facilityAPI.deleteImage(facilityId, img.MediaID || img.MediaId || img.id || img.ImageID); } catch (e) { console.debug('ignore delete image error', e && e.message); }
              }
            }
            // upload new images
            try { await facilityAPI.uploadImages(facilityId, selectedFiles); } catch (e) { console.error('Error uploading facility images', e); alert('Lỗi khi tải ảnh mới: ' + (e.message || '')); }
          } finally { setUploading(false); }
        }

        // refresh remote facility
        try {
          const refreshed = await facilityAPI.getById(Number(facilityId));
          if (refreshed && refreshed.success) setRemoteFacility(refreshed.data);
        } catch (e) { console.debug('Could not refresh facility after save', e && e.message); }

        alert('Lưu cơ sở thành công');
        onClose();
      } catch (err) {
        console.error('Submit error:', err);
        alert('Lỗi: ' + (err.message || 'Không thể lưu cơ sở'));
      }
    })();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              {facility ? '✏️ ' + t('admin.facilityForm.titleEdit') : '➕ ' + t('admin.facilityForm.titleAdd')}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Facility Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('admin.facilityForm.facilityNameLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="FacilityName"
                  value={formData.FacilityName}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.FacilityName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder={t('admin.facilityForm.facilityNamePlaceholder')}
                  disabled={!!facility}
                />
              {errors.FacilityName && (
                <p className="text-red-500 text-xs mt-1">{errors.FacilityName}</p>
              )}
            </div>

            {/* Area */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('admin.facilityForm.areaLabel')} <span className="text-red-500">*</span>
              </label>
              <select
                name="AreaID"
                value={formData.AreaID}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.AreaID ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">{t('admin.facilityForm.areaPlaceholder')}</option>
                {referenceData?.areas?.map((area, idx) => (
                  <option key={area.AreaID || area.id || area.AreaName || idx} value={area.AreaID || area.id}>
                    {area.AreaName}
                  </option>
                ))}
              </select>
              {errors.AreaID && (
                <p className="text-red-500 text-xs mt-1">{errors.AreaID}</p>
              )}
            </div>

            {/* Owner */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('admin.facilityForm.ownerLabel')} <span className="text-red-500">*</span>
              </label>
              {facility ? (
                // When editing, show current owner as read-only text
                <div className="px-4 py-2 border border-gray-200 rounded bg-gray-50">
                  {(() => {
                      const owners = referenceData?.owners || [];
                      // match on several possible id properties
                      const owner = owners.find(o => {
                        const ids = [o.UserID, o.UserId, o.id, o.AccountID, o.AccountId, o.ID];
                        return ids.some(idVal => idVal !== undefined && String(idVal) === String(formData.OwnerID));
                      });
                      if (owner) {
                        const name = owner.FullName || owner.Fullname || owner.Username || owner.DisplayName || owner.Name || owner.Email || owner.PhoneNumber;
                        const contact = owner.Email || owner.PhoneNumber || '';
                        return name + (contact ? ` (${contact})` : '');
                      }
                      // if owner not found in reference data, do not show raw numeric id — show placeholder instead
                      return '-';
                    })()}
                </div>
              ) : (
                <select
                  name="OwnerID"
                  value={formData.OwnerID}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.OwnerID ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">{t('admin.facilityForm.ownerPlaceholder')}</option>
                  {referenceData?.owners?.map((owner, idx) => (
                    <option key={owner.UserID || owner.AccountID || owner.id || owner.Email || idx} value={owner.UserID || owner.AccountID || owner.id}>
                      {owner.FullName || owner.Username} ({owner.Email || owner.PhoneNumber})
                    </option>
                  ))}
                </select>
              )}
              {errors.OwnerID && (
                <p className="text-red-500 text-xs mt-1">{errors.OwnerID}</p>
              )}
            </div>

            {/* Address and Description removed per request */}

            {/* Images: show existing (when editing) and allow selecting files when creating or editing */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.facilityForm.imagesLabel')}</label>
              <div className="flex gap-3 mb-3 flex-wrap">
                {(() => {
                  const imgs = [];
                  if (remoteFacility && Array.isArray(remoteFacility.images) && remoteFacility.images.length > 0) imgs.push(...remoteFacility.images);
                  // fallback to passed-in facility
                  if (imgs.length === 0 && facility) {
                    if (facility.HinhAnh) imgs.push({ URL: facility.HinhAnh });
                    if (facility.Image) imgs.push({ URL: facility.Image });
                    if (facility.ImageUrl) imgs.push({ URL: facility.ImageUrl });
                  }

                  // remove duplicates and empty
                  const uniq = [];
                  const seen = new Set();
                  imgs.forEach(it => {
                    const url = (it && (it.URL || it.ImageUrl || it.Data)) || null;
                    if (!url || (typeof url === 'string' && url.trim() === '')) return;
                    if (seen.has(url)) return;
                    seen.add(url);
                    uniq.push(it);
                  });

                  if (selectedPreviews && selectedPreviews.length > 0) {
                    return selectedPreviews.map((p, idx) => (
                      <div key={p.url} className="w-24 h-24 bg-gray-100 rounded overflow-hidden relative">
                        <img src={p.url} alt={p.file && p.file.name} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeSelectedPreview(idx)} className="absolute top-1 right-1 bg-white/80 rounded-full p-1 text-xs">✕</button>
                      </div>
                    ));
                  }

                  if (uniq.length === 0) return <p className="text-sm text-gray-500">{t('admin.facilityForm.noImages')}</p>;

                  return uniq.map((img, idx) => (
                    <div key={img.MediaID || img.ImageID || img.id || img.URL || idx} className="w-24 h-24 bg-gray-100 rounded overflow-hidden relative">
                      {img.URL ? (
                        <img src={img.URL} alt="img" className="w-full h-full object-cover" />
                      ) : img.Data ? (
                        <img src={img.Data} alt="img" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">No image</div>
                      )}
                      {(img.MediaID || img.ImageID || img.id) && (
                        <button type="button" onClick={() => handleDeleteImage(img)} className="absolute top-1 right-1 bg-white/80 rounded-full p-1 text-xs">✕</button>
                      )}
                    </div>
                  ));
                })()}
              </div>

              <div className="flex items-center gap-3">
                <input id="facility-images-input" type="file" accept="image/*,video/*" multiple onChange={handleFileChange} />
                <p className="text-sm text-gray-500">{t('admin.facilityForm.selectNote')}</p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                {t('admin.facilityForm.cancel')}
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
              >
                {facility ? t('admin.facilityForm.update') : t('admin.facilityForm.addNew')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FacilityForm;
