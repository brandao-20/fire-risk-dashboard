import { KPIS, MAP_AREAS, RISK_META } from './config.js';
import { loadDashboardData } from './api.js';
import { saveState, loadState, clearState } from './storage.js';
import { CHART_RENDERERS } from './charts.js';

const els = {
  kpiList: document.getElementById('kpi-list'),
  dropZone: document.getElementById('drop-zone'),
  dashboardGrid: document.getElementById('dashboard-grid'),
  emptyState: document.getElementById('empty-state'),
  addedCount: document.getElementById('added-count'),
  totalCount: document.getElementById('total-count'),
  progressPercent: document.getElementById('progress-percent'),
  progressBar: document.getElementById('progress-bar'),
  refreshBtn: document.getElementById('refresh-btn'),
  saveBtn: document.getElementById('save-btn'),
  exportCsvBtn: document.getElementById('export-csv-btn'),
  exportJsonBtn: document.getElementById('export-json-btn'),
  resetBtn: document.getElementById('reset-btn'),
  statusMessage: document.getElementById('status-message'),
  confirmModal: document.getElementById('confirm-modal'),
  confirmCancel: document.getElementById('confirm-cancel'),
  confirmAccept: document.getElementById('confirm-accept'),
  confirmClose: document.getElementById('confirm-close'),
  toast: document.getElementById('toast'),
  metricFires: document.getElementById('metric-fires'),
  metricMaxRisk: document.getElementById('metric-max-risk'),
  metricHotspots: document.getElementById('metric-hotspots'),
  metricSources: document.getElementById('metric-sources'),
  metricUpdated: document.getElementById('metric-updated'),
  areaSelect: document.getElementById('area-select'),
  areaHelp: document.getElementById('area-help'),
  sourceFilter: document.getElementById('source-filter'),
  riskFilter: document.getElementById('risk-filter'),
  hotspotDaysSelect: document.getElementById('hotspot-days-select'),
  copernicusLayerToggle: document.getElementById('copernicus-layer-toggle')
};

let dashboardData = null;
let viewData = null;
let sortable = null;

function init() {
  els.totalCount.textContent = KPIS.length;
  renderKpiLibrary();
  updateAreaHelp();
  initDropZone();
  initSortable();
  bindActions();
  restoreSavedState();
  refreshData();
}

function renderKpiLibrary() {
  els.kpiList.innerHTML = KPIS.map((kpi) => `
    <article class="kpi-card" role="listitem" draggable="true" data-kpi-id="${kpi.id}" tabindex="0" aria-disabled="false">
      <div class="kpi-head">
        <strong>${kpi.title}</strong>
        <span class="badge available">DISPONÍVEL</span>
      </div>
      <p>${kpi.description}</p>
      <div class="kpi-meta">
        <span>${kpi.chartType}</span>
        <span>·</span>
        <span>Clique ou arraste</span>
      </div>
    </article>
  `).join('');

  els.kpiList.querySelectorAll('.kpi-card').forEach((card) => {
    card.addEventListener('dragstart', (event) => {
      if (isWidgetActive(card.dataset.kpiId)) {
        event.preventDefault();
        showToast('Este KPI já está no dashboard.');
        return;
      }
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', card.dataset.kpiId);
    });

    card.addEventListener('click', () => addWidget(card.dataset.kpiId));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        addWidget(card.dataset.kpiId);
      }
    });
  });
}

function initDropZone() {
  ['dragenter', 'dragover'].forEach((type) => {
    els.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      els.dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((type) => {
    els.dropZone.addEventListener(type, () => {
      els.dropZone.classList.remove('drag-over');
    });
  });

  els.dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    const kpiId = event.dataTransfer.getData('text/plain');
    addWidget(kpiId);
  });
}

function initSortable() {
  sortable = new Sortable(els.dashboardGrid, {
    animation: 180,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    onEnd: () => {
      renderAllWidgets();
      updateUiState();
    }
  });
}

