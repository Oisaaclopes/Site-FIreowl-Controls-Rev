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
  resolveDistinctDeviceProfiles,
  deviceProfileLabel,
} from './sdaiMaintenance';
import { legacyGroupLabel } from './technicalBase';

/** Campo mínimo consumido pelo adapter (evita depender do React/schema completo). */
export interface FieldLike {
  key: string;
  tipo?: string;
  opcoes?: string[];
  abre_pendencia_se?: string[];
}

/** Opção genérica de select (consumida pelo FormEngine sem saber o significado). */
export interface FieldOption { value: string; label: string }

/** Semântica visual de uma opção (derivada de metadata; NÃO hardcoded no motor). */
export type OptionSemantic = 'normal' | 'alert' | 'neutral';

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
  /** com emptyState: permite entrada manual (texto). */
  manual?: boolean;
  /** Renderizar como controle binário rápido (Sim/Não, Conforme/Não conforme). */
  control?: 'binary';
  /** Cor semântica por opção (verde=normal, laranja=alert, neutro=neutral). */
  optionSemantics?: Record<string, OptionSemantic>;
  /** Grava o valor em OUTRA chave do card (ex.: perfil, sem tocar device_id §13). */
  writeToKey?: string;
}

/* --------------------------- Semântica binária (§2/§3/§4) ------------------ */

// Gates onde "Sim" é a ANORMALIDADE (não têm abre_pendencia_se — a pendência vem
// do detalhe). Override MÍNIMO de domínio; o motor continua genérico.
const ALERT_WHEN_SIM = new Set(['alarme_ativo', 'falha_ativa', 'evento_anormal']);

/** Deriva a semântica das opções a partir de metadata EXISTENTE (abre_pendencia_se)
 *  + override dos gates. Sem metadata → neutro (binário rápido, sem cor). */
function binarySemantics(field: FieldLike): ResolvedField | undefined {
  const opts = field.opcoes || (field.tipo === 'passfail' ? ['Aprovado', 'Reprovado'] : []);
  if (opts.length !== 2) return undefined;
  const alert = new Set<string>(field.abre_pendencia_se && field.abre_pendencia_se.length ? field.abre_pendencia_se : []);
  if (alert.size === 0 && ALERT_WHEN_SIM.has(field.key)) alert.add('Sim');
  const optionSemantics: Record<string, OptionSemantic> = {};
  for (const o of opts) optionSemantics[o] = alert.has(o) ? 'alert' : (alert.size > 0 ? 'normal' : 'neutral');
  return { control: 'binary', optionSemantics };
}

/** Chaves de repeater/campo governadas pela cascata SDAI (mapeamento fica AQUI). */
export const SDAI_REPEATER_FALHAS = 'falhas';
export const SDAI_REPEATER_ALARMES = 'alarmes';
export const SDAI_REPEATER_DESABILITADOS = 'desabilitados';
export const SDAI_REPEATER_BATERIAS = 'baterias';
export const SDAI_REPEATER_LACOS = 'lacos';
export const FALHA_LOOP_KEY = 'laco';
export const FALHA_ADDR_KEY = 'endereco';
export const FALHA_DEVICE_KEY = 'device_id';
export const FALHA_PERFIL_KEY = 'dispositivo_perfil'; // TIPO/MODELO quando não há endereço (§13)
export const FALHA_DIVERGENCIA_KEY = 'divergencia_base'; // perfil ≠ device do endereço (§14)
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
  if (loops.length === 0) return { emptyState: 'Nenhum laço cadastrado na Base para esta central. Informe manualmente.', manual: true };
  if (loops.length === 1) return { options: toOptions(loops), autoValue: loops[0], readonly: true };
  return { options: toOptions(loops) };
}

export function resolveFalhaAddressField(ctx: SdaiCentralContext, loop?: string): ResolvedField {
  const l = (loop || '').trim();
  if (!ctx.central || !l) return {};
  const addrs = resolveLoopAddresses(ctx.central, l, ctx.devices);
  if (addrs.length === 0) return { emptyState: 'Endereço não cadastrado neste laço. Informe manualmente.', manual: true };
  if (addrs.length === 1) return { options: toOptions(addrs), autoValue: addrs[0] };
  return { options: toOptions(addrs) };
}

/**
 * Campo "Dispositivo" da falha (§8–§13). Duas situações:
 *  A) COM endereço e device único → device_id auto/readonly (identidade exata);
 *  B) SEM endereço (ou endereço sem match) → PERFIS DISTINTOS (tipo/modelo) —
 *     grava em `dispositivo_perfil`, NÃO em device_id (§13). Nunca lista os N
 *     devices individuais. Rótulos canônicos (§12).
 */
