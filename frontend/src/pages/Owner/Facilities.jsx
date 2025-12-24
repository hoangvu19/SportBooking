import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { facilityAPI, areaAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { useI18n } from '../../i18n';
import { useOwnerSearch } from '../../contexts/OwnerSearchContext';

const OwnerFacilities = () => {
  const { t } = useI18n();
  const { searchQuery } = useOwnerSearch();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [areas, setAreas] = useState([]);
  const { activeRole, user } = useAuth();

  // Create facility form
  const [facilityName, setFacilityName] = useState('');
  const [areaId, setAreaId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [editingFacilityId, setEditingFacilityId] = useState(null);
  const [editFacilityForm, setEditFacilityForm] = useState({ facilityName: '', areaId: '' });
  const [editImages, setEditImages] = useState([]);
  const [editSelectedFiles, setEditSelectedFiles] = useState([]);
  const [editPreviews, setEditPreviews] = useState([]);

  // Edit field state
  // Edit field state (removed — fields are managed elsewhere)
  // View field detail state
  const [viewingFieldDetail, setViewingFieldDetail] = useState(null);
  const [showFieldModal, setShowFieldModal] = useState(false);
  // Delete / selection mode
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedToDelete, setSelectedToDelete] = useState(new Set());

  const loadData = useCallback(async (opts = {}) => {
    setLoading(true);
    try {
      // FIXED: Always bypass cache for fresh data like Feed/Profile
      const bypassCache = true;
      
      // If caller requested showAll or checkbox is set, fetch all facilities
      const effectiveShowAll = typeof opts.showAll === 'boolean' ? opts.showAll : showAll;
      if (effectiveShowAll) {
        const allResp = await facilityAPI.getAll(bypassCache).catch(() => null);
        if (allResp && allResp.success && Array.isArray(allResp.data)) {
          setFacilities(allResp.data || []);
        } else {
          setFacilities([]);
        }
      } else {
        // Default: load only facilities owned by current user
        const fResp = await facilityAPI.getMyFacilities(bypassCache).catch(() => null);
        if (fResp && fResp.success && Array.isArray(fResp.data)) {
          setFacilities(fResp.data || []);
        } else {
          // Don't fall back to all facilities: owners should only see their own facilities
          setFacilities([]);
          // Inform the user if the owner's list couldn't be loaded
          if (!effectiveShowAll) toast.error(t('owner.facilities.loadError'));
        }
      }
  const aResp = await areaAPI.getAll();
  if (aResp && aResp.success) setAreas(aResp.data || []);
    } catch (err) {
      console.error('OwnerFacilities.loadData error', err);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [showAll, t]);

  useEffect(() => {
    loadData();
    
    // FIXED: Add realtime listeners for facility changes
    const handleFacilityCreated = () => {
      console.log('🔔 Realtime: facility:created - reloading facilities');
      loadData();
    };
    
    const handleFacilityUpdated = () => {
      console.log('🔔 Realtime: facility:updated - reloading facilities');
      loadData();
    };
    
    const handleFacilityDeleted = () => {
      console.log('🔔 Realtime: facility:deleted - reloading facilities');
      loadData();
    };
    
    window.addEventListener('facility:created', handleFacilityCreated);
    window.addEventListener('facility:updated', handleFacilityUpdated);
    window.addEventListener('facility:deleted', handleFacilityDeleted);
    
    return () => {
      window.removeEventListener('facility:created', handleFacilityCreated);
      window.removeEventListener('facility:updated', handleFacilityUpdated);
      window.removeEventListener('facility:deleted', handleFacilityDeleted);
    };
  }, [loadData]);

  // --- delete / selection helpers ---
  const toggleDeleteMode = () => {
    setDeleteMode(d => {
      if (d) setSelectedToDelete(new Set()); // clearing selection when turning off
      return !d;
    });
  };

  const toggleSelectForDelete = (facilityId) => {
    setSelectedToDelete(prev => {
      const s = new Set(prev);
      if (s.has(facilityId)) s.delete(facilityId); else s.add(facilityId);
      return s;
    });
  };

  const deleteSelectedFacilities = async () => {
    if (!selectedToDelete || selectedToDelete.size === 0) return toast.warn(t('common.none'));
    if (!confirm(t('owner.facilities.deleteConfirm'))) return;
    const ids = Array.from(selectedToDelete);
    let successCount = 0;
    const failed = [];
    for (const id of ids) {
      try {
        await facilityAPI.delete(id);
        successCount++;
      } catch (err) {
        console.error('Delete facility error', err);
        const msg = (err && err.message) ? String(err.message) : `${t('owner.facilities.deleteErrorMessage')} ${id}`;
        failed.push({ id, msg });
      }
    }

    if (failed.length === 0) {
      toast.success(t('owner.facilities.deleteSuccess'));
    } else {
      toast.success(successCount > 0 ? t('owner.facilities.deleteSuccess') : null);
      // Show detailed failures
      failed.forEach(({ msg }) => toast.error(`${t('owner.facilities.deleteError')}: ${msg}`));
    }

    setSelectedToDelete(new Set());
    setDeleteMode(false);
    // Bypass cache to show updated list after batch delete
    await loadData({ bypassCache: true });
  };

  const handleToggleShowAll = async () => {
    const next = !showAll;
    setShowAll(next);
    await loadData({ showAll: next });
  };

  const handleCreateFacility = async (e) => {
    e.preventDefault();
    if (!facilityName || !areaId) return toast.warn(t('common.validation_error'));
    try {
      const resp = await facilityAPI.create({ facilityName: facilityName.trim(), areaId: parseInt(areaId) });
      if (resp && resp.success) {
        toast.success(t('owner.facilities.createSuccess'));
        // If user selected images, upload them to the facility
        try {
          const createdFacilityId = resp.data && (resp.data.FacilityID || resp.data.id || resp.data.facilityId);
          if (selectedFiles && selectedFiles.length > 0 && createdFacilityId) {
            await facilityAPI.uploadImages(createdFacilityId, selectedFiles);
            toast.success(t('common.success'));
          }
        } catch (uploadErr) {
          console.error('Upload images error', uploadErr);
          toast.error(t('common.error'));
        }

        setFacilityName(''); setAreaId('');
        setSelectedFiles([]); setPreviews([]);
        // Bypass cache to show newly created facility immediately
        await loadData({ bypassCache: true });
      } else {
        toast.error((resp && resp.message) || t('owner.facilities.createError'));
      }
    } catch (err) {
      console.error('Create facility error', err);
      toast.error(t('owner.facilities.createError'));
    }
  };

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    // Limit to 8 files to match server config
    const limited = files.slice(0, 8);
    setSelectedFiles(limited);

    // Generate previews
    const urls = limited.map(f => URL.createObjectURL(f));
    setPreviews(urls);
  };

  const removePreview = (index) => {
    const nf = selectedFiles.slice();
    const np = previews.slice();
    // revoke object URL
  try { URL.revokeObjectURL(np[index]); } catch { /* ignore */ }
    nf.splice(index, 1);
    np.splice(index, 1);
    setSelectedFiles(nf);
    setPreviews(np);
  };

  const navigate = useNavigate();

  const handleViewFields = async (facility) => {
    const facilityId = facility.FacilityID || facility.SanID || facility.id;
    // Navigate to a dedicated fields-list page for this facility. That page will
    // show all sport fields (and from there user can open the field detail page).
  navigate(`/courts/facilities/${facilityId}/fields`);
  };

  const startEditFacility = (facility) => {
    setEditingFacilityId(facility.FacilityID || facility.SanID);
    setEditFacilityForm({ facilityName: facility.FacilityName || facility.TenCoSo || '', areaId: facility.AreaID || '' });
    // load facility images for edit
    (async () => {
      try {
        const id = facility.FacilityID || facility.SanID;
        if (!id) return;
        const res = await facilityAPI.getById(id).catch(() => null);
        if (res && res.success && res.data) {
          const imgs = res.data.images || [];
          setEditImages(imgs);
        } else {
          setEditImages([]);
        }
        setEditSelectedFiles([]);
        setEditPreviews([]);
      } catch (err) {
        console.error('Load facility images for edit error', err);
        setEditImages([]);
      }
    })();
  };

  const cancelEditFacility = () => {
    setEditingFacilityId(null);
    setEditFacilityForm({ facilityName: '', areaId: '' });
  };

  const submitEditFacility = async (facilityId) => {
    const { facilityName: fn, areaId: aid } = editFacilityForm;
    if (!fn || !aid) return toast.warn(t('common.validation_error'));
    try {
      const resp = await facilityAPI.update(facilityId, { facilityName: fn.trim(), areaId: parseInt(aid) });
      if (resp && resp.success) {
        toast.success(t('owner.facilities.updateSuccess'));
        // If user selected images during edit, upload them
        try {
          if (editSelectedFiles && editSelectedFiles.length > 0) {
            await facilityAPI.uploadImages(facilityId, editSelectedFiles);
            toast.success(t('common.success'));
          }
        } catch (uploadErr) {
          console.error('Upload images (edit) error', uploadErr);
          toast.error(t('common.error'));
        }

        cancelEditFacility();
        // Bypass cache to show updated facility immediately
        await loadData({ bypassCache: true });
      } else {
        toast.error((resp && resp.message) || t('owner.facilities.updateError'));
      }
    } catch (err) {
      console.error('Update facility error', err);
      toast.error(t('owner.facilities.updateError'));
    }
  };

  const handleEditFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const limited = files.slice(0, 8);
    setEditSelectedFiles(limited);
    const urls = limited.map(f => URL.createObjectURL(f));
    setEditPreviews(urls);
  };

  const removeEditPreview = (index) => {
    const nf = editSelectedFiles.slice();
    const np = editPreviews.slice();
  try { URL.revokeObjectURL(np[index]); } catch (e) { console.debug(e); }
    nf.splice(index, 1);
    np.splice(index, 1);
    setEditSelectedFiles(nf);
    setEditPreviews(np);
  };

  const deleteExistingImage = async (image) => {
    if (!confirm(t('owner.facilities.deleteConfirm'))) return;
    try {
      const facilityId = editingFacilityId;
      const imageId = image.MediaID || image.ImageID || image.MediaId || image.id;
      if (!imageId) return toast.error(t('common.error'));
      const resp = await facilityAPI.deleteImage(facilityId, imageId);
      if (resp && resp.success) {
        toast.success(t('owner.facilities.deleteSuccess'));
        // remove locally
        setEditImages(prev => prev.filter(i => (i.MediaID || i.ImageID || i.id) !== imageId));
        // Also refresh the facility list to ensure thumbnails update immediately
        await loadData({ bypassCache: true });
      } else {
        toast.error((resp && resp.message) || t('owner.facilities.deleteError'));
      }
    } catch (err) {
      console.error('Delete image error', err);
      toast.error(t('owner.facilities.deleteError'));
    }
  };

  const _deleteFacility = async (facilityId) => {
    if (!confirm(t('owner.facilities.deleteConfirm'))) return;
    try {
      const resp = await facilityAPI.delete(facilityId);
      if (resp && resp.success) {
        toast.success(t('owner.facilities.deleteSuccess'));
        // Bypass cache to show updated list after delete
        await loadData({ bypassCache: true });
      } else {
        toast.error((resp && resp.message) || t('owner.facilities.deleteError'));
      }
    } catch (err) {
      console.error('Delete facility error', err);
      toast.error(t('owner.facilities.deleteError'));
    }
  };



  // Field edit/delete handlers removed — fields are managed on dedicated pages

  // Field creation UI removed from Owner list — fields are managed on dedicated pages

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">{t('owner.facilities.title')}</h2>
      <div className="mb-6 bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2">{t('owner.facilities.createNew')}</h3>
        <form onSubmit={handleCreateFacility} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="border rounded p-2" placeholder={t('owner.facilities.facilityName')} value={facilityName} onChange={e => setFacilityName(e.target.value)} />
          <select className="border rounded p-2" value={areaId} onChange={e => setAreaId(e.target.value)}>
            <option value="">{t('owner.facilities.chooseArea')}</option>
            {areas.map(a => <option key={a.AreaID || a.id} value={a.AreaID || a.id}>{a.AreaName || a.name}</option>)}
          </select>
          <div>
            <div className="mb-2">
              <input type="file" accept="image/*,video/*" multiple onChange={handleFilesChange} />
            </div>
            {previews && previews.length > 0 && (
              <div className="mb-2 grid grid-cols-4 gap-2">
                {previews.map((p, idx) => (
                  <div key={p} className="relative">
                    <img src={p} alt={`preview-${idx}`} className="w-24 h-24 object-cover rounded" />
                    <button type="button" onClick={() => removePreview(idx)} className="absolute top-0 right-0 bg-red-600 text-white text-xs px-1 rounded">×</button>
                  </div>
                ))}
              </div>
            )}
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">{t('owner.facilities.createButton')}</button>
          </div>
        </form>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-4">{t('owner.facilities.facilityList')}</h3>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button type="button" className={`px-3 py-1 border rounded ${deleteMode ? 'bg-red-100' : ''}`} onClick={toggleDeleteMode}>{deleteMode ? t('owner.facilities.cancelSelection') : t('owner.facilities.selectToDelete')}</button>
            {deleteMode && (
              <button type="button" className="px-3 py-1 bg-red-600 text-white rounded" onClick={deleteSelectedFacilities} disabled={selectedToDelete.size === 0}>{t('owner.facilities.deleteSelected')} ({selectedToDelete.size})</button>
            )}
          </div>
        </div>
        {/* Only admins may view all facilities. Owners should see only their own by default. */}
        {activeRole === 'admin' && (
          <div className="mb-3 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showAll} onChange={handleToggleShowAll} />
              <span>{t('owner.facilities.showAllFacilities')}</span>
            </label>
          </div>
        )}
        {loading ? <div>{t('owner.facilities.loadingText')}</div> : (
          <div className="space-y-4">
            {(() => {
              // Filter facilities by search query
              const filtered = facilities.filter(f => {
                if (!searchQuery || searchQuery.trim() === '') return true;
                const q = searchQuery.toLowerCase().trim();
                const facilityName = (f.FacilityName || f.TenSan || f.name || '').toString().toLowerCase();
                const areaName = (f.AreaName || f.area || '').toString().toLowerCase();
                return facilityName.includes(q) || areaName.includes(q);
              });
              if (filtered.length === 0) return <div>{t('owner.facilities.noFacilitiesMessage')}</div>;
              return filtered.map(f => {
              const facilityId = f.FacilityID || f.SanID || f.id;
              // Normalize owner id from various backend shapes
              const ownerId = f.OwnerID || f.OwnerAccountID || f.Owner || f.AccountID || (f.ChuSoHuu && f.ChuSoHuu.AccountID) || f.OwnerId || f.ownerId || null;
              // Resolve current user id from normalized auth context (normalizeUser provides `id`), but keep legacy fallbacks
              const currentUserId = user ? (user.id || user.AccountID || user.AccountId || user._id || user.userId) : null;
              const canManage = (activeRole === 'admin') || (currentUserId && String(currentUserId) === String(ownerId));
              // MediaAsset rows may store image data in `Data` (base64) or `URL`.
              // Prefer `Data` first (DB stores base64 there when uploaded), then fallback to URL fields.
              const thumb = (f.images && f.images[0]) ? (f.images[0].Data || f.images[0].URL || f.images[0].ImageUrl || f.images[0].Image) : null;
              const fieldsCount = (f.sportFields && f.sportFields.length) || 0;
              const imagesCount = (f.images && f.images.length) || 0;

              return (
                <React.Fragment key={facilityId}>
                  <div className="border rounded p-3 flex items-center gap-4 relative">
                    {deleteMode && (
                      <input type="checkbox" checked={selectedToDelete.has(facilityId)} onChange={() => toggleSelectForDelete(facilityId)} className="absolute left-3 top-3 w-4 h-4" />
                    )}
                    <div className="w-28 h-20 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                      {thumb ? (
                        <img src={thumb} alt="thumb" className="w-full h-full object-cover" />
                      ) : (
                        <img src={'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="%23E2E8F0"%3E%3Crect width="200" height="140" fill="%23E2E8F0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23718096"%3ENo Image%3C/text%3E%3C/svg%3E'} alt="no-image" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-lg">{f.FacilityName || f.TenCoSo || '—'}</div>
                      <div className="text-sm text-gray-600">Khu vực: {f.AreaName || f.KhuVuc || 'N/A'}</div>
                      <div className="text-sm text-gray-500 mt-1">{t('owner.facilities.fieldsCount')}: {fieldsCount} • {t('owner.facilities.imagesCount')}: {imagesCount}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {canManage ? (
                        <>
                          <div className="flex gap-2">
                            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => handleViewFields(f)}>{t('owner.facilities.viewFields')}</button>
                            <button className="px-3 py-1 bg-yellow-500 text-white rounded" onClick={() => startEditFacility(f)}>{t('owner.facilities.edit')}</button>
                          </div>
                          {/* per-card delete removed - use selection mode to delete multiple facilities */}
                        </>
                      ) : null}
                    </div>
                  </div>

                  {editingFacilityId === facilityId && (
                    <div className="mt-3 bg-gray-50 p-3 rounded">
                      {/* Existing images for facility (editable) */}
                      {editImages && editImages.length > 0 && (
                        <div className="mb-2 grid grid-cols-4 gap-2">
                          {editImages.map((img) => {
                            const key = img.MediaID || img.ImageID || img.id || img.MediaId;
                            const src = img.URL || img.ImageUrl || img.Data || img.Image;
                            return (
                              <div key={key} className="relative">
                                <img src={src} alt="facility-img" className="w-24 h-24 object-cover rounded" />
                                <button type="button" onClick={() => deleteExistingImage(img)} className="absolute top-0 right-0 bg-red-600 text-white text-xs px-1 rounded">×</button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* New images to add during edit */}
                      {editPreviews && editPreviews.length > 0 && (
                        <div className="mb-2 grid grid-cols-4 gap-2">
                          {editPreviews.map((p, idx) => (
                            <div key={p} className="relative">
                              <img src={p} alt={`new-preview-${idx}`} className="w-24 h-24 object-cover rounded" />
                              <button type="button" onClick={() => removeEditPreview(idx)} className="absolute top-0 right-0 bg-red-600 text-white text-xs px-1 rounded">×</button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input className="border p-2 rounded" placeholder={t('owner.facilities.facilityName')} value={editFacilityForm.facilityName} onChange={e => setEditFacilityForm(prev => ({ ...prev, facilityName: e.target.value }))} />
                        <select className="border p-2 rounded" value={editFacilityForm.areaId} onChange={e => setEditFacilityForm(prev => ({ ...prev, areaId: e.target.value }))}>
                          <option value="">{t('owner.facilities.chooseArea')}</option>
                          {areas.map(a => <option key={a.AreaID || a.id} value={a.AreaID || a.id}>{a.AreaName || a.name}</option>)}
                        </select>
                        <div>
                          <div className="mb-2">
                            <input type="file" accept="image/*,video/*" multiple onChange={handleEditFilesChange} />
                          </div>
                          <button className="px-3 py-1 bg-blue-600 text-white rounded mr-2" onClick={() => submitEditFacility(f.FacilityID || f.SanID)}>{t('owner.facilities.saveChanges')}</button>
                          <button className="px-3 py-1 border rounded" onClick={cancelEditFacility}>{t('owner.facilities.cancel')}</button>
                        </div>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            });
          })()}
          </div>
        )}
        {/* Facility fields are shown on a dedicated page. */}
        {/* Sport fields are hidden in this view by design (Owner list shows only Facility). */}
      </div>
      {/* modal placeholder - rendered below */}
      {/* Field detail modal */}
      {showFieldModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded p-6 w-11/12 max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xl font-bold">{t('owner.facilities.fieldDetails')}</h4>
              <button onClick={() => { setShowFieldModal(false); setViewingFieldDetail(null); }} className="text-sm px-2 py-1 border rounded">{t('owner.facilities.closeButton')}</button>
            </div>
            {viewingFieldDetail ? (
              <div>
                <div className="mb-2"><strong>{viewingFieldDetail.TenSan || viewingFieldDetail.FieldName || viewingFieldDetail.FieldName}</strong></div>
                <div className="text-sm text-gray-600 mb-2">{t('owner.facilities.fieldType')}: {viewingFieldDetail.LoaiSan || viewingFieldDetail.FieldType}</div>
                <div className="mb-2">{t('owner.facilities.rentalPriceLabel')}: {viewingFieldDetail.GiaThue || viewingFieldDetail.RentalPrice}</div>
                <div className="mb-2">{t('owner.facilities.statusLabel')}: {viewingFieldDetail.TrangThai || viewingFieldDetail.Status}</div>
                <div className="mb-2">{t('owner.facilities.sportLabel')}: {viewingFieldDetail.MonTheThao || viewingFieldDetail.SportName}</div>
                <div className="mb-2">{t('owner.facilities.facilityLabel')}: {viewingFieldDetail.TenCoSo || viewingFieldDetail.FacilityName}</div>
                {(viewingFieldDetail.HinhAnh || viewingFieldDetail.images) ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(
                      viewingFieldDetail.images && viewingFieldDetail.images.length > 0
                        ? viewingFieldDetail.images
                        : (viewingFieldDetail.HinhAnh ? [viewingFieldDetail.HinhAnh] : [])
                    ).map((img, idx) => {
                      // support both media objects and legacy string HinhAnh
                      const src = typeof img === 'string'
                        ? img
                        : (img.ImageUrl || img.URL || img.Data || img.Image || img.url || img.Path || null);
                      return <img key={idx} src={src} alt="" className="w-full h-24 object-cover rounded" />;
                    })}
                  </div>
                ) : null}
              </div>
            ) : (
              <div>Đang tải...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerFacilities;

/* Field detail modal - placed after component export for simplicity (rendered via portal would be better) */
