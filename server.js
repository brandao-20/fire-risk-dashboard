require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_MS = Number(process.env.CACHE_MS || 0);
const FOGOS_API_URL = process.env.FOGOS_API_URL || 'https://api.fogos.pt/v2/incidents/active?geojson=true';
const NASA_FIRMS_MAP_KEY = process.env.NASA_FIRMS_MAP_KEY || '';
const NASA_FIRMS_DAYS = Number(process.env.NASA_FIRMS_DAYS || 3);
const NASA_FIRMS_SOURCE = process.env.NASA_FIRMS_SOURCE || 'VIIRS_SNPP_NRT';
const FIRMS_BBOX = process.env.FIRMS_BBOX || '-9.75,36.85,-6.05,42.25';
const USER_AGENT = process.env.USER_AGENT || 'FireRiskPortugalDashboard/1.0 academic-project';
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || process.env.OPENWEATHER_APPID || '';
const OPENWEATHER_FWI_POINTS_LIMIT = Number(process.env.OPENWEATHER_FWI_POINTS_LIMIT || 6);
const ENABLE_OPENWEATHER_FWI_MAP = String(process.env.ENABLE_OPENWEATHER_FWI_MAP || 'false').toLowerCase() === 'true';
const ENABLE_COPERNICUS_LAYERS = String(process.env.ENABLE_COPERNICUS_LAYERS || 'true').toLowerCase() === 'true';
const EFFIS_WMS_URL = process.env.EFFIS_WMS_URL || 'https://maps.effis.emergency.copernicus.eu/effis';
const EFFIS_WMS_LAYER = process.env.EFFIS_WMS_LAYER || 'ecmwf007.fwi';
const EFFIS_ACTIVE_FIRES_LAYER = process.env.EFFIS_ACTIVE_FIRES_LAYER || 'viirs.hs';
const EFFIS_BURNT_AREAS_LAYER = process.env.EFFIS_BURNT_AREAS_LAYER || 'viirs.ba';
const GWIS_WMS_URL = process.env.GWIS_WMS_URL || 'https://ies-ows.jrc.ec.europa.eu/gwis';
const GWIS_WMS_LAYER = process.env.GWIS_WMS_LAYER || 'ecmwf.fwi';
// As camadas WMS EFFIS/GWIS são temporais. Em alguns computadores, uma data local
// futura pode devolver tiles vazios. Usamos uma data demonstrativa/documentada por
// omissão e deixamos a data configurável por .env quando se pretender uma data específica.
const COPERNICUS_WMS_DATE = process.env.COPERNICUS_WMS_DATE || '2021-12-08';

const MAP_AREAS = {
  portugal: {
    key: 'portugal',
    label: 'Portugal Continental',
    bbox: process.env.FIRMS_BBOX || '-9.75,36.85,-6.05,42.25',
    bounds: [[36.85, -9.75], [42.25, -6.05]]
  },
  iberia: {
    key: 'iberia',
    label: 'Península Ibérica',
    bbox: '-10.50,35.60,4.40,44.40',
    bounds: [[35.60, -10.50], [44.40, 4.40]]
  },
  westernEurope: {
    key: 'westernEurope',
    label: 'Europa Ocidental',
    bbox: '-11.50,35.00,11.00,51.50',
    bounds: [[35.00, -11.50], [51.50, 11.00]]
  },
  westernMediterranean: {
    key: 'westernMediterranean',
    label: 'Mediterrâneo Ocidental',
    bbox: '-10.50,34.00,16.50,46.50',
    bounds: [[34.00, -10.50], [46.50, 16.50]]
  }
};

function resolveArea(areaKey) {
  return MAP_AREAS[areaKey] || MAP_AREAS.portugal;
}

