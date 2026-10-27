/**
 * Geracao de datas para os dados simulados.
 *
 * Os dados sao ancorados no momento em que a aplicacao carrega, nunca em datas fixas. Assim
 * a encomenda parada continua parada ha 52 horas em qualquer dia que o projeto for
 * apresentado, e as regras de anomalia disparam de verdade em vez de ler um campo pronto.
 */

const HOUR = 60 * 60 * 1000;

/** Instante em que o modulo foi carregado. Fixo durante toda a sessao. */
export const SEED_NOW = new Date();

export function hoursAgo(hours: number): string {
  return new Date(SEED_NOW.getTime() - hours * HOUR).toISOString();
}

export function daysAgo(days: number): string {
  return hoursAgo(days * 24);
}

/**
 * Prazo daqui a N dias de calendario, fixado no fim do expediente.
 *
 * O horario importa: um prazo marcado para o instante exato do carregamento oscilaria entre
 * "vence hoje" e "venceu" conforme os segundos passassem.
 */
export function dueInDays(days: number): string {
  const d = new Date(SEED_NOW);
  d.setDate(d.getDate() + days);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}
