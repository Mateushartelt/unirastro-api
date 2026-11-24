/** Ponto de entrada da API. */

import { createBackend } from './composition/container';

// API_PORT, e nao PORT: o Vite e outras ferramentas ja usam PORT para o frontend.
const PORT = Number(process.env.API_PORT ?? 3333);

// Segredo fixo so serve para desenvolvimento. Em producao vem do ambiente.
const app = createBackend({
  tokenSecret: process.env.TOKEN_SECRET ?? 'unirastro-dev-secret',
  // Encomendas persistidas em SQLite; DATABASE_FILE=:memory: volta ao modo so em memoria.
  databaseFile: process.env.DATABASE_FILE ?? 'data/unirastro.db',
  // Rastreio real pelo Melhor Rastreio; CARRIER_GATEWAY=simulado volta a transportadora simulada.
  carriers: process.env.CARRIER_GATEWAY === 'simulado' ? 'simulado' : 'real',
});

app.listen(PORT, () => {
  console.log(`UNIRASTRO API em http://localhost:${PORT}/api`);
  console.log(`Transportadoras: ${process.env.CARRIER_GATEWAY === 'simulado' ? 'simuladas' : 'rastreio real (Shopee Xpress + Melhor Rastreio)'}`);
});