const AREA_OBSERVATION_POINTS = {
  portugal: [
    { id: 'pt-lisboa', label: 'Lisboa', latitude: 38.7223, longitude: -9.1393 },
    { id: 'pt-porto', label: 'Porto', latitude: 41.1579, longitude: -8.6291 },
    { id: 'pt-coimbra', label: 'Coimbra', latitude: 40.2033, longitude: -8.4103 },
    { id: 'pt-braganca', label: 'Bragança', latitude: 41.8061, longitude: -6.7567 },
    { id: 'pt-evora', label: 'Évora', latitude: 38.5714, longitude: -7.9135 },
    { id: 'pt-faro', label: 'Faro', latitude: 37.0194, longitude: -7.9304 }
  ],
  iberia: [
    { id: 'ib-lisboa', label: 'Lisboa', latitude: 38.7223, longitude: -9.1393 },
    { id: 'ib-porto', label: 'Porto', latitude: 41.1579, longitude: -8.6291 },
    { id: 'ib-madrid', label: 'Madrid', latitude: 40.4168, longitude: -3.7038 },
    { id: 'ib-sevilha', label: 'Sevilha', latitude: 37.3891, longitude: -5.9845 },
    { id: 'ib-barcelona', label: 'Barcelona', latitude: 41.3874, longitude: 2.1686 },
    { id: 'ib-valencia', label: 'Valência', latitude: 39.4699, longitude: -0.3763 }
  ],
  westernEurope: [
    { id: 'we-lisboa', label: 'Lisboa', latitude: 38.7223, longitude: -9.1393 },
    { id: 'we-madrid', label: 'Madrid', latitude: 40.4168, longitude: -3.7038 },
    { id: 'we-paris', label: 'Paris', latitude: 48.8566, longitude: 2.3522 },
    { id: 'we-bordeaux', label: 'Bordéus', latitude: 44.8378, longitude: -0.5792 },
    { id: 'we-marseille', label: 'Marselha', latitude: 43.2965, longitude: 5.3698 },
    { id: 'we-milan', label: 'Milão', latitude: 45.4642, longitude: 9.1900 }
  ],
  westernMediterranean: [
    { id: 'wm-lisboa', label: 'Lisboa', latitude: 38.7223, longitude: -9.1393 },
    { id: 'wm-madrid', label: 'Madrid', latitude: 40.4168, longitude: -3.7038 },
    { id: 'wm-barcelona', label: 'Barcelona', latitude: 41.3874, longitude: 2.1686 },
    { id: 'wm-marseille', label: 'Marselha', latitude: 43.2965, longitude: 5.3698 },
    { id: 'wm-rome', label: 'Roma', latitude: 41.9028, longitude: 12.4964 },
    { id: 'wm-palma', label: 'Palma de Maiorca', latitude: 39.5696, longitude: 2.6502 }
  ]
};

function areaObservationPoints(areaKey) {
  const points = AREA_OBSERVATION_POINTS[areaKey] || AREA_OBSERVATION_POINTS.portugal;
  return points.slice(0, Math.max(1, OPENWEATHER_FWI_POINTS_LIMIT));
}

function resolveFirmsDays(value) {
  const parsed = Number(value || NASA_FIRMS_DAYS || 3);
  if (!Number.isFinite(parsed)) return 3;
  return Math.max(1, Math.min(10, Math.round(parsed)));
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const RISK_LABELS = {
  1: 'Reduzido',
  2: 'Moderado',
  3: 'Elevado',
  4: 'Muito elevado',
  5: 'Máximo'
};

const DISTRICTS = {
  '01': { name: 'Aveiro', lat: 40.6405, lon: -8.6538 },
  '02': { name: 'Beja', lat: 38.0151, lon: -7.8632 },
  '03': { name: 'Braga', lat: 41.5454, lon: -8.4265 },
  '04': { name: 'Bragança', lat: 41.8061, lon: -6.7567 },
  '05': { name: 'Castelo Branco', lat: 39.8222, lon: -7.4909 },
  '06': { name: 'Coimbra', lat: 40.2033, lon: -8.4103 },
  '07': { name: 'Évora', lat: 38.5714, lon: -7.9135 },
  '08': { name: 'Faro', lat: 37.0194, lon: -7.9304 },
  '09': { name: 'Guarda', lat: 40.5373, lon: -7.2658 },
  '10': { name: 'Leiria', lat: 39.7436, lon: -8.8071 },
  '11': { name: 'Lisboa', lat: 38.7223, lon: -9.1393 },
  '12': { name: 'Portalegre', lat: 39.2967, lon: -7.4289 },
  '13': { name: 'Porto', lat: 41.1579, lon: -8.6291 },
  '14': { name: 'Santarém', lat: 39.2367, lon: -8.6859 },
  '15': { name: 'Setúbal', lat: 38.5244, lon: -8.8882 },
  '16': { name: 'Viana do Castelo', lat: 41.6932, lon: -8.8329 },
  '17': { name: 'Vila Real', lat: 41.3006, lon: -7.7441 },
  '18': { name: 'Viseu', lat: 40.6566, lon: -7.9125 }
};

let cache = new Map();

function getCache(key) {
  if (!CACHE_MS) return null;
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.at > CACHE_MS) return null;
  return item.value;
}

function setCache(key, value) {
  if (!CACHE_MS) return value;
  cache.set(key, { at: Date.now(), value });
  return value;
}

function sanitizeUrlForLogs(url) {
  return String(url || '')
    .replace(/(appid=)[^&]+/gi, '$1***')
    .replace(/(map_key\/)[^/]+/gi, '$1***')
    .replace(/(MAP_KEY=)[^&]+/gi, '$1***');
}