function bindActions() {
  els.refreshBtn.addEventListener('click', refreshData);
  els.saveBtn.addEventListener('click', () => {
    const state = saveState(getActiveWidgetIds(), getCurrentPreferences());
    showToast(`Dashboard guardado às ${new Date(state.lastSaved).toLocaleTimeString('pt-PT')}.`);
  });
  els.exportCsvBtn?.addEventListener('click', exportVisibleCsv);
  els.exportJsonBtn?.addEventListener('click', exportDashboardJson);
  els.resetBtn.addEventListener('click', openResetConfirmModal);

  els.areaSelect?.addEventListener('change', () => {
    updateAreaHelp();
    refreshData();
  });
  els.hotspotDaysSelect?.addEventListener('change', refreshData);
  els.sourceFilter?.addEventListener('change', renderFilteredDashboard);
  els.riskFilter?.addEventListener('change', renderFilteredDashboard);
  els.copernicusLayerToggle?.addEventListener('change', renderFilteredDashboard);

  if (els.confirmCancel) els.confirmCancel.addEventListener('click', closeResetConfirmModal);
  if (els.confirmClose) els.confirmClose.addEventListener('click', closeResetConfirmModal);
  if (els.confirmAccept) els.confirmAccept.addEventListener('click', confirmResetDashboard);
  if (els.confirmModal) {
    els.confirmModal.addEventListener('click', (event) => {
      if (event.target === els.confirmModal) closeResetConfirmModal();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && els.confirmModal?.classList.contains('show')) {
      closeResetConfirmModal();
    }
  });
}

function openResetConfirmModal() {
  if (!els.confirmModal) {
    confirmResetDashboard();
    return;
  }
  els.confirmModal.classList.add('show');
  els.confirmModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  els.confirmCancel?.focus();
}

function closeResetConfirmModal() {
  els.confirmModal?.classList.remove('show');
  els.confirmModal?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  els.resetBtn.focus();
}

function confirmResetDashboard() {
  clearState();
  els.dashboardGrid.innerHTML = '';
  closeResetConfirmModal();
  updateUiState();
  showToast('Dashboard reposto para o estado inicial.');
}

function restoreSavedState() {
  const state = loadState();
  if (state?.preferences) {
    applySavedPreferences(state.preferences);
  }

  if (!state?.widgets?.length) {
    updateUiState();
    return;
  }

  state.widgets.forEach((id) => {
    if (KPIS.some((kpi) => kpi.id === id)) {
      createWidgetElement(id);
    }
  });
  updateUiState();
}

function applySavedPreferences(preferences = {}) {
  const filters = preferences.filters || preferences;
  if (preferences.area && MAP_AREAS[preferences.area] && els.areaSelect) {
    els.areaSelect.value = preferences.area;
  }
  if (filters.area && MAP_AREAS[filters.area] && els.areaSelect) {
    els.areaSelect.value = filters.area;
  }
  if (filters.source && els.sourceFilter) els.sourceFilter.value = normalizeMapSource(filters.source);
  if (filters.minRisk != null && els.riskFilter) els.riskFilter.value = String(filters.minRisk);
  if (filters.hotspotDays && els.hotspotDaysSelect) els.hotspotDaysSelect.value = String(filters.hotspotDays);
  if (filters.showCopernicusLayers != null && els.copernicusLayerToggle) els.copernicusLayerToggle.checked = Boolean(filters.showCopernicusLayers);
  updateAreaHelp();
}

async function refreshData() {
  const filters = getCurrentFilters();
  const areaLabel = MAP_AREAS[filters.area]?.label || 'Portugal Continental';
  setLoading(true, `A atualizar dados externos para ${areaLabel}: IPMA, Fogos.pt, NASA FIRMS, Open-Meteo e camadas EFFIS/GWIS...`);
  try {
    dashboardData = await loadDashboardData(filters.area, { days: filters.hotspotDays });
    renderFilteredDashboard();
    const updatedAt = new Date(dashboardData.summary.generatedAt).toLocaleString('pt-PT');
    setStatus(`Dados atualizados com sucesso. Widgets ativos redesenhados. Última atualização: ${updatedAt}.`, 'success');
  } catch (error) {
    console.error(error);
    setStatus(`Não foi possível carregar os dados externos. Confirme que executou npm install e npm start. Detalhe: ${error.message}`, 'error');
    showToast('Erro ao atualizar dados. Ver consola/terminal.');
  } finally {
    setLoading(false);
  }
}

