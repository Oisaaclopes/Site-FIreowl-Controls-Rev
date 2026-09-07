/* ===================================================================
 * ADAPTER SDAI DO CHECKLIST — traduz o CONTEXTO da manutenção contratual em
 * resoluções GENÉRICAS de campo para o FormEngine (Rota A). Todo o conhecimento
 * de domínio (Central/Laço/Endereço/Device/Bateria) vive AQUI; o FormEngine só
 * consome `options/autoValue/readonly/emptyState` e aplica patches de item.
 * PURO/testável — sem I/O, sem React.
 * =================================================================== */
import type { Device } from './types';
import {
  resolveCentralLoops,
  resolveLoopAddresses,
  resolveDeviceByLoopAddress,
  resolveCentralBatteries,
} from './sdaiMaintenance';
import { legacyGroupLabel } from './technicalBase';

/** Opção genérica de select (consumida pelo FormEngine sem saber o significado). */
export interface FieldOption { value: string; label: string }

/** Resolução genérica de um campo (contrato com o FormEngine — Rota A). */
export interface ResolvedField {
  /** Opções resolvidas pelo contexto (substituem a lista genérica do catálogo). */
  options?: FieldOption[];
  /** Valor a aplicar automaticamente quando o campo está vazio (determinístico). */
  autoValue?: string;
  /** Apresentar somente leitura (valor determinístico pela Base). */
  readonly?: boolean;
  /** Mensagem quando não há opções na Base — a UI cai para entrada manual. */
  emptyState?: string;
}

/** Chaves de repeater/campo governadas pela cascata SDAI (mapeamento fica AQUI). */
export const SDAI_REPEATER_FALHAS = 'falhas';
export const SDAI_REPEATER_BATERIAS = 'baterias';
export const SDAI_REPEATER_LACOS = 'lacos';
export const FALHA_LOOP_KEY = 'laco';
export const FALHA_ADDR_KEY = 'endereco';
export const FALHA_DEVICE_KEY = 'device_id';
export const BATERIA_DEVICE_KEY = 'device_id';
export const LACO_ID_KEY = 'identificacao';

export interface SdaiCentralContext {
  /** Central selecionada (device_id em values.central_device_id). undefined = não resolvida. */
  central?: Device;
  /** Devices da Base Técnica do cliente (canônicos). Fonte única. */
  devices: Device[];
}

const toOptions = (values: string[]): FieldOption[] => values.map((v) => ({ value: v, label: v }));

/** Rótulo curto e informativo de um device da Base (tipo/grupo · fab modelo · id). */
export function deviceShortLabel(d: Device): string {
  const grupo = legacyGroupLabel('SDAI', d.grupo) || d.tipoAtivo || d.tipoDispositivo || 'Dispositivo';
  const fm = [d.fabricante, d.modelo].filter(Boolean).join(' ');
  const id = d.technicalIdentifier;
  return [grupo, fm, id].filter(Boolean).join(' · ');
}

/* --------------------------- Falha: laço → endereço → device -------------- */

export function resolveFalhaLoopField(ctx: SdaiCentralContext): ResolvedField {
  if (!ctx.central) return { emptyState: 'Selecione a central para resolver os laços.' };
  const loops = resolveCentralLoops(ctx.central, ctx.devices);
  if (loops.length === 0) return { emptyState: 'Nenhum laço cadastrado na Base para esta central. Informe manualmente.' };
  if (loops.length === 1) return { options: toOptions(loops), autoValue: loops[0], readonly: true };
  return { options: toOptions(loops) };
}

export function resolveFalhaAddressField(ctx: SdaiCentralContext, loop?: string): ResolvedField {
  const l = (loop || '').trim();
  if (!ctx.central || !l) return {};
  const addrs = resolveLoopAddresses(ctx.central, l, ctx.devices);
  if (addrs.length === 0) return { emptyState: 'Endereço não cadastrado neste laço. Informe manualmente.' };
  if (addrs.length === 1) return { options: toOptions(addrs), autoValue: addrs[0] };
  return { options: toOptions(addrs) };
}

/** Device resolvido por (central, laço, endereço) — inequívoco → readonly + label. */
export function resolveFalhaDeviceField(ctx: SdaiCentralContext, loop?: string, address?: string): ResolvedField {
  const l = (loop || '').trim();
  const a = (address || '').trim();
  if (!ctx.central || !l || !a) return {};
  const dev = resolveDeviceByLoopAddress(ctx.central, l, a, ctx.devices);
  if (!dev) return { emptyState: 'Dispositivo não identificado na Base para este laço/endereço. Registre manualmente.' };
  return { options: [{ value: dev.id, label: deviceShortLabel(dev) }], autoValue: dev.id, readonly: true };
}

