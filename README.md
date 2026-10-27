# UNIRASTRO — API Backend

API do UNIRASTRO, SaaS multi-tenant de rastreamento proativo de encomendas. Atende a
[Aplicação Web](https://github.com/Mateushartelt/unirastro) (React/Vite), que fala com ela por
REST/JSON.

Node.js 22 + Express 5 + TypeScript. Nesta entrega os dados ficam em memória, semeados com os
mesmos dados de demonstração do painel; PostgreSQL, fila, cache e worker são a próxima etapa.

## Como rodar

```bash
npm install
npm run dev        # http://localhost:3333/api (porta em API_PORT)
```

Para usar com o painel, suba a Aplicação Web com `VITE_API_URL=/api` (o Vite encaminha `/api`
para a porta 3333). As contas de demonstração estão em `GET /api/demo-accounts`.

```bash
npm test           # integração HTTP + unidade (node:test)
npm run typecheck
npm run arch       # falha se algum import furar as camadas do C3
```

| Variável | Padrão | Uso |
| --- | --- | --- |
| `API_PORT` | `3333` | porta da API |
| `TOKEN_SECRET` | `unirastro-dev-secret` | segredo HMAC dos tokens; obrigatório trocar fora do desenvolvimento |

## Rotas

Todas devolvem o envelope `{ success, message, errors, data }`. A empresa (tenant) vem sempre
do token, nunca de parâmetro enviado pelo cliente.

| Método | Rota | Permissão |
| --- | --- | --- |
| POST | `/api/auth/login` · `/api/auth/logout` | pública |
| GET | `/api/demo-accounts` | pública |
| GET | `/api/encomendas` · `/api/encomendas/:code` | autenticado |
| POST | `/api/encomendas` | `createOrders` |
| POST | `/api/encomendas/:code/consultar` | autenticado |
| GET | `/api/incidentes` | autenticado |
| POST | `/api/incidentes/:id/resolver` · `/reabrir` | `resolveIncidents` |
| GET | `/api/gatilhos` | autenticado |
| PATCH | `/api/gatilhos/:id` | `editTriggers` |
| GET | `/api/workers/status` | autenticado |

Status: 200, 201 (cadastro), 400 (validação), 401 (sem token ou credencial inválida), 403
(papel sem permissão), 404.

## Arquitetura

As pastas são os componentes do C3 do container API Backend:

```
src/
  http/           app Express, envelope, token JWT (HS256), authenticate/authorize
  controllers/    traduzem HTTP <-> caso de uso; nenhuma regra de negócio
  application/    serviços de aplicação: só orquestram domínio + portas
  repositories/   ports.ts (interfaces) + repositórios em memória
  integrations/   transportadora simulada, publicador de alertas
  composition/    composition root: o único lugar que instancia classes concretas
  domain/         regras puras: anomalias, transportadoras, cadastro, incidentes, permissões
  types/          modelo de domínio
  seed/           dados de demonstração
```

O domínio é o mesmo conjunto de regras da Aplicação Web: o painel mostra e a API aplica as
mesmas anomalias, os mesmos formatos de código e a mesma matriz de permissões. Se uma regra
mudar, ela muda nos dois repositórios.

### SOLID

- **S** — `OrdersService` só orquestra; validação no domínio, persistência no repositório,
  HTTP no controller.
- **O** — regra de anomalia nova = classe nova + uma linha em `ANOMALY_RULES`; banco real =
  repositório novo que implementa `ports.ts`.
- **L** — toda implementação cumpre a porta inteira; falha é um `Result`, nunca exceção.
- **I** — portas pequenas por papel (`IWorkerActivityRecorder` × `IWorkerStatusReader`).
- **D** — serviços recebem interfaces pelo construtor; `test/ordersService.test.ts` troca a
  transportadora e o publicador por dublês sem tocar no serviço.

### Padrão de projeto: Strategy

`AnomalyRule` é a interface Strategy; `StalledInTransitRule`, `RepeatedFailedAttemptsRule`,
`RouteDeviationRule` e `PredictiveDelayRiskRule` são as estratégias concretas;
`AnomalyDetector` é o Context, que recebe as regras e aplica cada uma; o composition root
escolhe quais estão ativas.

O diagrama de sequência do cadastro de encomenda e o modelo C4 completo estão no README da
[Aplicação Web](https://github.com/Mateushartelt/unirastro).
