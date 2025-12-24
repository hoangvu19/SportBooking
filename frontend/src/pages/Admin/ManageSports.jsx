import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../utils/apiClient';
import SportFieldList from '../../components/Admin/SportFieldList';
import SportFieldForm from '../../components/Admin/SportFieldForm';
import SportFieldCalendar from '../../components/Admin/SportFieldCalendar';
import FacilityList from '../../components/Admin/FacilityList';
import FacilityForm from '../../components/Admin/FacilityForm';
import { useI18n } from '../../i18n/hooks';
import { useAdminSearch } from '../../contexts/AdminSearchContext';

const ManageSports = () => {
  const { t } = useI18n();
  const { searchQuery } = useAdminSearch();
  const [activeTab, setActiveTab] = useState('fields'); // 'fields', 'facilities', 'calendar', 'booking'
  const [facilities, setFacilities] = useState([]);
  const [sportFields, setSportFields] = useState([]);
  const [referenceData, setReferenceData] = useState({ areas: [], sportTypes: [] });
  const [loading, setLoading] = useState(true);
  const [selectedField, setSelectedField] = useState(null);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [showFacilityForm, setShowFacilityForm] = useState(false);
  const [filters, setFilters] = useState({
    searchTerm: '',
    areaId: '',
    sportTypeId: '',
    status: ''
  });

  // Update filters when header search changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, searchTerm: searchQuery || '' }));
  }, [searchQuery]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'fields') {
      loadSportFields();
    } else if (activeTab === 'facilities') {
      loadFacilities();
    }
  }, [activeTab, filters]);

  const loadData = async () => {
    try {
      // Load reference data
      const refResponse = await apiClient.get('/admin/sports/reference-data');
      // Also load owners list so forms can choose an owner when creating a facility
      let owners = [];
      try {
        const ownersResp = await apiClient.get('/admin/accounts/list');
        if (ownersResp.data && ownersResp.data.success) owners = ownersResp.data.data || [];
      } catch (err) {
        console.debug('Could not load owners list for reference data', err && err.message);
      }

      if (refResponse.data.success) {
        setReferenceData({ ...(refResponse.data.data || {}), owners });
      } else {
        setReferenceData(prev => ({ ...prev, owners }));
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const loadSportFields = async () => {
    try {
      const queryParams = new URLSearchParams();
      
      // When searching, load all data for client-side filtering
      const hasSearch = searchQuery && searchQuery.trim() !== '';
      if (!hasSearch && filters.searchTerm) queryParams.append('searchTerm', filters.searchTerm);
      if (!hasSearch && filters.areaId) queryParams.append('areaId', filters.areaId);
      if (!hasSearch && filters.sportTypeId) queryParams.append('sportTypeId', filters.sportTypeId);
      if (!hasSearch && filters.status) queryParams.append('status', filters.status);

      const response = await apiClient.get(`/admin/sports/fields?${queryParams}`);
      
      if (response.data.success) {
        setSportFields(response.data.data);
      }
    } catch (error) {
      console.error('Error loading sport fields:', error);
    }
  };

  const loadFacilities = async () => {
    try {
      const queryParams = new URLSearchParams();
      
      // When searching, load all data for client-side filtering
      const hasSearch = searchQuery && searchQuery.trim() !== '';
      if (!hasSearch && filters.searchTerm) queryParams.append('searchTerm', filters.searchTerm);
      if (!hasSearch && filters.areaId) queryParams.append('areaId', filters.areaId);

      const response = await apiClient.get(`/admin/sports/facilities?${queryParams}`);
      
      if (response.data.success) {
        setFacilities(response.data.data);
      }
    } catch (error) {
      console.error('Error loading facilities:', error);
    }
  };

  const handleEditField = (field) => {
    setSelectedField(field);
    setShowFieldForm(true);
  };

  const handleAddField = () => {
    setSelectedField(null);
    setShowFieldForm(true);
  };

  const handleEditFacility = (facility) => {
    setSelectedFacility(facility);
    setShowFacilityForm(true);
  };

  const handleAddFacility = () => {
    setSelectedFacility(null);
    setShowFacilityForm(true);
  };

  const handleDeleteField = async (fieldId) => {
    if (!confirm(t('admin.manageSports.confirmDeleteField'))) return;

    try {
      const response = await apiClient.delete(`/admin/sports/fields/${fieldId}`);

      if (response.data.success) {
        alert(t('admin.manageSports.deleteFieldSuccess'));
        loadSportFields();
      } else {
        alert(response.data.message || t('admin.manageSports.deleteFieldError'));
      }
    } catch (error) {
      console.error('Error deleting field:', error);
      alert(t('admin.manageSports.deleteFieldError'));
    }
  };

  const handleDeleteFacility = async (facilityId) => {
    if (!confirm(t('admin.manageSports.confirmDeleteFacility'))) return;

    try {
      const response = await apiClient.delete(`/admin/sports/facilities/${facilityId}`);

      if (response.data.success) {
        alert(t('admin.manageSports.deleteFacilitySuccess'));
        loadFacilities();
      } else {
        alert(response.data.message || t('admin.manageSports.deleteFacilityError'));
      }
    } catch (error) {
      console.error('Error deleting facility:', error);
      alert(t('admin.manageSports.deleteFacilityError'));
    }
  };

  const handleFormClose = () => {
    setShowFieldForm(false);
    setShowFacilityForm(false);
    setSelectedField(null);
    setSelectedFacility(null);
    if (activeTab === 'fields') {
      loadSportFields();
    } else {
      loadFacilities();
    }
  };

  const handleFieldSubmit = async (fieldData) => {
    try {
      console.log('handleFieldSubmit - raw fieldData:', fieldData);
      // Normalize payload: remove empty strings, convert numeric ids
      const payload = { ...fieldData };
      // If updating (FieldID present) and FacilityID is empty, don't send FacilityID
      if (payload.FieldID && (payload.FacilityID === '' || payload.FacilityID == null)) {
        delete payload.FacilityID;
      }
      if (payload.SportTypeID !== undefined && payload.SportTypeID !== null && payload.SportTypeID !== '') {
        const n = Number(payload.SportTypeID);
        if (!Number.isNaN(n)) payload.SportTypeID = n;
      } else {
        delete payload.SportTypeID;
      }
      if (payload.RentalPrice !== undefined) {
        const p = Number(payload.RentalPrice);
        payload.RentalPrice = Number.isNaN(p) ? 0 : p;
      }
      console.log('handleFieldSubmit - normalized payload:', payload);
      // Map frontend keys (PascalCase) to backend expected snake/camelLower keys
      const payloadLower = {
        fieldName: payload.FieldName || payload.fieldName || '',
        fieldType: payload.FieldType || payload.fieldType || '',
        rentalPrice: payload.RentalPrice !== undefined ? payload.RentalPrice : (payload.rentalPrice !== undefined ? payload.rentalPrice : 0),
        status: payload.Status || payload.status || 'Available'
      };
      if (payload.sportTypeId !== undefined) payloadLower.sportTypeId = payload.sportTypeId;
      if (payload.SportTypeID !== undefined) payloadLower.sportTypeId = payloadLower.sportTypeId || payload.SportTypeID;
      if (payload.facilityId !== undefined) payloadLower.facilityId = payload.facilityId;
      if (payload.FacilityID !== undefined) payloadLower.facilityId = payloadLower.facilityId || payload.FacilityID;
      // If updating, don't include facilityId when it's not provided
      if (payload.FieldID && (payloadLower.facilityId === '' || payloadLower.facilityId == null)) {
        delete payloadLower.facilityId;
      }
      console.log('handleFieldSubmit - backend payload:', payloadLower);
      if (fieldData.FieldID) {
        // Update existing field
        const response = await apiClient.put(`/admin/sports/fields/${fieldData.FieldID}`, payloadLower);
        return response; // caller (form) will handle success/close and image uploads
      } else {
        // Create new field
        const response = await apiClient.post('/admin/sports/fields', payloadLower);
        return response; // caller handles post-create image upload and closing
      }
    } catch (error) {
      console.error('Error submitting field:', error);
      alert('Lỗi: ' + (error.message || 'Không thể lưu sân'));
    }
  };

  const handleFacilitySubmit = async (facilityData) => {
    try {
      // Normalize payload keys to backend expected lowerCamel keys: facilityName, areaId, ownerId
      const payload = {};
      if (facilityData.FacilityName !== undefined) payload.facilityName = facilityData.FacilityName;
      if (facilityData.facilityName !== undefined) payload.facilityName = payload.facilityName || facilityData.facilityName;
      if (facilityData.AreaID !== undefined) payload.areaId = Number(facilityData.AreaID);
      if (facilityData.areaId !== undefined) payload.areaId = payload.areaId || Number(facilityData.areaId);
      if (facilityData.OwnerID !== undefined) payload.ownerId = Number(facilityData.OwnerID);
      if (facilityData.ownerId !== undefined) payload.ownerId = payload.ownerId || Number(facilityData.ownerId);

      if (facilityData.FacilityID) {
        // Update existing facility — return response to caller so form can handle images
        const response = await apiClient.put(`/admin/sports/facilities/${facilityData.FacilityID}`, payload);
        return response;
      } else {
        // Create new facility
        const response = await apiClient.post('/admin/sports/facilities', payload);
        return response;
      }
    } catch (error) {
      console.error('Error submitting facility:', error);
      alert('Lỗi: ' + (error.message || 'Không thể lưu cơ sở'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('admin.manageSports.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">🏟️ {t('admin.manageSports.title')}</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('fields')}
              className={`${
                activeTab === 'fields'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              ⚽ {t('admin.manageSports.fieldsTab')}
            </button>
            <button
              onClick={() => setActiveTab('facilities')}
              className={`${
                activeTab === 'facilities'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              🏢 {t('admin.manageSports.facilitiesTab')}
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`${
                activeTab === 'calendar'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              📅 {t('admin.manageSports.calendarTab')}
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="p-6 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder={t('admin.manageSports.searchPlaceholder')}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
            />
            
            <select
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              value={filters.areaId}
              onChange={(e) => setFilters({ ...filters, areaId: e.target.value })}
            >
              <option value="">{t('admin.manageSports.allAreas')}</option>
              {referenceData.areas.map(area => (
                <option key={area.AreaID} value={area.AreaID}>{area.AreaName}</option>
              ))}
            </select>

            {activeTab === 'fields' && (
              <>
                <select
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={filters.sportTypeId}
                  onChange={(e) => setFilters({ ...filters, sportTypeId: e.target.value })}
                >
                  <option value="">{t('admin.manageSports.allSports')}</option>
                  {referenceData.sportTypes.map(sport => (
                    <option key={sport.SportTypeID} value={sport.SportTypeID}>{sport.SportName}</option>
                  ))}
                </select>

                <select
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <option value="">{t('admin.manageSports.allStatuses')}</option>
                  <option value="Available">{t('admin.manageSports.statusAvailable')}</option>
                  <option value="Maintenance">{t('admin.manageSports.statusMaintenance')}</option>
                  <option value="Unavailable">{t('admin.manageSports.statusUnavailable')}</option>
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {activeTab === 'fields' && (() => {
          // Client-side filtering for fields when searchQuery is present
          let filteredFields = sportFields;
          if (searchQuery && searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase().trim();
            filteredFields = sportFields.filter(field => {
              const fieldName = (field.FieldName || '').toLowerCase();
              const fieldType = (field.FieldType || '').toLowerCase();
              const areaName = (field.AreaName || '').toLowerCase();
              const facilityName = (field.FacilityName || '').toLowerCase();
              const sportName = (field.SportName || '').toLowerCase();
              return fieldName.includes(q) || fieldType.includes(q) || areaName.includes(q) || facilityName.includes(q) || sportName.includes(q);
            });
          }
          
          return (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">{t('admin.manageSports.fieldsList')} ({filteredFields.length})</h2>
                <button
                  onClick={handleAddField}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  ➕ {t('admin.manageSports.addNewField')}
                </button>
              </div>
              <SportFieldList
                fields={filteredFields}
                onEdit={handleEditField}
                onDelete={handleDeleteField}
                onSaveField={handleFieldSubmit}
                referenceData={referenceData}
              />
            </>
          );
        })()}

        {activeTab === 'facilities' && (() => {
          // Client-side filtering for facilities when searchQuery is present
          let filteredFacilities = facilities;
          if (searchQuery && searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase().trim();
            filteredFacilities = facilities.filter(facility => {
              const facilityName = (facility.FacilityName || '').toLowerCase();
              const areaName = (facility.AreaName || '').toLowerCase();
              const ownerName = (facility.OwnerName || facility.OwnerFullName || '').toLowerCase();
              return facilityName.includes(q) || areaName.includes(q) || ownerName.includes(q);
            });
          }
          
          return (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">{t('admin.manageSports.facilitiesList')} ({filteredFacilities.length})</h2>
                <button
                  onClick={handleAddFacility}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  ➕ {t('admin.manageSports.addNewFacility')}
                </button>
              </div>
              <FacilityList
                facilities={filteredFacilities}
                onEdit={handleEditFacility}
                onDelete={handleDeleteFacility}
                referenceData={referenceData}
              />
            </>
          );
        })()}

        {activeTab === 'calendar' && (
          <SportFieldCalendar
            sportFields={sportFields}
            referenceData={referenceData}
          />
        )}
      </div>

      {/* Modals */}
      {showFieldForm && (
        <SportFieldForm
          isOpen={showFieldForm}
          field={selectedField}
          // include facilities so the form's Facility select is populated
          referenceData={{ ...referenceData, facilities }}
          onSubmit={handleFieldSubmit}
          onClose={handleFormClose}
        />
      )}

      {showFacilityForm && (
        <FacilityForm
          isOpen={showFacilityForm}
          facility={selectedFacility}
          referenceData={referenceData}
          onSubmit={handleFacilitySubmit}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
};

export default ManageSports;