function renderFilteredDashboard() {
  if (!dashboardData) return;
  viewData = buildViewData(dashboardData, getCurrentFilters());
  updateSummary(viewData);
  renderAllWidgets();
  updateUiState();
}

function addWidget(kpiId) {
  const kpi = KPIS.find((item) => item.id === kpiId);
  if (!kpi) return;
  if (isWidgetActive(kpiId)) {
    showToast('Esse KPI já foi adicionado. Remova-o para voltar a adicionar.');
    return;
  }
  createWidgetElement(kpiId);
  updateUiState();
  renderWidget(kpiId);
  showToast(`${kpi.title} adicionado ao dashboard.`);
}

function createWidgetElement(kpiId) {
  const kpi = KPIS.find((item) => item.id === kpiId);
  if (!kpi) return null;

  const widget = document.createElement('article');
  widget.className = `widget ${kpi.size === 'large' ? 'large' : ''}`;
  widget.dataset.kpiId = kpi.id;
  widget.innerHTML = `
    <header class="widget-header">
      <div class="widget-title">
        <h3>${kpi.title}</h3>
        <p>${kpi.description}</p>
      </div>
      <div class="widget-actions">
        <button class="icon-btn drag-handle" type="button" title="Reorganizar widget" aria-label="Reorganizar widget">↕</button>
        <button class="icon-btn remove" type="button" title="Remover widget" aria-label="Remover widget">×</button>
      </div>
    </header>
    <div class="widget-body" data-chart-container="${kpi.id}">
      <div class="empty-state"><p>A aguardar dados...</p></div>
    </div>
    <footer class="widget-footer" data-widget-footer="${kpi.id}">
      <span>Fonte: APIs externas via proxy local</span>
      <span>Tipo: ${kpi.chartType}</span>
    </footer>
  `;

  widget.querySelector('.remove').addEventListener('click', () => {
    widget.remove();
    updateUiState();
    showToast(`${kpi.title} removido.`);
  });

  els.dashboardGrid.appendChild(widget);
  return widget;
}

function renderAllWidgets() {
  getActiveWidgetIds().forEach(renderWidget);
}

function renderWidget(kpiId) {
  if (!viewData) return;
  const renderer = CHART_RENDERERS[kpiId];
  if (!renderer) return;
  const widget = els.dashboardGrid.querySelector(`[data-kpi-id="${kpiId}"]`);
  if (!widget) return;
  const body = widget.querySelector(`[data-chart-container="${kpiId}"]`);
  const footer = widget.querySelector(`[data-widget-footer="${kpiId}"]`);
  try {
    renderer(body, viewData);
    footer.innerHTML = footerContent(kpiId, viewData);
  } catch (error) {
    console.error(`Erro ao renderizar ${kpiId}`, error);
    body.innerHTML = `<div class="empty-state"><p>Erro ao desenhar gráfico: ${escapeHtml(error.message)}</p></div>`;
  }
}

function footerContent(kpiId, data) {
  const updated = new Date(data.summary.generatedAt).toLocaleString('pt-PT');
  const filters = data.filters || getCurrentFilters();
  const sources = {
    'active-map': `${data.fires.source} · ${data.hotspots.source}`,
    'risk-map': data.risk.source,
    'risk-donut': data.risk.source,
    'top-risk-bar': data.risk.source,
    'weather-scatter': `${data.weather.source} · ${data.risk.source}`,
    'evolution-line': `${data.hotspots.source} · ${data.fires.source}`
  };
  const filterText = `Filtros: ${filterSummary(filters)}`;
  return `<span>Fonte: ${sources[kpiId] || 'APIs externas'}</span><span>${filterText}</span><span>Atualizado: ${updated}</span>`;
}