function externalErrorMessage(response, url) {
  const cleanUrl = sanitizeUrlForLogs(url);
  if (response.status === 401) {
    return `401 Unauthorized em ${cleanUrl}`;
  }
  if (response.status === 403) {
    return `403 Forbidden em ${cleanUrl}`;
  }
  if (response.status === 429) {
    return `429 Too Many Requests em ${cleanUrl}`;
  }
  return `${response.status} ${response.statusText} em ${cleanUrl}`;
}

function summariseExternalErrors(errors = []) {
  if (!errors.length) return null;
  const joined = errors.join(' | ');
  if (/401 Unauthorized/i.test(joined)) {
    return 'OpenWeather respondeu 401 Unauthorized. A chave está definida, mas ainda não tem acesso ativo ao produto Fire Weather Index ou a subscrição ainda não ficou ativa.';
  }
  if (/403 Forbidden/i.test(joined)) {
    return 'OpenWeather respondeu 403 Forbidden. A chave existe, mas o produto Fire Weather Index não está autorizado para esta conta/plano.';
  }
  if (/429 Too Many Requests/i.test(joined)) {
    return 'OpenWeather respondeu 429 Too Many Requests. O limite de pedidos foi atingido temporariamente.';
  }
  return errors.slice(0, 3).join(' | ');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'User-Agent': USER_AGENT,
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    throw new Error(externalErrorMessage(response, url));
  }
  return response.json();
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'text/csv,text/plain,*/*',
      'User-Agent': USER_AGENT,
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    throw new Error(externalErrorMessage(response, url));
  }
  return response.text();
}

function districtFromDico(dico) {
  const raw = String(dico || '').padStart(4, '0');
  const districtCode = raw.slice(0, 2);
  const district = DISTRICTS[districtCode] || { name: `Distrito ${districtCode}`, lat: null, lon: null };
  return { districtCode, districtName: district.name };
}

function riskLabel(rcm) {
  return RISK_LABELS[Number(rcm)] || 'Sem dados';
}

function normalizeRiskItem(item) {
  const dico = String(item.DICO || item.dico || '').padStart(4, '0');
  const { districtCode, districtName } = districtFromDico(dico);
  const risk = Number(item.data?.rcm ?? item.rcm ?? item.risk ?? 0);
  return {
    id: dico,
    dico,
    districtCode,
    districtName,
    municipalityLabel: `Município DICO ${dico}`,
    latitude: Number(item.latitude ?? item.lat),
    longitude: Number(item.longitude ?? item.lon ?? item.lng),
    risk,
    riskLabel: riskLabel(risk)
  };
}

async function getIpmaRisk(day = 0) {
  const cacheKey = `ipma-risk-${day}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const url = `https://api.ipma.pt/open-data/forecast/meteorology/rcm/rcm-d${day}.json`;
  try {
    const json = await fetchJson(url);
    const rawLocal = json.local || {};
    const items = Object.values(rawLocal)
      .map(normalizeRiskItem)
      .filter((d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude) && d.risk > 0);

    return setCache(cacheKey, {
      live: true,
      source: 'IPMA - Previsão do Risco de Incêndio Rural',
      url,
      day,
      forecastDate: json.dataPrev || null,
      dataRun: json.dataRun || null,
      fileDate: json.fileDate || null,
      items
    });
  } catch (error) {
    return setCache(cacheKey, {
      live: false,
      source: 'Fallback local - IPMA indisponível',
      url,
      day,
      error: error.message,
      forecastDate: new Date().toISOString().slice(0, 10),
      dataRun: null,
      fileDate: null,
      items: fallbackRisk()
    });
  }
}

function fallbackRisk() {
  const sample = [
    ['0303', 41.545, -8.426, 3], ['0407', 41.806, -6.756, 5], ['0505', 39.822, -7.491, 5],
    ['0603', 40.203, -8.410, 4], ['0705', 38.571, -7.913, 4], ['0805', 37.019, -7.930, 3],
    ['0907', 40.537, -7.266, 5], ['1009', 39.743, -8.807, 3], ['1111', 38.722, -9.139, 2],
    ['1214', 39.296, -7.429, 4], ['1312', 41.158, -8.629, 2], ['1415', 39.236, -8.686, 4],
    ['1512', 38.524, -8.888, 3], ['1610', 41.693, -8.832, 2], ['1714', 41.301, -7.744, 5],
    ['1805', 40.657, -7.912, 4], ['0107', 40.641, -8.654, 3], ['0205', 38.015, -7.863, 4]
  ];
  return sample.map(([dico, latitude, longitude, risk]) => normalizeRiskItem({ DICO: dico, latitude, longitude, data: { rcm: risk } }));
}