export function resolveFalhaDeviceField(ctx: SdaiCentralContext, loop?: string, address?: string): ResolvedField {
  if (!ctx.central) return {};
  const l = (loop || '').trim();
  const a = (address || '').trim();
  if (l && a) {
    const dev = resolveDeviceByLoopAddress(ctx.central, l, a, ctx.devices);
    if (dev) return { options: [{ value: dev.id, label: deviceShortLabel(dev) }], autoValue: dev.id, readonly: true };
  }
  // Sem endereço (ou sem match): oferecer TIPO/MODELO distintos — não seta device_id.
  const profiles = resolveDistinctDeviceProfiles(ctx.central, l || undefined, ctx.devices);
  if (profiles.length === 0) return { emptyState: 'Nenhum dispositivo na Base para esta central/laço. Registre manualmente.' };
  return { options: profiles.map((p) => ({ value: p.label, label: p.label })), writeToKey: FALHA_PERFIL_KEY };
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
  if (loops.length === 0) return { emptyState: 'Nenhum laço estruturado na Base. Informe manualmente.', manual: true };
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
  field: FieldLike,
  item: Record<string, unknown> | undefined,
): ResolvedField | undefined {
  const fieldKey = field.key;
  if ([SDAI_REPEATER_FALHAS, SDAI_REPEATER_ALARMES, SDAI_REPEATER_DESABILITADOS].includes(repeaterKey || '')) {
    if (fieldKey === 'base_status') return { readonly: true, autoValue: String(item?.base_status || '') };
    if (fieldKey === FALHA_LOOP_KEY) return resolveFalhaLoopField(ctx);
    if (fieldKey === FALHA_ADDR_KEY) return resolveFalhaAddressField(ctx, item?.[FALHA_LOOP_KEY] as string);
    if (fieldKey === FALHA_DEVICE_KEY) return resolveFalhaDeviceField(ctx, item?.[FALHA_LOOP_KEY] as string, item?.[FALHA_ADDR_KEY] as string);
  }
  if (repeaterKey === SDAI_REPEATER_BATERIAS && fieldKey === BATERIA_DEVICE_KEY) return resolveBatteryDeviceField(ctx);
  if (repeaterKey === SDAI_REPEATER_LACOS && fieldKey === LACO_ID_KEY) return resolveLacoIdField(ctx);
  // Fallback GENÉRICO (todo o template contratual): campos de 2 opções viram
  // controle binário com cor semântica derivada da metadata (§2/§3).
  return binarySemantics(field);
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
  if (![SDAI_REPEATER_FALHAS, SDAI_REPEATER_ALARMES, SDAI_REPEATER_DESABILITADOS].includes(repeaterKey || '')) return undefined;
  if (fieldKey === 'pertence_central') {
    if (newValue === 'Sim' && ctx.central) return {
      [FALHA_DEVICE_KEY]: ctx.central.id,
      codigo: ctx.central.technicalIdentifier || '', local: ctx.central.localizacao || '',
      fabricante: ctx.central.fabricante || '', modelo: ctx.central.modelo || '',
      base_status: 'Central vinculada à Base Técnica',
    };
    return { [FALHA_DEVICE_KEY]: '', codigo: '', local: '', fabricante: '', modelo: '', base_status: '' };
  }
  if (fieldKey === FALHA_LOOP_KEY) {
    // Trocar o laço zera endereço/device e derivados do endereço anterior (§7).
    return { [FALHA_ADDR_KEY]: '', [FALHA_DEVICE_KEY]: '', codigo: '', local: '', [FALHA_PERFIL_KEY]: '', [FALHA_DIVERGENCIA_KEY]: '' };
  }
  if (fieldKey === FALHA_ADDR_KEY) {
    const loop = String(item?.[FALHA_LOOP_KEY] ?? '');
    const addr = String(newValue ?? '');
    const dev = ctx.central && loop && addr ? resolveDeviceByLoopAddress(ctx.central, loop, addr, ctx.devices) : undefined;
    if (dev) {
      // Device do endereço é AUTORITATIVO (§14). Se havia perfil informado que
      // diverge, registra a divergência (não sobrescreve silenciosamente).
      const perfilInformado = String(item?.[FALHA_PERFIL_KEY] ?? '').trim();
      const perfilReal = deviceProfileLabel(dev);
      const divergente = !!perfilInformado && perfilInformado !== perfilReal;
      return {
        [FALHA_DEVICE_KEY]: dev.id,
        codigo: dev.technicalIdentifier || '',
        local: dev.localizacao || '',
        fabricante: dev.fabricante || '',
        modelo: dev.modelo || '',
        base_status: 'Dispositivo vinculado à Base Técnica',
        [FALHA_DIVERGENCIA_KEY]: divergente ? `Perfil informado (${perfilInformado}) difere do dispositivo do endereço (${perfilReal}).` : '',
      };
    }
    return { [FALHA_DEVICE_KEY]: '', codigo: '', local: '', fabricante: '', modelo: '', base_status: 'Dispositivo não localizado na Base Técnica', [FALHA_DIVERGENCIA_KEY]: '' };
  }
  return undefined;
}

/** Laços reais para SEMEAR o repeater de medição (um card por laço). §17. */
export function seedLacoCards(ctx: SdaiCentralContext): Array<{ identificacao: string }> {
  if (!ctx.central) return [];
  return resolveCentralLoops(ctx.central, ctx.devices).map((l) => ({ identificacao: l }));
}
