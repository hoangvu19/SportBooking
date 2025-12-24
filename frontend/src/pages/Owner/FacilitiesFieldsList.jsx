import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sportFieldAPI, sportTypeAPI } from '../../utils/api';
import Loading from '../../components/Shared/Loading';
import toast from 'react-hot-toast';
import { useI18n } from '../../i18n';

export default function FacilitiesFieldsList() {
  const { t } = useI18n();
  const { facilityId } = useParams();
  const [fields, setFields] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [form, setForm] = useState({ fieldName: '', fieldType: '', rentalPrice: '', sportTypeId: '' });
  const [filesToUpload, setFilesToUpload] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [sportTypes, setSportTypes] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const loadSportTypes = async () => {
      try {
        const st = await sportTypeAPI.getAll().catch(() => null);
        if (st && st.success && Array.isArray(st.data) && mounted) setSportTypes(st.data);
      } catch { /* ignore */ }
    };

    loadSportTypes();

    return () => { mounted = false; };
  }, []);

  const loadFields = useCallback(async (bypassCache = false) => {
    setLoading(true);
    try {
      // Use fresh endpoint to bypass client GET cache when explicitly requested or after mutations
      const res = bypassCache 
        ? await sportFieldAPI.getByFacilityFresh(facilityId).catch(() => null)
        : await sportFieldAPI.getByFacility(facilityId).catch(() => null);
      if (res && res.success && Array.isArray(res.data)) {
        setFields(res.data);
      } else {
        setFields([]);
        toast.error(t('common.error'));
      }
    } catch (err) {
      console.error('Error fetching fields for facility', err);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => { loadFields(); }, [loadFields]);

  // Listen for OwnerHeader search events (ownerSearch) and filter fields
  useEffect(() => {
    const onOwnerSearch = (e) => {
      try {
        const q = (e && e.detail) ? String(e.detail || '') : '';
        setSearchQ(q);
      } catch (err) { console.debug('ownerSearch event parse error', err); }
    };
    window.addEventListener('ownerSearch', onOwnerSearch);
    return () => window.removeEventListener('ownerSearch', onOwnerSearch);
  }, []);

  const openCreate = () => {
    setEditingField(null);
    setForm({ fieldName: '', fieldType: '', rentalPrice: '', sportTypeId: '', status: 'Available' });
    setShowModal(true);
  };

  const openEdit = (field) => {
    setEditingField(field);
    setForm({
      fieldName: field.FieldName || field.TenSan || '',
      fieldType: field.FieldType || field.LoaiSan || '',
      rentalPrice: field.RentalPrice || '',
      sportTypeId: field.SportTypeID || field.SportTypeId || '',
      status: field.Status || field.TrangThai || 'Available'
    });
    // reset file inputs when editing
    setFilesToUpload([]);
    setFilePreviews([]);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingField(null);
    setFilesToUpload([]);
    setFilePreviews([]);
  };

  // Lock body scroll when modal is open (owner edit modal)
  useEffect(() => {
    if (showModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
    return undefined;
  }, [showModal]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!form.fieldName || !form.fieldType || !form.rentalPrice) {
      toast.error(t('common.validation_error'));
      return;
    }
    try {
      let createdOrUpdatedId = null;
      if (editingField) {
        await sportFieldAPI.update(editingField.FieldID, {
          fieldName: form.fieldName,
          fieldType: form.fieldType,
          rentalPrice: parseFloat(form.rentalPrice),
          sportTypeId: form.sportTypeId || null,
          status: form.status || 'Available'
        });
        createdOrUpdatedId = editingField.FieldID;
        toast.success(t('owner.facilities.updateSuccess'));
      } else {
        const res = await sportFieldAPI.create(facilityId, {
          fieldName: form.fieldName,
          fieldType: form.fieldType,
          rentalPrice: parseFloat(form.rentalPrice),
          sportTypeId: form.sportTypeId || null,
          status: form.status || 'Available'
        });
        createdOrUpdatedId = res && res.data && (res.data.FieldID || res.data.SanID || res.data.id);
        toast.success(t('owner.facilities.fieldCreated'));
      }

      // upload files if any selected
      if (filesToUpload && filesToUpload.length > 0 && createdOrUpdatedId) {
        try {
          await sportFieldAPI.uploadImages(createdOrUpdatedId, filesToUpload);
          toast.success(t('common.success'));
          // refresh list bypassing client GET cache so new images appear immediately
          const fresh = await sportFieldAPI.getByFacilityFresh(facilityId).catch(() => null);
          if (fresh && fresh.success && Array.isArray(fresh.data)) setFields(fresh.data);
          // also refresh editingField so modal (if left open) shows new images
          const freshField = await sportFieldAPI.getById(createdOrUpdatedId).catch(() => null);
          if (freshField && freshField.success && freshField.data) setEditingField(freshField.data);
        } catch (imgErr) {
          console.error('Upload images error', imgErr);
          toast.error(t('common.error'));
        }
      }

      closeModal();
      // Always bypass cache after mutation to show fresh data immediately
      await loadFields(true);
    } catch (err) {
      console.error('Save field error', err);
      toast.error(t('owner.facilities.fieldCreateError'));
    }
  };

  const onFilesSelected = (e) => {
    const list = Array.from(e.target.files || []);
    // Only allow 1 image for sport field
    if (list.length > 0) {
      setFilesToUpload([list[0]]);
      const preview = URL.createObjectURL(list[0]);
      setFilePreviews([preview]);
    }
  };

  const removeSelectedPreview = () => {
    try { 
      if (filePreviews[0]) URL.revokeObjectURL(filePreviews[0]); 
    } catch (err) { 
      console.debug('revoke error', err); 
    }
    setFilesToUpload([]);
    setFilePreviews([]);
  };

  const handleDeleteExistingImage = async (image) => {
    if (!editingField) return;
    if (!window.confirm(t('owner.facilities.deleteConfirm'))) return;
    try {
      await sportFieldAPI.deleteImage(editingField.FieldID, image.MediaID || image.ImageID || image.id);
      toast.success(t('owner.facilities.deleteSuccess'));
      const fresh = await sportFieldAPI.getById(editingField.FieldID).catch(() => null);
      if (fresh && fresh.success && fresh.data) {
        setEditingField(fresh.data);
      }
      await loadFields(true);
    } catch (err) {
      console.error('Delete image error', err);
      toast.error(t('owner.facilities.deleteError'));
    }
  };
  

  const handleDelete = async (field) => {
    if (!window.confirm(t('owner.facilities.deleteConfirm'))) return;
    try {
      await sportFieldAPI.delete(field.FieldID);
      toast.success(t('owner.facilities.deleteSuccess'));
      // Refresh fields list with fresh data (bypass cache)
      await loadFields(true);
    } catch (err) {
      console.error('Delete field error', err);
      const msg = (err && err.message) ? err.message : t('owner.facilities.deleteError');
      toast.error(msg);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">{t('owner.facilities.facilityList')}</h2>
          <div className="flex items-center gap-3">
            <button className="px-3 py-2 bg-green-600 text-white rounded" onClick={openCreate}>{t('owner.facilities.addField')}</button>
            <button className="px-3 py-2 border rounded text-sm" onClick={() => navigate(-1)}>{t('common.back')}</button>
          </div>
        </div>

  <div className="bg-white rounded-lg shadow-sm p-6 relative overflow-visible">
          {fields.length === 0 ? (
            <div className="text-gray-600">{t('owner.facilities.noFields')}</div>
          ) : (
            <div className="grid gap-4">
              {fields.filter(f => {
                if (!searchQ || searchQ.trim() === '') return true;
                const q = searchQ.toLowerCase().trim();
                const name = (f.FieldName || f.TenSan || f.name || '').toString().toLowerCase();
                const typ = (f.FieldType || f.LoaiSan || '').toString().toLowerCase();
                return name.includes(q) || typ.includes(q);
              }).map(f => {
                const fid = f.FieldID || f.SanID || f.id;
                const name = f.FieldName || f.TenSan || f.name || `#${fid}`;
                const typ = f.FieldType || f.LoaiSan || '';
                // Prefer Data (base64) or ImageUrl/URL when available
                const thumb = (f.images && f.images[0] && (f.images[0].Data || f.images[0].ImageUrl || f.images[0].URL)) || f.HinhAnh || null;
                return (
                  <div key={fid} className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow bg-white">
                    <div className="flex items-center gap-4">
                              <div className="w-20 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0 border border-gray-100">
                                {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : <img src={'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="%23E2E8F0"%3E%3Crect width="200" height="140" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23718096"%3ENo Image%3C/text%3E%3C/svg%3E'} alt="no-image" className="w-full h-full object-cover" />}
                              </div>
                      <div>
                        <div className="font-semibold text-gray-800">{name}</div>
                        <div className="text-sm text-gray-500 mt-1">{t('owner.facilities.sportType')}: {typ}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="px-3 py-2 bg-indigo-600 text-white rounded shadow-sm hover:bg-indigo-700" onClick={() => navigate(`/courts/facilities/field/${fid}`)}>{t('common.viewProfile')}</button>
                      <button className="px-3 py-2 border rounded text-sm" onClick={() => openEdit(f)}>{t('owner.facilities.edit')}</button>
                      <button className="px-3 py-2 border rounded text-sm text-red-600" onClick={() => handleDelete(f)}>{t('common.delete')}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Inline form card positioned at top-right on md+ screens */}
          {showModal && (
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={closeModal}
            >
              <div
                className="relative w-full max-w-2xl mx-4 bg-white rounded-lg shadow-xl overflow-y-auto max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">{editingField ? t('owner.facilities.editField') : t('owner.facilities.addNewField')}</h3>
                    <button onClick={closeModal} className="text-gray-500 text-sm">✕</button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('owner.facilities.fieldName')}</label>
                      <input name="fieldName" value={form.fieldName} onChange={handleChange} className="mt-1 block w-full border border-gray-200 rounded px-2 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('booking.fieldType')}</label>
                      <input name="fieldType" value={form.fieldType} onChange={handleChange} className="mt-1 block w-full border border-gray-200 rounded px-2 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('owner.facilities.rentalPrice')}</label>
                      <input name="rentalPrice" value={form.rentalPrice} onChange={handleChange} type="number" className="mt-1 block w-full border border-gray-200 rounded px-2 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('owner.facilities.sportType')}</label>
                      {sportTypes && sportTypes.length > 0 ? (
                        <select name="sportTypeId" value={form.sportTypeId} onChange={handleChange} className="mt-1 block w-full border border-gray-200 rounded px-2 py-2">
                          <option value="">{t('owner.facilities.selectSport')}</option>
                          {sportTypes.map(st => <option key={st.SportTypeID || st.id} value={st.SportTypeID || st.id}>{st.SportName || st.name}</option>)}
                        </select>
                      ) : (
                        <input name="sportTypeId" value={form.sportTypeId} onChange={handleChange} className="mt-1 block w-full border border-gray-200 rounded px-2 py-2" />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('owner.facilities.status')}</label>
                      <select name="status" value={form.status} onChange={handleChange} className="mt-1 block w-full border border-gray-200 rounded px-2 py-2">
                        <option value="Available">Available</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Unavailable">Unavailable</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mt-2">{t('owner.facilities.images')}</label>
                      {filePreviews && filePreviews.length > 0 ? (
                        <div className="mt-2">
                          <div className="relative w-full h-48 border-2 border-dashed border-gray-300 rounded overflow-hidden bg-gray-50">
                            <img src={filePreviews[0]} alt="preview" className="w-full h-full object-cover" />
                            <button 
                              onClick={removeSelectedPreview} 
                              className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                              type="button"
                            >
                              ×
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{t('owner.facilities.newImageSelected')}</p>
                        </div>
                      ) : editingField && editingField.images && editingField.images.length > 0 ? (
                        <div className="mt-2">
                          {editingField.images.map((img, idx) => {
                            const src = typeof img === 'string' ? img : (img.URL || img.ImageUrl || img.Data || img.Image || img.url || img.Path || null);
                            return (
                              <div key={img.MediaID || img.ImageID || idx} className="relative w-full h-48 border rounded overflow-hidden bg-gray-100">
                                {src ? (
                                  <img src={src} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <img src={'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="%23E2E8F0"%3E%3Crect width="200" height="140" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23718096"%3ENo Image%3C/text%3E%3C/svg%3E'} alt="no-image" className="w-full h-full object-cover" />
                                )}
                                <button 
                                  onClick={() => handleDeleteExistingImage(img)} 
                                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                                  type="button"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                          <p className="text-xs text-gray-500 mt-1">{t('owner.facilities.currentImage')}</p>
                        </div>
                      ) : (
                        <div className="mt-2 w-full h-48 border-2 border-dashed border-gray-300 rounded flex items-center justify-center bg-gray-50">
                          <p className="text-gray-400">{t('owner.facilities.noImage')}</p>
                        </div>
                      )}
                      
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={onFilesSelected} 
                        className="mt-2 text-sm" 
                      />
                      <p className="text-xs text-gray-500 mt-1">{t('owner.facilities.selectNewImage')}</p>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button className="px-3 py-2 border rounded" onClick={closeModal}>{t('owner.facilities.cancel')}</button>
                      <button className="px-3 py-2 bg-indigo-600 text-white rounded" onClick={handleSubmit}>{t('common.save')}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Inline form card (shows inside page instead of overlay) */}
    </div>
  );
}

