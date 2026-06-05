import { STORAGE_KEY } from './config.js';

export function saveState(widgetIds, preferences = {}) {
  const payload = {
    widgets: widgetIds,
    preferences,
    lastSaved: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (!Array.isArray(state.widgets)) return null;
    return {
      widgets: state.widgets,
      preferences: state.preferences || {},
      lastSaved: state.lastSaved || null
    };
  } catch (_error) {
    return null;
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}
