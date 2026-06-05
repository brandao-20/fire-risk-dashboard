import { RISK_META, MAP_AREAS } from './config.js';

let mapCounter = 0;
let tooltip;

const FWI_META = {
  0: { label: 'Muito baixo', color: '#22c55e' },
  1: { label: 'Baixo', color: '#16a34a' },
  2: { label: 'Moderado', color: '#84cc16' },
  3: { label: 'Elevado', color: '#f59e0b' },
  4: { label: 'Muito elevado', color: '#f97316' },
  5: { label: 'Extremo', color: '#dc2626' }
};

function ensureTooltip() {
  if (!tooltip) {
    tooltip = d3.select('body').append('div').attr('class', 'chart-tooltip');
  }
  return tooltip;
}

function showTooltip(event, html) {
  ensureTooltip()
    .html(html)
    .style('left', `${event.clientX}px`)
    .style('top', `${event.clientY}px`)
    .style('opacity', 1);
}

function moveTooltip(event) {
  ensureTooltip()
    .style('left', `${event.clientX}px`)
    .style('top', `${event.clientY}px`);
}

function hideTooltip() {
  ensureTooltip().style('opacity', 0);
}

function clean(container) {
  container.innerHTML = '';
}

function formatDate(value) {
  if (!value) return 'Sem data';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
}

function createChartFrame(container) {
  const frame = document.createElement('div');
  frame.className = 'chart-frame';
  container.appendChild(frame);
  return frame;
}

function createSvg(frame, margin = { top: 22, right: 18, bottom: 40, left: 44 }) {
  const width = Math.max(frame.clientWidth || 620, 320);
  const height = Math.max(frame.clientHeight || 330, 260);
  const svg = d3.select(frame).append('svg')
    .attr('class', 'chart-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img');

  return {
    svg,
    width,
    height,
    innerWidth: width - margin.left - margin.right,
    innerHeight: height - margin.top - margin.bottom,
    margin,
    plot: svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  };
}

function legend(container, entries) {
  const div = document.createElement('div');
  div.className = 'legend';
  div.innerHTML = entries.map((entry) => `
    <span class="legend-item">
      <span class="legend-swatch" style="background:${entry.color}"></span>${entry.label}
    </span>
  `).join('');
  container.appendChild(div);
}


function selectedAreaFromData(data) {
  const key = data?.summary?.area?.key || 'portugal';
  const fallback = MAP_AREAS.portugal;
  return MAP_AREAS[key] || fallback;
}

function areaBounds(area) {
  const source = area?.mapBounds || area?.bounds || MAP_AREAS.portugal.bounds;
  return L.latLngBounds(source[0], source[1]);
}