async function getFogosActive() {
  const cacheKey = 'fogos-active';
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const headers = {};
  if (process.env.FOGOS_PT_AUTH) {
    headers['FOGOS-PT-AUTH'] = process.env.FOGOS_PT_AUTH;
  }

  try {
    const json = await fetchJson(FOGOS_API_URL, { headers });
    const items = normalizeFogos(json);
    return setCache(cacheKey, {
      live: true,
      source: 'Fogos.pt - ocorrências ativas',
      url: FOGOS_API_URL,
      count: items.length,
      items
    });
  } catch (error) {
    return setCache(cacheKey, {
      live: false,
      source: 'Fallback local - Fogos.pt indisponível ou protegido',
      url: FOGOS_API_URL,
      error: error.message,
      count: fallbackFires().length,
      items: fallbackFires()
    });
  }
}

function normalizeFogos(json) {
  let rows = [];
  if (Array.isArray(json)) rows = json;
  if (Array.isArray(json?.data)) rows = json.data;
  if (Array.isArray(json?.incidents)) rows = json.incidents;
  if (Array.isArray(json?.features)) {
    rows = json.features.map((feature) => ({
      ...(feature.properties || {}),
      latitude: feature.geometry?.coordinates?.[1],
      longitude: feature.geometry?.coordinates?.[0]
    }));
  }

  return rows.map((row, index) => {
    const latitude = Number(row.latitude ?? row.lat ?? row.y);
    const longitude = Number(row.longitude ?? row.lng ?? row.lon ?? row.x);
    return {
      id: String(row.id ?? row.uuid ?? row.sado_id ?? `fire-${index}`),
      title: row.title || row.name || row.localidade || row.location || row.concelho || 'Ocorrência ativa',
      district: row.district || row.distrito || row.dicofre || 'Sem distrito',
      municipality: row.concelho || row.municipality || row.county || 'Sem concelho',
      parish: row.freguesia || row.parish || '',
      status: row.status || row.estado || row.natureza || 'Estado não indicado',
      latitude,
      longitude,
      aerial: Number(row.aerial ?? row.aereos ?? row.aircraft ?? row.meios_aereos ?? 0),
      ground: Number(row.ground ?? row.terrestres ?? row.vehicles ?? row.meios_terrestres ?? 0),
      humans: Number(row.humans ?? row.operacionais ?? row.man ?? row.meios_humanos ?? 0),
      startedAt: row.startedAt || row.started_at || row.created_at || row.createdAt || row.date || null,
      updatedAt: row.updatedAt || row.updated_at || row.last_update || null
    };
  }).filter((d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude));
}

function fallbackFires() {
  const now = Date.now();
  return [
    { id: 'demo-1', title: 'Ocorrência simulada - Serra da Estrela', district: 'Guarda', municipality: 'Manteigas', parish: '', status: 'Em curso', latitude: 40.402, longitude: -7.539, aerial: 1, ground: 8, humans: 36, startedAt: new Date(now - 7200000).toISOString(), updatedAt: new Date(now - 600000).toISOString() },
    { id: 'demo-2', title: 'Ocorrência simulada - Interior Norte', district: 'Vila Real', municipality: 'Alijó', parish: '', status: 'Resolução', latitude: 41.276, longitude: -7.474, aerial: 0, ground: 5, humans: 19, startedAt: new Date(now - 10800000).toISOString(), updatedAt: new Date(now - 900000).toISOString() },
    { id: 'demo-3', title: 'Ocorrência simulada - Pinhal Interior', district: 'Castelo Branco', municipality: 'Oleiros', parish: '', status: 'Vigilância', latitude: 39.916, longitude: -7.913, aerial: 0, ground: 3, humans: 12, startedAt: new Date(now - 14400000).toISOString(), updatedAt: new Date(now - 1800000).toISOString() }
  ];
}

