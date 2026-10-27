/**
 * Calculos de tempo usados pelas regras de negocio.
 *
 * Moravam em lib/format.ts, misturados com formatacao de tela. Isso fazia as regras de
 * anomalia (dominio) dependerem de um modulo de apresentacao. Separados, o dominio nao conhece
 * nada de interface, e a formatacao passa a depender do dominio, que e a direcao certa.
 *
 * Toda funcao aceita o instante atual como parametro opcional. Assim as regras ficam puras e
 * testaveis com um relogio fixo, sem depender de `new Date()` escondido.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Horas decorridas entre dois instantes ISO. Positivo quando `to` e posterior a `from`. */
export function hoursBetween(from: string, to: Date = new Date()): number {
  return (to.getTime() - new Date(from).getTime()) / HOUR;
}

/**
 * Diferenca em dias de calendario, nao em blocos de 24 horas. Um prazo que termina as 23h de
 * hoje "vence hoje", mesmo faltando apenas uma hora.
 */
export function calendarDaysUntil(iso: string, now: Date = new Date()): number {
  const target = startOfDay(new Date(iso));
  const today = startOfDay(now);
  return Math.round((target.getTime() - today.getTime()) / DAY);
}

/** Prazo daqui a N dias de calendario, fixado no fim do expediente (18h). */
export function deadlineInDays(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
