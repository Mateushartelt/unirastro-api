/**
 * Rastreio real (RF02) da Shopee Xpress, a entrega propria da Shopee.
 *
 * Usa o mesmo endpoint publico que a pagina de rastreio spx.com.br consulta. Nao exige chave.
 * O Melhor Rastreio nao cobre a Shopee Xpress, por isso ela tem integracao propria.
 *
 * Como o MelhorRastreioGateway, devolve so os eventos que a encomenda ainda nao tem.
 */

import type { Order, OrderStatus, TrackingEvent } from '../types';
import {
  CarrierUnavailableError,
  type ICarrierTrackingGateway,
  type TrackingUpdate,
} from '../repositories/ports';

export const SPX_TRACKING_URL = 'https://spx.com.br/shipment/order/open/order/get_order_info';

/** Registro de rastreio como a Shopee Xpress devolve (so os campos que usamos). */
export interface SpxRecord {
  tracking_code: string;
  tracking_name?: string;
  buyer_description?: string;
  description?: string;
  /** Segundos desde 1970 (epoch Unix). */
  actual_time: number;
  /** 1 = aparece para o comprador; 0 = evento interno da logistica. */
  display_flag?: number;
  milestone_name?: string;
  current_location?: { location_name?: string };
}

export interface SpxResponse {
  retcode: number;
  message?: string;
  data?: { sls_tracking_info?: { records?: SpxRecord[] } };
}

export interface ShopeeXpressOptions {
  url?: string;
  timeoutMs?: number;
  /** Injetavel para os testes trocarem a rede por respostas gravadas. */
  fetch?: typeof fetch;
}

export class ShopeeXpressGateway implements ICarrierTrackingGateway {
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: ShopeeXpressOptions = {}) {
    this.url = options.url ?? SPX_TRACKING_URL;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetchFn = options.fetch ?? fetch;
  }

  async fetchUpdate(order: Order): Promise<TrackingUpdate | null> {
    const records = await this.search(order.code);
    const all = records
      .filter((r) => r.display_flag !== 0)
      .map(toTrackingEvent)
      .sort((a, b) => b.at.localeCompare(a.at));
    if (all.length === 0) return null;

    const known = new Set(order.timeline.map(eventKey));
    const events = all.filter((e) => !known.has(eventKey(e)));
    if (events.length === 0) return null;

    return { events, status: statusFromRecord(records, all[0]) };
  }

  private async search(code: string): Promise<SpxRecord[]> {
    const url = `${this.url}?spx_tn=${encodeURIComponent(code)}&language_code=pt`;

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new CarrierUnavailableError(`Falha de rede: ${(error as Error).message}`);
    }
    if (!response.ok) throw new CarrierUnavailableError(`HTTP ${response.status}`);

    const body = (await response.json()) as SpxResponse;
    // retcode diferente de 0 e "codigo nao encontrado" na Shopee Xpress, nao queda do servico.
    if (body.retcode !== 0) return [];
    return body.data?.sls_tracking_info?.records ?? [];
  }
}

/* --------------------------- Traducao do formato --------------------------- */

export function toTrackingEvent(record: SpxRecord): TrackingEvent {
  return {
    title: (record.buyer_description || record.description || record.tracking_name || 'Movimentação').trim(),
    place: placeOf(record.current_location?.location_name),
    at: new Date(record.actual_time * 1000).toISOString(),
    rawCode: record.tracking_code,
  };
}

/** "São Bernardo do Campo - SP" vira "São Bernardo do Campo, SP", como o resto do painel. */
function placeOf(name: string | undefined): string {
  const clean = (name ?? '').trim();
  if (!clean) return 'Shopee Xpress';
  return clean.replace(/\s+-\s+([A-Z]{2})$/, ', $1');
}

/** Status do UNIRASTRO pelo marco (milestone) do evento mais recente. */
export function statusFromRecord(records: readonly SpxRecord[], latest: TrackingEvent): OrderStatus {
  const record = records.find((r) => r.tracking_code === latest.rawCode && toTrackingEvent(r).at === latest.at);
  const milestone = (record?.milestone_name ?? '').toLowerCase();
  const text = `${record?.tracking_name ?? ''} ${latest.title}`.toLowerCase();

  if (milestone === 'delivered' || text.includes('entregue')) return 'Entregue';
  if (text.includes('unsuccessful delivery') || text.includes('não foi possível entregar')) return 'Entrega frustrada';
  if (milestone === 'out for delivery' || text.includes('saiu para entrega')) return 'Saiu p/ entrega';
  if (milestone === 'preparing to ship') return 'Postado';
  return 'Em trânsito';
}

function eventKey(e: TrackingEvent): string {
  return `${e.at}|${e.title}`;
}
