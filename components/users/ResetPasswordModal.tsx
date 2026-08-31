'use client';

import React, { useState } from 'react';
import { useToast } from '@/components/ui/Feedback';
import { ManagedUser, resetUserPassword } from '@/lib/users';
import { checkPassword, generateStrongPassword, PASSWORD_MIN } from '@/lib/password';

interface Props {
  user: ManagedUser;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = { ATIVO: 'Ativo', INATIVO: 'Inativo', DESLIGADO: 'Desligado' };

export const ResetPasswordModal: React.FC<Props> = ({ user, onClose }) => {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const check = checkPassword(password);
  const matches = password.length > 0 && password === confirm;
  const canSubmit = check.ok && matches && !busy;

  const gerar = () => {
    const pw = generateStrongPassword();
    setPassword(pw);
    setConfirm(pw);
    setShow(true); // mostra para o admin conferir/copiar
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await resetUserPassword(user.id, password);
      setDone(true); // a senha permanece apenas no estado local deste modal
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível redefinir a senha.');
    } finally {
      setBusy(false);
    }
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(password); toast.success('Senha copiada.'); }
    catch { toast.error('Não foi possível copiar. Selecione e copie manualmente.'); }
  };

  const Req = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
    <span className={`inline-flex items-center gap-1 text-[11px] ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>
      <span className="material-symbols-outlined text-sm">{ok ? 'check_circle' : 'radio_button_unchecked'}</span>{children}
    </span>
  );

  const field = 'mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pr-11 text-sm font-mono';

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-bold text-slate-900">Redefinir senha</p>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><span className="material-symbols-outlined">close</span></button>
        </header>

        {done ? (
          <div className="space-y-4 p-5 text-center">
            <span className="material-symbols-outlined rounded-full bg-emerald-100 p-3 text-3xl text-emerald-600">task_alt</span>
            <div>
              <p className="text-base font-bold text-slate-900">Senha redefinida com sucesso.</p>
              <p className="mt-1 text-sm text-slate-500">Informe a nova senha ao usuário por um canal seguro.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="break-all font-mono text-sm text-slate-800">{password}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={copiar} className="min-h-11 flex-1 rounded-xl border border-[#1A1A72] bg-white text-xs font-bold uppercase text-[#1A1A72]">Copiar senha</button>
              <button onClick={onClose} className="min-h-11 flex-1 rounded-xl bg-[#1A1A72] text-xs font-bold uppercase text-white">Concluir</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-900">{user.name || user.email}</p>
                <p className="text-[11px] text-slate-500">{user.email}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Status: {STATUS_LABEL[user.status] || user.status}</p>
              </div>
              {user.status !== 'ATIVO' && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">Redefinir a senha não altera o status — o usuário continua {STATUS_LABEL[user.status]?.toLowerCase()}.</p>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="np" className="text-xs font-bold uppercase text-slate-600">Nova senha</label>
                  <button type="button" onClick={gerar} className="text-[11px] font-bold uppercase text-[#1A1A72]">Gerar senha forte</button>
                </div>
                <div className="relative flex items-center">
                  <input id="np" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={field} />
                  <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-1 flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:text-[#1A1A72]">
                    <span className="material-symbols-outlined text-xl">{show ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="cp" className="text-xs font-bold uppercase text-slate-600">Confirmar nova senha</label>
                <input id="cp" type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={`${field} pr-3`} />
                {confirm.length > 0 && !matches && <p className="mt-1 text-[11px] text-red-600">As senhas não coincidem.</p>}
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <Req ok={check.length}>{PASSWORD_MIN}+ caracteres</Req>
                <Req ok={check.upper}>Maiúscula</Req>
                <Req ok={check.lower}>Minúscula</Req>
                <Req ok={check.digit}>Número</Req>
                <Req ok={check.symbol}>Símbolo</Req>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-200 p-4">
              <button onClick={onClose} className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white text-xs font-bold uppercase text-slate-600">Cancelar</button>
              <button onClick={submit} disabled={!canSubmit} className="min-h-12 flex-[2] rounded-xl bg-[#1A1A72] text-xs font-bold uppercase text-white disabled:opacity-50">
                {busy ? 'Redefinindo…' : 'Redefinir senha'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