function createMapInfoPanel(frame) {
  const panel = document.createElement('aside');
  panel.className = 'map-info-panel';
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <button class="map-info-close" type="button" aria-label="Fechar detalhe do ponto">×</button>
    <div class="map-info-content"></div>
  `;
  frame.appendChild(panel);

  const content = panel.querySelector('.map-info-content');
  const close = panel.querySelector('.map-info-close');
  close.addEventListener('click', (event) => {
    event.stopPropagation();
    panel.classList.remove('show');
    panel.setAttribute('aria-hidden', 'true');
  });

  return {
    panel,
    content,
    show(html) {
      content.innerHTML = html;
      content.scrollTop = 0;
      panel.classList.add('show');
      panel.setAttribute('aria-hidden', 'false');
    },
    hide() {
      panel.classList.remove('show');
      panel.setAttribute('aria-hidden', 'true');
    }
  };
}

function setSelectedMarker(previous, next) {
  if (previous && previous !== next) {
    previous.setStyle({ weight: previous.options.__baseWeight || previous.options.weight || 2 });
  }
  if (next) {
    next.bringToFront();
    next.setStyle({ weight: Math.max(4, (next.options.__baseWeight || next.options.weight || 2) + 1.2) });
  }
  return next;
}

function addMapPoint(map, latLng, style, htmlFactory, selectMarkerCallback) {
  const pointOptions = {
    ...style,
    pane: 'fireMarkerPane',
    interactive: true,
    bubblingMouseEvents: false
  };

  const marker = L.circleMarker(latLng, pointOptions).addTo(map);
  marker.options.__baseWeight = marker.options.weight;

  // Área invisível maior para tornar a seleção dos pontos mais fácil, sem alterar o aspeto visual.
  const hitMarker = L.circleMarker(latLng, {
    pane: 'fireMarkerPane',
    radius: Math.max(20, Number(style.radius || 8) + 14),
    color: 'transparent',
    fillColor: '#ffffff',
    fillOpacity: 0.001,
    opacity: 0,
    weight: 0,
    interactive: true,
    bubblingMouseEvents: false,
    className: 'map-hit-area'
  }).addTo(map);

  const handleClick = (event) => {
    if (event.originalEvent) {
      L.DomEvent.stop(event.originalEvent);
    }
    selectMarkerCallback(marker, htmlFactory());
  };

  marker.on('click', handleClick);
  hitMarker.on('click', handleClick);
  marker.on('mouseover', () => marker.setStyle({ fillOpacity: Math.min(1, (style.fillOpacity ?? 0.8) + 0.12) }));
  marker.on('mouseout', () => marker.setStyle({ fillOpacity: style.fillOpacity ?? 0.8 }));

  return marker;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function removeRepeatedHalves(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 4 && words.length % 2 === 0) {
    const mid = words.length / 2;
    const first = words.slice(0, mid).join(' ').toLowerCase();
    const second = words.slice(mid).join(' ').toLowerCase();
    if (first === second) return words.slice(0, mid).join(' ');
  }
  return text;
}

function cleanFireTitle(value) {
  const text = String(value || 'Ocorrência')
    .replace(/Latlong\([^)]*\)/gi, '')
    .replace(/-?\s*M\d+[^,]*(,\s*Portugal)?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+-\s*$/g, '')
    .trim();
  return removeRepeatedHalves(text || 'Ocorrência');
}

function firePopupHtml(fire) {
  const location = [fire.municipality, fire.district].filter(Boolean).map(escapeHtml).join(' · ') || 'Localização não disponível';
  return `
    <div class="fire-popup">
      <div class="fire-popup-kicker">Ocorrência Fogos.pt</div>
      <strong class="fire-popup-title">${escapeHtml(cleanFireTitle(fire.title))}</strong>
      <div class="fire-popup-location">${location}</div>
      <div class="fire-popup-grid">
        <span><b>Estado</b>${escapeHtml(fire.status || 'n/d')}</span>
        <span><b>Operacionais</b>${Number(fire.humans || 0)}</span>
        <span><b>Terrestres</b>${Number(fire.ground || 0)}</span>
        <span><b>Aéreos</b>${Number(fire.aerial || 0)}</span>
      </div>
      <div class="fire-popup-date">Atualizado: ${formatDate(fire.updatedAt)}</div>
    </div>
  `;
}

function hotspotPopupHtml(hotspot) {
  return `
    <div class="fire-popup hotspot-popup">
      <div class="fire-popup-kicker">Hotspot NASA FIRMS</div>
      <strong class="fire-popup-title">Deteção térmica por satélite</strong>
      <div class="fire-popup-grid">
        <span><b>Confiança</b>${escapeHtml(hotspot.confidence || 'n/d')}</span>
        <span><b>FRP</b>${Number(hotspot.frp || 0).toFixed(1)} MW</span>
        <span><b>Latitude</b>${Number(hotspot.latitude || 0).toFixed(3)}</span>
        <span><b>Longitude</b>${Number(hotspot.longitude || 0).toFixed(3)}</span>
      </div>
      <div class="fire-popup-date">Data: ${escapeHtml(hotspot.acqDate || 'n/d')} ${escapeHtml(hotspot.acqTime || '')}</div>
    </div>
  `;
}

function riskPopupHtml(risk) {
  const meta = RISK_META[Number(risk.risk)] || RISK_META[0];
  return `
    <div class="fire-popup risk-popup">
      <div class="fire-popup-kicker ipma">Risco IPMA</div>
      <strong class="fire-popup-title">${escapeHtml(risk.municipalityLabel || risk.dico || 'Município')}</strong>
      <div class="fire-popup-location">${escapeHtml(risk.districtName || 'Distrito não disponível')}</div>
      <div class="fire-popup-grid">
        <span><b>Nível</b>${Number(risk.risk || 0)}</span>
        <span><b>Classe</b><em style="color:${meta.color}">${escapeHtml(risk.riskLabel || meta.label)}</em></span>
        <span><b>DICO</b>${escapeHtml(risk.dico || risk.id || 'n/d')}</span>
        <span><b>Fonte</b>IPMA</span>
      </div>
      <div class="fire-popup-date">Previsão de risco de incêndio rural por município</div>
    </div>
  `;
}

function weatherPopupHtml(weather) {
  return `
    <div class="fire-popup weather-popup">
      <div class="fire-popup-kicker meteo">Meteorologia Open-Meteo</div>
      <strong class="fire-popup-title">${escapeHtml(weather.districtName || 'Distrito')}</strong>
      <div class="fire-popup-grid">
        <span><b>Temperatura</b>${Number(weather.temperature || 0).toFixed(1)} °C</span>
        <span><b>Humidade</b>${Number(weather.humidity || 0).toFixed(0)}%</span>
        <span><b>Vento</b>${Number(weather.windSpeed || 0).toFixed(1)} km/h</span>
        <span><b>Precipitação</b>${Number(weather.precipitation || 0).toFixed(1)} mm</span>
      </div>
      <div class="fire-popup-date">Condições meteorológicas atuais por distrito</div>
    </div>
  `;
}

function fwiPopupHtml(item, isLive = false) {
  const current = item.current || {};
  const forecast = (item.forecast || []).slice(0, 5);
  const forecastText = forecast.length
    ? forecast.map((entry) => `${Number(entry.fwi || 0).toFixed(1)} (${escapeHtml(entry.dangerLabel || 'n/d')})`).join(' · ')
    : 'Sem previsão disponível';
  const sourceLabel = isLive ? 'OpenWeather FWI' : 'FWI demonstrativo';
  const sourceNote = isLive
    ? 'Dados reais obtidos através da OpenWeather Fire Weather Index API'
    : 'Dados locais demonstrativos: a API OpenWeather FWI ainda não está autorizada nesta chave';
  return `
    <div class="fire-popup fwi-popup">
      <div class="fire-popup-kicker fwi">${sourceLabel}</div>
      <strong class="fire-popup-title">${escapeHtml(item.label || 'Ponto FWI')}</strong>
      <div class="fire-popup-grid">
        <span><b>FWI atual</b>${Number(current.fwi || 0).toFixed(1)}</span>
        <span><b>Classe</b>${escapeHtml(current.dangerLabel || 'n/d')}</span>
        <span><b>Latitude</b>${Number(item.latitude || 0).toFixed(3)}</span>
        <span><b>Longitude</b>${Number(item.longitude || 0).toFixed(3)}</span>
      </div>
      <div class="fire-popup-date"><b>Previsão 5 dias:</b> ${forecastText}</div>
      <div class="fire-popup-date">${sourceNote}</div>
    </div>
  `;
}

export function drawActiveFiresMap(container, data) {
  clean(container);
  const frame = createChartFrame(container);
  frame.classList.add('fire-map-frame');

  const mapId = `leaflet-map-${++mapCounter}`;
  const mapEl = document.createElement('div');
  mapEl.id = mapId;
  mapEl.className = 'leaflet-map fire-leaflet-map';
  frame.appendChild(mapEl);
  const infoPanel = createMapInfoPanel(frame);
  let selectedMarker = null;

  const filters = data?.filters || {};
  const rawLayerMode = filters.source || 'all';
  // A camada IPMA deixou de aparecer neste mapa para evitar repetição com o KPI "Risco de Incêndio por Município".
  // Estados antigos guardados com source="risk" são tratados como "all" para não deixar o mapa vazio.
  const layerMode = rawLayerMode === 'risk' ? 'all' : rawLayerMode;
  const minRisk = Number(filters.minRisk || 0);
  const showLayer = (layer) => layerMode === 'all' || layerMode === layer;
  const fires = showLayer('fires') ? (data?.fires?.items || []) : [];
  const hotspots = showLayer('hotspots') ? (data?.hotspots?.items || []) : [];
  const riskPoints = [];
  const fwiPoints = showLayer('fwi') ? (data?.openWeatherFwi?.items || []).filter((d) => Number(d.current?.dangerValue || 0) >= minRisk) : [];
  const fwiIsLive = Boolean(data?.openWeatherFwi?.live);
  const area = selectedAreaFromData(data);
  const focusBounds = areaBounds(area);

  const map = L.map(mapEl, {
    scrollWheelZoom: true,
    zoomControl: true,
    preferCanvas: false,
    worldCopyJump: false,
    dragging: true,
    touchZoom: true,
    doubleClickZoom: true,
    boxZoom: true,
    keyboard: true
  });

  map.createPane('fireMarkerPane');
  const markerPane = map.getPane('fireMarkerPane');
  markerPane.style.zIndex = 670;
  markerPane.style.pointerEvents = 'auto';

  let ignoreNextMapClick = false;

  const selectPoint = (marker, html) => {
    ignoreNextMapClick = true;
    selectedMarker = setSelectedMarker(selectedMarker, marker);
    infoPanel.show(html);
    window.setTimeout(() => {
      ignoreNextMapClick = false;
    }, 120);
  };

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const overlays = {};
  const externalLayers = data?.externalLayers?.layers || {};
  const activeExternalLayerLabels = [];

  function registerExternalLayer(key, fallbackLabel) {
    const cfg = externalLayers[key];
    if (!cfg?.enabled || !cfg.url) return;
    const label = cfg.label || fallbackLabel || key;
    let layer;
    if (cfg.type === 'wms') {
      const wmsOptions = {
        layers: cfg.layers,
        styles: cfg.styles || '',
        format: cfg.format || 'image/png',
        transparent: cfg.transparent !== false,
        opacity: cfg.opacity ?? 0.72,
        version: cfg.version || '1.1.1',
        uppercase: true,
        crs: L.CRS.EPSG4326,
        attribution: cfg.attribution || label
      };
      if (cfg.time) wmsOptions.TIME = cfg.time;
      layer = L.tileLayer.wms(cfg.url, wmsOptions);
    } else {
      layer = L.tileLayer(cfg.url, {
        opacity: cfg.opacity ?? 0.42,
        attribution: cfg.attribution || label
      });
    }
    overlays[label] = layer;
    activeExternalLayerLabels.push(label);
    if (cfg.defaultActive) {
      layer.addTo(map);
    }
  }

  registerExternalLayer('openWeatherFwiMap', 'OpenWeather FWI');
  registerExternalLayer('effisFwiWms', 'EFFIS Fire Weather Index');
  registerExternalLayer('effisActiveFiresWms', 'EFFIS VIIRS Hotspots');
  registerExternalLayer('effisBurntAreasWms', 'EFFIS Burnt Areas');
  registerExternalLayer('gwisFwiWms', 'GWIS Global FWI');

  if (Object.keys(overlays).length) {
    L.control.layers(null, overlays, { collapsed: true, position: 'topright' }).addTo(map);
  }

  const isCopernicusMode = layerMode === 'copernicus' || Boolean(data?.filters?.showCopernicusLayers);
  if (isCopernicusMode && activeExternalLayerLabels.length) {
    const wmsNotice = document.createElement('div');
    wmsNotice.className = 'map-wms-explainer';
    wmsNotice.innerHTML = `
      <div>
        <strong>Camadas EFFIS/GWIS ativas</strong>
        <span>São camadas WMS raster externas: aparecem como uma película sobre o mapa, não como pontos clicáveis.</span>
      </div>
      <div class="map-wms-explainer-meta">
        <span>${escapeHtml(activeExternalLayerLabels[0])} ligada</span>
        <span>Alterna outras camadas no botão superior direito do mapa.</span>
      </div>
    `;
    container.appendChild(wmsNotice);
  }

  L.rectangle(focusBounds, {
    color: '#16834a',
    weight: 2,
    fill: false,
    dashArray: '5 6',
    interactive: false,
    className: 'portugal-focus-rectangle'
  }).addTo(map);

  fwiPoints.forEach((item) => {
    if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) return;
    const danger = Number(item.current?.dangerValue || 0);
    const meta = FWI_META[danger] || FWI_META[0];
    const fwi = Number(item.current?.fwi || 0);
    const radius = Math.max(7, Math.min(15, 6 + Math.sqrt(Math.max(1, fwi)) / 1.4));
    addMapPoint(map, [item.latitude, item.longitude], {
      radius,
      color: '#6d28d9',
      fillColor: meta.color,
      fillOpacity: 0.76,
      weight: 2.3,
      className: 'map-point map-point-fwi'
    }, () => fwiPopupHtml(item, fwiIsLive), selectPoint);
  });

  fires.forEach((fire) => {
    if (!Number.isFinite(fire.latitude) || !Number.isFinite(fire.longitude)) return;
    const latLng = [fire.latitude, fire.longitude];
    const totalMeans = Number(fire.humans || 0) + Number(fire.ground || 0) + Number(fire.aerial || 0) * 8;
    const radius = Math.max(6, Math.min(13, 6 + Math.sqrt(totalMeans || 1) / 2.2));
    addMapPoint(map, latLng, {
      radius,
      color: '#991b1b',
      fillColor: '#ef4444',
      fillOpacity: 0.82,
      weight: 2.5,
      className: 'map-point map-point-fire'
    }, () => firePopupHtml(fire), selectPoint);
  });

  hotspots.forEach((hotspot) => {
    if (!Number.isFinite(hotspot.latitude) || !Number.isFinite(hotspot.longitude)) return;
    const latLng = [hotspot.latitude, hotspot.longitude];
    const radius = Math.max(5, Math.min(11, 4.5 + Math.sqrt(Number(hotspot.frp || 0)) / 1.25));
    addMapPoint(map, latLng, {
      radius,
      color: '#ea580c',
      fillColor: '#f59e0b',
      fillOpacity: 0.58,
      weight: 1.8,
      className: 'map-point map-point-hotspot'
    }, () => hotspotPopupHtml(hotspot), selectPoint);
  });

  const boundsItems = [...fires, ...hotspots, ...fwiPoints]
    .filter((d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude));

  function applyMapView() {
    map.invalidateSize({ pan: false });
    if (boundsItems.length) {
      const dataBounds = L.latLngBounds(boundsItems.map((d) => [d.latitude, d.longitude]));
      const finalBounds = L.latLngBounds(focusBounds.getSouthWest(), focusBounds.getNorthEast()).extend(dataBounds);
      map.fitBounds(finalBounds.pad(0.08), { animate: false, maxZoom: area.maxZoom || 8 });
    } else {
      map.fitBounds(focusBounds.pad(0.08), { animate: false, maxZoom: area.maxZoom || 8 });
    }
  }

  map.on('click', () => {
    if (ignoreNextMapClick) return;
    infoPanel.hide();
    selectedMarker = setSelectedMarker(selectedMarker, null);
  });

  requestAnimationFrame(() => requestAnimationFrame(applyMapView));
  setTimeout(applyMapView, 250);
  setTimeout(applyMapView, 900);

  const footer = document.createElement('div');
  footer.className = 'legend map-legend-polished';
  const legendItems = [
    showLayer('fires') ? '<span class="legend-item"><span class="legend-swatch fire-swatch"></span>Fogos.pt</span>' : '',
    showLayer('hotspots') ? '<span class="legend-item"><span class="legend-swatch hotspot-swatch"></span>NASA FIRMS</span>' : '',
    showLayer('fwi') ? `<span class="legend-item"><span class="legend-swatch fwi-swatch"></span>${fwiIsLive ? 'OpenWeather FWI' : 'FWI local'}</span>` : '',
    (layerMode === 'all' || layerMode === 'copernicus') && activeExternalLayerLabels.length ? '<span class="legend-item"><span class="legend-swatch copernicus-swatch"></span>EFFIS/GWIS WMS</span>' : ''
  ].filter(Boolean).join('');
  footer.innerHTML = `
    ${legendItems}
    <span>${layerMode === 'copernicus' ? 'Modo WMS externo: sem pontos clicáveis nesta vista' : `${fires.length} ocorrência(s) · ${hotspots.length} hotspot(s) · ${fwiPoints.length} ponto(s) FWI`}</span>
    <span class="area-legend-pill">Área: ${escapeHtml(area.label)}</span>
    ${minRisk > 0 ? `<span class="area-legend-pill risk-filter-pill">Risco mínimo: ${escapeHtml(RISK_META[minRisk]?.label || minRisk)}</span>` : ''}
    ${externalLayers.openWeatherFwiMap?.enabled ? '<span class="area-legend-pill api-pill">OpenWeather FWI tile disponível</span>' : ''}
    ${activeExternalLayerLabels.length ? `<span class="area-legend-pill copernicus-pill">EFFIS/GWIS: ${activeExternalLayerLabels.length} camada(s) · WMS ${escapeHtml(data?.externalLayers?.wmsDate || 'sem data')}</span>` : ''}
  `;
  container.appendChild(footer);
}

export function drawRiskMap(container, data) {
  clean(container);
  const frame = createChartFrame(container);
  const riskItems = data?.risk?.items || [];
  const { svg, width, height } = createSvg(frame, { top: 16, right: 20, bottom: 24, left: 20 });

  const projection = d3.geoMercator()
    .center([-8.15, 39.55])
    .scale(Math.min(width, height) * 6.2)
    .translate([width / 2, height / 2]);

  const graticule = d3.geoGraticule().extent([[-10.2, 36.5], [-5.5, 42.6]]).step([1, 1]);
  const path = d3.geoPath(projection);

  svg.append('path')
    .datum(graticule())
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', '#e3ebe4')
    .attr('stroke-width', 0.8);

  svg.append('rect')
    .attr('x', projection([-9.75, 42.25])[0])
    .attr('y', projection([-9.75, 42.25])[1])
    .attr('width', projection([-6.05, 36.85])[0] - projection([-9.75, 42.25])[0])
    .attr('height', projection([-6.05, 36.85])[1] - projection([-9.75, 42.25])[1])
    .attr('fill', '#ecfdf3')
    .attr('stroke', '#16834a')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '5 5')
    .attr('rx', 12)
    .lower();

  svg.append('text')
    .attr('x', 18)
    .attr('y', 24)
    .attr('fill', '#475467')
    .attr('font-size', 12)
    .attr('font-weight', 800)
    .text('Portugal Continental · pontos municipais IPMA');

  svg.selectAll('circle.risk-point')
    .data(riskItems)
    .join('circle')
    .attr('class', 'risk-point')
    .attr('cx', (d) => projection([d.longitude, d.latitude])[0])
    .attr('cy', (d) => projection([d.longitude, d.latitude])[1])
    .attr('r', 0)
    .attr('fill', (d) => RISK_META[d.risk]?.color || RISK_META[0].color)
    .attr('fill-opacity', 0.78)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.2)
    .on('mouseenter', (event, d) => showTooltip(event, `<strong>${d.municipalityLabel}</strong><br>${d.districtName}<br>Risco: ${d.riskLabel}`))
    .on('mousemove', moveTooltip)
    .on('mouseleave', hideTooltip)
    .transition()
    .duration(650)
    .attr('r', (d) => 3 + d.risk * 1.5);

  const entries = [1, 2, 3, 4, 5].map((key) => ({ label: RISK_META[key].label, color: RISK_META[key].color }));
  legend(container, entries);
}

export function drawRiskDonut(container, data) {
  clean(container);
  const frame = createChartFrame(container);
  const riskItems = data?.risk?.items || [];
  const counts = d3.rollups(riskItems, (v) => v.length, (d) => d.risk)
    .map(([risk, count]) => ({ risk: Number(risk), label: RISK_META[risk]?.label || 'Sem dados', count }))
    .sort((a, b) => a.risk - b.risk);

  const { svg, width, height } = createSvg(frame, { top: 10, right: 10, bottom: 10, left: 10 });
  const radius = Math.min(width, height) / 2 - 26;
  const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);
  const pie = d3.pie().sort(null).value((d) => d.count);
  const arc = d3.arc().innerRadius(radius * 0.58).outerRadius(radius);
  const arcHover = d3.arc().innerRadius(radius * 0.58).outerRadius(radius + 8);

  g.selectAll('path')
    .data(pie(counts))
    .join('path')
    .attr('fill', (d) => RISK_META[d.data.risk]?.color || RISK_META[0].color)
    .attr('stroke', '#fff')
    .attr('stroke-width', 3)
    .attr('d', arc)
    .on('mouseenter', function (event, d) {
      d3.select(this).transition().duration(120).attr('d', arcHover);
      showTooltip(event, `<strong>${d.data.label}</strong><br>${d.data.count} concelho(s)`);
    })
    .on('mousemove', moveTooltip)
    .on('mouseleave', function () {
      d3.select(this).transition().duration(120).attr('d', arc);
      hideTooltip();
    });

  const total = d3.sum(counts, (d) => d.count);
  const maxRisk = counts.find((d) => d.risk === 5)?.count || 0;
  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', -6)
    .attr('font-size', 30)
    .attr('font-weight', 900)
    .attr('fill', '#101828')
    .text(total);
  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', 18)
    .attr('font-size', 12)
    .attr('font-weight', 800)
    .attr('fill', '#667085')
    .text(`${maxRisk} em risco máximo`);

  legend(container, counts.map((d) => ({ label: `${d.label}: ${d.count}`, color: RISK_META[d.risk]?.color || RISK_META[0].color })));
}

export function drawTopRiskBar(container, data) {
  clean(container);
  const frame = createChartFrame(container);
  frame.classList.add('top-risk-frame', 'top-risk-table-frame');

  const rows = [...(data?.risk?.items || [])]
    .sort((a, b) => d3.descending(a.risk, b.risk) || d3.ascending(a.dico, b.dico))
    .slice(0, 13)
    .map((d) => ({
      ...d,
      label: `${d.dico} · ${d.districtName}`,
      riskLabel: RISK_META[d.risk]?.label || d.riskLabel || 'Sem dados',
      riskColor: RISK_META[d.risk]?.color || RISK_META[0].color
    }));

  if (!rows.length) {
    frame.innerHTML = '<p class="empty-state">Sem dados de risco disponíveis.</p>';
    return;
  }

  const chart = d3.select(frame)
    .append('div')
    .attr('class', 'risk-ranking-chart')
    .attr('role', 'img')
    .attr('aria-label', 'Ranking de municípios portugueses com maior risco de incêndio rural');

  const header = chart.append('div').attr('class', 'risk-ranking-header');
  header.append('span').text('Município / distrito');
  header.append('span').text('Nível de risco');
  header.append('span').text('Classe');

  const row = chart.selectAll('.risk-ranking-row')
    .data(rows)
    .join('div')
    .attr('class', 'risk-ranking-row')
    .on('mouseenter', (event, d) => showTooltip(event, `<strong>${d.municipalityLabel || d.label}</strong><br>${d.districtName}<br>Risco: ${d.riskLabel}`))
    .on('mousemove', moveTooltip)
    .on('mouseleave', hideTooltip);

  row.append('div')
    .attr('class', 'risk-ranking-name')
    .html((d) => `<strong>${escapeHtml(d.label)}</strong><small>${escapeHtml(d.municipalityLabel || 'Município IPMA')}</small>`);

  const barCell = row.append('div').attr('class', 'risk-ranking-bar-cell');
  barCell.append('div')
    .attr('class', 'risk-ranking-track')
    .append('div')
    .attr('class', 'risk-ranking-fill')
    .style('background', (d) => d.riskColor)
    .style('width', '0%')
    .transition()
    .duration(700)
    .style('width', (d) => `${Math.max(5, Math.min(100, (Number(d.risk || 0) / 5) * 100))}%`);

  row.append('div')
    .attr('class', 'risk-ranking-class')
    .style('--risk-color', (d) => d.riskColor)
    .text((d) => d.riskLabel);

  const axis = chart.append('div')
    .attr('class', 'risk-ranking-axis')
    .attr('aria-label', 'Escala de risco de incêndio rural');

  axis.append('span')
    .attr('class', 'risk-ranking-axis-title')
    .text('Escala de risco');

  const scale = axis.append('div').attr('class', 'risk-ranking-scale');
  [0, 1, 2, 3, 4, 5].forEach((risk) => {
    const item = scale.append('span').attr('class', 'risk-ranking-scale-item');
    item.append('i')
      .style('background', RISK_META[risk]?.color || RISK_META[0].color);
    item.append('span').text(RISK_META[risk]?.label || risk);
  });
}

export function drawWeatherScatter(container, data) {
  clean(container);
  const frame = createChartFrame(container);
  const riskItems = data?.risk?.items || [];
  const avgRiskByDistrict = d3.rollups(riskItems, (v) => d3.mean(v, (d) => d.risk), (d) => d.districtCode);
  const riskMap = new Map(avgRiskByDistrict);

  const rows = (data?.weather?.items || [])
    .map((d) => ({ ...d, avgRisk: Number((riskMap.get(d.districtCode) || 0).toFixed(2)) }))
    .filter((d) => Number.isFinite(d.temperature) && Number.isFinite(d.humidity));

  const { plot, innerWidth, innerHeight } = createSvg(frame, { top: 18, right: 24, bottom: 46, left: 54 });
  const x = d3.scaleLinear()
    .domain(d3.extent(rows, (d) => d.temperature)).nice()
    .range([0, innerWidth]);
  const y = d3.scaleLinear()
    .domain(d3.extent(rows, (d) => d.humidity)).nice()
    .range([innerHeight, 0]);
  const r = d3.scaleSqrt().domain([0, d3.max(rows, (d) => d.windSpeed) || 1]).range([5, 18]);
  const color = d3.scaleLinear().domain([1, 3, 5]).range(['#16a34a', '#f59e0b', '#dc2626']);

  plot.append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(6).tickSize(-innerHeight).tickFormat(''));

  plot.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(''));

  plot.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat((d) => `${d}°C`));

  plot.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}%`));

  plot.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 40)
    .attr('text-anchor', 'middle')
    .attr('fill', '#667085')
    .attr('font-size', 12)
    .attr('font-weight', 800)
    .text('Temperatura atual');

  plot.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -40)
    .attr('text-anchor', 'middle')
    .attr('fill', '#667085')
    .attr('font-size', 12)
    .attr('font-weight', 800)
    .text('Humidade relativa');

  plot.selectAll('circle')
    .data(rows)
    .join('circle')
    .attr('cx', (d) => x(d.temperature))
    .attr('cy', (d) => y(d.humidity))
    .attr('r', 0)
    .attr('fill', (d) => color(Math.max(1, d.avgRisk || 1)))
    .attr('fill-opacity', 0.78)
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .on('mouseenter', (event, d) => showTooltip(event, `<strong>${d.districtName}</strong><br>Temp.: ${d.temperature.toFixed(1)}°C<br>Humidade: ${d.humidity.toFixed(0)}%<br>Vento: ${d.windSpeed.toFixed(1)} km/h<br>Risco médio: ${d.avgRisk || 'n/d'}`))
    .on('mousemove', moveTooltip)
    .on('mouseleave', hideTooltip)
    .transition()
    .duration(650)
    .attr('r', (d) => r(d.windSpeed));
}

