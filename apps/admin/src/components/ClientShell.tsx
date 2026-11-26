'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const DynamicPwaInstallBanner = dynamic(
  () => import('./PwaInstallBanner').then((mod) => mod.PwaInstallBanner),
  { ssr: false }
);

/**
 * ClientShell isolates client-only floating interfaces from server-side
 * prerendering. The AI copilot is mounted by the authenticated page shell so
 * it never appears on the sign-in or session-verification screens.
 */
export function ClientShell() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <>
      <DynamicPwaInstallBanner />
    </>
  );
}
