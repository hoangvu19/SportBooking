import React from 'react';
import { useI18n } from '../../i18n/hooks';

const FacilityList = ({ facilities, onEdit, onDelete, referenceData }) => {
  const { t } = useI18n();
  if (!facilities || facilities.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-xl">{t('admin.facility.noFacilities')}</p>
        <p className="text-sm mt-2">{t('admin.facility.addFacilityPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {facilities.map((facility) => {
        const facilityImage = facility.images && facility.images.length > 0 ? facility.images[0].ImageUrl : null;
        
        return (
          <div key={facility.FacilityID} className="bg-white border rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden">
            {/* Facility Image */}
            {facilityImage ? (
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={facilityImage} 
                  alt={facility.FacilityName}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2">
                  <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-lg">
                    {facility.AreaName}
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative h-48 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <span className="text-6xl opacity-50">🏟️</span>
                <div className="absolute top-2 right-2">
                  <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-lg">
                    {facility.AreaName}
                  </span>
                </div>
              </div>
            )}

            <div className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">{facility.FacilityName}</h3>
                <p className="text-sm text-gray-500">ID: #{facility.FacilityID}</p>
              </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center text-sm text-gray-600">
                <span className="font-semibold mr-2"> {t('admin.facility.owner')}:</span>
                <span>{facility.OwnerFullName || facility.OwnerUsername || 'N/A'}</span>
              </div>
              
              {facility.sportFields && (
                <div className="flex items-center text-sm text-gray-600">
                  <span className="font-semibold mr-2"> {t('admin.facility.fieldCount')}:</span>
                  <span>{facility.sportFields.length || 0} {t('admin.sportField.fieldsCount')}</span>
                </div>
              )}

              {facility.images && facility.images.length > 0 && (
                <div className="flex items-center text-sm text-gray-600">
                  <span className="font-semibold mr-2"> {t('admin.facility.imageCount')}:</span>
                  <span>{facility.images.length} ảnh</span>
                </div>
              )}
            </div>

            {facility.sportFields && facility.sportFields.length > 0 && (
              <div className="border-t pt-3 mb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">{t('admin.facility.fields').toUpperCase()}:</p>
                <div className="space-y-1">
                  {facility.sportFields.slice(0, 3).map(field => {
                    const raw = field.FieldType ?? field.Type ?? field.fieldType ?? null;
                    let typeLabel;
                    if (raw) {
                      typeLabel = String(raw);
                    } else if (field.IsIndoor === 1 || field.IsIndoor === true) {
                      typeLabel = 'Indoor';
                    } else if (field.IsIndoor === 0 || field.IsIndoor === false) {
                      typeLabel = 'Outdoor';
                    } else {
                      typeLabel = '—';
                    }

                    return (
                      <div key={field.FieldID} className="text-xs text-gray-600 flex justify-between">
                        <span>• {field.FieldName} <span className="text-gray-400">({typeLabel})</span></span>
                        <span className="text-green-600 font-semibold">
                          {new Intl.NumberFormat('vi-VN').format(field.RentalPrice || 0)} đ
                        </span>
                      </div>
                    );
                  })}
                  {facility.sportFields.length > 3 && (
                    <p className="text-xs text-gray-400 italic">
                      {t('admin.facility.moreFields', { count: facility.sportFields.length - 3 })}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => onEdit(facility)}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium"
              >
                {t('admin.sportField.edit')}
              </button>
              <button
                onClick={() => onDelete(facility.FacilityID)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium"
              >
                {t('admin.sportField.delete')}
              </button>
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
};

export default FacilityList;
