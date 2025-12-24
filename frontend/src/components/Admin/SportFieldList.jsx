import React, { useState } from 'react';
import FieldDetailModal from '../../components/Shared/FieldDetailModal';
import { useI18n } from '../../i18n/hooks';

const SportFieldList = ({ fields, onEdit, onDelete }) => {
  const { t } = useI18n();
  const [expandedFacility, setExpandedFacility] = useState(null);
  const [viewingFieldId, setViewingFieldId] = useState(null);

  const getStatusBadge = (status) => {
    const statusMap = {
      'Available': { label: t('admin.sportField.statusAvailable'), class: 'bg-green-100 text-green-800' },
      'Maintenance': { label: t('admin.sportField.statusMaintenance'), class: 'bg-yellow-100 text-yellow-800' },
      'Unavailable': { label: t('admin.sportField.statusUnavailable'), class: 'bg-red-100 text-red-800' }
    };
    const config = statusMap[status] || { label: status, class: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${config.class}`}>
        {config.label}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);
  };

  const getFieldTypeLabel = (field) => {
    // If DB explicitly provides a type, show it verbatim (supports Single/Double/Beach/50m/etc.)
    const raw = field.FieldType ?? field.Type ?? field.fieldType ?? field.FieldTypeName ?? null;
    if (raw) {
      return String(raw);
    }

    // Some schemas may store a boolean flag indicating indoor/outdoor
    if (field.IsIndoor === 1 || field.IsIndoor === true) return 'Indoor';
    if (field.IsIndoor === 0 || field.IsIndoor === false) return 'Outdoor';

    // Fallback: try to infer from name (best-effort)
    const name = field.FieldName || '';
    if (/indoor|trong nhà|trong nha|trong/i.test(name)) return 'Indoor';
    if (/outdoor|ngoai|ngoài|ngoai trời|ngoài trời/i.test(name)) return 'Outdoor';

    return '—';
  };

  if (!fields || fields.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-xl">{t('admin.sportField.noFields')}</p>
        <p className="text-sm mt-2">{t('admin.sportField.addFieldPrompt')}</p>
      </div>
    );
  }

  // Group fields by facility
  const groupedByFacility = fields.reduce((acc, field) => {
    const facilityId = field.FacilityID;
    if (!acc[facilityId]) {
      acc[facilityId] = {
        facilityId: facilityId,
        facilityName: field.FacilityName,
        areaName: field.AreaName,
        fields: []
      };
    }
    acc[facilityId].fields.push(field);
    return acc;
  }, {});

  const facilities = Object.values(groupedByFacility);

  const toggleFacility = (facilityId) => {
    setExpandedFacility(expandedFacility === facilityId ? null : facilityId);
  };

  return (
    <div className="space-y-4">
      <FieldDetailModal fieldId={viewingFieldId} isOpen={!!viewingFieldId} onClose={() => setViewingFieldId(null)} />
      {facilities.map((facility) => {
        const isExpanded = expandedFacility === facility.facilityId;
        const facilityImage = facility.fields[0]?.FacilityImageUrl;
        
        return (
          <div key={facility.facilityId} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            {/* Facility Header - Clickable */}
            <div
              onClick={() => toggleFacility(facility.facilityId)}
              className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 cursor-pointer hover:from-blue-100 hover:to-blue-200 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Facility Image */}
                  {facilityImage ? (
                    <img 
                      src={facilityImage} 
                      alt={facility.facilityName}
                      className="w-16 h-16 rounded-lg object-cover border-2 border-blue-300 shadow-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-200 to-blue-300 flex items-center justify-center border-2 border-blue-300 shadow-sm">
                      <span className="text-2xl">🏟️</span>
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{facility.facilityName}</h3>
                    <p className="text-sm text-gray-600">
                      📍 {facility.areaName} • <span className="font-semibold text-blue-600">{facility.fields.length} {t('admin.sportField.fieldsCount')}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-blue-600">
                    {isExpanded ? t('admin.sportField.collapse') + ' ▲' : t('admin.sportField.expand') + ' ▼'}
                  </span>
                </div>
              </div>
            </div>

            {/* Fields Table - Only show when expanded */}
            {isExpanded && (
              <div className="bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.sportField.image')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.sportField.fieldName')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.sportField.sportType')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.sportField.fieldType')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.sportField.rentalPrice')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.sportField.status')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.sportField.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {facility.fields.map((field) => (
                        <tr key={field.FieldID} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {field.ImageUrl || field.imageUrl ? (
                              <img 
                                src={field.ImageUrl || field.imageUrl} 
                                alt={field.FieldName}
                                className="w-12 h-12 rounded-lg object-cover border border-gray-300 shadow-sm"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border border-gray-300">
                                <span className="text-xl"></span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="font-mono">#{field.FieldID}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {field.FieldName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {field.SportName || field.SportTypeName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {getFieldTypeLabel(field)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                            {formatCurrency(field.RentalPrice)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(field.Status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setViewingFieldId(field.FieldID || field.SanID || field.id); }}
                              className="px-2 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                            >
                              {t('admin.sportField.view')}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (typeof onEdit === 'function') onEdit(field);
                              }}
                              className="text-blue-600 hover:text-blue-900 mr-3 hover:underline"
                            >
                              {t('admin.sportField.edit')}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(field.FieldID);
                              }}
                              className="text-red-600 hover:text-red-900 hover:underline"
                            >
                              {t('admin.sportField.delete')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SportFieldList;