function updateUiState() {
  const activeIds = getActiveWidgetIds();
  els.emptyState.hidden = activeIds.length > 0;

  const count = activeIds.length;
  const percent = Math.round((count / KPIS.length) * 100);
  els.addedCount.textContent = count;
  els.progressPercent.textContent = `${percent}%`;
  els.progressBar.style.width = `${percent}%`;

  els.kpiList.querySelectorAll('.kpi-card').forEach((card) => {
    const isActive = activeIds.includes(card.dataset.kpiId);
    card.classList.toggle('added', isActive);
    card.setAttribute('aria-disabled', String(isActive));
    card.querySelector('.badge').textContent = isActive ? 'ADICIONADO' : 'DISPONÍVEL';
    card.querySelector('.badge').className = `badge ${isActive ? 'added' : 'available'}`;
    const meta = card.querySelector('.kpi-meta');
    const kpi = KPIS.find((item) => item.id === card.dataset.kpiId);
    meta.innerHTML = isActive
      ? `<span>${kpi.chartType}</span><span>·</span><span>Já está no dashboard</span>`
      : `<span>${kpi.chartType}</span><span>·</span><span>Clique ou arraste</span>`;
  });
}

function getSelectedArea() {
  const value = els.areaSelect?.value || 'portugal';
  return MAP_AREAS[value] ? value : 'portugal';
}

function normalizeMapSource(source) {
  const allowed = new Set(['all', 'fires', 'hotspots', 'copernicus']);
  return allowed.has(source) ? source : 'all';
}

function updateAreaHelp() {
  if (!els.areaHelp) return;
  const area = MAP_AREAS[getSelectedArea()] || MAP_AREAS.portugal;
  els.areaHelp.textContent = area.note;
}

function getCurrentFilters() {
  return {
    area: getSelectedArea(),
    source: normalizeMapSource(els.sourceFilter?.value || 'all'),
    minRisk: Number(els.riskFilter?.value || 0),
    hotspotDays: Number(els.hotspotDaysSelect?.value || 3),
    showCopernicusLayers: Boolean(els.copernicusLayerToggle?.checked)
  };
}

function getCurrentPreferences() {
  return {
    area: getSelectedArea(),
    filters: getCurrentFilters()
  };
}

function buildViewData(data, filters) {
  // O filtro de fonte controla apenas o mapa. O filtro de risco mínimo é aplicado
  // aos dados IPMA, que possuem classe de risco explícita.
  const fires = [...(data.fires?.items || [])];
  const hotspots = [...(data.hotspots?.items || [])];
  const minRisk = Number(filters.minRisk || 0);
  const riskItems = [...(data.risk?.items || [])].filter((item) => Number(item.risk || 0) >= minRisk);
  const riskTomorrowItems = [...(data.riskTomorrow?.items || [])].filter((item) => Number(item.risk || 0) >= minRisk);

  const riskMax = riskItems.filter((d) => d.risk === 5).length;
  const riskHighOrMore = riskItems.filter((d) => d.risk >= 3).length;
  const avgRisk = riskItems.length ? riskItems.reduce((acc, item) => acc + Number(item.risk || 0), 0) / riskItems.length : 0;
  const totalHumans = fires.reduce((acc, d) => acc + Number(d.humans || 0), 0);
  const totalGround = fires.reduce((acc, d) => acc + Number(d.ground || 0), 0);
  const totalAerial = fires.reduce((acc, d) => acc + Number(d.aerial || 0), 0);
  const externalLayers = structuredCloneSafe(data.externalLayers || {});
  if (externalLayers.layers) {
    if (externalLayers.layers.effisFwiWms) {
      externalLayers.layers.effisFwiWms.enabled = Boolean((filters.showCopernicusLayers || filters.source === 'copernicus') && externalLayers.layers.effisFwiWms.enabled);
    }
    if (externalLayers.layers.effisActiveFiresWms) {
      externalLayers.layers.effisActiveFiresWms.enabled = Boolean((filters.showCopernicusLayers || filters.source === 'copernicus') && externalLayers.layers.effisActiveFiresWms.enabled);
    }
    if (externalLayers.layers.effisBurntAreasWms) {
      externalLayers.layers.effisBurntAreasWms.enabled = Boolean((filters.showCopernicusLayers || filters.source === 'copernicus') && externalLayers.layers.effisBurntAreasWms.enabled);
    }
    if (externalLayers.layers.gwisFwiWms) {
      externalLayers.layers.gwisFwiWms.enabled = Boolean((filters.showCopernicusLayers || filters.source === 'copernicus') && externalLayers.layers.gwisFwiWms.enabled);
    }
  }

  return {
    ...data,
    filters,
    fires: { ...data.fires, items: fires },
    hotspots: { ...data.hotspots, items: hotspots },
    risk: { ...data.risk, items: riskItems },
    riskTomorrow: { ...data.riskTomorrow, items: riskTomorrowItems },
    externalLayers,
    summary: {
      ...data.summary,
      activeFires: fires.length,
      hotspots: hotspots.length,
      riskMax,
      riskHighOrMore,
      avgRisk: Number((avgRisk || 0).toFixed(2)),
      totalHumans,
      totalGround,
      totalAerial,
      filters
    }
  };
}

