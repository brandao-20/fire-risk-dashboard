export async function loadDashboardData(area = 'portugal', options = {}) {
  const params = new URLSearchParams({
    t: String(Date.now()),
    area
  });

  if (options.days) {
    params.set('days', String(options.days));
  }

  const response = await fetch(`/api/data?${params.toString()}`, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Erro ao carregar dados: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