export function drawEvolutionLine(container, data) {
  clean(container);
  const frame = createChartFrame(container);
  const hotspots = data?.hotspots?.items || [];
  const fires = data?.fires?.items || [];

  const hotspotCounts = d3.rollups(hotspots, (v) => v.length, (d) => d.acqDate || new Date().toISOString().slice(0, 10));
  const fireCounts = d3.rollups(fires, (v) => v.length, (d) => (d.startedAt || d.updatedAt || new Date().toISOString()).slice(0, 10));
  const map = new Map();

  hotspotCounts.forEach(([date, count]) => map.set(date, { date, hotspots: count, fires: 0 }));
  fireCounts.forEach(([date, count]) => {
    const existing = map.get(date) || { date, hotspots: 0, fires: 0 };
    existing.fires = count;
    map.set(date, existing);
  });

  const rows = Array.from(map.values())
    .map((d) => ({ ...d, parsedDate: new Date(d.date), total: d.hotspots + d.fires }))
    .filter((d) => !Number.isNaN(d.parsedDate.getTime()))
    .sort((a, b) => a.parsedDate - b.parsedDate);

  if (!rows.length) {
    frame.innerHTML = '<p class="empty-state">Sem dados temporais disponíveis.</p>';
    return;
  }

  const { plot, innerWidth, innerHeight } = createSvg(frame, { top: 20, right: 24, bottom: 44, left: 48 });
  const x = d3.scaleTime().domain(d3.extent(rows, (d) => d.parsedDate)).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.total) || 1]).nice().range([innerHeight, 0]);

  plot.append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(-innerHeight).tickFormat(''));

  plot.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(''));

  plot.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat('%d/%m')));

  plot.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5));

  const area = d3.area()
    .x((d) => x(d.parsedDate))
    .y0(innerHeight)
    .y1((d) => y(d.total))
    .curve(d3.curveMonotoneX);

  const line = d3.line()
    .x((d) => x(d.parsedDate))
    .y((d) => y(d.total))
    .curve(d3.curveMonotoneX);

  plot.append('path')
    .datum(rows)
    .attr('fill', 'rgba(249, 115, 22, 0.18)')
    .attr('d', area);

  const path = plot.append('path')
    .datum(rows)
    .attr('fill', 'none')
    .attr('stroke', '#f97316')
    .attr('stroke-width', 3)
    .attr('d', line);

  const length = path.node().getTotalLength();
  path.attr('stroke-dasharray', `${length} ${length}`)
    .attr('stroke-dashoffset', length)
    .transition()
    .duration(800)
    .attr('stroke-dashoffset', 0);

  plot.selectAll('circle')
    .data(rows)
    .join('circle')
    .attr('cx', (d) => x(d.parsedDate))
    .attr('cy', (d) => y(d.total))
    .attr('r', 5)
    .attr('fill', '#f97316')
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .on('mouseenter', (event, d) => showTooltip(event, `<strong>${d3.timeFormat('%d/%m/%Y')(d.parsedDate)}</strong><br>Hotspots: ${d.hotspots}<br>Ocorrências: ${d.fires}<br>Total: ${d.total}`))
    .on('mousemove', moveTooltip)
    .on('mouseleave', hideTooltip);
}

