/**
 * Rastreio real (RF02) pela API publica do Melhor Rastreio.
 *
 * O Melhor Rastreio consulta Jadlog, Loggi e outras transportadoras e devolve o historico num
 * formato so, sem exigir chave. Correios ficou de fora: com um codigo real, o Melhor Rastreio
 * nao devolveu nada (so mostra codigos que alguem ja cadastrou na plataforma dele). Trocar pela API oficial e
 * escrever outra classe que implemente ICarrierTrackingGateway (OCP).
 *
 * A classe devolve so os eventos que a encomenda ainda nao tem, para o OrdersService poder
 * consultar quantas vezes quiser sem duplicar a linha do tempo.
 */

import type { Carrier, Order, OrderStatus, TrackingEvent } from '../types';
import {
  CarrierUnavailableError,
  type ICarrierTrackingGateway,
  type TrackingUpdate,
} from '../repositories/ports';

export const MELHOR_RASTREIO_URL = 'https://api.melhorrastreio.com.br/graphql';

/**
 * Como o Melhor Rastreio chama cada transportadora integrada. Total Express ele nao cobre;
 * Shopee Xpress tem integracao propria (ShopeeXpressGateway).
 */
const TRACKER_TYPE: Partial<Record<Carrier, string>> = {
  Jadlog: 'jadlog',
  Loggi: 'loggi',
};

const SEARCH_PARCEL = `
  mutation searchParcel($tracker: TrackerSearchInput!) {
    result: searchParcel(tracker: $tracker) {
      trackingEvents {
        status
        title
        description
        registeredAt
        createdAt
        location { city state }
      }
    }
  }
`;

/** Evento como o Melhor Rastreio devolve (so os campos que usamos). */
export interface RemoteEvent {
  status?: string | null;
  title?: string | null;
  description?: string | null;
  registeredAt?: string | null;
  createdAt?: string | null;
  location?: { city?: string | null; state?: string | null } | null;
}

interface SearchParcelResponse {
  data?: { result?: { trackingEvents?: RemoteEvent[] | null } | null } | null;
  errors?: { message: string }[];
}

export interface MelhorRastreioOptions {
  url?: string;
  timeoutMs?: number;
  /** Injetavel para os testes trocarem a rede por respostas gravadas. */
  fetch?: typeof fetch;
}

export class MelhorRastreioGateway implements ICarrierTrackingGateway {
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: MelhorRastreioOptions = {}) {
    this.url = options.url ?? MELHOR_RASTREIO_URL;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetchFn = options.fetch ?? fetch;
  }

  async fetchUpdate(order: Order): Promise<TrackingUpdate | null> {
    const type = TRACKER_TYPE[order.carrier];
    if (!type) return null;

    const remote = await this.search(type, order.code);
    if (remote.length === 0) return null;

    const all = remote.map(toTrackingEvent).sort(newestFirst);
    const known = new Set(order.timeline.map(eventKey));
    const events = all.filter((e) => !known.has(eventKey(e)));
    if (events.length === 0) return null;

    return { events, status: statusFromEvent(all[0]) };
  }

  private async search(type: string, code: string): Promise<RemoteEvent[]> {
    const body = await this.post({
      query: SEARCH_PARCEL,
      variables: { tracker: { type, trackingCode: code } },
    });
    // Codigo que a transportadora ainda nao conhece volta como result: null, sem erro.
    return body.data?.result?.trackingEvents ?? [];
  }

  private async post(payload: unknown): Promise<SearchParcelResponse> {
    let response: Response;
    try {
      response = await this.fetchFn(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new CarrierUnavailableError(`Falha de rede: ${(error as Error).message}`);
    }

    if (!response.ok) throw new CarrierUnavailableError(`HTTP ${response.status}`);

    const body = (await response.json()) as SearchParcelResponse;
    if (body.errors?.length && !body.data?.result) {
      throw new CarrierUnavailableError(body.errors.map((e) => e.message).join('; '));
    }
    return body;
  }
}

/* --------------------------- Traducao do formato --------------------------- */

export function toTrackingEvent(remote: RemoteEvent): TrackingEvent {
  const title = clean(remote.title) || clean(remote.description) || 'Movimentação';
  return {
    title,
    place: placeOf(remote),
    at: new Date(remote.registeredAt ?? remote.createdAt ?? Date.now()).toISOString(),
    rawCode: clean(remote.status) || 'MR',
  };
}

function placeOf(remote: RemoteEvent): string {
  const city = clean(remote.location?.city);
  const state = clean(remote.location?.state);
  if (city && state) return `${titleCase(city)}, ${state.toUpperCase()}`;
  return city ? titleCase(city) : state.toUpperCase() || '—';
}

/**
 * Status do UNIRASTRO a partir do evento mais recente.
 *
 * O codigo (`status`) vem do Melhor Rastreio; o texto cobre o que ele marca so como aviso,
 * como a tentativa de entrega que a regra RepeatedFailedAttemptsRule conta.
 */
export function statusFromEvent(event: TrackingEvent): OrderStatus {
  const code = event.rawCode.toUpperCase();
  const title = event.title.toLowerCase();

  if (code === 'DELIVERED' || title.includes('entregue ao destinat')) return 'Entregue';
  if (isFailedAttempt(title)) return 'Entrega frustrada';
  if (code === 'ONROUTE' || title.includes('saiu para entrega')) return 'Saiu p/ entrega';
  if (['ADDED', 'PREPOSTING', 'POSTING', 'POSTED'].includes(code) || title.includes('postado')) {
    return 'Postado';
  }
  return 'Em trânsito';
}

function isFailedAttempt(title: string): boolean {
  return (
    (title.includes('tentativa') && (title.includes('não efetuada') || title.includes('frustrada'))) ||
    title.includes('destinatário ausente') ||
    title.includes('carteiro não atendido')
  );
}

function eventKey(e: TrackingEvent): string {
  return `${e.at}|${e.title}`;
}

function newestFirst(a: TrackingEvent, b: TrackingEvent): number {
  return b.at.localeCompare(a.at);
}

function clean(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());
}
