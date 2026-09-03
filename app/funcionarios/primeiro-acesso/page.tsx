'use client';
import React, { useEffect, useState } from 'react';
import { FirstAccessRequired } from '@/components/FirstAccessRequired';
import { AuthUser, getSessionUser } from '@/lib/auth';

export default function PrimeiroAcessoPage() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  useEffect(() => { getSessionUser().then(setUser).catch(() => setUser(null)); }, []);
  if (user === undefined) return <main className="min-h-[100dvh] bg-navy flex items-center justify-center text-white">Validando sessão...</main>;
  if (!user || user.firstAccessCompleted) return <main className="min-h-[100dvh] bg-navy flex items-center justify-center px-4 text-center text-white">Acesse o Guardian pelo login normal.</main>;
  return <FirstAccessRequired user={user} />;
}