async function getFirmsHotspots(areaKey = 'portugal', daysValue = NASA_FIRMS_DAYS) {
  const area = resolveArea(areaKey);
  const days = resolveFirmsDays(daysValue);
  const cacheKey = `firms-hotspots-${area.key}-${NASA_FIRMS_SOURCE}-${days}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  if (!NASA_FIRMS_MAP_KEY) {
    const items = filterByArea(fallbackHotspots(), area);
    return setCache(cacheKey, {
      live: false,
      source: 'NASA FIRMS - dados de demonstração sem MAP_KEY',
      area: { key: area.key, label: area.label, bounds: area.bounds, bbox: area.bbox, days },
      url: null,
      error: 'Defina NASA_FIRMS_MAP_KEY no ficheiro .env para substituir os dados de demonstração por dados reais da NASA FIRMS.',
      items
    });
  }

  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(NASA_FIRMS_MAP_KEY)}/${encodeURIComponent(NASA_FIRMS_SOURCE)}/${area.bbox}/${days}`;
  try {
    const csv = await fetchText(url);
    const items = parseCsv(csv).map((row, index) => ({
      id: `firms-${row.latitude}-${row.longitude}-${row.acq_date}-${row.acq_time}-${index}`,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      confidence: row.confidence || row.confidence_label || 'n/a',
      brightness: Number(row.bright_ti4 ?? row.brightness ?? row.bright_t31 ?? 0),
      frp: Number(row.frp || 0),
      acqDate: row.acq_date || null,
      acqTime: row.acq_time || null,
      satellite: row.satellite || null,
      instrument: row.instrument || null
    })).filter((d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude));

    return setCache(cacheKey, {
      live: true,
      source: 'NASA FIRMS - active fire detections',
      area: { key: area.key, label: area.label, bounds: area.bounds, bbox: area.bbox, days },
      url,
      items
    });
  } catch (error) {
    const items = filterByArea(fallbackHotspots(), area);
    return setCache(cacheKey, {
      live: false,
      source: 'Fallback local - NASA FIRMS indisponível',
      area: { key: area.key, label: area.label, bounds: area.bounds, bbox: area.bbox, days },
      url,
      error: error.message,
      items
    });
  }
}

function parseCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cols[i]]));
  });
}

function splitCsvLine(line) {
  const output = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      output.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  output.push(current);
  return output.map((s) => s.replace(/^"|"$/g, ''));
}


function filterByArea(items, area) {
  const [south, west] = area.bounds[0];
  const [north, east] = area.bounds[1];
  return items.filter((item) => (
    Number(item.latitude) >= south &&
    Number(item.latitude) <= north &&
    Number(item.longitude) >= west &&
    Number(item.longitude) <= east
  ));
}

function fallbackHotspots() {
  const base = [
    [41.82, -6.74, 'h', 18.2, 8], [40.43, -7.56, 'n', 22.8, 5], [39.91, -7.89, 'h', 19.3, 6],
    [38.83, -7.58, 'n', 15.4, 3], [37.20, -8.03, 'l', 11.1, 2], [41.21, -7.61, 'h', 28.6, 7],
    [39.35, -8.18, 'n', 13.2, 1], [40.72, -8.12, 'l', 9.7, 2]
  ];
  const now = new Date();
  return base.map(([latitude, longitude, confidence, frp, daysBack], index) => {
    const d = new Date(now.getTime() - daysBack * 86400000 / 3);
    return {
      id: `fallback-hotspot-${index}`,
      latitude,
      longitude,
      confidence,
      brightness: 330 + index * 4,
      frp,
      acqDate: d.toISOString().slice(0, 10),
      acqTime: `${String(930 + index * 37).padStart(4, '0')}`,
      satellite: 'Demo',
      instrument: 'Fallback'
    };
  });
}

