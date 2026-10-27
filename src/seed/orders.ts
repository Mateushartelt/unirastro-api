/**
 * Encomendas simuladas.
 *
 * Vieram do prototipo do design e foram mantidas quase na integra: os nomes, cidades e
 * codigos sao os mesmos. O que mudou foi a forma das datas, agora relativas ao momento atual,
 * e dois campos novos que o prototipo nao tinha: `tenantId`, para demonstrar o isolamento
 * multi-tenant, e `plannedRoute`, que a regra de desvio usa como gabarito.
 *
 * A selecao de casos e deliberada. Ha uma parada longa, duas tentativas frustradas, um
 * desvio de rota, entregas normais e uma recem postada. Sem essa variedade a central de
 * incidentes apareceria vazia e a demonstracao nao provaria nada.
 */

import type { Order } from '../types';
import { dueInDays, hoursAgo } from './seedClock';

export const MOCK_ORDERS: Order[] = [
  /* --- Parada prolongada: 52h na mesma unidade, prazo em 1 dia --- */
  {
    code: 'NL482913776BR',
    tenantId: 'tenant-aurora',
    carrier: 'Correios',
    recipient: 'Beatriz Nogueira',
    city: 'Belo Horizonte, MG',
    region: 'Sudeste',
    status: 'Parado',
    dueAt: dueInDays(1),
    origin: 'São Paulo, SP',
    plannedRoute: ['São Paulo, SP', 'Contagem, MG', 'Belo Horizonte, MG'],
    timeline: [
      {
        title: 'Objeto em trânsito — unidade de tratamento',
        place: 'Contagem, MG',
        at: hoursAgo(52),
        rawCode: 'RO-01',
      },
      {
        title: 'Objeto encaminhado',
        place: 'São Paulo, SP',
        at: hoursAgo(70),
        rawCode: 'DO-01',
      },
      {
        title: 'Objeto postado',
        place: 'São Paulo, SP',
        at: hoursAgo(98),
        rawCode: 'PO-01',
      },
    ],
  },

  /* --- Duas tentativas frustradas, prazo vencendo hoje --- */
  {
    code: '10084531275940',
    tenantId: 'tenant-aurora',
    carrier: 'Jadlog',
    recipient: 'Rafael Tavares',
    city: 'Curitiba, PR',
    region: 'Sul',
    status: 'Entrega frustrada',
    dueAt: dueInDays(0),
    origin: 'São Paulo, SP',
    plannedRoute: ['São Paulo, SP', 'Curitiba, PR'],
    timeline: [
      {
        title: 'Tentativa de entrega não efetuada',
        place: 'Curitiba, PR',
        at: hoursAgo(6),
        rawCode: 'JD-88',
      },
      {
        title: 'Tentativa de entrega não efetuada',
        place: 'Curitiba, PR',
        at: hoursAgo(25),
        rawCode: 'JD-88',
      },
      {
        title: 'Em rota de entrega',
        place: 'Curitiba, PR',
        at: hoursAgo(31),
        rawCode: 'JD-40',
      },
      {
        title: 'Chegada na unidade',
        place: 'Curitiba, PR',
        at: hoursAgo(43),
        rawCode: 'JD-20',
      },
      {
        title: 'Coletado',
        place: 'São Paulo, SP',
        at: hoursAgo(94),
        rawCode: 'JD-01',
      },
    ],
  },

  /* --- Fluxo saudavel, saiu para entrega agora --- */
  {
    code: 'LG2039481122',
    tenantId: 'tenant-aurora',
    carrier: 'Loggi',
    recipient: 'Camila Duarte',
    city: 'São Paulo, SP',
    region: 'Sudeste',
    status: 'Saiu p/ entrega',
    dueAt: dueInDays(2),
    origin: 'São Paulo, SP',
    plannedRoute: ['São Paulo, SP'],
    timeline: [
      {
        title: 'Saiu para entrega',
        place: 'São Paulo, SP',
        at: hoursAgo(0.7),
        rawCode: 'LG-OUT',
      },
      {
        title: 'Chegou ao hub',
        place: 'São Paulo, SP',
        at: hoursAgo(5),
        rawCode: 'LG-HUB',
      },
      {
        title: 'Coletado',
        place: 'São Paulo, SP',
        at: hoursAgo(15),
        rawCode: 'LG-PIC',
      },
    ],
  },

  /* --- Fluxo saudavel, transito longo --- */
  {
    code: 'QB771204558BR',
    tenantId: 'tenant-aurora',
    carrier: 'Correios',
    recipient: 'Lucas Ferreira',
    city: 'Porto Alegre, RS',
    region: 'Sul',
    status: 'Em trânsito',
    dueAt: dueInDays(3),
    origin: 'São Paulo, SP',
    plannedRoute: ['São Paulo, SP', 'Cajamar, SP', 'Porto Alegre, RS'],
    timeline: [
      {
        title: 'Objeto em trânsito',
        place: 'Cajamar, SP',
        at: hoursAgo(5),
        rawCode: 'RO-01',
      },
      {
        title: 'Objeto postado',
        place: 'São Paulo, SP',
        at: hoursAgo(17),
        rawCode: 'PO-01',
      },
    ],
  },

  /* --- Entregue dentro do prazo --- */
  {
    code: 'LG2039480917',
    tenantId: 'tenant-aurora',
    carrier: 'Loggi',
    recipient: 'João Pedro Lima',
    city: 'Campinas, SP',
    region: 'Sudeste',
    status: 'Entregue',
    dueAt: dueInDays(1),
    origin: 'São Paulo, SP',
    plannedRoute: ['São Paulo, SP', 'Campinas, SP'],
    timeline: [
      {
        title: 'Entregue',
        place: 'Campinas, SP',
        at: hoursAgo(18),
        rawCode: 'LG-DLV',
      },
      {
        title: 'Saiu para entrega',
        place: 'Campinas, SP',
        at: hoursAgo(25),
        rawCode: 'LG-OUT',
      },
      {
        title: 'Coletado',
        place: 'São Paulo, SP',
        at: hoursAgo(39),
        rawCode: 'LG-PIC',
      },
    ],
  },

  /* --- Desvio de rota: registrado em Salvador, fora do trajeto para Recife --- */
  {
    code: 'TE930018472210',
    tenantId: 'tenant-bonsai',
    carrier: 'Total Express',
    recipient: 'Mercearia Dois Irmãos',
    city: 'Recife, PE',
    region: 'Nordeste',
    status: 'Em trânsito',
    dueAt: dueInDays(4),
    origin: 'Guarulhos, SP',
    plannedRoute: ['Guarulhos, SP', 'Vitória da Conquista, BA', 'Recife, PE'],
    timeline: [
      {
        title: 'Em trânsito',
        place: 'Salvador, BA',
        at: hoursAgo(3),
        rawCode: 'TE-TRN',
      },
      {
        title: 'Em trânsito',
        place: 'Vitória da Conquista, BA',
        at: hoursAgo(22),
        rawCode: 'TE-TRN',
      },
      {
        title: 'Coletado',
        place: 'Guarulhos, SP',
        at: hoursAgo(62),
        rawCode: 'TE-PIC',
      },
    ],
  },

  /* --- Fluxo saudavel --- */
  {
    code: '10084531276113',
    tenantId: 'tenant-bonsai',
    carrier: 'Jadlog',
    recipient: 'Ana Paula Ribeiro',
    city: 'Goiânia, GO',
    region: 'Centro-Oeste',
    status: 'Em trânsito',
    dueAt: dueInDays(5),
    origin: 'São Paulo, SP',
    plannedRoute: ['São Paulo, SP', 'Uberlândia, MG', 'Goiânia, GO'],
    timeline: [
      {
        title: 'Em trânsito',
        place: 'Uberlândia, MG',
        at: hoursAgo(9),
        rawCode: 'JD-30',
      },
      {
        title: 'Coletado',
        place: 'São Paulo, SP',
        at: hoursAgo(46),
        rawCode: 'JD-01',
      },
    ],
  },

  /* --- Recem postada, sem movimentacao ainda --- */
  {
    code: 'NL482913912BR',
    tenantId: 'tenant-bonsai',
    carrier: 'Correios',
    recipient: 'Fernanda Souza',
    city: 'Manaus, AM',
    region: 'Norte',
    status: 'Postado',
    dueAt: dueInDays(9),
    origin: 'São Paulo, SP',
    plannedRoute: ['São Paulo, SP', 'Manaus, AM'],
    timeline: [
      {
        title: 'Objeto postado',
        place: 'São Paulo, SP',
        at: hoursAgo(1),
        rawCode: 'PO-01',
      },
    ],
  },
];
