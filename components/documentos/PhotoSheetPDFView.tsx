'use client';
import dynamic from 'next/dynamic';
// Viewer React-PDF só no cliente (evita SSR do renderer no static export).
export const PhotoSheetPDFView = dynamic(() => import('./PhotoSheetPdfInner'), { ssr: false });
