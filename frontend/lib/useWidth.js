'use client';
import { useEffect, useState } from 'react';

// Inline styles cannot use media queries, so screens read the window width.
export function useWidth() {
  const [w, setW] = useState(1280);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}