function structuredCloneSafe(value) {
  try {
    return structuredClone(value);
  } catch (_error) {
    return JSON.parse(JSON.stringify(value));
  }
}

function updateSummary(data) {
  const summary = data.summary;
  const rawLiveSources = dashboardData?.summary?.liveSources || {};
  const liveSources = Object.fromEntries(
    Object.entries(rawLiveSources).filter(([key]) => key !== 'openWeatherFwi')
  );
  const live = Object.values(liveSources).filter(Boolean).length;
  const total = Object.keys(liveSources).length;
  els.metricFires.textContent = summary.activeFires;
  els.metricMaxRisk.textContent = summary.riskMax;
  els.metricHotspots.textContent = summary.hotspots;
  if (els.metricSources) els.metricSources.textContent = total ? `${live}/${total}` : '—';
  els.metricUpdated.textContent = new Date(summary.generatedAt).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
}

function updateSourceHealth(data) {
  if (!els.sourceHealth || !data?.summary?.liveSources) return;
  const labels = {
    ipma: 'IPMA',
    fogos: 'Fogos.pt',
    firms: 'NASA FIRMS',
    openMeteo: 'Open-Meteo'
  };
  const sourcePayload = {
    ipma: data.risk,
    fogos: data.fires,
    firms: data.hotspots,
    openMeteo: data.weather
  };
  els.sourceHealth.innerHTML = Object.entries(data.summary.liveSources)
    .filter(([key]) => key !== 'openWeatherFwi')
    .map(([key, live]) => {
    const item = sourcePayload[key] || {};
    const title = live ? 'Fonte em direto' : (item.error || 'Fonte em fallback');
    return `<span class="source-pill ${live ? 'live' : 'fallback'}" title="${escapeHtml(title)}"><i></i>${labels[key] || key}<strong>${live ? 'direto' : 'fallback'}</strong></span>`;
  }).join('');
}

function getActiveWidgetIds() {
  return Array.from(els.dashboardGrid.querySelectorAll('.widget')).map((widget) => widget.dataset.kpiId);
}

function isWidgetActive(kpiId) {
  return getActiveWidgetIds().includes(kpiId);
}

function setLoading(isLoading, message = '') {
  els.refreshBtn.disabled = isLoading;
  els.saveBtn.disabled = isLoading;
  if (els.exportCsvBtn) els.exportCsvBtn.disabled = isLoading;
  if (els.exportJsonBtn) els.exportJsonBtn.disabled = isLoading;
  if (isLoading) setStatus(message, 'loading');
}

function setStatus(message, type = 'success') {
  els.statusMessage.innerHTML = `<span class="status-dot"></span>${message}`;
  els.statusMessage.style.background = type === 'error' ? '#fff1f2' : type === 'loading' ? '#eff6ff' : '#f0fdf4';
  els.statusMessage.style.borderColor = type === 'error' ? '#fecdd3' : type === 'loading' ? '#bfdbfe' : '#bbf7d0';
  els.statusMessage.style.color = type === 'error' ? '#be123c' : type === 'loading' ? '#1d4ed8' : '#166534';
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => els.toast.classList.remove('show'), 2400);
}

