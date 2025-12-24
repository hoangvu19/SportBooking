import { areaAPI } from './api';

let _areas = null;
let _loading = null;

export const loadAreas = async () => {
  if (_areas) return _areas;
  if (_loading) return _loading;
  _loading = (async () => {
    try {
      const res = await areaAPI.getAll();
      if (res && res.success && Array.isArray(res.data)) {
        _areas = res.data;
      } else if (Array.isArray(res)) {
        _areas = res;
      } else {
        _areas = [];
      }
    } catch (err) {
      console.debug('areaCache: failed to load areas', err);
      _areas = [];
    } finally {
      _loading = null;
    }
    return _areas;
  })();
  return _loading;
};

export const getCachedAreaName = (areaId) => {
  if (!areaId || !_areas) return null;
  const found = _areas.find(a => String(a.AreaID || a.id) === String(areaId));
  return found ? (found.AreaName || found.name) : null;
};

export const clearAreaCache = () => { _areas = null; };

export default {
  loadAreas,
  getCachedAreaName,
  clearAreaCache,
};
