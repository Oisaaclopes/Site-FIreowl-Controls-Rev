'use client';
import dynamic from 'next/dynamic';
export const TimecardPDFView = dynamic(() => import('./TimecardPdfInner'), { ssr: false });
