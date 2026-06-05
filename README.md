# FireRisk Portugal Dashboard

Dashboard dinâmico de **Incêndios e Risco Florestal em Portugal Continental**, desenvolvido para a UC de Informação Geográfica e Visualização.

A aplicação cumpre o enunciado do TP1:

- biblioteca lateral com KPIs fixos;
- mínimo de 6 KPIs;
- geração dinâmica de gráficos ao adicionar KPIs;
- uso de **D3.js** nos gráficos estatísticos e geográficos;
- uso de **Leaflet** para o mapa interativo;
- **drag and drop** do painel esquerdo para o dashboard;
- botão **Save** para guardar o estado do dashboard;
- botão **Refresh** para atualizar os dados e redesenhar os gráficos;
- remoção de widgets;
- reorganização da ordem dos widgets com SortableJS;
- persistência da ordem no `localStorage` quando se clica em Save;
- consumo de APIs/fontes externas com proxy local Node.js/Express.

---

## Stack técnica

- HTML5
- CSS3
- JavaScript ES Modules
- D3.js
- Leaflet
- SortableJS
- Node.js
- Express
- localStorage
- APIs externas

---

## Fontes de dados usadas

### IPMA

Usado para obter a previsão do risco de incêndio rural por concelho.

Endpoint usado pelo servidor:

```txt
https://api.ipma.pt/open-data/forecast/meteorology/rcm/rcm-d0.json
https://api.ipma.pt/open-data/forecast/meteorology/rcm/rcm-d1.json
```

### Fogos.pt

Usado para obter ocorrências ativas, quando o acesso está disponível.

Endpoint configurado por defeito:

```txt
https://api.fogos.pt/v2/incidents/active?geojson=true
```

O Fogos.pt pode exigir autenticação/token. Se tiveres token, coloca-o no `.env` em `FOGOS_PT_AUTH`.

### NASA FIRMS

Usado para hotspots/deteções térmicas por satélite.

Requer MAP_KEY gratuito. Para usar dados reais da NASA FIRMS, cria um ficheiro `.env` e define:

```txt
NASA_FIRMS_MAP_KEY=coloca_a_tua_chave_aqui
```

Se não existir MAP_KEY, a aplicação usa dados locais de fallback para não falhar na apresentação.

### Open-Meteo

Usado para meteorologia atual por distrito: temperatura, humidade, vento e precipitação.

---

## Instalação

1. Instalar Node.js 18 ou superior.
2. Abrir terminal na pasta do projecto.
3. Instalar dependências:

```bash
npm install
```

4. Opcionalmente, criar o ficheiro `.env` a partir do exemplo:

```bash
copy .env.example .env
```

No Mac/Linux:

```bash
cp .env.example .env
```

5. Arrancar o servidor:

```bash
npm start
```

6. Abrir no browser:

```txt
http://localhost:3000
```

---

## Como testar as funcionalidades pedidas no enunciado

### 1. Drag and drop

Arrastar um KPI da lateral esquerda para a área do dashboard. Ao largar, o widget é criado automaticamente.

Também é possível clicar num KPI para o adicionar.

### 2. D3.js

Os seguintes KPIs usam D3.js:

- Risco de Incêndio por Município;
- Distribuição dos Níveis de Risco;
- Top Municípios em Risco Crítico;
- Meteorologia vs Risco;
- Evolução de Hotspots.

### 3. Mapa

O KPI “Mapa de Ocorrências e Hotspots” usa Leaflet com OpenStreetMap, ocorrências Fogos.pt e hotspots NASA FIRMS.

### 4. Save

Adicionar vários KPIs, reorganizar a ordem e clicar em **Save**.

Depois, recarregar a página. O dashboard deve aparecer com os mesmos widgets e na mesma ordem.

### 5. Refresh

Clicar em **Refresh**. A aplicação volta a chamar as fontes externas através do servidor e redesenha os widgets ativos.

### 6. Remover gráficos

Cada widget tem um botão `×`. Ao clicar, o gráfico é removido e o KPI volta a ficar disponível na lista lateral.

### 7. Reorganizar gráficos

Usar o botão `↕` no cabeçalho de cada widget para arrastar e reorganizar os gráficos.

---

## KPIs implementados

| KPI | Visualização | Fonte principal |
|---|---|---|
| Mapa de Ocorrências e Hotspots | Leaflet map | Fogos.pt + NASA FIRMS |
| Risco de Incêndio por Município | D3 geo plot | IPMA |
| Distribuição dos Níveis de Risco | D3 donut chart | IPMA |
| Top Municípios em Risco Crítico | D3 bar chart | IPMA |
| Meteorologia vs Risco | D3 scatter plot | Open-Meteo + IPMA |
| Evolução de Hotspots | D3 line chart | NASA FIRMS + Fogos.pt |

---

## Notas importantes para apresentação

- O dashboard está preparado para consumir APIs externas reais.
- Se uma API externa falhar, exigir token ou bloquear CORS/acesso, o servidor usa fallback local para manter a aplicação funcional.
- O estado guardado pelo Save não guarda os dados externos; guarda apenas a composição do dashboard: widgets adicionados e respectiva ordem.
- O Refresh volta a procurar dados e redesenha os gráficos ativos.
- A aplicação foi inspirada no conceito de plataformas como o SeverusPT, mas não copia o seu código nem a sua interface.

---

## Sugestão de demonstração em vídeo

1. Abrir `http://localhost:3000`.
2. Mostrar a biblioteca de KPIs.
3. Arrastar “Risco de Incêndio por Município”.
4. Arrastar “Distribuição dos Níveis de Risco”.
5. Arrastar “Mapa de Ocorrências e Hotspots”.
6. Reorganizar dois widgets com o botão `↕`.
7. Remover um widget com `×`.
8. Voltar a adicionar esse KPI.
9. Clicar em **Refresh**.
10. Clicar em **Save**.
11. Recarregar a página e mostrar que os widgets continuam no dashboard.

