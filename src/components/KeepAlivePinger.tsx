'use client';

import { useEffect } from 'react';

export function KeepAlivePinger() {
  useEffect(() => {
    // Ping on load
    fetch('/api/keep-alive').catch(() => {});

    // Ping every 4 hours if tab stays open
    const interval = setInterval(() => {
      fetch('/api/keep-alive').catch(() => {});
    }, 4 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