function exportVisibleCsv() {
  if (!viewData) {
    showToast('Ainda não existem dados para exportar.');
    return;
  }
  const rows = collectExportRows(viewData);
  if (!rows.length) {
    showToast('Não existem dados visíveis para exportar.');
    return;
  }
  const csv = toCsv(rows);
  const stamp = timestampForFile();
  downloadText(`fire-risk-visible-data-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
  showToast('Dados visíveis exportados para CSV.');
}

function exportDashboardJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    widgets: getActiveWidgetIds(),
    preferences: getCurrentPreferences(),
    summary: viewData?.summary || null,
    sourceStatus: filteredSourceStatus(dashboardData?.summary?.liveSources || null)
  };
  const stamp = timestampForFile();
  downloadText(`fire-risk-dashboard-state-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  showToast('Estado do dashboard exportado para JSON.');
}


function filteredSourceStatus(status) {
  if (!status) return null;
  return Object.fromEntries(Object.entries(status).filter(([key]) => key !== 'openWeatherFwi'));
}

function collectExportRows(data) {
  const rows = [];
  const area = data.summary?.area?.label || '';

  (data.fires?.items || []).forEach((fire) => {
    rows.push({
      tipo: 'ocorrencia_fogos_pt',
      area,
      id: fire.id,
      nome: fire.title,
      distrito: fire.district,
      municipio: fire.municipality,
      latitude: fire.latitude,
      longitude: fire.longitude,
      estado: fire.status,
      operacionais: fire.humans,
      terrestres: fire.ground,
      aereos: fire.aerial,
      atualizado_em: fire.updatedAt || fire.startedAt || '',
      fonte: data.fires.source
    });
  });

  (data.hotspots?.items || []).forEach((hotspot) => {
    rows.push({
      tipo: 'hotspot_nasa_firms',
      area,
      id: hotspot.id,
      nome: 'Deteção térmica por satélite',
      latitude: hotspot.latitude,
      longitude: hotspot.longitude,
      confianca: hotspot.confidence,
      frp_mw: hotspot.frp,
      brilho: hotspot.brightness,
      data: hotspot.acqDate,
      hora: hotspot.acqTime,
      satelite: hotspot.satellite,
      instrumento: hotspot.instrument,
      fonte: data.hotspots.source
    });
  });

  (data.risk?.items || []).forEach((risk) => {
    rows.push({
      tipo: 'risco_ipma',
      area: 'Portugal Continental',
      id: risk.dico,
      nome: risk.municipalityLabel,
      distrito: risk.districtName,
      municipio: risk.municipalityLabel,
      latitude: risk.latitude,
      longitude: risk.longitude,
      risco: risk.risk,
      classe: risk.riskLabel,
      fonte: data.risk.source
    });
  });


  (data.weather?.items || []).forEach((weather) => {
    rows.push({
      tipo: 'open_meteo',
      area,
      id: weather.districtCode,
      nome: weather.districtName,
      latitude: weather.latitude,
      longitude: weather.longitude,
      temperatura_c: weather.temperature,
      humidade_percentagem: weather.humidity,
      vento_kmh: weather.windSpeed,
      precipitacao_mm: weather.precipitation,
      fonte: data.weather.source
    });
  });


  return rows;
}

function toCsv(rows) {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set()));
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => csvCell(row[header])).join(','));
  });
  return lines.join('\n');
}

function csvCell(value) {
  if (value == null) return '';
  const text = String(value).replace(/"/g, '""');
  return /[",\n;]/.test(text) ? `"${text}"` : text;
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function filterSummary(filters) {
  const sourceLabels = {
    all: 'todas as fontes no mapa',
    fires: 'só Fogos.pt no mapa',
    hotspots: 'só NASA FIRMS no mapa',
    copernicus: 'só camadas EFFIS/GWIS (WMS) no mapa'
  };
  const riskLabel = Number(filters.minRisk) > 0 ? `${RISK_META[filters.minRisk]?.label || filters.minRisk}+` : 'todos os riscos';
  const copernicusLabel = filters.showCopernicusLayers ? ', EFFIS/GWIS ativo' : '';
  return `${sourceLabels[filters.source] || 'todas as fontes'}, ${riskLabel}, ${filters.hotspotDays} dia(s) FIRMS${copernicusLabel}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

init();
