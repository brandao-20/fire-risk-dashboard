export const KPIS = [
  {
    id: 'active-map',
    title: 'Mapa de Ocorrências e Hotspots',
    description: 'Ocorrências ativas e deteções térmicas por satélite na área selecionada.',
    chartType: 'Leaflet map',
    size: 'large'
  },
  {
    id: 'risk-map',
    title: 'Risco de Incêndio por Município',
    description: 'Mapa D3 com municípios portugueses posicionados por coordenadas e cor por nível de risco IPMA.',
    chartType: 'D3 geo plot',
    size: 'large'
  },
  {
    id: 'risk-donut',
    title: 'Distribuição dos Níveis de Risco',
    description: 'Distribuição dos concelhos por classe de risco: reduzido, moderado, elevado, muito elevado e máximo.',
    chartType: 'D3 donut chart',
    size: 'normal'
  },
  {
    id: 'top-risk-bar',
    title: 'Top Municípios em Risco Crítico',
    description: 'Ranking dos municípios portugueses com risco mais elevado, agrupados e identificados por DICO/distrito.',
    chartType: 'D3 bar chart',
    size: 'normal'
  },
  {
    id: 'weather-scatter',
    title: 'Meteorologia vs Risco',
    description: 'Relação entre temperatura, humidade, vento e risco médio por distrito português.',
    chartType: 'D3 scatter plot',
    size: 'normal'
  },
  {
    id: 'evolution-line',
    title: 'Evolução de Hotspots',
    description: 'Evolução temporal das deteções de fogo ativo registadas por satélite na área selecionada.',
    chartType: 'D3 line chart',
    size: 'normal'
  },
  {
    id: 'openweather-fwi',
    title: 'Fire Weather Index Global',
    description: 'Índice FWI atual e previsão a 5 dias por pontos de referência da área selecionada através da OpenWeather.',
    chartType: 'D3 FWI bars',
    size: 'normal'
  }
];

export const MAP_AREAS = {
  portugal: {
    label: 'Portugal Continental',
    note: 'IPMA/Fogos.pt + NASA FIRMS',
    bounds: [[36.85, -9.75], [42.25, -6.05]],
    mapBounds: [[36.65, -10.15], [42.45, -5.75]],
    maxZoom: 8
  },
  iberia: {
    label: 'Península Ibérica',
    note: 'NASA FIRMS alargado; IPMA/Fogos.pt mantêm Portugal',
    bounds: [[35.60, -10.50], [44.40, 4.40]],
    mapBounds: [[35.30, -10.90], [44.70, 4.80]],
    maxZoom: 7
  },
  westernEurope: {
    label: 'Europa Ocidental',
    note: 'Hotspots NASA FIRMS por área; risco IPMA só Portugal',
    bounds: [[35.00, -11.50], [51.50, 11.00]],
    mapBounds: [[34.60, -12.00], [51.90, 11.50]],
    maxZoom: 6
  },
  westernMediterranean: {
    label: 'Mediterrâneo Ocidental',
    note: 'Hotspots NASA FIRMS por área; risco IPMA só Portugal',
    bounds: [[34.00, -10.50], [46.50, 16.50]],
    mapBounds: [[33.60, -11.00], [46.90, 17.00]],
    maxZoom: 6
  }
};

export const RISK_META = {
  1: { label: 'Reduzido', color: '#16a34a' },
  2: { label: 'Moderado', color: '#84cc16' },
  3: { label: 'Elevado', color: '#f59e0b' },
  4: { label: 'Muito elevado', color: '#f97316' },
  5: { label: 'Máximo', color: '#dc2626' },
  0: { label: 'Sem dados', color: '#94a3b8' }
};

export const STORAGE_KEY = 'fire-risk-portugal-dashboard-state-v1';