async function getWeatherDistricts() {
  const cacheKey = 'weather-districts';
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const districts = Object.entries(DISTRICTS).map(([code, district]) => ({ code, ...district }));
  const latitudes = districts.map((d) => d.lat).join(',');
  const longitudes = districts.map((d) => d.lon).join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitudes}&longitude=${longitudes}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&timezone=Europe%2FLisbon`;

  try {
    const json = await fetchJson(url);
    const payload = Array.isArray(json) ? json : [json];
    const items = payload.map((entry, index) => ({
      districtCode: districts[index].code,
      districtName: districts[index].name,
      latitude: districts[index].lat,
      longitude: districts[index].lon,
      temperature: Number(entry.current?.temperature_2m ?? entry.current_weather?.temperature ?? NaN),
      humidity: Number(entry.current?.relative_humidity_2m ?? NaN),
      windSpeed: Number(entry.current?.wind_speed_10m ?? entry.current_weather?.windspeed ?? NaN),
      precipitation: Number(entry.current?.precipitation ?? 0),
      time: entry.current?.time || entry.current_weather?.time || null
    })).filter((d) => Number.isFinite(d.temperature));

    return setCache(cacheKey, {
      live: true,
      source: 'Open-Meteo - meteorologia atual por distrito',
      url,
      items
    });
  } catch (error) {
    return setCache(cacheKey, {
      live: false,
      source: 'Fallback local - Open-Meteo indisponível',
      url,
      error: error.message,
      items: fallbackWeather()
    });
  }
}

function fallbackWeather() {
  return Object.entries(DISTRICTS).map(([code, district], index) => ({
    districtCode: code,
    districtName: district.name,
    latitude: district.lat,
    longitude: district.lon,
    temperature: 21 + ((index * 7) % 16),
    humidity: 28 + ((index * 11) % 45),
    windSpeed: 5 + ((index * 5) % 25),
    precipitation: index % 5 === 0 ? 0.7 : 0,
    time: new Date().toISOString()
  }));
}

function openWeatherDangerLabel(value, description = '') {
  const n = Number(value);
  const labels = {
    0: 'Muito baixo',
    1: 'Baixo',
    2: 'Moderado',
    3: 'Elevado',
    4: 'Muito elevado',
    5: 'Extremo'
  };
  if (Number.isFinite(n) && labels[n]) return labels[n];
  return description || 'Sem classificação';
}

function normaliseOpenWeatherFwiEntry(entry) {
  const fwi = Number(entry?.main?.fwi ?? entry?.fwi ?? NaN);
  const dangerValue = Number(entry?.danger_rating?.value ?? entry?.danger_value ?? NaN);
  const rawDescription = entry?.danger_rating?.description ?? entry?.danger ?? '';
  const dt = Number(entry?.dt ?? NaN);
  return {
    fwi: Number.isFinite(fwi) ? Number(fwi.toFixed(2)) : null,
    dangerValue: Number.isFinite(dangerValue) ? dangerValue : null,
    dangerLabel: openWeatherDangerLabel(dangerValue, rawDescription),
    time: Number.isFinite(dt) ? new Date(dt * 1000).toISOString() : null
  };
}

async function getOpenWeatherFwi(areaKey = 'portugal') {
  const area = resolveArea(areaKey);
  const cacheKey = `openweather-fwi-${area.key}-${OPENWEATHER_FWI_POINTS_LIMIT}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const points = areaObservationPoints(area.key);
  if (!OPENWEATHER_API_KEY) {
    return setCache(cacheKey, {
      live: false,
      configured: false,
      source: 'OpenWeather Fire Weather Index - chave não configurada',
      error: 'Defina OPENWEATHER_API_KEY no ficheiro .env para ativar a API Fire Weather Index.',
      area: { key: area.key, label: area.label, bounds: area.bounds, bbox: area.bbox },
      items: fallbackOpenWeatherFwi(points)
    });
  }

  const items = [];
  const errors = [];
  for (const point of points) {
    const currentUrl = `https://api.openweathermap.org/data/2.5/fwi?lat=${point.latitude}&lon=${point.longitude}&appid=${encodeURIComponent(OPENWEATHER_API_KEY)}`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/fwi/forecast?lat=${point.latitude}&lon=${point.longitude}&appid=${encodeURIComponent(OPENWEATHER_API_KEY)}`;
    try {
      const [currentJson, forecastJson] = await Promise.all([fetchJson(currentUrl), fetchJson(forecastUrl)]);
      const current = normaliseOpenWeatherFwiEntry(currentJson?.list?.[0] || {});
      const forecast = (forecastJson?.list || []).map(normaliseOpenWeatherFwiEntry).filter((entry) => entry.fwi !== null);
      items.push({
        ...point,
        current,
        forecast,
        sourceUrls: { current: currentUrl.replace(OPENWEATHER_API_KEY, '***'), forecast: forecastUrl.replace(OPENWEATHER_API_KEY, '***') }
      });
    } catch (error) {
      errors.push(`${point.label}: ${error.message}`);
    }
  }

  const errorSummary = summariseExternalErrors(errors);

  if (!items.length) {
    return setCache(cacheKey, {
      live: false,
      configured: true,
      source: 'OpenWeather Fire Weather Index - fallback local',
      error: errorSummary || 'Sem dados devolvidos pela API OpenWeather FWI.',
      errors: errors.slice(0, 6),
      area: { key: area.key, label: area.label, bounds: area.bounds, bbox: area.bbox },
      items: fallbackOpenWeatherFwi(points)
    });
  }

  return setCache(cacheKey, {
    live: errors.length === 0,
    configured: true,
    source: errors.length ? 'OpenWeather Fire Weather Index - parcial' : 'OpenWeather Fire Weather Index - current/forecast',
    error: errorSummary,
    errors: errors.slice(0, 6),
    area: { key: area.key, label: area.label, bounds: area.bounds, bbox: area.bbox },
    items
  });
}

function fallbackOpenWeatherFwi(points) {
  const now = Date.now();
  return points.map((point, index) => {
    const base = 7 + ((index * 6 + Math.abs(point.latitude)) % 28);
    const dangerValue = base >= 38 ? 4 : base >= 21.3 ? 3 : base >= 11.2 ? 2 : base >= 5.2 ? 1 : 0;
    return {
      ...point,
      current: {
        fwi: Number(base.toFixed(2)),
        dangerValue,
        dangerLabel: openWeatherDangerLabel(dangerValue),
        time: new Date(now).toISOString()
      },
      forecast: Array.from({ length: 5 }, (_, day) => {
        const fwi = Math.max(0, base + Math.sin((index + 1) * (day + 1)) * 5 + day * 1.2);
        const v = fwi >= 50 ? 5 : fwi >= 38 ? 4 : fwi >= 21.3 ? 3 : fwi >= 11.2 ? 2 : fwi >= 5.2 ? 1 : 0;
        return {
          fwi: Number(fwi.toFixed(2)),
          dangerValue: v,
          dangerLabel: openWeatherDangerLabel(v),
          time: new Date(now + day * 86400000).toISOString()
        };
      })
    };
  });
}

function wmsTimeString(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return date.toISOString().slice(0, 10);
}

function getExternalLayers(areaKey = 'portugal') {
  const area = resolveArea(areaKey);
  const todayUnix = Math.floor(Date.now() / 1000);
  const wmsDate = COPERNICUS_WMS_DATE || wmsTimeString(0);
  const layers = {
    openWeatherFwiMap: {
      enabled: Boolean(OPENWEATHER_API_KEY && ENABLE_OPENWEATHER_FWI_MAP),
      label: 'OpenWeather FWI Map',
      type: 'tile',
      url: `/api/openweather/fwi-tile/{z}/{x}/{y}.png?date=${todayUnix}`,
      opacity: 0.42,
      defaultActive: false,
      attribution: 'OpenWeather FWI'
    },
    effisFwiWms: {
      enabled: ENABLE_COPERNICUS_LAYERS,
      label: 'EFFIS Fire Weather Index',
      type: 'wms',
      url: EFFIS_WMS_URL,
      layers: EFFIS_WMS_LAYER,
      format: 'image/png',
      transparent: true,
      time: wmsDate,
      opacity: 0.58,
      defaultActive: true,
      attribution: 'EFFIS / Copernicus EMS'
    },
    effisActiveFiresWms: {
      enabled: ENABLE_COPERNICUS_LAYERS,
      label: 'EFFIS VIIRS Hotspots',
      type: 'wms',
      url: EFFIS_WMS_URL,
      layers: EFFIS_ACTIVE_FIRES_LAYER,
      format: 'image/png',
      transparent: true,
      time: wmsDate,
      opacity: 0.86,
      defaultActive: false,
      attribution: 'EFFIS / Copernicus EMS'
    },
    effisBurntAreasWms: {
      enabled: ENABLE_COPERNICUS_LAYERS,
      label: 'EFFIS Burnt Areas',
      type: 'wms',
      url: EFFIS_WMS_URL,
      layers: EFFIS_BURNT_AREAS_LAYER,
      format: 'image/png',
      transparent: true,
      time: wmsDate,
      opacity: 0.62,
      defaultActive: false,
      attribution: 'EFFIS / Copernicus EMS'
    },
    gwisFwiWms: {
      enabled: ENABLE_COPERNICUS_LAYERS,
      label: 'GWIS Global FWI',
      type: 'wms',
      url: GWIS_WMS_URL,
      layers: GWIS_WMS_LAYER,
      format: 'image/png',
      transparent: true,
      time: wmsDate,
      opacity: 0.42,
      defaultActive: false,
      attribution: 'GWIS / Copernicus EMS'
    },
    gwisInfo: {
      enabled: true,
      label: 'GWIS/Copernicus - referência global',
      type: 'reference',
      url: 'https://gwis.jrc.ec.europa.eu/applications/data-and-services',
      note: 'Serviço global de enquadramento; no mapa é usado como camada WMS opcional quando disponível.'
    }
  };
  return {
    area: { key: area.key, label: area.label, bounds: area.bounds, bbox: area.bbox },
    wmsDate,
    note: `Camadas WMS temporais EFFIS/GWIS configuradas para ${wmsDate}.`,
    layers
  };
}

function summarize(data, area = MAP_AREAS.portugal) {
  const riskItems = data.risk.items || [];
  const riskMax = riskItems.filter((d) => d.risk === 5).length;
  const riskHighOrMore = riskItems.filter((d) => d.risk >= 3).length;
  const avgRisk = riskItems.length ? riskItems.reduce((acc, d) => acc + d.risk, 0) / riskItems.length : 0;
  const hotspots = data.hotspots.items || [];
  const fires = data.fires.items || [];
  const totalHumans = fires.reduce((acc, d) => acc + Number(d.humans || 0), 0);
  const totalGround = fires.reduce((acc, d) => acc + Number(d.ground || 0), 0);
  const totalAerial = fires.reduce((acc, d) => acc + Number(d.aerial || 0), 0);
  const fwiItems = data.openWeatherFwi?.items || [];
  const fwiValues = fwiItems.map((d) => Number(d.current?.fwi)).filter(Number.isFinite);
  const openWeatherFwiAvg = fwiValues.length ? fwiValues.reduce((acc, d) => acc + d, 0) / fwiValues.length : 0;
  const openWeatherFwiMax = fwiValues.length ? Math.max(...fwiValues) : 0;

  return {
    generatedAt: new Date().toISOString(),
    municipalities: riskItems.length,
    riskMax,
    riskHighOrMore,
    avgRisk: Number(avgRisk.toFixed(2)),
    activeFires: fires.length,
    hotspots: hotspots.length,
    totalHumans,
    totalGround,
    totalAerial,
    openWeatherFwiAvg: Number(openWeatherFwiAvg.toFixed(2)),
    openWeatherFwiMax: Number(openWeatherFwiMax.toFixed(2)),
    area: { key: area.key, label: area.label, bounds: area.bounds, bbox: area.bbox },
    liveSources: {
      ipma: Boolean(data.risk.live),
      fogos: Boolean(data.fires.live),
      firms: Boolean(data.hotspots.live),
      openMeteo: Boolean(data.weather.live),
      openWeatherFwi: Boolean(data.openWeatherFwi?.live)
    }
  };
}

async function getAllData(areaKey = 'portugal', options = {}) {
  const area = resolveArea(areaKey);
  const days = resolveFirmsDays(options.days);
  const [risk, riskTomorrow, fires, hotspots, weather, openWeatherFwi] = await Promise.all([
    getIpmaRisk(0),
    getIpmaRisk(1),
    getFogosActive(),
    getFirmsHotspots(area.key, days),
    getWeatherDistricts(),
    getOpenWeatherFwi(area.key)
  ]);
  const data = {
    risk,
    riskTomorrow,
    fires,
    hotspots,
    weather,
    openWeatherFwi,
    externalLayers: getExternalLayers(area.key)
  };
  data.summary = summarize(data, area);
  return data;
}

app.get('/api/ipma/risk', async (req, res) => {
  const day = Number(req.query.day || 0);
  res.json(await getIpmaRisk(day));
});

app.get('/api/fogos/active', async (_req, res) => {
  res.json(await getFogosActive());
});

app.get('/api/firms/hotspots', async (req, res) => {
  res.json(await getFirmsHotspots(req.query.area || 'portugal', req.query.days));
});

app.get('/api/weather/districts', async (_req, res) => {
  res.json(await getWeatherDistricts());
});

app.get('/api/openweather/fwi', async (req, res) => {
  res.json(await getOpenWeatherFwi(req.query.area || 'portugal'));
});

app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

app.get('/api/openweather/fwi-tile/:z/:x/:y.png', async (req, res) => {
  if (!OPENWEATHER_API_KEY) {
    return res.status(404).send('OPENWEATHER_API_KEY não configurada');
  }
  const { z, x, y } = req.params;
  const date = req.query.date ? `&date=${encodeURIComponent(req.query.date)}` : '';
  const url = `https://maps.openweathermap.org/maps/2.0/fwi/${encodeURIComponent(z)}/${encodeURIComponent(x)}/${encodeURIComponent(y)}?appid=${encodeURIComponent(OPENWEATHER_API_KEY)}${date}`;
  try {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) {
      return res.status(response.status).send(`OpenWeather FWI map: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=900');
    return res.send(buffer);
  } catch (error) {
    return res.status(502).send(error.message);
  }
});

app.get('/api/data', async (req, res) => {
  try {
    res.json(await getAllData(req.query.area || 'portugal', { days: req.query.days }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const data = await getAllData(req.query.area || 'portugal', { days: req.query.days });
    const sourceStatus = {
      ipma: { live: Boolean(data.risk.live), source: data.risk.source, error: data.risk.error || null },
      fogos: { live: Boolean(data.fires.live), source: data.fires.source, error: data.fires.error || null },
      firms: { live: Boolean(data.hotspots.live), source: data.hotspots.source, error: data.hotspots.error || null },
      openMeteo: { live: Boolean(data.weather.live), source: data.weather.source, error: data.weather.error || null },
      openWeatherFwi: { live: Boolean(data.openWeatherFwi?.live), source: data.openWeatherFwi?.source || null, error: data.openWeatherFwi?.error || null }
    };
    res.json({
      ok: true,
      app: 'FireRisk Portugal Dashboard',
      time: new Date().toISOString(),
      area: data.summary.area,
      liveSources: data.summary.liveSources,
      sourceStatus
    });
  } catch (error) {
    res.status(500).json({ ok: false, app: 'FireRisk Portugal Dashboard', time: new Date().toISOString(), error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`FireRisk Portugal Dashboard disponível em http://localhost:${PORT}`);
});
