/**
 * RF01: identificacao automatica da transportadora a partir do codigo de rastreio.
 *
 * Importante para a defesa: os formatos sao aproximacoes didaticas. Formatos reais mudam, se
 * sobrepoem entre operadores e admitem variacoes que nao estao representadas aqui. Em producao
 * o palpite do formato serviria apenas para escolher qual API consultar primeiro, e a
 * confirmacao viria da resposta da propria transportadora.
 *
 * O detector recebe os formatos pelo construtor (OCP). Integrar uma transportadora nova e
 * acrescentar um CarrierPattern no registro, sem tocar na logica de deteccao.
 *
 * Os textos de interface ("Aguardando codigo...", "Transportadora identificada...") sairam
 * daqui e foram para components/orders/carrierFeedback.ts. Dominio decide, tela descreve.
 */

import type { Carrier } from '../../types';

export interface CarrierPattern {
  carrier: Carrier;
  pattern: RegExp;
  /** Dica de formato mostrada ao usuario. */
  hint: string;
}

/** Normaliza o que o usuario digitou: sem espacos nas pontas, tudo em maiusculas. */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

export class CarrierDetector {
  private readonly patterns: readonly CarrierPattern[];

  constructor(patterns: readonly CarrierPattern[]) {
    this.patterns = patterns;
  }

  /** Devolve a transportadora identificada, ou null quando nenhum formato casa. */
  detect(input: string): Carrier | null {
    const code = normalizeCode(input);
    return this.patterns.find((c) => c.pattern.test(code))?.carrier ?? null;
  }

  /** Lista de formatos aceitos, para exibir como ajuda no formulario. */
  supportedFormats(): string[] {
    return this.patterns.map((c) => `${c.carrier}: ${c.hint}`);
  }
}