export function drawOpenWeatherFwi(container, data) {
  clean(container);
  const frame = createChartFrame(container);
  frame.classList.add('fwi-frame');
  const fwi = data?.openWeatherFwi || {};
  const rows = (fwi.items || [])
    .map((item) => ({
      ...item,
      fwi: Number(item.current?.fwi),
      dangerValue: Number(item.current?.dangerValue),
      dangerLabel: item.current?.dangerLabel || 'Sem classificação'
    }))
    .filter((item) => Number.isFinite(item.fwi));

  if (!rows.length) {
    const message = fwi.configured === false
      ? 'Sem dados FWI disponíveis. Configure OPENWEATHER_API_KEY no ficheiro .env.'
      : `Sem dados FWI disponíveis. ${escapeHtml(fwi.error || 'A API OpenWeather FWI ainda não devolveu dados utilizáveis.')}`;
    frame.innerHTML = `<p class="empty-state">${message}</p>`;
    return;
  }

  const maxFwi = Math.max(55, d3.max(rows, (d) => d.fwi) || 1);
  const top = rows.slice().sort((a, b) => b.fwi - a.fwi)[0];
  const avg = d3.mean(rows, (d) => d.fwi) || 0;
  const summary = document.createElement('div');
  summary.className = 'fwi-summary';
  summary.innerHTML = `
    <article><span>FWI médio</span><strong>${avg.toFixed(1)}</strong></article>
    <article><span>Maior risco</span><strong>${escapeHtml(top.label)}</strong><small>${top.fwi.toFixed(1)} · ${escapeHtml(top.dangerLabel)}</small></article>
    <article><span>Fonte</span><strong>${fwi.live ? 'OpenWeather' : 'Fallback local'}</strong><small>${escapeHtml(fwi.source || 'Sem fonte')}</small></article>
  `;
  frame.appendChild(summary);

  const chart = document.createElement('div');
  chart.className = 'fwi-ranking';
  rows.sort((a, b) => b.fwi - a.fwi).forEach((row) => {
    const meta = FWI_META[row.dangerValue] || FWI_META[0];
    const forecast = (row.forecast || []).slice(0, 5);
    const forecastHtml = forecast.map((entry) => {
      const value = Number(entry.fwi || 0);
      const entryMeta = FWI_META[Number(entry.dangerValue)] || meta;
      const width = Math.max(4, Math.min(100, (value / maxFwi) * 100));
      return `<span title="${escapeHtml(formatDate(entry.time))}: ${value.toFixed(1)}"><i style="width:${width}%; background:${entryMeta.color}"></i></span>`;
    }).join('');
    const width = Math.max(4, Math.min(100, (row.fwi / maxFwi) * 100));
    const rowEl = document.createElement('div');
    rowEl.className = 'fwi-row';
    rowEl.innerHTML = `
      <div class="fwi-name"><strong>${escapeHtml(row.label)}</strong><small>${Number(row.latitude).toFixed(2)}, ${Number(row.longitude).toFixed(2)}</small></div>
      <div class="fwi-bar-cell"><div class="fwi-track"><span style="width:${width}%; background:${meta.color}"></span></div></div>
      <div class="fwi-value"><strong>${row.fwi.toFixed(1)}</strong><small>${escapeHtml(row.dangerLabel)}</small></div>
      <div class="fwi-forecast">${forecastHtml}</div>
    `;
    chart.appendChild(rowEl);
  });
  frame.appendChild(chart);

  const note = document.createElement('p');
  note.className = `fwi-note ${fwi.live ? 'success' : 'warning'}`;
  note.textContent = fwi.live
    ? 'Dados atuais e previsão a 5 dias obtidos diretamente da API Fire Weather Index da OpenWeather.'
    : (fwi.error || 'Modo fallback/local: a chave OpenWeather FWI ainda não está configurada ou ainda não tem acesso ao produto FWI.');
  container.appendChild(note);
}

export const CHART_RENDERERS = {
  'active-map': drawActiveFiresMap,
  'risk-map': drawRiskMap,
  'risk-donut': drawRiskDonut,
  'top-risk-bar': drawTopRiskBar,
  'weather-scatter': drawWeatherScatter,
  'evolution-line': drawEvolutionLine,
  'openweather-fwi': drawOpenWeatherFwi
};