/* --------------------------- Bateria da central --------------------------- */

export function resolveBatteryDeviceField(ctx: SdaiCentralContext): ResolvedField {
  if (!ctx.central) return {};
  const bats = resolveCentralBatteries(ctx.central, ctx.devices);
  if (bats.length === 0) {
    return { emptyState: 'Nenhuma bateria cadastrada na Base Técnica para esta central. Use o catálogo ou informe manualmente.' };
  }
  return { options: bats.map((b) => ({ value: b.id, label: deviceShortLabel(b) })) };
}

/* --------------------------- Laço (medição) ------------------------------- */

export function resolveLacoIdField(ctx: SdaiCentralContext): ResolvedField {
  if (!ctx.central) return {};
  const loops = resolveCentralLoops(ctx.central, ctx.devices);
  if (loops.length === 0) return { emptyState: 'Nenhum laço estruturado na Base. Informe manualmente.' };
  if (loops.length === 1) return { options: toOptions(loops), autoValue: loops[0], readonly: true };
  return { options: toOptions(loops) };
}

/* --------------------------- Dispatch genérico ---------------------------- */

/**
 * Resolução de opções por (repeater, campo). Retorna undefined quando a cascata
 * SDAI não governa o campo — aí o FormEngine usa o comportamento padrão.
 */
export function resolveSdaiFieldOptions(
  ctx: SdaiCentralContext,
  repeaterKey: string | undefined,
  fieldKey: string,
  item: Record<string, unknown> | undefined,
): ResolvedField | undefined {
  if (repeaterKey === SDAI_REPEATER_FALHAS) {
    if (fieldKey === FALHA_LOOP_KEY) return resolveFalhaLoopField(ctx);
    if (fieldKey === FALHA_ADDR_KEY) return resolveFalhaAddressField(ctx, item?.[FALHA_LOOP_KEY] as string);
    if (fieldKey === FALHA_DEVICE_KEY) return resolveFalhaDeviceField(ctx, item?.[FALHA_LOOP_KEY] as string, item?.[FALHA_ADDR_KEY] as string);
    return undefined;
  }
  if (repeaterKey === SDAI_REPEATER_BATERIAS && fieldKey === BATERIA_DEVICE_KEY) return resolveBatteryDeviceField(ctx);
  if (repeaterKey === SDAI_REPEATER_LACOS && fieldKey === LACO_ID_KEY) return resolveLacoIdField(ctx);
  return undefined;
}

/**
 * Patch reativo ao mudar um campo de um card (auto-preenche derivados + RESET de
 * dependências §7). Retorna undefined quando não há efeito. Auto-preenche
 * codigo/local a partir do device resolvido (§5) — valor DEFAULT editável, sem
 * tocar a Base (§8).
 */
export function resolveSdaiItemPatch(
  ctx: SdaiCentralContext,
  repeaterKey: string | undefined,
  fieldKey: string,
  newValue: unknown,
  item: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (repeaterKey !== SDAI_REPEATER_FALHAS) return undefined;
  if (fieldKey === FALHA_LOOP_KEY) {
    // Trocar o laço zera endereço/device e derivados do endereço anterior (§7).
    return { [FALHA_ADDR_KEY]: '', [FALHA_DEVICE_KEY]: '', codigo: '', local: '' };
  }
  if (fieldKey === FALHA_ADDR_KEY) {
    const loop = String(item?.[FALHA_LOOP_KEY] ?? '');
    const addr = String(newValue ?? '');
    const dev = ctx.central && loop && addr ? resolveDeviceByLoopAddress(ctx.central, loop, addr, ctx.devices) : undefined;
    if (dev) return { [FALHA_DEVICE_KEY]: dev.id, codigo: dev.technicalIdentifier || '', local: dev.localizacao || '' };
    return { [FALHA_DEVICE_KEY]: '', codigo: '', local: '' };
  }
  return undefined;
}

/** Laços reais para SEMEAR o repeater de medição (um card por laço). §17. */
export function seedLacoCards(ctx: SdaiCentralContext): Array<{ identificacao: string }> {
  if (!ctx.central) return [];
  return resolveCentralLoops(ctx.central, ctx.devices).map((l) => ({ identificacao: l }));
}
