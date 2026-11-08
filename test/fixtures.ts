/** Encomenda de teste com relogio fixo: cada teste altera so o campo que interessa. */

import type { Order, TrackingEvent } from '../src/types';

export const NOW = new Date('2026-11-10T12:00:00Z');

export function hoursBefore(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

export function daysAfter(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString();
}

export function event(title: string, place: string, hoursAgo = 1): TrackingEvent {
  return { title, place, at: hoursBefore(hoursAgo), rawCode: 'TST' };
}

export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    code: 'AB123456789BR',
    tenantId: 'tenant-teste',
    carrier: 'Correios',
    recipient: 'Ana Souza',
    city: 'Curitiba, PR',
    region: 'Sul',
    status: 'Em trânsito',
    dueAt: daysAfter(5),
    origin: 'São Paulo, SP',
    plannedRoute: ['São Paulo, SP', 'Curitiba, PR'],
    timeline: [event('Objeto em trânsito', 'São Paulo, SP')],
    ...overrides,
  };
}
