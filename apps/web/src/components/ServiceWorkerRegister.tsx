'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        (reg) => console.log('✅ SW registrado:', reg.scope),
        (err) => console.log('❌ SW falhou:', err)
      );
    }
  }, []);

  return null;
}