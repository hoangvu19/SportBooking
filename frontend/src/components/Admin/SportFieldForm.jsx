import React, { useState, useEffect } from 'react';
import { sportFieldAPI } from '../../utils/api';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/hooks';

const SportFieldForm = ({ isOpen, inline = false, onClose, onSubmit, field, referenceData }) => {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    FieldName: '',
    FacilityID: '',
    SportTypeID: '',
    FieldType: 'Indoor',
    RentalPrice: '',
    Status: 'Available',
    Description: ''
  });

  const [errors, setErrors] = useState({});
  const [remoteField, setRemoteField] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedPreviews, setSelectedPreviews] = useState([]); // [{file, url}]
  const previewsRef = React.useRef([]);
  const commonFieldTypes = ['Indoor', 'Outdoor', '5-a-side', '7-a-side', '11-a-side', 'Court', 'Lawn'];

  useEffect(() => {
    if (field) {
      // Fetch full field detail (to get images) when editing
      (async () => {
        try {
          const res = await sportFieldAPI.getById(Number(field.FieldID || field.SanID || field.id));
          // sportFieldAPI returns { success, message, data }
            console.debug('SportFieldForm: getById response', res);
            if (res && res.success) {
              setRemoteField(res.data);
            } else if (res && res.data && res.data.success) {
              // fallback: some callers may return wrapper { data: { success, data } }
              setRemoteField(res.data.data || res.data);
            } else {
              setRemoteField(null);
            }
        } catch (err) {
          console.debug('Could not fetch full field detail for images', err && err.message);
          setRemoteField(null);
        }
      })();
      setFormData({
        FieldName: field.FieldName || '',
        FacilityID: field.FacilityID || (field.Facility && field.Facility.FacilityID) || '',
        SportTypeID: field.SportTypeID || (field.SportType && field.SportType.SportTypeID) || '',
        FieldType: field.FieldType || 'Indoor',
        RentalPrice: field.RentalPrice || '',
        Status: field.Status || 'Available',
        Description: field.Description || ''
      });
    } else {
      setFormData({
        FieldName: '',
        FacilityID: '',
        SportTypeID: '',
        FieldType: 'Indoor',
        RentalPrice: '',
        Status: 'Available',
        Description: ''
      });
    }
    setErrors({});
  }, [field, isOpen]);

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

  const validate = () => {
    const newErrors = {};
    
    if (!formData.FieldName || formData.FieldName.trim() === '') {
      newErrors.FieldName = t('admin.sportFieldForm.fieldNameRequired');
    }
    // Facility is required only when creating a new field; when editing we keep original
    if (!field && !formData.FacilityID) {
      newErrors.FacilityID = t('admin.sportFieldForm.facilityRequired');
    }
    // SportType is required only when creating; when editing we display current sport type
    if (!field && !formData.SportTypeID) {
      newErrors.SportTypeID = t('admin.sportFieldForm.sportTypeRequired');
    }
    
    if (!formData.RentalPrice || parseFloat(formData.RentalPrice) <= 0) {
      newErrors.RentalPrice = t('admin.sportFieldForm.rentalPriceRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    (async () => {
      if (!validate()) return;

      const submitData = {
        ...formData,
        RentalPrice: parseFloat(formData.RentalPrice)
      };

      try {
        // Call parent onSubmit which returns the API response
        const resp = await onSubmit(field ? { ...submitData, FieldID: field.FieldID } : submitData);
        // Check response shape
        if (!resp) throw new Error('No response from server');
        const success = (resp.data && resp.data.success) || resp.success;
        const data = (resp.data && resp.data.data) || resp.data || resp;

        if (!success) {
          const msg = (resp.data && resp.data.message) || resp.message || t('admin.sportFieldForm.saveError');
          alert(msg);
          return;
        }

        // At this point the field was created/updated. If user selected new files, replace images now
        const fieldId = (field && field.FieldID) || (data && (data.FieldID || data.SanID || data.id));
        if (selectedFiles && selectedFiles.length > 0) {
          // Delete old images if any
          try {
            if (remoteField && Array.isArray(remoteField.images) && remoteField.images.length > 0) {
              for (const img of remoteField.images) {
                try {
                  await sportFieldAPI.deleteImage(fieldId, img.MediaID || img.MediaId || img.id);
                } catch (e) { console.debug('ignore delete image error', e && e.message); }
              }
            }
          } catch (e) { console.debug('Error deleting old images', e && e.message); }

          // Upload new images
          try {
            await sportFieldAPI.uploadImages(fieldId, selectedFiles);
          } catch (e) {
            console.error('Error uploading new images:', e);
            alert(t('admin.sportFieldForm.saveError') + ': ' + (e.message || ''));
          }
        }

        // Refresh remoteField to show final images
        try {
          const refreshed = await sportFieldAPI.getById(Number(fieldId));
          if (refreshed && refreshed.success) setRemoteField(refreshed.data);
        } catch (e) { console.debug('Could not refresh field after save', e && e.message); }

        alert(t('admin.sportFieldForm.saveSuccess'));
        onClose();
      } catch (err) {
        console.error('Submit error:', err);
        alert(t('admin.sportFieldForm.saveError') + ': ' + (err.message || ''));
      }
    })();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    // revoke previous object URLs
    try {
      previewsRef.current.forEach(u => { try { URL.revokeObjectURL(u.url); } catch {} });
    } catch {}
    const previews = files.map(f => ({ file: f, url: URL.createObjectURL(f) }));
    previewsRef.current = previews;
    setSelectedPreviews(previews);
    // keep Files array for uploading
    setSelectedFiles(files);
  };

  // remove a selected preview (and corresponding file)
  const removeSelectedPreview = (index) => {
    const prev = selectedPreviews.slice();
    const removed = prev.splice(index, 1)[0];
    try { URL.revokeObjectURL(removed.url); } catch {}
    previewsRef.current = prev;
    setSelectedPreviews(prev);
    // also update selectedFiles
    const files = (selectedFiles || []).slice();
    files.splice(index, 1);
    setSelectedFiles(files);
  };

  // cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      try { previewsRef.current.forEach(u => { try { URL.revokeObjectURL(u.url); } catch {} }); } catch {}
      previewsRef.current = [];
    };
  }, []);

  // NOTE: removed immediate upload helper — images are replaced when user presses "Cập Nhật"
  // Selected files are kept in `selectedFiles` and uploaded inside `handleSubmit`.

  const handleDeleteImage = async (image) => {
    if (!field || !field.FieldID) return;
    if (!confirm(t('admin.sportFieldForm.confirmDeleteImage'))) return;
    try {
      const res = await sportFieldAPI.deleteImage(field.FieldID, image.MediaID || image.MediaId || image.id || image.MediaID);
      if (res && res.success) {
        alert(t('admin.sportFieldForm.deleteImageSuccess'));
        const refreshed = await sportFieldAPI.getById(Number(field.FieldID));
        if (refreshed && refreshed.success) setRemoteField(refreshed.data);
      } else {
        alert(res && res.message ? res.message : t('admin.sportFieldForm.deleteImageError'));
      }
    } catch (err) {
      console.error('Error deleting image:', err);
      alert(t('admin.sportFieldForm.deleteImageFailed') + ': ' + (err.message || ''));
    }
  };

  const shouldRender = isOpen || inline;

  // When modal (non-inline) is open, lock body scroll
  useEffect(() => {
    if (!inline && isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
    return undefined;
  }, [inline, isOpen]);


  const innerClass = inline
    ? 'w-full'
    : 'w-full max-w-3xl mx-4 max-h-[90vh] relative transform transition-all flex flex-col';

  if (!shouldRender) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={innerClass + ' bg-white rounded-lg shadow-md overflow-hidden'}>
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">{field ? '✏️ ' + t('admin.sportFieldForm.titleEdit') : '➕ ' + t('admin.sportFieldForm.titleAdd')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl rounded-full w-9 h-9 flex items-center justify-center"
            aria-label={t('admin.sportFieldForm.cancel')}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="p-6 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Field Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('admin.sportFieldForm.fieldNameLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="FieldName"
                value={formData.FieldName}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.FieldName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder={t('admin.sportFieldForm.fieldNamePlaceholder')}
              />
              {errors.FieldName && (
                <p className="text-red-500 text-xs mt-1">{errors.FieldName}</p>
              )}
            </div>

            {/* Facility: selectable when creating, hidden when editing (preserve value via hidden input) */}
            {!field ? (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('admin.sportFieldForm.facilityLabel')} <span className="text-red-500">*</span>
                </label>
                <select
                  name="FacilityID"
                  value={formData.FacilityID}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.FacilityID ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">{t('admin.sportFieldForm.facilityPlaceholder')}</option>
                  {referenceData?.facilities?.map(facility => (
                    <option key={facility.FacilityID} value={facility.FacilityID}>
                      {facility.FacilityName} ({facility.AreaName})
                    </option>
                  ))}
                </select>
                {errors.FacilityID && (
                  <p className="text-red-500 text-xs mt-1">{errors.FacilityID}</p>
                )}
              </div>
            ) : (
              // When editing, do not show facility; include hidden input so submit keeps the original value
              <input type="hidden" name="FacilityID" value={formData.FacilityID} />
            )}

            {/* Sport Type: always selectable (show friendly name) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('admin.sportFieldForm.sportTypeLabel')} <span className="text-red-500">*</span>
              </label>
              <select
                name="SportTypeID"
                value={formData.SportTypeID}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.SportTypeID ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">{t('admin.sportFieldForm.sportTypePlaceholder')}</option>
                {referenceData?.sportTypes?.map(sport => (
                  <option key={sport.SportTypeID} value={sport.SportTypeID}>
                    {sport.SportName || sport.SportTypeName || sport.Name || sport.SportType}
                  </option>
                ))}
              </select>
              {errors.SportTypeID && (
                <p className="text-red-500 text-xs mt-1">{errors.SportTypeID}</p>
              )}
            </div>

            {/* Field Type: dropdown of common types with 'Other' to allow custom input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.sportFieldForm.fieldTypeLabel')}</label>
              <div className="flex gap-2">
                <select
                  name="FieldTypeSelect"
                  value={commonFieldTypes.includes(formData.FieldType) ? formData.FieldType : 'Other'}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'Other') {
                      setFormData(prev => ({ ...prev, FieldType: '' }));
                    } else {
                      setFormData(prev => ({ ...prev, FieldType: v }));
                    }
                  }}
                  className="px-3 py-2 border rounded-lg"
                >
                  {commonFieldTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="Other">{t('admin.sportFieldForm.otherOption')}</option>
                </select>

                {/* If user chooses Other (or existing type isn't in common list), show a free text input */}
                {(!commonFieldTypes.includes(formData.FieldType)) && (
                  <input
                    type="text"
                    name="FieldType"
                    value={formData.FieldType}
                    onChange={handleChange}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={t('admin.sportFieldForm.fieldTypePlaceholder')}
                  />
                )}
              </div>
            </div>

            {/* Rental Price */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('admin.sportFieldForm.rentalPriceLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="RentalPrice"
                value={formData.RentalPrice}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.RentalPrice ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder={t('admin.sportFieldForm.rentalPricePlaceholder')}
                min="0"
                step="1000"
              />
              {errors.RentalPrice && (
                <p className="text-red-500 text-xs mt-1">{errors.RentalPrice}</p>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('admin.sportFieldForm.statusLabel')}
              </label>
              <select
                name="Status"
                value={formData.Status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Available">{t('admin.sportField.statusAvailable')}</option>
                <option value="Maintenance">{t('admin.sportField.statusMaintenance')}</option>
                <option value="Unavailable">{t('admin.sportField.statusUnavailable')}</option>
              </select>
            </div>

            {/* Description removed per request */}

            {/* Images: show existing (when editing) and allow selecting files when creating or editing */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.sportFieldForm.imagesLabel')}</label>
              <div className="flex gap-3 mb-3 flex-wrap">
                {(() => {
                  // Build a normalized images array from multiple possible sources (only when editing / remoteField present)
                  const imgs = [];
                  if (remoteField && Array.isArray(remoteField.images) && remoteField.images.length > 0) {
                    imgs.push(...remoteField.images);
                  }
                  // also accept single-image properties
                  if (remoteField) {
                    if (remoteField.HinhAnh) imgs.push({ URL: remoteField.HinhAnh });
                    if (remoteField.Image) imgs.push({ URL: remoteField.Image });
                    if (remoteField.ImageUrl) imgs.push({ URL: remoteField.ImageUrl });
                    if (remoteField.URL) imgs.push({ URL: remoteField.URL });
                  }
                  // fallback to the passed-in `field` object for legacy values
                  if (imgs.length === 0 && field) {
                    if (field.HinhAnh) imgs.push({ URL: field.HinhAnh });
                    if (field.Image) imgs.push({ URL: field.Image });
                    if (field.ImageUrl) imgs.push({ URL: field.ImageUrl });
                    if (field.URL) imgs.push({ URL: field.URL });
                  }

                  // filter out empty urls and duplicates
                  const uniq = [];
                  const seen = new Set();
                  imgs.forEach(it => {
                    const url = (it && (it.URL || it.ImageUrl || it.Data || it.URL) ) || null;
                    if (!url || (typeof url === 'string' && url.trim() === '')) return;
                    if (seen.has(url)) return;
                    seen.add(url);
                    uniq.push(it);
                  });

                  // If user selected new previews, show them first
                  if (selectedPreviews && selectedPreviews.length > 0) {
                    return selectedPreviews.map((p, idx) => (
                      <div key={p.url} className="w-24 h-24 bg-gray-100 rounded overflow-hidden relative">
                        <img src={p.url} alt={p.file && p.file.name} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeSelectedPreview(idx)} className="absolute top-1 right-1 bg-white/80 rounded-full p-1 text-xs">✕</button>
                      </div>
                    ));
                  }

                  if (uniq.length === 0) return <p className="text-sm text-gray-500">{t('admin.sportFieldForm.noImages')}</p>;

                  return uniq.map(img => (
                    <div key={img.MediaID || img.id || img.MediaId || (img.URL || img.ImageUrl)} className="w-24 h-24 bg-gray-100 rounded overflow-hidden relative">
                      {img.URL ? (
                        <img src={img.URL} alt="img" className="w-full h-full object-cover" />
                      ) : img.Data ? (
                        <img src={img.Data} alt="img" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">No image</div>
                      )}
                      {/* only allow deletion when editing existing images */}
                      { (img.MediaID || img.MediaId || img.id) && (
                        <button type="button" onClick={() => handleDeleteImage(img)} className="absolute top-1 right-1 bg-white/80 rounded-full p-1 text-xs">✕</button>
                      ) }
                    </div>
                  ));
                })()}
              </div>

              <div className="flex items-center gap-3">
                <input id="field-images-input" type="file" accept="image/*,video/*" multiple onChange={handleFileChange} />
              </div>
            </div>

          </form>
        </div>

        {/* Footer with sticky actions so buttons are always visible */}
        <div className="border-t p-4 bg-white flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            {t('admin.sportFieldForm.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="ml-auto px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
          >
            {field ? t('admin.sportFieldForm.update') : t('admin.sportFieldForm.addNew')}
          </button>
        </div>
      </div>
    </div>
  );

  if (!inline) {
    // Render modal into document body so it overlays everything (sidebar, headers, etc.)
    try {
      return createPortal(modalContent, document.body);
    } catch {
      // Fallback to normal render if portal fails (server-side rendering or other)
      return modalContent;
    }
  }

  return modalContent;
};

export default SportFieldForm;
