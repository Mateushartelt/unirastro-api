/** Ponto de entrada da API. */

import { createBackend } from './composition/container';

// API_PORT, e nao PORT: o Vite e outras ferramentas ja usam PORT para o frontend.
const PORT = Number(process.env.API_PORT ?? 3333);

// Segredo fixo so serve para desenvolvimento. Em producao vem do ambiente.
const app = createBackend({ tokenSecret: process.env.TOKEN_SECRET ?? 'unirastro-dev-secret' });

app.listen(PORT, () => {
  console.log(`UNIRASTRO API em http://localhost:${PORT}/api`);
});
