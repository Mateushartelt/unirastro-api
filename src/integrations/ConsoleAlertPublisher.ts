/**
 * Publicador de alertas que so escreve no log.
 *
 * Fica no lugar do gateway de mensageria (WhatsApp API, SendGrid, Twilio no C1). A integracao
 * real implementa a mesma porta IAlertPublisher, e o servico de encomendas nao muda.
 */

import type { Anomaly, Order } from '../types';
import type { IAlertPublisher } from '../repositories/ports';

export class ConsoleAlertPublisher implements IAlertPublisher {
  private readonly log: (line: string) => void;

  constructor(log: (line: string) => void = console.log) {
    this.log = log;
  }

  publish(order: Order, anomalies: readonly Anomaly[]): void {
    const rules = anomalies.map((a) => a.rule).join(', ');
    this.log(`[alerta] ${order.tenantId} · ${order.code} · ${order.recipient} · ${rules}`);
  }
}
