'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getSupabaseClient } from '../lib/supabaseClient';
import {
  Flame,
  Shield,
  Cctv,
  Fingerprint,
  Cpu,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  Star,
  Menu,
  X,
  Send,
  Building,
  ArrowRight,
  Clock,
  Settings,
  Wrench,
  Plus,
  FileText,
  Users,
  Award,
  ShieldCheck,
  Zap,
  Building2
} from 'lucide-react';

// Official Brand Logo Component from SVG Spec
const OfficialLogo = ({ className = "w-12 h-12", isFooter = false }: { className?: string; isFooter?: boolean }) => (
  <svg 
    viewBox="0 0 503 503" 
    className={className} 
    xmlns="http://www.w3.org/2000/svg" 
    overflow="hidden"
  >
    <g>
      {/* Container is completely transparent - no white background rect */}
      <path d="M49 147.168C49 116.147 74.1471 91 105.168 91L358.832 91C389.853 91 415 116.147 415 147.168L415 371.832C415 402.853 389.853 428 358.832 428L105.168 428C74.1471 428 49 402.853 49 371.832Z" stroke={isFooter ? "#FFFFFF" : "#0C0C0C"} strokeWidth="4.00265" strokeMiterlimit="8" fill={isFooter ? "#13135A" : "#1A1A72"} fillRule="evenodd"/>
      <path d="M107.082 128.023 380.116 128.023 380.358 128.42 380.116 129.808 381.082 130.601 378.427 135.954 375.288 142.299 371.667 149.635 367.804 157.368 363.701 165.498 360.321 172.239 357.665 177.593 354.044 184.73 351.147 190.282 348.009 196.627 347.526 197.024 176.125 197.024 173.228 194.644 171.297 193.256 167.917 190.481 165.986 189.093 164.055 187.506 162.123 186.118 157.778 182.549 155.847 181.161 152.467 178.386 150.536 176.998 147.639 174.817 143.535 171.644 141.121 169.662 139.189 168.273 136.292 165.894 134.361 164.506 131.464 162.127 129.533 160.739 126.395 158.161 124.463 156.773 121.566 154.394 119.635 153.006 117.704 151.42 115.773 150.032 111.91 147.058 107.565 143.489 107.082 142.498Z" stroke={isFooter ? "#FFFFFF" : "#0C0C0C"} strokeWidth="4.00265" strokeMiterlimit="1" fill="#E63946" fillRule="evenodd"/>
      <path d="M105.448 156.05 106.416 156.249 111.252 160.225 113.187 161.616 118.023 165.592 119.958 166.983 126.004 171.953 127.938 173.344 130.84 175.73 132.775 177.121 139.546 182.687 141.481 184.078 145.592 187.259 148.494 189.445 150.428 191.036 152.363 192.427 155.265 194.812 157.2 196.204 161.311 199.385 163.729 201.173 165.664 202.565 166.148 203.161 166.389 231.388 166.389 285.059 166.148 285.655 165.664 285.854 159.618 285.854 153.814 284.86 136.644 281.481 124.795 279.294 111.252 276.71 107.141 275.915 106.174 275.319 105.69 273.728 105.448 270.349 105.206 231.786 104.964 230.593 103.03 231.984 100.853 233.773 98.9189 235.761 96.2586 238.743 93.115 242.719 89.0038 248.284 87.3108 251.266 85.86 254.844 84.8927 259.019 84.8927 262.199 85.6181 265.976 86.8273 269.157 88.7619 272.337 91.1801 275.12 93.3566 277.108 95.0496 278.698 97.7097 280.686 100.612 282.475 104.481 284.463 110.043 286.848 115.847 288.836 121.651 290.426 128.906 292.016 138.095 293.606 146.318 294.6 155.991 295.395 165.664 295.793 179.448 295.793 190.331 295.395 206.049 294.203 218.625 292.811 230.233 291.221 243.05 289.034 256.108 286.45 266.507 284.065 273.762 282.276 282.952 279.692 294.318 276.313 301.089 274.126 307.618 271.741 314.389 269.355 322.37 266.374 329.141 263.789 341.233 258.82 344.618 257.23 348.488 255.639 354.533 252.857 367.35 246.694 371.945 244.309 381.377 239.141 385.246 236.954 388.873 234.966 389.84 234.966 390.082 235.96 388.389 237.749 385.487 240.134 383.553 241.526 380.893 243.514 377.507 245.7 373.638 248.284 370.252 250.471 365.899 253.254 361.788 255.838 357.435 258.422 353.566 260.609 348.971 263.193 343.651 266.175 335.671 270.548 329.867 273.53 322.854 276.909 317.775 279.294 310.037 282.674 305.442 284.661 298.912 287.444 293.108 289.631 289.481 291.022 284.403 293.01 275.938 295.992 266.749 298.974 259.01 301.359 244.501 305.335 238.455 306.925 226.605 309.708 213.305 312.491 206.049 313.882 194.925 315.472 187.671 316.466 177.514 317.46 163.487 318.653 155.991 319.05 142.932 319.05 132.291 318.653 122.86 317.858 113.429 316.864 105.448 315.671 101.821 314.677 97.4678 313.286 93.5985 312.491 85.3762 309.708 79.3304 307.322 75.4612 305.335 72.5592 303.545 69.4156 301.359 65.788 298.377 62.8861 294.998 60.226 290.824 58.5332 287.047 57.324 282.276 57.0822 280.686 57.0822 276.71 58.2914 270.945 60.226 266.175 62.4025 262.199 65.5461 257.826 68.4481 254.447 71.5919 251.266 73.5265 249.278 75.9449 247.092 77.6377 245.502 83.6835 240.532 85.6181 239.141 88.52 236.954 91.6639 234.767 99.8862 229.599 103.514 227.413 105.206 226.419ZM104.723 227.81 104.481 228.605 104.964 228.605Z" stroke={isFooter ? "#FFFFFF" : "#0C0C0C"} strokeWidth="4.00265" strokeMiterlimit="1" fill="#E63946" fillRule="evenodd"/>
      <path d="M176.153 206.099 207.881 206.099 287.08 206.298 339.152 206.298 338.91 208.089 339.152 209.482 338.91 211.87 330.433 225.801 325.589 234.955 322.199 241.323 319.292 247.094 315.417 254.656 311.058 263.014 308.151 268.786 307.424 269.383 297.494 269.781 277.876 270.378 258.742 271.174 240.578 271.771 220.959 272.567 218.295 272.567 218.295 282.517 218.053 284.507 217.811 284.706 197.95 285.502 179.059 286.099 176.637 286.099 176.395 285.104 176.153 281.124Z" stroke={isFooter ? "#FFFFFF" : "#0C0C0C"} strokeWidth="4.00265" strokeMiterlimit="1" fill="#E63946" fillRule="evenodd"/>
      <path d="M216.992 319.209 218.186 319.409 216.276 322.202 214.844 323.798 208.876 328.786 206.967 330.182 204.341 332.177 201.715 333.973 198.851 335.968 194.793 338.562 190.496 341.355 186.438 344.148 183.335 346.343 179.992 348.937 178.083 350.333 175.457 352.328 173.547 353.725 170.205 356.119 164.954 359.71 161.851 361.905 159.225 363.701 157.554 365.097 155.644 366.494 152.064 369.088 149.676 370.883 147.767 372.28 144.425 374.674 142.038 376.47 140.128 377.866 137.741 379.662 135.115 381.457 132.967 383.253 131.057 384.65 127.954 387.044 122.702 390.635 118.883 393.229 116.257 395.024 112.915 397.418 109.335 400.012 107.664 401.209 107.425 401.209 107.186 395.623 107.186 388.64 107.664 349.934 107.902 334.971 108.141 328.187 108.857 327.988 121.031 328.586 136.547 328.586 146.096 328.187 157.315 327.589 173.309 326.192 186.676 324.596 195.986 323.199 208.399 321.005Z" stroke={isFooter ? "#FFFFFF" : "#0C0C0C"} strokeWidth="4.00265" strokeMiterlimit="1" fill="#E63946" fillRule="evenodd"/>
    </g>
  </svg>
);

// Vector animations stylesheet for pure keyframe animations without heavy GIFs/Video loads
const VectorAnimationsStyle = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    @keyframes smoke-rise-1 {
      0% { transform: translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
      20% { opacity: 0.5; }
      80% { opacity: 0.3; }
      100% { transform: translateY(-30px) scale(1.3) rotate(15deg); opacity: 0; }
    }
    @keyframes smoke-rise-2 {
      0% { transform: translateY(0) scale(0.5) rotate(0deg); opacity: 0; }
      15% { opacity: 0.4; }
      75% { opacity: 0.2; }
      100% { transform: translateY(-35px) scale(1.4) rotate(-20deg); opacity: 0; }
    }
    @keyframes laser-sweep {
      0%, 100% { transform: translateY(-12px); opacity: 0.9; }
      50% { transform: translateY(18px); opacity: 0.9; }
    }
    @keyframes camera-scan {
      0%, 100% { transform: rotate(-22deg); }
      50% { transform: rotate(22deg); }
    }
    @keyframes camera-scan-auto {
      0%, 100% { transform: rotate(0deg); }
      30% { transform: rotate(-20deg); }
      70% { transform: rotate(20deg); }
    }
    @keyframes fire-led-blink {
      0%, 100% { fill: #E63946; filter: drop-shadow(0 0 2px #E63946); }
      50% { fill: #5b0e2d; filter: none; }
    }
    @keyframes custom-bms-blink-red {
      0%, 100% { fill: #ef4444; filter: drop-shadow(0 0 1px #ef4444); opacity: 1; }
      50% { fill: #3f0f12; filter: none; opacity: 0.4; }
    }
    @keyframes custom-bms-blink-green {
      0%, 100% { fill: #10b981; filter: drop-shadow(0 0 1px #10b981); opacity: 1; }
      50% { fill: #062f1c; filter: none; opacity: 0.4; }
    }
    @keyframes connection-flow {
      to {
        stroke-dashoffset: 0;
      }
    }
    @keyframes fan-rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes signal-wave {
      0% { transform: scale(0.1); opacity: 0.9; }
      100% { transform: scale(1.8); opacity: 0; }
    }
    @keyframes padlock-pop {
      0% { transform: scale(1); }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); }
    }
    @keyframes scan-glow {
      0%, 100% { border-color: rgba(34, 211, 238, 0.2); box-shadow: none; }
      50% { border-color: rgba(34, 211, 238, 0.8); box-shadow: 0 0 12px rgba(34, 211, 238, 0.4); }
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background-color: #2ECC71;
      border-radius: 50%;
      display: inline-block;
      margin-right: 8px;
      box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.7);
      animation: pulse-dot 2s infinite;
    }
    @keyframes pulse-dot {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(46, 204, 113, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(46, 204, 113, 0); }
    }
  `}} />
);

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);
  return reduced;
};

const useIntersection = (elementRef: React.RefObject<Element | null>) => {
  const [isVisible, setIsVisible] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !elementRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, { threshold: 0.1 });
    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [elementRef]);
  return isVisible;
};

const SmokeDetectorCard = ({ isActive, onClick }: { isActive: boolean; onClick: () => void }) => {
  const containerRef = React.useRef<HTMLButtonElement>(null);
  const isInViewport = useIntersection(containerRef);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isHovered, setIsHovered] = React.useState(false);
  const [showOverlay, setShowOverlay] = React.useState(false);
  const [isMobileTriggered, setIsMobileTriggered] = React.useState(false);
  const [isHighlighted, setIsHighlighted] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!prefersReducedMotion) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setShowOverlay(true);
      }, 1000);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowOverlay(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsHovered(true);
    setIsMobileTriggered(true);

    const animationTimer = setTimeout(() => {
      setIsHighlighted(true);
      const highlightTimer = setTimeout(() => {
        setIsHighlighted(false);
        onClick();
        setIsMobileTriggered(false);
        setIsHovered(false);
      }, 200);
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const animate = (isHovered || isMobileTriggered || isActive) && isInViewport && !prefersReducedMotion;

  return (
    <button
      ref={containerRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      aria-label="Ver mais sobre Sistemas SDAI e Alarmes de Incêndio"
      className={`relative w-full h-[22rem] rounded-2xl border-2 p-6 flex flex-col justify-between overflow-hidden text-left transition-all duration-300 group select-none ${
        isActive 
          ? 'border-primary-blue bg-white shadow-xl shadow-primary-blue/10 scale-[1.03]' 
          : 'border-slate-100 bg-white hover:border-primary-blue/30 hover:shadow-lg hover:-translate-y-1'
      } ${isHighlighted ? 'ring-4 ring-action-red/30' : ''}`}
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(26,26,114,0.04) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
        touchAction: 'manipulation'
      }}
    >
      {/* Wave Signal effect expanding from center */}
      {animate && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full border-2 border-action-red/30 absolute" style={{ animation: 'signal-wave 1.6s infinite ease-out' }} />
          <div className="w-12 h-12 rounded-full border-2 border-action-red/10 absolute" style={{ animation: 'signal-wave 1.6s infinite ease-out 0.8s' }} />
        </div>
      )}

      {/* Top Section: Client style status header */}
      <div className="flex items-center justify-between w-full relative z-10">
        <span className="text-[11px] sm:text-[12px] font-mono uppercase tracking-wider text-action-red bg-red-50 px-2.5 py-1 rounded font-bold">
          {animate ? 'AÇÃO ATIVA' : 'SISTEMA SDAI'}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${animate ? 'bg-action-red animate-pulse shadow-[0_0_6px_#E63946]' : 'bg-gray-300'}`} />
          <span className="text-[11px] sm:text-[12px] font-bold text-gray-400 uppercase font-mono">{animate ? 'DETECÇÃO' : 'STANDBY'}</span>
        </div>
      </div>

      {/* Center Interactive Illustration */}
      <div className="grow flex flex-col items-center justify-center relative w-full pt-4">
        {/* Smoke particles rising in front of sensor */}
        {animate && (
          <div className="absolute bottom-[60%] left-0 right-0 h-16 pointer-events-none overflow-visible flex justify-center">
            <span className="w-3 h-3 bg-gray-400/25 rounded-full blur-[1px] absolute bottom-0 left-[42%]" style={{ animation: 'smoke-rise-1 1.4s infinite ease-out' }} />
            <span className="w-4 h-4 bg-gray-500/20 rounded-full blur-[1.5px] absolute bottom-1 left-[50%]" style={{ animation: 'smoke-rise-2 1.8s infinite ease-out 0.3s' }} />
            <span className="w-2.5 h-2.5 bg-gray-400/20 rounded-full blur-[1px] absolute bottom-0 left-[56%]" style={{ animation: 'smoke-rise-1 1.2s infinite ease-out 0.6s' }} />
          </div>
        )}

        {/* Clean, recognizable circular smoke detector (visto de baixo), Opção A */}
        <svg viewBox="0 0 100 100" className="w-24 h-24 text-primary-blue relative overflow-visible" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Subtle rising smoke path lines */}
          <g className={animate ? "animate-pulse" : "opacity-75"} style={{ animationDuration: '2s' }}>
            <path d="M38 25 C35 18, 43 10, 40 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-slate-400 opacity-20" />
            <path d="M50 18 C47 11, 55 5, 52 -2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-slate-400 opacity-25" />
            <path d="M62 25 C59 18, 67 10, 64 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-slate-400 opacity-20" />
          </g>

          {/* Outer Ring */}
          <circle cx="50" cy="55" r="32" stroke="currentColor" strokeWidth="3" className="text-primary-blue/30" fill="currentColor" fillOpacity="0.02" />
          {/* Inner ring for radial slits */}
          <circle cx="50" cy="55" r="23" stroke="currentColor" strokeWidth="2.5" className="text-primary-blue/20" />

          {/* Radial vents / cuts characteristic of smoke detectors */}
          <line x1="32" y1="37" x2="38" y2="43" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="68" y1="37" x2="62" y2="43" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="32" y1="73" x2="38" y2="67" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="68" y1="73" x2="62" y2="67" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="24" y1="55" x2="32" y2="55" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="76" y1="55" x2="68" y2="55" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />

          {/* Central Dome */}
          <circle cx="50" cy="55" r="12" fill="white" stroke="currentColor" strokeWidth="2.5" />

          {/* Center LED point with glow effect */}
          <circle 
            cx="50" 
            cy="55" 
            r="4.5" 
            style={{ 
              animation: animate ? 'fire-led-blink 0.8s infinite' : 'none',
              fill: animate ? '#ef4444' : '#9ca3af',
              opacity: animate ? 1 : 0.4
            }} 
            className={animate ? "drop-shadow-[0_0_6px_rgba(239,68,68,0.85)]" : ""}
          />
        </svg>

        {/* Small Central de Alarme Mockup in corner of center view */}
        <div className="absolute right-2 bottom-2 bg-slate-900 border border-slate-800 p-1.5 rounded-lg w-12 h-12 flex flex-col justify-between shadow-md">
          <div className="flex justify-between items-center">
            <span className="text-[6px] text-gray-500 font-mono font-bold">CNTRL</span>
            <span className={`w-1.5 h-1.5 rounded-full ${animate ? 'bg-action-red animate-ping' : 'bg-green-500'}`} />
          </div>
          <div className="h-1 bg-slate-800 rounded overflow-hidden">
            <div className={`h-full ${animate ? 'w-full bg-action-red' : 'w-1/3 bg-[#1A1A72]'} transition-all`} />
          </div>
          <div className="flex gap-0.5 justify-center">
            <span className={`w-1.5 h-1 rounded-[1px] ${animate ? 'bg-red-500' : 'bg-slate-700'}`} />
            <span className={`w-1.5 h-1 rounded-[1px] ${animate ? 'bg-red-500' : 'bg-slate-700'}`} />
            <span className="w-1.5 h-1 bg-slate-700 rounded-[1px]" />
          </div>
        </div>
      </div>

      {/* Bottom Section: Title */}
      <div className="w-full relative z-10 pt-4 border-t border-slate-100 flex items-center justify-between">
        <div>
          <h4 className="text-base xs:text-lg sm:text-[19px] font-extrabold text-primary-blue font-display leading-tight">
            Alarmes de Incêndio
          </h4>
          <span className="text-[11px] xs:text-[12px] sm:text-[13px] text-gray-500 font-semibold block mt-1 uppercase tracking-wider">Sistemas SDAI</span>
        </div>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
          isActive ? 'bg-primary-blue text-white' : 'bg-slate-50 text-gray-400 group-hover:bg-primary-blue group-hover:text-white'
        }`}>
          <Plus className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Persistence 1s Overlays for desktop/touch */}
      <AnimatePresence>
        {(showOverlay || (prefersReducedMotion && (isHovered || isActive))) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: prefersReducedMotion ? 0.15 : 0.25 }}
            className="absolute inset-0 bg-[#1A1A72]/95 text-white p-6 flex flex-col justify-between z-20"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-[#FFD700] uppercase tracking-wider font-extrabold">Sistemas Auxiliares</span>
              <span className="w-2 h-2 rounded-full bg-action-red animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-extrabold font-display leading-snug">
                Detecção em segundos.<br />Resposta imediata.
              </p>
              <span className="text-[10px] text-[#FFD700] font-sans font-bold uppercase tracking-wider block">Ver Engenharia Completa →</span>
            </div>
            <div className="text-[9px] text-[#DDDDDD] font-mono border-t border-white/10 pt-2 text-center">
              Clique para abrir especificações técnicas
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

const CFTVCard = ({ isActive, onClick }: { isActive: boolean; onClick: () => void }) => {
  const containerRef = React.useRef<HTMLButtonElement>(null);
  const isInViewport = useIntersection(containerRef);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isHovered, setIsHovered] = React.useState(false);
  const [showOverlay, setShowOverlay] = React.useState(false);
  const [isMobileTriggered, setIsMobileTriggered] = React.useState(false);
  const [isHighlighted, setIsHighlighted] = React.useState(false);
  const [mousePos, setMousePos] = React.useState({ x: 0.5, y: 0.5 });
  const [angle, setAngle] = React.useState(0);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!prefersReducedMotion) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setShowOverlay(true);
      }, 1000);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowOverlay(false);
    setAngle(0);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsHovered(true);
    setIsMobileTriggered(true);

    const animationTimer = setTimeout(() => {
      setIsHighlighted(true);
      const highlightTimer = setTimeout(() => {
        setIsHighlighted(false);
        onClick();
        setIsMobileTriggered(false);
        setIsHovered(false);
      }, 200);
    }, 1200);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMousePos({ x, y });

    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const targetDeg = (Math.atan2(dy, dx) * 180) / Math.PI - 90;
    const constrained = Math.max(-15, Math.min(15, targetDeg));
    setAngle(constrained);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const animate = (isHovered || isMobileTriggered || isActive) && isInViewport && !prefersReducedMotion;

  const vfX = mousePos.x * 100;
  const vfY = mousePos.y * 100;

  return (
    <button
      ref={containerRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      aria-label="Ver mais sobre CFTV Inteligente e IA Corporativa"
      className={`relative w-full h-[22rem] rounded-2xl border-2 p-6 flex flex-col justify-between overflow-hidden text-left transition-all duration-300 group select-none ${
        isActive 
          ? 'border-primary-blue bg-white shadow-xl shadow-primary-blue/10 scale-[1.03]' 
          : 'border-slate-100 bg-white hover:border-primary-blue/30 hover:shadow-lg hover:-translate-y-1'
      } ${isHighlighted ? 'ring-4 ring-action-red/30' : ''}`}
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(230,57,70,0.02) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
        touchAction: 'manipulation'
      }}
    >
      {/* Laser concentric circles matching camera infrared sweeps */}
      {animate && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <svg className="w-full h-full text-action-red/10 animate-pulse" viewBox="0 0 100 100" preserveAspectRatio="none">
            <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </svg>
        </div>
      )}

      {/* Floating active Viewfinder bracket following cursor position */}
      {animate && !isMobileTriggered && (
        <div 
          className="absolute w-12 h-12 pointer-events-none z-10 transition-all duration-300 ease-out flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${vfX}%`, top: `${vfY}%` }}
        >
          <div className="absolute inset-0 border-t-2 border-l-2 border-[#FFD700] w-3 h-3 left-0 top-0" />
          <div className="absolute inset-0 border-t-2 border-r-2 border-[#FFD700] w-3 h-3 right-0 top-0" />
          <div className="absolute inset-0 border-b-2 border-l-2 border-[#FFD700] w-3 h-3 left-0 bottom-0" />
          <div className="absolute inset-0 border-b-2 border-r-2 border-[#FFD700] w-3 h-3 right-0 bottom-0" />
          <span className="block w-1.5 h-1.5 rounded-full bg-action-red animate-ping" />
        </div>
      )}

      {/* Top Section: Status panel */}
      <div className="flex items-center justify-between w-full relative z-10">
        <span className="text-[11px] sm:text-[12px] font-mono uppercase tracking-wider text-primary-blue bg-blue-50 px-2.5 py-1 rounded font-bold">
          CFTV INTELIGENTE
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${animate ? 'bg-action-red animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-[11px] sm:text-[12px] font-bold text-gray-500 uppercase font-mono tracking-wider">
            {animate ? 'REC ●' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Center Camera Drawing */}
      <div className="grow flex flex-col items-center justify-center relative w-full pt-4">
        <div 
          style={{ 
            transform: `rotate(${animate ? (isMobileTriggered ? undefined : angle) : 0}deg)`,
            animation: animate && isMobileTriggered ? 'camera-scan-auto 1.2s ease-in-out' : 'none',
            transition: 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          className="origin-[50px_35px] relative"
        >
          <svg viewBox="0 0 100 100" className="w-24 h-24 text-primary-blue" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M25 35 L45 35 C45 35, 47 48, 62 48 L78 48" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-gray-400" />
            <path d="M25 25 L25 45" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" className="text-gray-400" />
            
            <circle cx="50" cy="35" r="7" fill="white" stroke="currentColor" strokeWidth="3" />
            
            <rect x="35" y="35" width="30" height="20" rx="4" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="3" />
            <path d="M28 32 L72 32 L64 36 L28 36 Z" fill="currentColor" stroke="currentColor" strokeWidth="2" />
            
            <circle cx="50" cy="45" r="3.5" fill="#E63946" className={animate ? 'animate-pulse' : 'text-gray-400'} />
            <circle cx="42" cy="41" r="1.5" fill={animate ? '#E63946' : '#9ca3af'} />
            <circle cx="58" cy="41" r="1.5" fill={animate ? '#E63946' : '#9ca3af'} />
          </svg>
        </div>
      </div>

      {/* Bottom Section: Title */}
      <div className="w-full relative z-10 pt-4 border-t border-slate-100 flex items-center justify-between">
        <div>
          <h4 className="text-base xs:text-lg sm:text-[19px] font-extrabold text-primary-blue font-display leading-tight">
            CFTV Inteligente
          </h4>
          <span className="text-[11px] xs:text-[12px] sm:text-[13px] text-gray-500 font-semibold block mt-1 uppercase tracking-wider">IA Corporativa</span>
        </div>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
          isActive ? 'bg-primary-blue text-white' : 'bg-slate-50 text-gray-400 group-hover:bg-primary-blue group-hover:text-white'
        }`}>
          <Plus className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Overlays for desktop/touch */}
      <AnimatePresence>
        {(showOverlay || (prefersReducedMotion && (isHovered || isActive))) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: prefersReducedMotion ? 0.15 : 0.25 }}
            className="absolute inset-0 bg-[#1A1A72]/95 text-white p-6 flex flex-col justify-between z-20"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-[#FFD700] uppercase tracking-wider font-extrabold">Monitoramento IA</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-extrabold font-display leading-snug">
                Monitoramento contínuo,<br />onde e quando você precisar.
              </p>
              <span className="text-[10px] text-[#FFD700] font-sans font-bold uppercase tracking-wider block">Ver Detalhes do VMS →</span>
            </div>
            <div className="text-[9px] text-[#DDDDDD] font-mono border-t border-white/10 pt-2 text-center">
              Clique para abrir especificações técnicas
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

const AccessControlCard = ({ isActive, onClick }: { isActive: boolean; onClick: () => void }) => {
  const containerRef = React.useRef<HTMLButtonElement>(null);
  const isInViewport = useIntersection(containerRef);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isHovered, setIsHovered] = React.useState(false);
  const [showOverlay, setShowOverlay] = React.useState(false);
  const [isMobileTriggered, setIsMobileTriggered] = React.useState(false);
  const [isHighlighted, setIsHighlighted] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!prefersReducedMotion) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setShowOverlay(true);
      }, 1000);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowOverlay(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsHovered(true);
    setIsMobileTriggered(true);

    const animationTimer = setTimeout(() => {
      setIsHighlighted(true);
      const highlightTimer = setTimeout(() => {
        setIsHighlighted(false);
        onClick();
        setIsMobileTriggered(false);
        setIsHovered(false);
      }, 200);
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const animate = (isHovered || isMobileTriggered || isActive) && isInViewport && !prefersReducedMotion;

  return (
    <button
      ref={containerRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      aria-label="Ver mais sobre Controle de Acesso de Alta Segurança"
      className={`relative w-full h-[22rem] rounded-2xl border-2 p-6 flex flex-col justify-between overflow-hidden text-left transition-all duration-300 group select-none ${
        isActive 
          ? 'border-primary-blue bg-white shadow-xl shadow-primary-blue/10 scale-[1.03]' 
          : 'border-slate-100 bg-white hover:border-primary-blue/30 hover:shadow-lg hover:-translate-y-1'
      } ${isHighlighted ? 'ring-4 ring-action-red/30' : ''}`}
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(16,185,129,0.02) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
        touchAction: 'manipulation'
      }}
    >
      {/* Target framing HUD lines on scanner area */}
      {animate && (
        <div className="absolute inset-0 pointer-events-none p-4 opacity-30">
          <div className="w-full h-full border border-[#2ecc71]/20 rounded-lg animate-pulse" style={{ animationDuration: '2s' }} />
        </div>
      )}

      {/* Top Section: Status */}
      <div className="flex items-center justify-between w-full relative z-10">
        <span className="text-[11px] sm:text-[12px] font-mono uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded font-bold">
          CONTR. DE ACESSO
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${animate ? 'bg-[#2ECC71] shadow-[0_0_6px_#2ECC71]' : 'bg-action-red shadow-[0_0_6px_#E63946]'}`} />
          <span className="text-[11px] sm:text-[12px] font-bold text-gray-500 uppercase font-mono tracking-wider">
            {animate ? 'LIBERADO' : 'BLOQUEADO'}
          </span>
        </div>
      </div>

      {/* Center Scanner Terminal view */}
      <div className="grow flex flex-col items-center justify-center relative w-full pt-4">
        {/* Laser line sweeper */}
        {animate && (
          <div 
            className="absolute left-[20%] right-[20%] h-0.5 bg-cyan-400 shadow-[0_0_6px_#22d3ee,0_0_12px_#06b6d4] pointer-events-none z-10"
            style={{ animation: 'laser-sweep 1.8s infinite ease-in-out', top: '40%' }}
          />
        )}

        {/* Hand Approaching card animation */}
        {animate && (
          <div className="absolute bottom-1 right-2 w-14 h-14 pointer-events-none z-10 transition-all duration-700 transform translate-x-1 translate-y-1 group-hover:-translate-x-3 group-hover:-translate-y-3">
            <svg viewBox="0 0 48 48" className="w-full h-full text-blue-500" fill="currentColor">
              <rect x="6" y="10" width="36" height="26" rx="3" fill="#1d4ed8" stroke="white" strokeWidth="1.5" />
              <circle cx="14" cy="23" r="3" fill="#FFD700" />
              <path d="M22 20 L38 20 M22 26 L34 26" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        )}

        {/* biometric fingerprint panel */}
        <div className={`p-4 rounded-2xl border-2 transition-all ${animate ? 'border-[#2ecc71]' : 'border-slate-100'} bg-slate-50 relative flex items-center justify-center`}>
          <svg viewBox="0 0 100 100" className={`w-16 h-16 ${animate ? 'text-[#2ecc71] scale-105' : 'text-gray-400'} transition-all`} fill="none" xmlns="http://www.w3.org/2000/svg">
            <g stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M25 75 C25 45, 75 45, 75 75" strokeOpacity={animate ? "1" : "0.5"} />
              <path d="M35 75 C35 55, 65 55, 65 75" strokeOpacity={animate ? "1" : "0.7"} />
              <path d="M45 75 C45 63, 55 63, 55 75" strokeOpacity={animate ? "0.9" : "0.85"} />
              <line x1="50" y1="75" x2="50" y2="70" strokeOpacity={animate ? "1" : "0.9"} />
            </g>
          </svg>

          {/* Secure Padlock overlaid graphic */}
          <div className="absolute -right-2 -bottom-2 bg-white rounded-xl shadow-md border p-1 rounded-full text-primary-blue transition-transform" style={{ animation: animate ? 'padlock-pop 0.6s ease-out' : 'none' }}>
            {animate ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#2ECC71]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-action-red" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Title */}
      <div className="w-full relative z-10 pt-4 border-t border-slate-100 flex items-center justify-between">
        <div>
          <h4 className="text-base xs:text-lg sm:text-[19px] font-extrabold text-primary-blue font-display leading-tight">
            Controle de Acesso
          </h4>
          <span className="text-[11px] xs:text-[12px] sm:text-[13px] text-gray-500 font-semibold block mt-1 uppercase tracking-wider">Altíssima Segurança</span>
        </div>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
          isActive ? 'bg-primary-blue text-white' : 'bg-slate-50 text-gray-400 group-hover:bg-primary-blue group-hover:text-white'
        }`}>
          <Plus className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Overlays for desktop/touch */}
      <AnimatePresence>
        {(showOverlay || (prefersReducedMotion && (isHovered || isActive))) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: prefersReducedMotion ? 0.15 : 0.25 }}
            className="absolute inset-0 bg-[#1A1A72]/95 text-white p-6 flex flex-col justify-between z-20"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-[#FFD700] uppercase tracking-wider font-extrabold">Fluxo e Segurança</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-extrabold font-display leading-snug">
                Quem entra, como entra,<br />quando entra. Você decide.
              </p>
              <span className="text-[10px] text-[#FFD700] font-sans font-bold uppercase tracking-wider block">Ver Biometria Facial 3D →</span>
            </div>
            <div className="text-[9px] text-[#DDDDDD] font-mono border-t border-white/10 pt-2 text-center">
              Clique para abrir especificações técnicas
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

const BMSCard = ({ isActive, onClick }: { isActive: boolean; onClick: () => void }) => {
  const containerRef = React.useRef<HTMLButtonElement>(null);
  const isInViewport = useIntersection(containerRef);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isHovered, setIsHovered] = React.useState(false);
  const [showOverlay, setShowOverlay] = React.useState(false);
  const [isMobileTriggered, setIsMobileTriggered] = React.useState(false);
  const [isHighlighted, setIsHighlighted] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!prefersReducedMotion) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setShowOverlay(true);
      }, 1000);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowOverlay(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsHovered(true);
    setIsMobileTriggered(true);

    const animationTimer = setTimeout(() => {
      setIsHighlighted(true);
      const highlightTimer = setTimeout(() => {
        setIsHighlighted(false);
        onClick();
        setIsMobileTriggered(false);
        setIsHovered(false);
      }, 200);
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const animate = (isHovered || isMobileTriggered || isActive) && isInViewport && !prefersReducedMotion;

  return (
    <button
      ref={containerRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      aria-label="Ver mais sobre Automação Predial e BMS"
      className={`relative w-full h-[22rem] rounded-2xl border-2 p-6 flex flex-col justify-between overflow-hidden text-left transition-all duration-300 group select-none ${
        isActive 
          ? 'border-primary-blue bg-white shadow-xl shadow-primary-blue/10 scale-[1.03]' 
          : 'border-slate-100 bg-white hover:border-primary-blue/30 hover:shadow-lg hover:-translate-y-1'
      } ${isHighlighted ? 'ring-4 ring-action-red/30' : ''}`}
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,215,0,0.02) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
        touchAction: 'manipulation'
      }}
    >
      {/* Top Section: Status */}
      <div className="flex items-center justify-between w-full relative z-10">
        <span className="text-[11px] sm:text-[12px] font-mono uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded font-bold">
          AUTOMAÇÃO & BMS
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${animate ? 'bg-amber-500 shadow-[0_0_6px_#FFD700]' : 'bg-gray-400'}`} />
          <span className="text-[11px] sm:text-[12px] font-bold text-gray-500 uppercase font-mono tracking-wider">
            {animate ? 'INTEGRADO' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Center Grid Controls Viewport */}
      <div className="grow flex items-center justify-center relative w-full pt-4">
        {/* Connection SVGs linking the panels */}
        {animate && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-32 h-32 text-[#1A1A72]/20">
              <line x1="20" y1="20" x2="50" y2="50" stroke="currentColor" strokeWidth="1.5" strokeDasharray="100" strokeDashoffset="100" style={{ animation: 'connection-flow 0.8s forwards' }} />
              <line x1="80" y1="20" x2="50" y2="50" stroke="currentColor" strokeWidth="1.5" strokeDasharray="100" strokeDashoffset="100" style={{ animation: 'connection-flow 0.8s forwards 0.15s' }} />
              <line x1="20" y1="80" x2="50" y2="50" stroke="currentColor" strokeWidth="1.5" strokeDasharray="100" strokeDashoffset="100" style={{ animation: 'connection-flow 0.8s forwards 0.3s' }} />
              <line x1="80" y1="80" x2="50" y2="50" stroke="currentColor" strokeWidth="1.5" strokeDasharray="100" strokeDashoffset="100" style={{ animation: 'connection-flow 0.8s forwards 0.45s' }} />
            </svg>
          </div>
        )}

        {/* 2x2 modular matrix representing indicators */}
        <div className="grid grid-cols-2 gap-8 relative z-10">
          
          {/* Indicator 1: Luz - Warn Yellow (Top-Left) */}
          <div 
            className={`w-11 h-11 rounded-xl bg-white border border-gray-150 flex items-center justify-center shadow-sm transition-all duration-300 ${
              animate ? 'text-amber-500 scale-105 border-amber-300 shadow-amber-100/50' : 'text-gray-300'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .5 2.5 1.5 3.5.7.8 1.3 1.5 1.5 2.5" />
              <line x1="9" y1="18" x2="15" y2="18" />
              <line x1="10" y1="22" x2="14" y2="22" />
            </svg>
          </div>

          {/* Indicator 2: HVAC - Primary Blue (Top-Right) */}
          <div 
            className={`w-11 h-11 rounded-xl bg-white border border-gray-150 flex items-center justify-center shadow-sm transition-all duration-300 ${
              animate ? 'text-blue-600 scale-105 border-blue-300' : 'text-gray-300'
            }`}
          >
            <svg 
              viewBox="0 0 24 24" 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ animation: animate ? 'fan-rotate 1.5s infinite linear' : 'none' }}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2 a10 10 0 0 1 10 10 M12 12 l4 4 M12 12 l-4 -4" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>

          {/* Indicator 3: Alarme - Red Pulse (Bottom-Left) */}
          <div 
            className={`w-11 h-11 rounded-xl bg-white border border-gray-150 flex items-center justify-center shadow-sm transition-all duration-300 ${
              animate ? 'text-action-red scale-105 border-red-300 animate-pulse' : 'text-gray-300'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>

          {/* Indicator 4: Acesso - Success Green (Bottom-Right) */}
          <div 
            className={`w-11 h-11 rounded-xl bg-white border border-gray-150 flex items-center justify-center shadow-sm transition-all duration-300 ${
              animate ? 'text-[#2ecc71] scale-105 border-emerald-300' : 'text-gray-300'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

        </div>

        {/* Centralised hub pulse icon */}
        {animate && (
          <div className="absolute w-8 h-8 rounded-full bg-[#1A1A72]/10 border border-[#1A1A72]/30 flex items-center justify-center animate-ping" style={{ animationDuration: '2s' }}>
            <span className="w-2.5 h-2.5 bg-[#1A1A72] rounded-full" />
          </div>
        )}
      </div>

      {/* Bottom Section: Title */}
      <div className="w-full relative z-10 pt-4 border-t border-slate-100 flex items-center justify-between">
        <div>
          <h4 className="text-base xs:text-lg sm:text-[19px] font-extrabold text-primary-blue font-display leading-tight">
            Automação Predial (BMS)
          </h4>
          <span className="text-[11px] xs:text-[12px] sm:text-[13px] text-gray-500 font-semibold block mt-1 uppercase tracking-wider">Eficiência Predial</span>
        </div>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
          isActive ? 'bg-primary-blue text-white' : 'bg-slate-50 text-gray-400 group-hover:bg-primary-blue group-hover:text-white'
        }`}>
          <Plus className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Overlays for desktop/touch */}
      <AnimatePresence>
        {(showOverlay || (prefersReducedMotion && (isHovered || isActive))) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: prefersReducedMotion ? 0.15 : 0.25 }}
            className="absolute inset-0 bg-[#1A1A72]/95 text-white p-6 flex flex-col justify-between z-20"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-[#FFD700] uppercase tracking-wider font-extrabold">Controle Integrado</span>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-extrabold font-display leading-snug">
                Tudo integrado. Tudo sob controle,<br />de qualquer lugar.
              </p>
              <span className="text-[10px] text-[#FFD700] font-sans font-bold uppercase tracking-wider block">Ver BACnet e Modbus →</span>
            </div>
            <div className="text-[9px] text-[#DDDDDD] font-mono border-t border-white/10 pt-2 text-center">
              Clique para abrir especificações técnicas
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

// Solution Details for the verticals
interface ServiceDetail {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  specs: string[];
  certifications: string[];
  description: string;
  benefits: string[];
}

// Counts up numbers dynamically when they enter the viewport
const CounterUp = ({
  end,
  start = 0,
  duration = 1500,
  delay = 0,
  prefix = "",
  suffix = ""
}: {
  end: number;
  start?: number;
  duration?: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
}) => {
  const [count, setCount] = useState(start);
  const [isCounting, setIsCounting] = useState(false);
  const elementRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const currentElement = elementRef.current;
    if (!currentElement) return;

    let observer: IntersectionObserver | null = null;
    let timeoutId: NodeJS.Timeout;
    let animationFrameId: number;

    const startAnimation = () => {
      // Respect user movement preferences
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        setCount(end);
        return;
      }

      setIsCounting(true);
      let startTimestamp: number | null = null;

      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const currentCount = Math.floor(start + (end - start) * easedProgress);
        setCount(currentCount);

        if (progress < 1) {
          animationFrameId = window.requestAnimationFrame(step);
        } else {
          setCount(end); // guarantee final exact value
          setIsCounting(false);
        }
      };

      animationFrameId = window.requestAnimationFrame(step);
    };

    observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          // Trigger stagger delay
          timeoutId = setTimeout(startAnimation, delay);
          // Disconnect observer after trigger (only run once)
          if (observer) {
            observer.disconnect();
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(currentElement);

    return () => {
      if (observer) {
        observer.disconnect();
      }
      clearTimeout(timeoutId);
      cancelAnimationFrame(animationFrameId);
    };
  }, [end, start, duration, delay]);

  return (
    <span
      ref={elementRef}
      className="transition-all duration-300 inline-block"
      style={{
        textShadow: isCounting ? '0 0 12px rgba(251, 191, 36, 0.8)' : 'none',
        transform: isCounting ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      {prefix}{count}{suffix}
    </span>
  );
};

export default function Home() {
  // Navigation states
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeVerticalTab, setActiveVerticalTab] = useState('fire');
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);

  // Simulator / Calculator states
  const [buildingType, setBuildingType] = useState('commercial');
  const [area, setArea] = useState<number>(3000);
  const [securityLevel, setSecurityLevel] = useState('high');
  const [needsSystems, setNeedsSystems] = useState({
    fire: true,
    cctv: true,
    access: true,
    automation: false,
  });
  const [simulatorSubmitted, setSimulatorSubmitted] = useState(false);
  const [quoteFormData, setQuoteFormData] = useState({
    name: '',
    company: '',
    role: '',
    phone: '',
    email: '',
    additionalNotes: '',
  });

  // Main Lead Form
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactError, setContactError] = useState('');
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);
  const [protocolId, setProtocolId] = useState('');
  const [contactForm, setContactForm] = useState({
    name: '',
    company: '',
    role: '',
    phone: '',
    email: '',
    city: '',
    message: '',
    interest: 'all',
  });

  // Selected Case State for interactive Modal Lightbox
  const [selectedCase, setSelectedCase] = useState<number | null>(null);

  // Dynamic pressure sensor simulation (oscillating between 5.4 and 8.0 BAR)
  const [pressao, setPressao] = useState('7.2 BAR');

  React.useEffect(() => {
    const interval = setInterval(() => {
      const val = (Math.random() * (8.0 - 5.4) + 5.4).toFixed(1);
      setPressao(`${val} BAR`);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedCase(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // SDAI Diagnostics (Diagnóstico Inteligente SDAI) State
  const [sdaiProfile, setSdaiProfile] = useState<'leigo' | 'tecnico' | null>(null);
  const [sdaiStep, setSdaiStep] = useState<'initial' | 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'result' | 'form' | 'success'>('initial');
  const [sdaiAnswers, setSdaiAnswers] = useState<Record<string, string>>({});
  const [sdaiLeadForm, setSdaiLeadForm] = useState({
    name: '',
    phone: '',
    company: '',
  });
  const [sdaiFormError, setSdaiFormError] = useState('');

  const leigoQuestions = [
    {
      id: 'q1',
      question: 'O painel principal apresenta algum alerta sonoro ou visual?',
      options: [
        { id: 'A', text: 'Apito constante / Luz amarela ou vermelha' },
        { id: 'B', text: 'Tudo normal (Luz verde)' },
        { id: 'C', text: 'Painel desligado' }
      ]
    },
    {
      id: 'q2',
      question: 'Ocorrem disparos falsos frequentes?',
      options: [
        { id: 'A', text: 'Sim, frequentemente' },
        { id: 'B', text: 'Raramente ou Nunca' }
      ]
    },
    {
      id: 'q3',
      question: 'Há equipamentos fisicamente danificados?',
      options: [
        { id: 'A', text: 'Sim (quebrados, molhados, fios soltos)' },
        { id: 'B', text: 'Não, visualmente intactos' }
      ]
    },
    {
      id: 'q4',
      question: 'Qual a sua urgência burocrática atual?',
      options: [
        { id: 'A', text: 'Laudo (ART) para Seguradora' },
        { id: 'B', text: 'Vistoria do Corpo de Bombeiros' },
        { id: 'C', text: 'Apenas segurança preventiva' }
      ]
    },
    {
      id: 'q5',
      question: 'A sua equipe sabe operar o sistema?',
      options: [
        { id: 'A', text: 'Não, precisamos de ajuda' },
        { id: 'B', text: 'Sim' }
      ]
    }
  ];

  const tecnicoQuestions = [
    {
      id: 'q1',
      question: 'Qual a tecnologia atual do SDAI?',
      options: [
        { id: 'A', text: 'Endereçável (Notifier, Intelbras, etc.)' },
        { id: 'B', text: 'Convencional' },
        { id: 'C', text: 'Misto / Não sei' }
      ]
    },
    {
      id: 'q2',
      question: 'Quais as falhas reportadas no log?',
      options: [
        { id: 'A', text: 'Ground Fault / Fuga para terra' },
        { id: 'B', text: 'Falha de comunicação / Circuito Aberto' },
        { id: 'C', text: 'Alerta de Sujeira' },
        { id: 'D', text: 'Sem falhas' }
      ]
    },
    {
      id: 'q3',
      question: 'Status dos dispositivos de campo?',
      options: [
        { id: 'A', text: 'Necessita substituição em massa' },
        { id: 'B', text: 'Necessita remanejamento (layout)' },
        { id: 'C', text: 'Operação normal' }
      ]
    },
    {
      id: 'q4',
      question: 'Necessita de integração (BMS/Acesso)?',
      options: [
        { id: 'A', text: 'Sim, via relés (Automação)' },
        { id: 'B', text: 'Não' }
      ]
    }
  ];

  const getDiagnosticsResult = () => {
    if (sdaiProfile === 'leigo') {
      const q4Ans = sdaiAnswers['q4'];
      const forceAuditoria = q4Ans === 'A' || q4Ans === 'B';
      const addTreinamento = sdaiAnswers['q5'] === 'A';
      
      let scoreCorretiva = 0;
      if (sdaiAnswers['q1'] === 'A' || sdaiAnswers['q1'] === 'C') scoreCorretiva += 1;
      if (sdaiAnswers['q2'] === 'A') scoreCorretiva += 1;
      if (sdaiAnswers['q3'] === 'A') scoreCorretiva += 1;
      
      let recomLabel = '';
      let recomDesc = '';
      
      if (forceAuditoria) {
        recomLabel = 'Auditoria Especializada e Laudo Técnico de Conformidade (ART)';
        recomDesc = 'Com base nos sintomas de urgência burocrática relatados, sua prioridade é a regularização do sistema. Recomendamos uma Auditoria Técnica Presencial completa com emissão de Laudo Técnico e recolhimento de ART (Anotação de Responsabilidade Técnica) conforme a NBR 17240 para liberar de imediato vistorias dos Bombeiros ou fechar com seguradoras.';
      } else if (scoreCorretiva > 0) {
        recomLabel = 'Manutenção Corretiva Técnica Imediata';
        recomDesc = 'Sinais graves de anomalia ativa e danos físicos foram reportados nos seus equipamentos. Recomendamos uma intervenção cirúrgica de Manutenção Corretiva pela equipe de engenharia da Fireowl Controls para reinstalar cabeamento comprometido, desativar alarmes falsos de pânico e restaurar a estabilidade do painel, fornecendo substituição ágil em larga escala de sensores e sirenes danificadas.';
      } else {
        recomLabel = 'Contrato de Manutenção Preventiva Corporativa';
        recomDesc = 'O inventário de prevenção contra incêndio parece estável, mas conforme a NBR 17240, sistemas exigem rotinas compulsórias de ensaios mensais de acionadores e detectores. Recomendamos o Plano de Manutenção Preventiva para isenção total de responsabilidade civil/criminal, com plena capacidade de auditar e substituir grandes volumes de dispositivos (sensores, módulos, sirenes) em ambientes de grande porte.';
      }
      
      if (addTreinamento) {
        recomDesc += ' Sugerimos também a inclusão do nosso treinamento rápido de operação elemental da central de alarme SDAI para a sua brigada ativa.';
      }
      
      return {
        service: recomLabel,
        description: recomDesc,
        hasAddon: addTreinamento,
        addonText: 'Treinamento Operacional de Brigada em Painéis de SDAI'
      };
    } else {
      const forceAutomacao = sdaiAnswers['q4'] === 'A';
      const forceRetrofit = sdaiAnswers['q3'] === 'A' || sdaiAnswers['q3'] === 'B';
      
      let scoreCorretiva = 0;
      if (sdaiAnswers['q2'] === 'A' || sdaiAnswers['q2'] === 'B') scoreCorretiva += 1;
      
      let recomLabel = '';
      let recomDesc = '';
      
      if (forceAutomacao) {
        recomLabel = 'Engenharia de Automação & Integração Predial';
        recomDesc = 'Com a necessidade declarada de integrar o sistema de alarme de incêndio ao BMS (Building Management System) ou ao controle de acesso físico, oferecemos nossa engenharia de automação predial. Interligamos seus CLPs por relés inteligentes e gateways de protocolo Modbus/BACnet para destravamento de acessos em pânico de modo autônomo.';
      } else if (forceRetrofit) {
        recomLabel = 'Retrofit Tecnológico de SDAI e Remanejamento';
        recomDesc = 'Seus dispositivos necessitam de remanejamento físico por layout ou troca tecnológica em massa. O serviço indicado é o Retrofit Tecnológico Fireowl. Substituímos sensores convencionais ultrapassados por laços endereçáveis inteligentes com barramento blindado de alta confiabilidade.';
      } else if (scoreCorretiva > 0) {
        recomLabel = 'Inspeção e Correção Avançada de Loops de Campo (Ground Fault)';
        recomDesc = 'Identificamos falhas críticas de infraestrutura física, como fuga para terra (Ground Fault) ou circuito de laço aberto que comprometem a zona inteira. É recomendável o agendamento de uma corretiva cirúrgica para que nossos técnicos examinem as caixas de passagem e refaçam o isolamento.';
      } else {
        recomLabel = 'Manutenção Preventiva de SDAI e Calibração de Sensibilidade';
        recomDesc = 'A central está sem falhas ativas, mas apresenta sinalizadores normais ou pequenos alertas de poeiras. Ideal agendar higienização e testes por sopro. Nossos técnicos possuem plena capacitação técnica para auditar, conferir sensibilidade e substituir grandes volumes de dispositivos (sensores, módulos e sirenes) em plantas de grande porte.';
      }
      
      return {
        service: recomLabel,
        description: recomDesc,
        hasAddon: false,
        addonText: ''
      };
    }
  };

  const verticals: ServiceDetail[] = [
    {
      id: 'fire',
      title: 'Alarmes & Combate a Incêndio',
      subtitle: 'Sistemas de Detecção Homologados UL/FM',
      icon: <Flame className="w-8 h-8 text-action-red" id="icon-fire" />,
      description: 'Projetos completos de engenharia contra incêndio. Desde painéis inteligentes endereçáveis até detectores lineares (BEAM) e agentes limpos para salas de TI críticas.',
      specs: [
        'Central de Alarme Endereçável Inteligente',
        'Detectores Térmicos e Ópticos de Alta Sensibilidade',
        'Acionadores Manuais de Dupla Ação',
        'Sinalizadores Audiovisuais Estroboscópicos',
        'Sistemas de Supressão por Gás (FM-200 / Novec)',
      ],
      certifications: ['Instruções Técnicas do Corpo de Bombeiros (IT)', 'NBR 17240', 'Selo de Qualidade UL/FM / CE', 'NFPA 72'],
      benefits: ['Instalação sem interrupção operacional', 'Certificações prontas para seguradoras', 'Baixo índice de alarmes falsos', 'Manutenção preventiva periódica'],
    },
    {
      id: 'cctv',
      title: 'CFTV Inteligente & IA corporativa',
      subtitle: 'Monitoramento Gerenciado por Inteligência Artificial',
      icon: <Cctv className="w-8 h-8 text-action-red" id="icon-cctv" />,
      description: 'Sistemas corporativos de circuito fechado de televisão de alta definição integrando analíticos avançados de vídeo para segurança patrimonial e controle de processos.',
      specs: [
        'Câmeras IP 4K de Baixíssima Luminosidade (Starlight)',
        'Analíticos de IA: Intrusão, Cerca Virtual e Reconhecimento Facial',
        'Leitura de Placas Automotivas (LPR / OCR)',
        'Storage Redundante RAID para Alta Disponibilidade de Gravações',
        'VMS de Nível Enterprise (Milestone / Genetec)',
      ],
      certifications: ['Criptografia de ponta a ponta (AES-256)', 'LGPD Compliance para dados de face', 'Gravação em Nuvem Criptografada', 'Conectividade Fibra Óptica redundante'],
      benefits: ['Detecção instantânea de intrusos', 'Mapeamento de calor para eficiência operacional', 'Fácil rastreamento retroativo por IA', 'Central integrada de monitoramento remota'],
    },
    {
      id: 'access',
      title: 'Controle de Acesso de Alta Segurança',
      subtitle: 'Gerenciamento de Fluxo de Pessoas e Veículos',
      icon: <Fingerprint className="w-8 h-8 text-action-red" id="icon-access" />,
      description: 'Bloqueios físicos e identificação inteligente com integração direta com software corporativo de Recursos Humanos e Segurança Patrimonial.',
      specs: [
        'Biometria Facial 3D Antifraude (Liveness Detection)',
        'Leitores RFID de Alta Segurança (Mifare Plus / DESFire)',
        'Catracas Flap / Torniquetes Motorizados de Alto Fluxo',
        'Cancelas Veiculares Ultrarrápidas de Alto Fluxo',
        'Servidor Central com Redundância Ativo-Ativo',
      ],
      certifications: ['Integração com Active Directory / LDAP', 'Arquitetura de rede segura baseada em IP', 'Backups automáticos na nuvem', 'Controle anti-passback físico e lógico'],
      benefits: ['Eliminação de fraudes de acesso', 'Relatórios de presença em tempo real', 'Configurações de permissões dinâmicas por setor', 'Contratados com acesso temporário automatizado'],
    },
    {
      id: 'automation',
      title: 'Automação Predial & BMS',
      subtitle: 'Eficiência Energética e Controle Centralizado',
      icon: <Cpu className="w-8 h-8 text-action-red" id="icon-automation" />,
      description: 'Integração centralizada em sistemas Building Management Systems (BMS). Monitore consumo de energia, sistemas HVAC (Ar condicionado), iluminação e bombas.',
      specs: [
        'Sistemas BMS Baseados em Protocolo BacNet / Modbus / LonWorks',
        'Sensores de Qualidade do Ar (CO2, Temperatura e Umidade)',
        'Quadros de Automação Inteligentes com CLP Industrial',
        'Agendamento Inteligente para Redução de Demanda Elétrica',
        'Dashboard WEB Unificado de Telemetria e Eventos',
      ],
      certifications: ['Diretrizes LEED (Eficiência Energética)', 'NBR ISO 50001 (Gestão de Energia)', 'Integração de protocolos nativos IP', 'Controle PID de alta precisão para HVAC'],
      benefits: ['Economia comprovada de até 40% na conta de luz', 'Aumento de vida útil de maquinários', 'Conforto ambiental premium para os colaboradores', 'Manutenção preditiva de falhas em bombas e ventiladores'],
    },
  ];

  // Simulator core calculations
  const calculateEstimate = () => {
    let priceMultiplier = 1;
    if (buildingType === 'industrial') priceMultiplier = 1.35;
    if (buildingType === 'hospital') priceMultiplier = 1.5;

    let scaleFactor = area / 1000;
    
    // Core hardware items recommendation
    const results = {
      fire: {
        detectors: Math.ceil(area / 60),
        panels: Math.ceil(area / 10000),
        manualStations: Math.ceil(area / 120),
        estimatedCost: Math.ceil(scaleFactor * 14000 * priceMultiplier)
      },
      cctv: {
        cameras: Math.ceil(area / 150 * (securityLevel === 'high' ? 1.4 : 1)),
        nvrPorts: Math.ceil(area / 150 * (securityLevel === 'high' ? 1.4 : 1) / 16) * 16,
        estimatedCost: Math.ceil(scaleFactor * 11500 * priceMultiplier)
      },
      access: {
        points: Math.ceil(area / 200 * (securityLevel === 'enterprise' ? 1.6 : 1)),
        readers: Math.ceil(area / 200 * (securityLevel === 'enterprise' ? 1.6 : 1) * 1.5),
        estimatedCost: Math.ceil(scaleFactor * 9500 * priceMultiplier)
      },
      automation: {
        clpControllers: Math.ceil(area / 1500),
        sensors: Math.ceil(area / 100),
        estimatedCost: Math.ceil(scaleFactor * 19000 * priceMultiplier)
      }
    };

    let totalEstimate = 0;
    if (needsSystems.fire) totalEstimate += results.fire.estimatedCost;
    if (needsSystems.cctv) totalEstimate += results.cctv.estimatedCost;
    if (needsSystems.access) totalEstimate += results.access.estimatedCost;
    if (needsSystems.automation) totalEstimate += results.automation.estimatedCost;

    return {
      hardware: results,
      totalEstimate,
    };
  };

  const simulationResults = calculateEstimate();

  const saveSupabaseRow = async (tableName: string, values: Record<string, unknown>) => {
    const { error } = await (getSupabaseClient() as any)
      .from(tableName)
      .insert(values);

    if (error) {
      throw new Error(error.message);
    }
  };

  const handleSimulatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteFormData.name || !quoteFormData.email || !quoteFormData.company) {
      alert('Por favor, preencha nome, e-mail e empresa para ver a estimativa.');
      return;
    }
    setSimulatorSubmitted(true);

    try {
      const results = calculateEstimate();
      await saveSupabaseRow('simulator_submissions', {
        name: quoteFormData.name,
        company: quoteFormData.company,
        role: quoteFormData.role || null,
        phone: quoteFormData.phone || null,
        email: quoteFormData.email,
        additional_notes: quoteFormData.additionalNotes || null,
        area,
        building_type: buildingType,
        estimated_value: results?.totalEstimate ? `R$ ${results.totalEstimate.toLocaleString('pt-BR')},00` : null,
      });
    } catch (err) {
      console.error("Erro ao salvar simulação de custos no Supabase:", err);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const generatedProtocol = `FO-[${Math.floor(Math.random() * 900000 + 100000)}]`;
    // We remove the square brackets to keep FO-XXXXXX format
    const cleanProtocol = generatedProtocol.replace('[', '').replace(']', '');
    setContactError('');
    setIsContactSubmitting(true);

    try {
      await saveSupabaseRow('contact_submissions', {
        name: contactForm.name,
        company: contactForm.company,
        role: contactForm.role || null,
        phone: contactForm.phone || null,
        email: contactForm.email,
        city: contactForm.city || null,
        message: contactForm.message,
        interest: contactForm.interest || 'all',
        protocol_id: cleanProtocol,
      });

      setProtocolId(cleanProtocol);
      setContactSubmitted(true);
    } catch (err) {
      console.error("Erro ao enviar contato para o Supabase:", err);
      setContactError(err instanceof Error ? err.message : 'Nao foi possivel salvar o contato no momento.');
    } finally {
      setIsContactSubmitting(false);
    }
  };

  const casesData = [
    {
      id: 1,
      client: "Itamaraty",
      isCritical: false,
      tags: [],
      badges: ["+2.500 km de infraestrutura", "12 detectores lineares", "4 blocos integrados"],
      problem: "Complexo com 4 blocos operando com centrais de alarme de incêndio isoladas, sem supervisão centralizada, e centros de distribuição sem monitoramento de fumaça em grandes vãos.",
      solution: "Instalação de central de alarme de incêndio na Guarita para supervisionar as 4 centrais existentes, além de 12 detectores lineares de fumaça nos centros de distribuição. Execução de mais de 2.500 km de infraestrutura.",
      result: "Monitoramento centralizado e em tempo real de todo o complexo, com cobertura ampliada em áreas críticas de armazenamento."
    },
    {
      id: 2,
      client: "Catuaí Shopping",
      isCritical: true,
      tags: ["Missão Crítica", "Intervenção Emergencial"],
      badges: ["260+ falhas resolvidas", "7 dias de intervenção", "R$ 0 em equipamentos novos"],
      problem: "Central de alarme de incêndio Notifier operando com mais de 260 falhas ativas, comprometendo a confiabilidade do sistema.",
      solution: "7 dias de manutenção intensiva, regularizando todas as falhas via reprogramação e ajustes técnicos, sem aquisição de equipamento novo.",
      result: "Sistema 100% regularizado em uma semana, com economia significativa para o cliente e know-how técnico comprovado em centrais Notifier."
    },
    {
      id: 3,
      client: "Grupo Muffato",
      isCritical: true,
      tags: ["Missão Crítica", "Multi-unidade"],
      badges: ["Múltiplas unidades atendidas", "CD + Indústria + Varejo"],
      problem: "Centro de Distribuição e unidade industrial (Muffato Foods) com sistemas de segurança fora de operação, além de unidades de varejo com falhas pontuais e novas lojas precisando de comissionamento.",
      solution: "Manutenção corretiva completa no CD e na Muffato Foods Indústria, restabelecendo operação total; suporte contínuo em múltiplas unidades de varejo; atuação em ativações de novas lojas/mercados do grupo.",
      result: "Restabelecimento total da operação em ambientes de missão crítica (logística e indústria alimentícia), com relacionamento contínuo de longo prazo atendendo múltiplas unidades simultaneamente."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans" id="root-viewport">
      <VectorAnimationsStyle />
      {/* Top Banner - Important warning/announcement */}
      <div className="bg-primary-blue text-white text-xs py-2 px-4 flex justify-between items-center border-b border-white/10" id="top-announcement">
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
          <span className="inline-block bg-action-red rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider animate-pulse text-white">
            Engenharia Ativa
          </span>
          <span className="truncate">Sistemas 100% em conformidade com as normas NBR 17240, NBR 5410 e NFPA-72. Solicite uma vistoria técnica presencial.</span>
        </div>
        <div className="hidden md:flex items-center gap-4 text-[11px] opacity-90 shrink-0">
          <a href="https://wa.me/5543984160725?text=Olá!%20Gostaria%20de%20um%20diagnóstico%20técnico%20para%20minha%20empresa." target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-warning-yellow hover:underline transition-all cursor-pointer">
            <Phone className="w-3 h-3 text-warning-yellow" /> +55 (43) 98416-0725
          </a>
          <a href="mailto:contato@fireowlcontrols.com.br" className="flex items-center gap-1 hover:text-warning-yellow hover:underline transition-all cursor-pointer">
            <Mail className="w-3 h-3 text-warning-yellow" /> contato@fireowlcontrols.com.br
          </a>
        </div>
      </div>

      {/* Main Header / Navigation */}
      <header className="sticky top-0 z-[100] bg-white border-b border-gray-100 shadow-sm backdrop-blur-md" id="main-navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo with branding */}
          <a href="#" className="flex items-center gap-3 group" id="brand-logo-link">
            <div className="flex items-center justify-center shrink-0">
              <OfficialLogo className="w-10 h-10 transition-transform duration-200 group-hover:scale-105" />
            </div>
            <div>
              <span className="block text-2xl font-extrabold tracking-tight text-primary-blue font-display leading-none">
                FIREOWL CONTROLS<span className="text-action-red">.</span>
              </span>
              <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mt-0.5">
                ENGINEERING & AUTOMATION
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-700" id="desktop-nav-links">
            <a href="#solucoes" className="hover:text-blue-600 transition-all cursor-pointer hover:opacity-100 opacity-90">Serviços</a>
            <a href="#solucoes-tabs" className="hover:text-blue-600 transition-all cursor-pointer hover:opacity-100 opacity-90">Soluções Técnicas</a>
            <a href="#quem-somos" className="hover:text-blue-600 transition-all cursor-pointer hover:opacity-100 opacity-90">Quem Somos</a>
            <a href="#cases" className="hover:text-blue-600 transition-all cursor-pointer hover:opacity-100 opacity-90">Cases de Sucesso</a>
            <a href="#contato" className="hover:text-blue-600 transition-all cursor-pointer hover:opacity-100 opacity-90">Contato</a>
          </nav>

          {/* Call to Action Button */}
          <div className="hidden lg:flex items-center gap-4" id="desktop-cta-container">
            <a 
              href="#contato" 
              className="bg-action-red text-white font-bold py-3 px-6 rounded-lg text-sm transition-all hover:bg-red-650 hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-action-red/10 flex items-center gap-2.5"
              id="cta-nav-button"
            >
              <span className="status-dot shrink-0" />
              Fale com a Engenharia <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Mobile menu toggle button */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-primary-blue hover:bg-slate-100 transition-colors"
            aria-label="Toggle menu"
            id="mobile-menu-toggle-btn"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-white border-t border-slate-100 overflow-hidden"
              id="mobile-nav-panel"
            >
              <div className="px-4 pt-4 pb-6 space-y-3 flex flex-col font-medium text-slate-700">
                <a href="#solucoes" onClick={() => setIsMobileMenuOpen(false)} className="py-2 hover:text-blue-600 border-b border-slate-100 flex justify-between items-center text-slate-800">
                  <span>Serviços</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </a>
                <a href="#solucoes-tabs" onClick={() => setIsMobileMenuOpen(false)} className="py-2 hover:text-blue-600 border-b border-slate-100 flex justify-between items-center text-slate-800">
                  <span>Soluções Técnicas</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </a>
                <a href="#quem-somos" onClick={() => setIsMobileMenuOpen(false)} className="py-2 hover:text-blue-600 border-b border-slate-100 flex justify-between items-center text-slate-800">
                  <span>Quem Somos</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </a>
                <a href="#cases" onClick={() => setIsMobileMenuOpen(false)} className="py-2 hover:text-blue-600 border-b border-slate-100 flex justify-between items-center text-slate-800">
                  <span>Cases de Sucesso</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </a>
                <a href="#contato" onClick={() => setIsMobileMenuOpen(false)} className="py-2 hover:text-blue-600 border-b border-slate-100 flex justify-between items-center text-slate-800">
                  <span>Contato</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </a>
                <a 
                  href="#contato" 
                  onClick={() => setIsMobileMenuOpen(false)} 
                  className="bg-action-red text-white font-bold py-3 px-4 rounded-lg text-sm shadow-md mt-4 flex items-center justify-center gap-2"
                >
                  <span className="status-dot shrink-0" />
                  Fale com a Engenharia
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white py-16 lg:py-24" id="hero-section">
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-70"
          style={{
            backgroundImage: 'radial-gradient(circle at 18% 22%, rgba(26,26,114,0.08) 0 2px, transparent 2px), radial-gradient(circle at 72% 35%, rgba(230,57,70,0.07) 0 2px, transparent 2px), radial-gradient(circle at 44% 74%, rgba(255,215,0,0.11) 0 1.5px, transparent 1.5px)',
            backgroundSize: '96px 96px, 132px 132px, 84px 84px',
          }}
        />

        {/* Background Decorative Grid and Gradients */}
        <div className="absolute inset-x-0 top-0 h-[600px] bg-gradient-to-b from-[#F2F4FA] to-transparent -z-10" />
        <div className="absolute right-0 top-1/4 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-3xl -z-10" />
        <div className="absolute left-10 bottom-0 w-[400px] h-[400px] bg-red-50/20 rounded-full blur-2xl -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center" id="hero-grid">
            
            {/* Hero Text Side */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left pointer-events-none" id="hero-text-container">
              {/* Premium Trust Badge */}
              <div className="inline-flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm pointer-events-auto" id="hero-trust-badge">
                <ShieldCheck className="w-4 h-4 text-action-red" />
                <span className="text-xs font-semibold text-gray-700 tracking-tight">
                  Projetos Industriais & Infraestruturas de Grande Porte
                </span>
              </div>

              {/* Outstanding Title */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-primary-blue leading-tight font-display" id="hero-title">
                Inteligência e Eficiência <br className="hidden lg:block"/>
                em Sistemas de <br className="hidden lg:block"/>
                <span className="text-action-red bg-gradient-to-r from-action-red to-red-500 bg-clip-text text-transparent">Segurança</span>
              </h1>

              {/* Subtitle / Value Proposition */}
              <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed" id="hero-description">
                Soluções especializadas B2B em alarmes de incêndio (SDAI), CFTV, controle de acesso e automação predial para grandes operações, entregando sempre excelência técnica e atendimento consultivo personalizado.
              </p>

              {/* Multi-feature bullets directly visible on hero fold */}
              <div className="grid sm:grid-cols-2 gap-3 max-w-xl mx-auto lg:mx-0 pt-2 pointer-events-auto" id="hero-features-list">
                <div className="flex items-center gap-2.5 text-sm font-semibold text-gray-700 bg-white/70 backdrop-blur-sm p-2 rounded-lg border border-gray-100 shadow-xs">
                  <CheckCircle className="w-4 h-4 text-action-red shrink-0" />
                  <span>Sistemas de Detecção Homologados NBR</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm font-semibold text-gray-700 bg-white/70 backdrop-blur-sm p-2 rounded-lg border border-gray-100 shadow-xs">
                  <CheckCircle className="w-4 h-4 text-action-red shrink-0" />
                  <span>Equipe certificada pelas principais marcas</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm font-semibold text-gray-700 bg-white/70 backdrop-blur-sm p-2 rounded-lg border border-gray-100 shadow-xs">
                  <CheckCircle className="w-4 h-4 text-action-red shrink-0" />
                  <span>Atendimento personalizado e pós-venda</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm font-semibold text-gray-700 bg-white/70 backdrop-blur-sm p-2 rounded-lg border border-gray-100 shadow-xs">
                  <CheckCircle className="w-4 h-4 text-action-red shrink-0" />
                  <span>Engenharia focada em economia de custos</span>
                </div>
              </div>

              {/* Call-to-action Fold */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4 pointer-events-auto" id="hero-cta-buttons">
                <a 
                  href="#contato" 
                  className="w-full sm:w-auto bg-action-red text-white font-bold py-4 px-8 rounded-xl text-md transition-all hover:bg-red-600 hover:-translate-y-0.5 shadow-lg shadow-action-red/20 text-center flex items-center justify-center gap-2 group"
                >
                  Solicitar Avaliação Técnica <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </a>
                <a 
                  href="#solucoes" 
                  className="w-full sm:w-auto border-2 border-primary-blue text-primary-blue font-bold py-4 px-8 rounded-xl text-md transition-all hover:bg-primary-blue/5 hover:-translate-y-0.5 text-center flex items-center justify-center gap-2"
                >
                  Conhecer Soluções Técnicas
                </a>
              </div>


            </div>

            {/* Hero Graphic / Dashboard Side */}
            <div className="lg:col-span-5 relative" id="hero-graphic-container">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-primary-blue to-action-red opacity-15 blur-xl" />
              <div 
                className="relative border border-slate-800 text-white p-6 rounded-2xl shadow-2xl flex flex-col gap-4 overflow-hidden animate-fade-in"
                style={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.85)', 
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)'
                }}
              >
                
                {/* Header of Simulated Console */}
                <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-red-500 led-indicator"></span>
                    <span className="text-[10px] sm:text-xs font-mono text-gray-300 tracking-wider font-extrabold">FIREOWL INTERACTIVE MONITOR V2.8</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-slate-700 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-slate-700 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-slate-700 rounded-full"></div>
                  </div>
                </div>

                {/* Sub UI Block 1: Incêndio */}
                <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800/60 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-action-red" />
                      <span className="text-xs font-bold text-gray-200">Sistemas Contra Incêndio</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold bg-emerald-950/80 text-emerald-400 px-2.5 py-0.5 rounded border border-emerald-900/30">ATIVO & MONITORADO</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono font-extrabold">
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/40">
                      <span className="block text-[9px] text-gray-400 uppercase tracking-wider font-bold">PRESSÃO DE REDE</span>
                      <span className="block text-sm font-semibold text-warning-yellow transition-all duration-500">{pressao}</span>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/40">
                      <span className="block text-[9px] text-gray-400 uppercase tracking-wider font-bold">DETECTORES ATIVOS</span>
                      <span className="block text-sm font-semibold text-gray-200">248 unidades</span>
                    </div>
                  </div>
                </div>

                {/* Sub UI Block 2: CFTV Analítico */}
                <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800/60 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Cctv className="w-4 h-4 text-warning-yellow" />
                      <span className="text-xs font-bold text-gray-100">IA Analíticos de Vídeo</span>
                    </div>
                    <span className="text-[10px] font-mono bg-blue-950/80 text-blue-300 px-2 py-0.5 rounded border border-blue-900/30 font-bold">STREAMING 4K</span>
                  </div>
                  
                  {/* Camera Feed Screen */}
                  <div className="relative bg-slate-950 h-32 rounded-lg overflow-hidden flex items-center justify-center group border border-slate-800/80">
                    
                    {/* Local industrial signal background */}
                    <div className="absolute inset-0 w-full h-full select-none pointer-events-none">
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 select-none pointer-events-none bg-[radial-gradient(circle_at_35%_30%,rgba(148,163,184,0.18),transparent_22%),linear-gradient(135deg,#020617_0%,#0f172a_48%,#111827_100%)] transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>

                    {/* Retro Grid overlay */}
                    <div className="absolute inset-0 opacity-25 bg-[linear-gradient(to_right,#334155_1.2px,transparent_1.2px),linear-gradient(to_bottom,#334155_1.2px,transparent_1.2px)] bg-[size:16px_16px] pointer-events-none z-0"></div>
                    
                    {/* Simulated warehouse structural blueprint shapes in SVG */}
                    <svg className="absolute inset-0 w-full h-full text-white opacity-25 p-2 z-1 pointer-events-none" viewBox="0 0 100 50">
                      <rect x="8" y="8" width="32" height="26" fill="none" stroke="currentColor" strokeWidth="0.4" strokeDasharray="1.5,1.5" />
                      <rect x="52" y="4" width="42" height="34" fill="none" stroke="currentColor" strokeWidth="0.4" />
                      <line x1="24" y1="8" x2="24" y2="34" stroke="currentColor" strokeWidth="0.4" />
                      <line x1="8" y1="21" x2="40" y2="21" stroke="currentColor" strokeWidth="0.4" />
                      <circle cx="73" cy="20" r="9" fill="none" stroke="currentColor" strokeWidth="0.4" />
                    </svg>
                    
                    {/* Red Scanning Scanning line with glows and animations */}
                    <div className="cctv-scanner-line"></div>

                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/85 px-2.5 py-1 rounded text-[9px] font-mono font-bold text-gray-200 z-10 border border-slate-800">
                      <span className="w-1.5 h-1.5 bg-red-600 led-indicator"></span>
                      <span>CAM 04 - GALPÃO SETOR K</span>
                    </div>

                    {/* Bounding box mock overlay */}
                    <div className="absolute top-10 left-12 border border-red-500 bg-red-500/15 p-1.5 rounded font-mono text-[8px] text-red-500 flex flex-col shadow-[0_0_12px_rgba(230,57,70,0.35)] z-10">
                      <span className="font-bold tracking-wider">PESSOA DETECTADA</span>
                      <span>CONFIANÇA: 98.6%</span>
                    </div>

                    {/* Corner Reticles */}
                    <div className="absolute top-2 right-2 w-2.5 h-2.5 border-t border-r border-slate-400/60 z-10"></div>
                    <div className="absolute bottom-2 left-2 w-2.5 h-2.5 border-b border-l border-slate-400/60 z-10"></div>
                    <div className="absolute bottom-2 right-2 w-2.5 h-2.5 border-b border-r border-slate-400/60 z-10"></div>
                  </div>
                </div>

                {/* Footer of Simulated Console with system state */}
                <div className="flex justify-between items-center pt-2 text-[10px] font-mono text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-500 led-indicator"></span>
                    <span className="font-semibold text-gray-300">Link de Dados: Satélite / Fibra Dupla</span>
                  </div>
                  <span>IP: 192.168.100.41</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Faixa de Marcas Parceiras */}
      <section className="py-12 bg-white border-y border-gray-100" id="marcas-parceiras">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          {/* Marcas Nacionais */}
          <div className="space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#666666] text-center font-display">
              Marcas Nacionais Parceiras Homologadas
            </h4>
            <div className="flex flex-wrap items-center justify-center gap-4 animate-fade-in">
              {['Intelbras', 'Tecnohold', 'Ascael'].map((brand) => (
                <span 
                  key={brand} 
                  className="px-5 py-2 border-2 border-action-red rounded-xl font-display font-bold text-sm tracking-wide text-primary-blue bg-red-50/20"
                >
                  {brand}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 w-24 mx-auto" />

          {/* Marcas Internacionais */}
          <div className="space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#666666] text-center font-display">
              Marcas Internacionais Homologadas
            </h4>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {['Notifier', 'Edwards', 'Schneider', 'Bosch', 'Honeywell', 'Siemens', 'Axis', 'Milestone'].map((brand) => (
                <span 
                  key={brand} 
                  className="px-4 py-2 border border-slate-100 hover:border-blue-300 hover:scale-[1.03] rounded-xl font-display font-bold text-xs tracking-widest text-primary-blue bg-slate-50/50 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  {brand.toUpperCase()}
                </span>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* Seção de Estatísticas (Prova de Escala e Experiência) */}
      <section 
        className="py-20 bg-[#1a1a60] text-white relative overflow-hidden" 
        id="stats-experience"
      >
        {/* Linha vermelha superior */}
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-[#E63946]" id="stats-red-line"></div>

        {/* --- SISTEMA DE BOLHAS VERMELHAS FLUTUANTES --- */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" id="stats-bubbles-container">
          {[
            { text: "Manutenções corretivas", left: "5%", duration: "12s", delay: "0s" },
            { text: "Instalação central de Alarme", left: "25%", duration: "15s", delay: "2s" },
            { text: "Retrofit Hipermercado", left: "50%", duration: "10s", delay: "4s" },
            { text: "Instalação industria", left: "75%", duration: "18s", delay: "1s" },
            { text: "Contrato Shopping", left: "15%", duration: "14s", delay: "6s" },
            { text: "Auditorias SDAI", left: "65%", duration: "11s", delay: "8s" },
            { text: "Manutenções preventivas", left: "85%", duration: "16s", delay: "5s" },
            { text: "Instalação CFTV", left: "35%", duration: "13s", delay: "7s" }
          ].map((bubble, idx) => (
            <div 
              key={idx}
              className="float-bubble text-[10px] md:text-[13.5px] px-3 py-1.5 md:px-6 md:py-3 cursor-default"
              style={{ 
                left: bubble.left, 
                animationDuration: bubble.duration, 
                animationDelay: bubble.delay 
              }}
            >
              {bubble.text}
            </div>
          ))}
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row justify-center items-stretch text-center gap-0">
            
            {/* Stat 1 */}
            <div className="flex-1 p-6 md:p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/10" id="stat-box-1">
              <span 
                className="font-montserrat font-bold text-[#FFD700] text-[3.2rem] sm:text-[3.5rem] tracking-tight leading-none mb-3 block"
                style={{ textShadow: '2px 2px 10px rgba(0,0,0,0.3)' }}
              >
                <CounterUp end={130} start={0} prefix="+" delay={0} />
              </span>
              <span className="text-[0.9rem] font-sans font-bold text-white uppercase tracking-[1.5px] block">
                Projetos concluídos
              </span>
            </div>

            {/* Stat 2 */}
            <div className="flex-1 p-6 md:p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/10" id="stat-box-2">
              <span 
                className="font-montserrat font-bold text-[#FFD700] text-[3.2rem] sm:text-[3.5rem] tracking-tight leading-none mb-3 block"
                style={{ textShadow: '2px 2px 10px rgba(0,0,0,0.3)' }}
              >
                <CounterUp end={300} start={0} prefix="+" delay={150} />
              </span>
              <span className="text-[0.9rem] font-sans font-bold text-white uppercase tracking-[1.5px] block">
                Auditorias realizadas
              </span>
            </div>

            {/* Stat 3 */}
            <div className="flex-1 p-6 md:p-8 flex flex-col items-center justify-center" id="stat-box-3">
              <span 
                className="font-montserrat font-bold text-[#FFD700] text-[3.2rem] sm:text-[3.5rem] tracking-tight leading-none mb-3 block"
                style={{ textShadow: '2px 2px 10px rgba(0,0,0,0.3)' }}
              >
                <CounterUp end={2024} start={2015} delay={300} />
              </span>
              <span className="text-[0.9rem] font-sans font-bold text-white uppercase tracking-[1.5px] block">
                Ano de fundação
              </span>
            </div>

          </div>
        </div>
      </section>

      {/* Seção Quem Somos (Missão, Visão, Valores) */}
      <section className="py-20 bg-bg-light-gray" id="quem-somos">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-action-red font-bold uppercase text-xs tracking-widest block font-display">
              Compromisso Técnico e Institucional
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-blue font-display tracking-tight">
              Quem Somos & Nossos Valores Corporativos
            </h2>
            <p className="text-gray-600">
              A Fireowl Controls é uma empresa fundada em 2024 que já conquistou a confiança de grandes operações no mercado brasileiro, entregando soluções em automação, alarmes de incêndio (SDAI), CFTV e controle de acesso, sempre com foco na excelência no atendimento.
            </p>
          </div>

          {/* 3 cards: Missão, Visão e Valores */}
          <div className="grid md:grid-cols-3 gap-8">
            
            {/* Card Missão */}
            <div className="bg-white p-8 rounded-2xl border border-gray-200/85 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-action-red">
                  <ShieldCheck className="w-6 h-6 text-action-red" />
                </div>
                <h3 className="text-xl font-extrabold text-primary-blue font-display">Nossa Missão</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Proteger o que é importante através de soluções inteligentes em SDAI, Automação, CFTV, Controle de Acesso e Intrusão, garantindo total tranquilidade e segurança aos nossos clientes.
                </p>
              </div>
              <span className="block text-xs font-bold text-gray-400 pt-4 border-t border-gray-100 uppercase tracking-widest">O PROPÓSITO</span>
            </div>

            {/* Card Visão */}
            <div className="bg-white p-8 rounded-2xl border border-gray-200/85 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-action-red">
                  <Award className="w-6 h-6 text-action-red" />
                </div>
                <h3 className="text-xl font-extrabold text-primary-blue font-display">Nossa Visão</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Ser referência em segurança eletrônica e de sistemas de detecção e alarme de incêndio (SDAI) no mercado brasileiro, sendo reconhecida pela integridade e excelência técnica.
                </p>
              </div>
              <span className="block text-xs font-bold text-gray-400 pt-4 border-t border-gray-100 uppercase tracking-widest">O FUTURO</span>
            </div>

            {/* Card Valores */}
            <div className="bg-white p-8 rounded-2xl border border-gray-200/85 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-action-red">
                  <Shield className="w-6 h-6 text-action-red" />
                </div>
                <h3 className="text-xl font-extrabold text-primary-blue font-display">Nossos Valores</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Integridade, olhar para o futuro e o cliente em primeiro lugar orientam todas as nossas parcerias técnicas, com foco em relacionamentos de longo prazo e confiança técnica.
                </p>
              </div>
              <span className="block text-xs font-bold text-gray-400 pt-4 border-t border-gray-100 uppercase tracking-widest">A BASE</span>
            </div>

          </div>

          {/* Destaque "Diferencial Fireowl" */}
          <div className="bg-white border-l-4 border-action-red p-6 sm:p-8 rounded-r-2xl shadow-md space-y-3">
            <h4 className="text-lg font-bold text-primary-blue font-display">
              Diferencial Certificado Fireowl Controls
            </h4>
            <p className="text-gray-600 text-sm leading-relaxed">
              Nosso verdadeiro diferencial reside na elaboração de uma rigorosa <strong>análise técnico-econômica detalhada de cada projeto</strong>. Atuamos de forma consultiva para <strong>otimizar orçamentos de modernizações e contratos de manutenção</strong>, recomendando substituição correta de ativos apenas quando estritamente necessário. Isso protege seu fluxo de caixa contra investimentos supérfluos, garantindo máxima conformidade sob o menor Custo Total de Propriedade (TCO).
            </p>
          </div>

        </div>
      </section>

      {/* Services Showcase Section */}
      <section className="py-20 bg-bg-light-gray border-y border-gray-100 scroll-mt-20" id="solucoes">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section titles */}
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-action-red font-bold uppercase text-xs tracking-widest block font-display">
              Nosso Portfólio Tecnológico B2B
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-blue font-display tracking-tight">
              Sistemas de Automação e Redução Absoluta de Riscos Patrimoniais
            </h2>
            <p className="text-gray-600 text-base">
              Projetos corporativos complexos em conformidade com as exigências mais severas do mercado de engenharia mundial.
            </p>
          </div>

          {/* Interactive Custom High-Fidelity Cards for Solucoes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16" id="solucoes-tabs">
            <SmokeDetectorCard 
              isActive={activeVerticalTab === 'fire'} 
              onClick={() => {
                setActiveVerticalTab('fire');
                const viewport = document.getElementById('solucoes-tab-viewport');
                if (viewport) viewport.scrollIntoView({ behavior: 'smooth' });
              }} 
            />
            <CFTVCard 
              isActive={activeVerticalTab === 'cctv'} 
              onClick={() => {
                setActiveVerticalTab('cctv');
                const viewport = document.getElementById('solucoes-tab-viewport');
                if (viewport) viewport.scrollIntoView({ behavior: 'smooth' });
              }} 
            />
            <AccessControlCard 
              isActive={activeVerticalTab === 'access'} 
              onClick={() => {
                setActiveVerticalTab('access');
                const viewport = document.getElementById('solucoes-tab-viewport');
                if (viewport) viewport.scrollIntoView({ behavior: 'smooth' });
              }} 
            />
            <BMSCard 
              isActive={activeVerticalTab === 'automation'} 
              onClick={() => {
                setActiveVerticalTab('automation');
                const viewport = document.getElementById('solucoes-tab-viewport');
                if (viewport) viewport.scrollIntoView({ behavior: 'smooth' });
              }} 
            />
          </div>

          {/* Interactive Tab Content Display */}
          <div className="max-w-5xl mx-auto" id="solucoes-tab-viewport">
            <AnimatePresence mode="wait">
              {verticals.map((tab) => tab.id === activeVerticalTab && (
                <motion.div
                  key={tab.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                  className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden grid lg:grid-cols-12"
                >
                  {/* Left Specs Text */}
                  <div className={`p-6 sm:p-10 space-y-6 ${tab.id === 'fire' ? 'lg:col-span-6' : 'lg:col-span-7'}`}>
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-action-red uppercase tracking-wider">{tab.subtitle}</span>
                      <h3 className="text-2xl sm:text-3xl font-extrabold text-primary-blue font-display">{tab.title}</h3>
                    </div>

                    <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                      {tab.description}
                    </p>

                    {/* Specifications List */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary-blue">
                        Componentes & Hardware Recomendado
                      </h4>
                      <ul className="grid sm:grid-cols-2 gap-2 text-sm text-gray-700">
                        {tab.specs.map((spec, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 bg-action-red rounded-full mt-2 shrink-0"></span>
                            <span>{spec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Service benefits list */}
                    <div className="space-y-2 pt-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary-blue">Benefícios Operacionais e Financeiros</h4>
                      <div className="flex flex-wrap gap-2">
                        {tab.benefits.map((benefit, bIdx) => (
                          <span key={bIdx} className="bg-slate-50 border border-slate-200 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
                            ✓ {benefit}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Block */}
                  {tab.id === 'fire' ? (
                    <div className="bg-slate-900 text-white p-6 sm:p-8 lg:col-span-6 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-800 min-h-[550px]" id="diag-bms-sdai">
                      <div className="h-full flex flex-col justify-between gap-4">
                        {/* Title & Header */}
                        <div className="border-b border-slate-800 pb-3 shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                            <h4 className="text-sm font-extrabold tracking-wider uppercase text-action-red font-display">
                              Diagnóstico Técnico Preliminar SDAI
                            </h4>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Avaliação de conformidade e soluções para prevenção de incêndio
                          </p>
                        </div>

                        <div className="grow flex flex-col justify-center">
                          <AnimatePresence mode="wait">
                            {/* Step 1: Initial Profile Select */}
                            {sdaiStep === 'initial' && (
                              <motion.div
                                key="step-initial"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4 py-2"
                              >
                                <div className="space-y-1">
                                  <h5 className="text-xs font-bold text-gray-100 uppercase tracking-widest text-warning-yellow">
                                    Vamos diagnosticar o seu sistema
                                  </h5>
                                  <p className="text-xs text-gray-300 leading-relaxed">
                                    Escolha o perfil que melhor descreve você para iniciarmos a qualificação de conformidade do seu sistema:
                                  </p>
                                </div>

                                <div className="space-y-2.5 pt-1">
                                  {/* Option A: Gestor */}
                                  <button
                                    onClick={() => {
                                      setSdaiProfile('leigo');
                                      setSdaiStep('q1');
                                    }}
                                    className="w-full text-left p-3.5 rounded-xl border border-slate-700 bg-slate-950/60 hover:bg-slate-850/80 hover:border-action-red transition-all flex items-start gap-3 group"
                                  >
                                    <div className="p-2 rounded bg-slate-800 text-action-red group-hover:scale-110 transition-transform mt-0.5 shrink-0">
                                      <Users className="w-4 h-4" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <span className="block text-xs font-bold text-gray-100 group-hover:text-action-red transition-colors">
                                        Sou Gestor / Proprietário
                                      </span>
                                      <span className="block text-[10px] text-gray-400 leading-tight">
                                        Foco técnico simplificado em resolver dores ativas de multas, seguros ou adequação para vistoria dos Bombeiros.
                                      </span>
                                    </div>
                                  </button>

                                  {/* Option B: Técnico */}
                                  <button
                                    onClick={() => {
                                      setSdaiProfile('tecnico');
                                      setSdaiStep('q1');
                                    }}
                                    className="w-full text-left p-3.5 rounded-xl border border-slate-700 bg-slate-950/60 hover:bg-slate-850/80 hover:border-action-red transition-all flex items-start gap-3 group"
                                  >
                                    <div className="p-2 rounded bg-slate-800 text-action-red group-hover:scale-110 transition-transform mt-0.5 shrink-0">
                                      <Settings className="w-4 h-4" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <span className="block text-xs font-bold text-gray-100 group-hover:text-action-red transition-colors">
                                        Sou da Engenharia / Facilities
                                      </span>
                                      <span className="block text-[10px] text-gray-400 leading-tight">
                                        Foco técnico em especificações operacionais de detectores, barramentos de loop, falhas terrestres ou logs de erro.
                                      </span>
                                    </div>
                                  </button>
                                </div>
                              </motion.div>
                            )}

                            {/* Steps q1 to q5 */}
                            {sdaiStep.startsWith('q') && (() => {
                              const currentQuestionsList = sdaiProfile === 'leigo' ? leigoQuestions : tecnicoQuestions;
                              const qNumber = parseInt(sdaiStep.substring(1), 10);
                              const qItemIdx = qNumber - 1;
                              const currentQItem = currentQuestionsList[qItemIdx];

                              if (!currentQItem) return null;

                              const progressPct = (qNumber / currentQuestionsList.length) * 100;

                              return (
                                <motion.div
                                  key={`step-${sdaiStep}`}
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="space-y-4 py-2 flex flex-col justify-between h-full"
                                >
                                  <div className="space-y-3">
                                    {/* Progress header */}
                                    <div className="flex justify-between items-center text-[10px] font-mono text-gray-400">
                                      <span>PERGUNTA {qNumber} DE {currentQuestionsList.length}</span>
                                      <span>{Math.round(progressPct)}% CONCLUÍDO</span>
                                    </div>
                                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                      <div 
                                        className="bg-action-red h-full transition-all duration-300"
                                        style={{ width: `${progressPct}%` }}
                                      />
                                    </div>

                                    <h5 className="text-xs sm:text-sm font-extrabold text-gray-100 leading-snug pt-1">
                                      {currentQItem.question}
                                    </h5>

                                    <div className="space-y-2 pt-1">
                                      {currentQItem.options.map((opt) => {
                                        const isSelected = sdaiAnswers[currentQItem.id] === opt.id;
                                        return (
                                          <button
                                            key={opt.id}
                                            onClick={() => {
                                              setSdaiAnswers(prev => ({ ...prev, [currentQItem.id]: opt.id }));
                                            }}
                                            className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between text-xs ${
                                              isSelected
                                                ? 'border-action-red bg-action-red/10 text-white'
                                                : 'border-slate-800 bg-slate-950 hover:bg-slate-900/50 hover:border-slate-700 text-gray-300'
                                            }`}
                                          >
                                            <span>{opt.text}</span>
                                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                              isSelected ? 'border-action-red bg-action-red' : 'border-slate-600'
                                            }`}>
                                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Navigation */}
                                  <div className="flex gap-2.5 pt-4 border-t border-slate-800/60 mt-auto shrink-0">
                                    <button
                                      onClick={() => {
                                        if (qNumber === 1) {
                                          setSdaiStep('initial');
                                          setSdaiProfile(null);
                                          setSdaiAnswers({});
                                        } else {
                                          setSdaiStep(`q${qNumber - 1}` as any);
                                        }
                                      }}
                                      className="px-4 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-gray-300 text-xs font-semibold tracking-wider uppercase transition-colors"
                                    >
                                      Voltar
                                    </button>

                                    <button
                                      disabled={!sdaiAnswers[currentQItem.id]}
                                      onClick={() => {
                                        if (qNumber === currentQuestionsList.length) {
                                          setSdaiStep('result');
                                        } else {
                                          setSdaiStep(`q${qNumber + 1}` as any);
                                        }
                                      }}
                                      className={`ml-auto px-5 py-2 rounded-lg text-xs font-extrabold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                                        sdaiAnswers[currentQItem.id]
                                          ? 'bg-action-red hover:bg-red-650 text-white'
                                          : 'bg-slate-850 text-gray-500 cursor-not-allowed'
                                      }`}
                                    >
                                      Avançar <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </motion.div>
                              );
                            })()}

                            {/* Result Diagnostic Output */}
                            {sdaiStep === 'result' && (() => {
                              const resultObj = getDiagnosticsResult();
                              return (
                                <motion.div
                                  key="step-result"
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="space-y-4 py-1"
                                >
                                  <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-2">
                                    <span className="text-[9px] font-bold text-action-red tracking-widest uppercase block animate-pulse">
                                      ANÁLISE DE DIAGNÓSTICO CONCLUÍDA
                                    </span>
                                    <h5 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5 leading-snug">
                                      <ShieldCheck className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                                      {resultObj.service}
                                    </h5>
                                    <p className="text-[11px] text-gray-300 leading-relaxed pt-2 border-t border-slate-900">
                                      {resultObj.description}
                                    </p>
                                  </div>

                                  <div className="space-y-2.5">
                                    <p className="text-[10px] text-gray-400 text-center uppercase tracking-wider font-semibold">
                                      Agende ativação enviando para nossa engenharia:
                                    </p>

                                    <div className="grid grid-cols-1 gap-2">
                                      <input
                                        type="text"
                                        placeholder="Seu Nome *"
                                        value={sdaiLeadForm.name}
                                        onChange={(e) => setSdaiLeadForm(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-850 text-gray-100 placeholder-gray-500 px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-action-red focus:ring-1 focus:ring-action-red"
                                      />
                                      <input
                                        type="text"
                                        placeholder="WhatsApp com DDD *"
                                        value={sdaiLeadForm.phone}
                                        onChange={(e) => setSdaiLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-850 text-gray-100 placeholder-gray-500 px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-action-red focus:ring-1 focus:ring-action-red"
                                      />
                                      <input
                                        type="text"
                                        placeholder="Nome da Empresa / Local *"
                                        value={sdaiLeadForm.company}
                                        onChange={(e) => setSdaiLeadForm(prev => ({ ...prev, company: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-850 text-gray-100 placeholder-gray-500 px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-action-red focus:ring-1 focus:ring-action-red"
                                      />
                                    </div>

                                    {sdaiFormError && (
                                      <p className="text-[10px] font-bold text-red-400 text-center">
                                        {sdaiFormError}
                                      </p>
                                    )}

                                    <button
                                      onClick={async () => {
                                        if (!sdaiLeadForm.name || !sdaiLeadForm.phone || !sdaiLeadForm.company) {
                                          setSdaiFormError('Por favor, preencha todos os campos obrigatórios (*).');
                                          return;
                                        }
                                        setSdaiFormError('');

                                        try {
                                          const resultObj = getDiagnosticsResult();
                                          const qTitle = sdaiProfile === 'leigo' ? 'Gestor / Proprietário' : 'Engenharia / Facilities';
                                          const qList = sdaiProfile === 'leigo' ? leigoQuestions : tecnicoQuestions;
                                          
                                          let answersMap: Record<string, string> = {};
                                          qList.forEach((q) => {
                                            const ansId = sdaiAnswers[q.id];
                                            const optText = q.options.find(o => o.id === ansId)?.text || 'N/A';
                                            answersMap[q.question] = optText;
                                          });

                                          await saveSupabaseRow('sdai_diagnostics', {
                                            name: sdaiLeadForm.name,
                                            company: sdaiLeadForm.company,
                                            phone: sdaiLeadForm.phone,
                                            profile_title: qTitle,
                                            recommendation: resultObj?.service || 'N/A',
                                            answers: JSON.stringify(answersMap),
                                          });

                                          setSdaiStep('success');
                                        } catch (err) {
                                          console.error("Erro ao salvar diagnóstico no Supabase:", err);
                                          setSdaiFormError(err instanceof Error ? err.message : 'Nao foi possivel salvar o diagnostico no momento.');
                                        }
                                      }}
                                      className="w-full bg-action-red hover:bg-red-650 text-white font-extrabold text-xs py-3 rounded-lg tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5 mt-1"
                                    >
                                      Enviar Diagnóstico para a Engenharia da Fireowl
                                    </button>

                                    <button
                                      onClick={() => {
                                        setSdaiStep('initial');
                                        setSdaiProfile(null);
                                        setSdaiAnswers({});
                                        setSdaiFormError('');
                                      }}
                                      className="w-full text-center text-[10px] font-bold text-gray-500 hover:text-white uppercase transition-colors"
                                    >
                                      Reiniciar
                                    </button>
                                  </div>
                                </motion.div>
                              );
                             })()}

                             {/* Success State */}
                             {sdaiStep === 'success' && (() => {
                               const resultObj = getDiagnosticsResult();
                               const qTitle = sdaiProfile === 'leigo' ? 'Gestor / Proprietário' : 'Engenharia / Facilities';
                               const qList = sdaiProfile === 'leigo' ? leigoQuestions : tecnicoQuestions;

                               let answersSummary = '';
                               qList.forEach((q) => {
                                 const ansId = sdaiAnswers[q.id];
                                 const optText = q.options.find(o => o.id === ansId)?.text || 'N/A';
                                 answersSummary += `\n• ${q.question}\n   _Resp: ${optText}_`;
                               });

                               const waText = `Olá Engenharia Fireowl Controls!\n\n*Diagnóstico Inteligente SDAI Concluído*\n\n*Dados Cadastrados:* \n• Nome: ${sdaiLeadForm.name}\n• Empresa: ${sdaiLeadForm.company}\n• WhatsApp: ${sdaiLeadForm.phone}\n\n*Perfil:* ${qTitle}\n*Recomendação:* ${resultObj.service}\n\n*Respostas do Quiz:*${answersSummary}`;
                               const waUrl = `https://wa.me/5543984160725?text=${encodeURIComponent(waText)}`;

                               return (
                                 <motion.div
                                   key="step-success"
                                   initial={{ opacity: 0, scale: 0.9 }}
                                   animate={{ opacity: 1, scale: 1 }}
                                   className="text-center py-6 space-y-4 flex flex-col items-center justify-center animate-pulse"
                                 >
                                   <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-bounce">
                                     <CheckCircle className="w-6 h-6" />
                                   </div>

                                   <div className="space-y-1">
                                     <h5 className="text-base font-extrabold text-white">
                                       Análise Enviada com Sucesso!
                                     </h5>
                                     <p className="text-xs text-gray-300 max-w-sm mx-auto leading-relaxed">
                                       Os dados cadastrais e as respostas coletadas foram transmitidos para a nossa Engenharia de Incêndio de plantão. Para receber seu memorial agora e tirar dúvidas clique no botão abaixo:
                                     </p>
                                   </div>

                                   <div className="w-full pt-2">
                                     <a
                                       href={waUrl}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className="block text-center w-full bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold text-xs py-3 px-4 rounded-lg tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5"
                                     >
                                       <Phone className="w-4 h-4 shrink-0 animate-pulse" />
                                       Chamar Engenharia no WhatsApp
                                     </a>

                                     <button
                                       onClick={() => {
                                         setSdaiStep('initial');
                                         setSdaiProfile(null);
                                         setSdaiAnswers({});
                                         setSdaiLeadForm({ name: '', phone: '', company: '' });
                                         setSdaiFormError('');
                                       }}
                                       className="text-[10px] text-gray-500 hover:text-white underline block mx-auto mt-4 transition-colors"
                                     >
                                       Fazer Novo Diagnóstico
                                     </button>
                                   </div>
                                 </motion.div>
                               );
                             })()}
                           </AnimatePresence>
                         </div>

                         {/* Footer */}
                         <div className="pt-2 text-center text-[10px] text-gray-500 border-t border-slate-800 shrink-0">
                           <span>Análise regulamentar e agendamento de acordo com a NBR 17240</span>
                         </div>
                       </div>
                     </div>
                   ) : (
                     <div className="bg-slate-900 text-white p-6 sm:p-10 lg:col-span-5 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-800">
                       <div className="space-y-6">
                         <h4 className="text-xs font-bold uppercase tracking-widest text-[#999999] border-b border-slate-800 pb-3 flex items-center gap-2">
                           <Award className="w-4 h-4 text-warning-yellow" /> Normas & Certificações do Sistema
                         </h4>

                         <div className="space-y-3">
                           {tab.certifications.map((cert, index) => (
                             <div key={index} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                               <div className="bg-slate-800 p-1.5 rounded text-warning-yellow shrink-0 font-bold text-[10px] tracking-wider">
                                 NORM
                               </div>
                               <div>
                                 <p className="text-xs font-bold text-gray-100">{cert}</p>
                                 <p className="text-[10px] text-gray-500 mt-0.5">Laudos e relatórios automatizados incluídos</p>
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>

                       <div className="pt-6 sm:pt-8 mt-6 border-t border-slate-800 space-y-4">
                         <p className="text-[11px] text-gray-400">
                           Nossos projetos são elaborados em conformidade com as diretrizes e normas brasileiras aplicáveis, garantindo a emissão dos devidos relatórios de regularidade oficial.
                         </p>
                         <a 
                           href="#contato" 
                           className="block text-center w-full bg-action-red hover:bg-red-650 text-white text-xs font-bold py-3.5 px-4 rounded-lg tracking-wider uppercase transition-colors"
                         >
                           Solicitar Memorial Descritivo
                         </a>
                       </div>
                     </div>
                   )}

                 </motion.div>
               ))}
             </AnimatePresence>
          </div>

        </div>
      </section>

      {/* Interactive Simulator Section */}
      <section className="py-20 bg-white scroll-mt-20" id="projetor">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid lg:grid-cols-12 gap-12 items-center" id="simulator-content-grid">
            
            {/* Simulator Left explanation */}
            <div className="lg:col-span-5 space-y-6" id="simulator-description-side">
              <span className="text-action-red font-bold uppercase text-xs tracking-widest block font-display">
                Simulador de Dimensionamento Técnico
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-blue font-display tracking-tight">
                Estime o Escopo Técnico do Seu Projeto em Segundos
              </h2>
              <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                Use nosso simulador baseado em algoritmos de arquitetura técnica da Fireowl para estimar sua quantidade recomendada de equipamentos básicos de automação e segurança.
              </p>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <Building className="w-5 h-5 text-action-red" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-primary-blue">Foco Industrial e Predial</h4>
                    <p className="text-xs text-gray-500 mt-1">Garante conformidade com o Corpo de Bombeiros de acordo com a sua área total em m².</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5 text-action-red" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-primary-blue">Cálculo de Densidade</h4>
                    <p className="text-xs text-gray-500 mt-1">Otimiza a quantidade de CFTV e controle de acesso conforme os metros quadrados e nível de risco exigido.</p>
                  </div>
                </div>
              </div>

              {/* Legal disclaimer */}
              <div className="bg-[#1A1A72]/5 border-l-4 border-primary-blue p-4 rounded-r-xl">
                <p className="text-xs text-primary-blue leading-relaxed font-semibold">
                  Aviso Técnico: As estimativas fornecidas são simulações paramétricas para estudos iniciais. Não substituem o memorial técnico oficial assinado por nossos engenheiros.
                </p>
              </div>
            </div>

            {/* Simulator Right interactive panel */}
            <div className="lg:col-span-7 bg-bg-light-gray rounded-2xl border border-gray-200 shadow-xl overflow-hidden p-6 sm:p-8" id="simulator-interactive-box">
              
              {!simulatorSubmitted ? (
                /* Dynamic Input Form & Controls */
                <form onSubmit={handleSimulatorSubmit} className="space-y-6">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                    <span className="font-bold text-primary-blue text-lg">Parâmetros Operacionais</span>
                    <span className="text-xs text-gray-500 font-mono">PASSO 1 DE 2</span>
                  </div>

                  {/* Building Type Radio Grid */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-700 uppercase block">Tipo de Infraestrutura / Edificação</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'commercial', title: 'Comercial / Escritórios' },
                        { id: 'industrial', title: 'Industrial / Galpão' },
                        { id: 'hospital', title: 'Hospital / Hotelaria' },
                      ].map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setBuildingType(type.id)}
                          className={`p-3 rounded-lg border text-xs font-bold transition-all ${
                            buildingType === type.id
                              ? 'border-primary-blue bg-primary-blue text-white'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {type.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Area Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-gray-700 uppercase">Área Total do Empreendimento (m²)</label>
                      <span className="text-sm font-extrabold text-primary-blue font-mono">{area.toLocaleString('pt-BR')} m²</span>
                    </div>
                    <input
                      type="range"
                      min="500"
                      max="20000"
                      step="500"
                      value={area}
                      onChange={(e) => setArea(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-action-red"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                      <span>500 m²</span>
                      <span>5.000 m²</span>
                      <span>10.000 m²</span>
                      <span>15.000 m²</span>
                      <span>20.000 m²</span>
                    </div>
                  </div>

                  {/* Security Tier Radio */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-700 uppercase block">Nível de Rigidez das Políticas de Segurança</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'standard', label: 'Monitoramento Padrão' },
                        { id: 'high', label: 'Alta Rigidez NFPA' },
                        { id: 'enterprise', label: 'Segurança Crítica / Bancos' },
                      ].map((tier) => (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => setSecurityLevel(tier.id)}
                          className={`p-3 rounded-lg border text-xs font-bold transition-all ${
                            securityLevel === tier.id
                              ? 'border-[#1A1A72] bg-[#1A1A72] text-white shadow-xs'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {tier.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Checkbox of needed services */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-700 uppercase block">Selecionar Sistemas Requeridos</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-colors">
                        <input
                          type="checkbox"
                          checked={needsSystems.fire}
                          onChange={(e) => setNeedsSystems({ ...needsSystems, fire: e.target.checked })}
                          className="w-4 h-4 rounded text-action-red focus:ring-action-red cursor-pointer accent-action-red"
                        />
                        <div className="text-xs">
                          <span className="block font-bold text-gray-800">Alarme de Incêndio</span>
                          <span className="text-[10px] text-[#888888]">Norma NBR 17240</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-colors">
                        <input
                          type="checkbox"
                          checked={needsSystems.cctv}
                          onChange={(e) => setNeedsSystems({ ...needsSystems, cctv: e.target.checked })}
                          className="w-4 h-4 rounded text-action-red focus:ring-action-red cursor-pointer accent-action-red"
                        />
                        <div className="text-xs">
                          <span className="block font-bold text-gray-800">CFTV Inteligente</span>
                          <span className="text-[10px] text-[#888888]">Monitoramento por IA</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-colors">
                        <input
                          type="checkbox"
                          checked={needsSystems.access}
                          onChange={(e) => setNeedsSystems({ ...needsSystems, access: e.target.checked })}
                          className="w-4 h-4 rounded text-action-red focus:ring-action-red cursor-pointer accent-action-red"
                        />
                        <div className="text-xs">
                          <span className="block font-bold text-gray-800">Controle de Acesso</span>
                          <span className="text-[10px] text-[#888888]">Biometria / Cancelas</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-colors">
                        <input
                          type="checkbox"
                          checked={needsSystems.automation}
                          onChange={(e) => setNeedsSystems({ ...needsSystems, automation: e.target.checked })}
                          className="w-4 h-4 rounded text-action-red focus:ring-action-red cursor-pointer accent-action-red"
                        />
                        <div className="text-xs">
                          <span className="block font-bold text-gray-800">BMS / Automação Predial</span>
                          <span className="text-[10px] text-[#888888]">Eficiência Energética</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Quote Form user lock */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 border-dashed space-y-4">
                    <span className="block text-xs font-bold text-primary-blue uppercase text-center">Para liberar o relatório e valor estimado:</span>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Seu Nome *</label>
                        <input
                          type="text"
                          required
                          value={quoteFormData.name}
                          onChange={(e) => setQuoteFormData({ ...quoteFormData, name: e.target.value })}
                          placeholder="Ex: João M. Silva"
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary-blue outline-hidden text-[#555]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Sua Empresa *</label>
                        <input
                          type="text"
                          required
                          value={quoteFormData.company}
                          onChange={(e) => setQuoteFormData({ ...quoteFormData, company: e.target.value })}
                          placeholder="Ex: Indústria Alfa S/A"
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary-blue outline-hidden text-[#555]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Seu Cargo *</label>
                        <input
                          type="text"
                          required
                          value={quoteFormData.role}
                          onChange={(e) => setQuoteFormData({ ...quoteFormData, role: e.target.value })}
                          placeholder="Ex: Gerente de Facilities / Segurança"
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary-blue outline-hidden text-[#555]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">E-mail Profissional *</label>
                        <input
                          type="email"
                          required
                          value={quoteFormData.email}
                          onChange={(e) => setQuoteFormData({ ...quoteFormData, email: e.target.value })}
                          placeholder="joao.silva@empresa.com.br"
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary-blue outline-hidden text-[#555]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submission Button */}
                  <button
                    type="submit"
                    className="w-full bg-action-red hover:bg-red-650 text-white font-extrabold py-4 px-6 rounded-xl text-center text-sm tracking-wider uppercase transition-all hover:scale-[1.01]"
                  >
                    Calcular Escopo & Liberar Relatório Estudo B2B →
                  </button>
                </form>
              ) : (
                /* Dynamic Output Display Result */
                <div className="space-y-6 animate-fadeIn" id="simulator-results-box">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                    <div>
                      <span className="font-bold text-emerald-600 block text-xs tracking-wider uppercase">✔ Simulação Parametrizada Concluída</span>
                      <span className="font-bold text-primary-blue text-lg">Estimativa Técnica de Escopo</span>
                    </div>
                    <button
                      onClick={() => setSimulatorSubmitted(false)}
                      className="text-xs text-primary-blue hover:underline font-bold"
                    >
                      Refazer Parâmetros
                    </button>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-800 text-xs leading-relaxed">
                    Olá <strong>{quoteFormData.name}</strong>, baseado na área de <strong>{area.toLocaleString('pt-BR')} m²</strong> para um empreendimento do tipo <strong>{buildingType === 'commercial' ? 'Escritório/Comercial' : buildingType === 'industrial' ? 'Industrial/Logístico' : 'Hospital/Hotelaria'}</strong>, nossos algoritmos construíram o seguinte memorial técnico preliminar:
                  </div>

                  {/* Active Services Estimates List */}
                  <div className="space-y-3">
                    
                    {/* Alarme de Incêndio Estimate */}
                    {needsSystems.fire && (
                      <div className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="bg-red-50 p-2 rounded-lg text-action-red">
                            <Flame className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-gray-800">Alarme e Detecção Incêndio</span>
                            <span className="text-[10px] text-gray-500">Recomenda-se centrais de laço redundante endereçáveis.</span>
                            <div className="flex gap-2 mt-1 text-[10px] font-mono font-semibold text-primary-blue">
                              <span>• Detectores Ópticos/Térmicos: {simulationResults.hardware.fire.detectors} un</span>
                              <span>• Painéis Centrais: {simulationResults.hardware.fire.panels} un</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block text-[10px] text-gray-400 font-bold uppercase">ESTIMATIVA SUT</span>
                          <span className="text-sm font-extrabold text-primary-blue font-mono">R$ {simulationResults.hardware.fire.estimatedCost.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    )}

                    {needsSystems.cctv && (
                      <div className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="bg-red-50 p-2 rounded-lg text-action-red">
                            <Cctv className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-gray-800">CFTV Inteligente por Inteligência Artificial</span>
                            <span className="text-[10px] text-gray-500">Processamento de analíticos embarcados no próprio chip.</span>
                            <div className="flex gap-2 mt-1 text-[10px] font-mono font-semibold text-primary-blue">
                              <span>• Câmeras IP Analíticas: {simulationResults.hardware.cctv.cameras} un</span>
                              <span>• Canais NVR Gravador: {simulationResults.hardware.cctv.nvrPorts} ch</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block text-[10px] text-gray-400 font-bold uppercase">ESTIMATIVA SUT</span>
                          <span className="text-sm font-extrabold text-primary-blue font-mono">R$ {simulationResults.hardware.cctv.estimatedCost.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    )}

                    {needsSystems.access && (
                      <div className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="bg-red-50 p-2 rounded-lg text-action-red">
                            <Fingerprint className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-gray-800">Controle de Acesso Biométrico e RFID</span>
                            <span className="text-[10px] text-gray-500">Dispositivos antifraude IP nativo com PoE.</span>
                            <div className="flex gap-2 mt-1 text-[10px] font-mono font-semibold text-primary-blue">
                              <span>• Leitores Biométricos Faciais: {simulationResults.hardware.access.points} un</span>
                              <span>• Leitores Auxiliares RF: {simulationResults.hardware.access.readers} un</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block text-[10px] text-gray-400 font-bold uppercase">ESTIMATIVA SUT</span>
                          <span className="text-sm font-extrabold text-primary-blue font-mono">R$ {simulationResults.hardware.access.estimatedCost.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    )}

                    {needsSystems.automation && (
                      <div className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="bg-red-50 p-2 rounded-lg text-action-red">
                            <Cpu className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-gray-800">Automação BMS / HVAC Integrados</span>
                            <span className="text-[10px] text-gray-500">Plataforma Honeywell Tridium ou Siemens.</span>
                            <div className="flex gap-2 mt-1 text-[10px] font-mono font-semibold text-primary-blue">
                              <span>• Controladores CLPs: {simulationResults.hardware.automation.clpControllers} un</span>
                              <span>• Sensores de Qualidade Ar: {simulationResults.hardware.automation.sensors} un</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block text-[10px] text-gray-400 font-bold uppercase">ESTIMATIVA SUT</span>
                          <span className="text-sm font-extrabold text-primary-blue font-mono">R$ {simulationResults.hardware.automation.estimatedCost.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Total Value estimated */}
                  <div className="bg-primary-blue text-white p-5 rounded-xl flex justify-between items-center">
                    <div>
                      <span className="block text-xs font-bold text-gray-300 uppercase tracking-wider">Investimento Estimado de Implantação (Turnkey)</span>
                      <span className="text-xs text-gray-400">Equipamentos + Projetos de Engenharia + Instalação física</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs text-warning-yellow font-bold uppercase">Valor Estimado Geral</span>
                      <span className="text-2xl font-extrabold text-white font-mono">R$ {simulationResults.totalEstimate.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>

                  {/* Immediate Lead Capture and Specialist Follow-up Call */}
                  <div className="space-y-4 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500 text-center">
                      Enviamos um arquivo PDF detalhado contendo a planta indicativa conceitual do projeto para o e-mail <strong>{quoteFormData.email}</strong>.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <a
                        href="#contato"
                        className="bg-action-red flex items-center justify-center gap-2 hover:bg-red-650 text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider"
                      >
                        <span className="status-dot shrink-0" />
                        Fale com a Engenharia para Validar Cálculo
                      </a>
                      <button
                        onClick={() => {
                          alert('Planta e escopo do e-mail reenviados com sucesso no canal B2B!');
                        }}
                        className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider text-center"
                      >
                        Reenviar Escopo no WhatsApp
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </div>

          </div>

        </div>
      </section>

      {/* Corporate Value & Why Fireowl controls (Diferenciais) */}
      <section className="py-20 bg-bg-light-gray border-y border-gray-200 scroll-mt-20" id="diferenciais">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-action-red font-bold uppercase text-xs tracking-widest block font-display">
              Engenharia Pautada em Resultados
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-blue font-display tracking-tight">
              Os 4 Pilares da Alta Confiança Técnica Fireowl
            </h2>
            <p className="text-gray-600">
              Não vendemos apenas sensores e cabos. Entregamos conformidade legal absoluta, continuidade de negócios e proteção de operações de grande porte e missão crítica.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8" id="pillars-grid">
            
            {/* Pillar 1 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-action-red">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-extrabold text-primary-blue font-display">Conformidade Legal</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Todos os projetos seguem rigorosamente as exigências das normas técnicas da ABNT e os decretos estaduais do Corpo de Bombeiros, visando a aprovação oficial e regularização de sua edificação.
                </p>
              </div>
              <span className="block text-xs font-bold text-gray-400 pt-4 border-t border-gray-100 uppercase tracking-widest">DIRETRIZ DE LEI</span>
            </div>

            {/* Pillar 2 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-action-red">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-extrabold text-primary-blue font-display">Parceria Premium</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Trabalhamos em parceria com as principais marcas nacionais e internacionais do setor (Intelbras, Tecnohold, Siemens, Honeywell, Bosch, Milestone e Axis), garantindo equipamentos homologados de alta qualidade.
                </p>
              </div>
              <span className="block text-xs font-bold text-gray-400 pt-4 border-t border-gray-100 uppercase tracking-widest">GLOBAL PARTNERS</span>
            </div>

            {/* Pillar 3 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-action-red">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-extrabold text-primary-blue font-display">Suporte & SLA de Engenharia 24/7</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Plano de manutenção certificado e equipe de engenharia elétrica de prontidão com limite regulado de SLA. Plena capacidade de auditar e substituir grandes volumes de dispositivos (sensores, módulos, sirenes) em ambientes de grande porte.
                </p>
              </div>
              <span className="block text-xs font-bold text-gray-400 pt-4 border-t border-gray-100 uppercase tracking-widest">DISPONIBILIDADE</span>
            </div>

            {/* Pillar 4 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-action-red">
                  <Settings className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-extrabold text-primary-blue font-display">Integração Total BMS</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Conectividade pura. Unifique todos os subsistemas analógicos ou IP sob o mesmo guarda-chuva de operação, permitindo economia de energia escalada e rápida tomada de decisão em sinistros.
                </p>
              </div>
              <span className="block text-xs font-bold text-gray-400 pt-4 border-t border-gray-100 uppercase tracking-widest">SISTEMA INTEGRADO</span>
            </div>

          </div>

        </div>
      </section>

      {/* Real Success Cases (Cases De Sucesso) */}
      <section className="py-20 bg-white border-b border-gray-150 scroll-mt-20" id="cases">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 animate-fade-in">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-action-red font-bold uppercase text-xs tracking-widest block font-display">
              Compromisso com Resultados Reais
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-blue font-display tracking-tight">
              Cases de Sucesso
            </h2>
            <p className="text-gray-600 font-sans">
              Resultados reais em ambientes de missão crítica
            </p>
          </div>

          {/* Responsive Cases Grid */}
          <div className="grid md:grid-cols-3 gap-8" id="cases-grid">
            
            {casesData.map((caseItem, idx) => (
              <div
                key={caseItem.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCase(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedCase(idx);
                  }
                }}
                className="bg-white hover:bg-bg-light-gray p-8 rounded-2xl border border-gray-200 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer group focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-blue relative overflow-hidden"
                aria-label={`Visualizar detalhes do case ${caseItem.client}`}
              >
                <div className="space-y-6">
                  {/* Top segment: Client name & critical badges */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xl font-bold font-display text-primary-blue group-hover:text-action-red transition-colors">
                        {caseItem.client}
                      </h3>
                      {caseItem.isCritical && (
                        <span className="bg-action-red text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                          Missão Crítica
                        </span>
                      )}
                    </div>
                    {caseItem.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {caseItem.tags.map((tag, tagIdx) => (
                          <span key={tagIdx} className="text-[10px] font-bold text-[#666666] bg-gray-100 px-2 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Highlights and badges in yellow or blue */}
                  <div className="flex flex-col gap-2 pt-2">
                    {caseItem.badges.slice(0, 2).map((badge, badgeIdx) => (
                      <div 
                        key={badgeIdx}
                        className="inline-flex items-center gap-2 bg-[#1A1A72]/5 text-[#1A1A72] px-3 py-1.5 rounded-xl text-xs font-bold font-sans tracking-wide"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-action-red"></span>
                        {badge}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer of card: indicates "see details" */}
                <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-100 text-sm font-bold text-[#666666] group-hover:text-primary-blue transition-colors">
                  <span className="text-xs uppercase tracking-wider">Ver detalhes do case</span>
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-primary-blue group-hover:text-white transition-all text-gray-500">
                    <Plus className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" />
                  </div>
                </div>

                {/* Hover outline visual effect */}
                <div className="absolute inset-0 border-2 border-transparent group-hover:border-[#1A1A72]/10 rounded-2xl pointer-events-none transition-all duration-300" />
              </div>
            ))}

          </div>

          {/* Modal Lightbox Component */}
          <AnimatePresence>
            {selectedCase !== null && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 md:p-10" id="case-modal-overlay">
                
                {/* Dark overlay backdrop with fade animation */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.65 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-black cursor-pointer"
                  onClick={() => setSelectedCase(null)}
                />

                {/* Modal Container with slide & scale animation */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden relative z-10 border border-slate-200 max-h-[90vh] flex flex-col"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="modal-case-title"
                >
                  {/* Top header bar */}
                  <div className="bg-[#1A1A72] text-white p-6 md:p-8 flex items-center justify-between border-b border-white/10 shrink-0">
                    <div className="space-y-1">
                      <span className="text-action-red font-bold uppercase text-[10px] tracking-widest block font-display">
                        Estudo de Caso Reconhecido
                      </span>
                      <h3 id="modal-case-title" className="text-xl md:text-2xl font-extrabold font-display">
                        Case - {casesData[selectedCase].client}
                      </h3>
                    </div>
                    
                    {/* Compact header badges */}
                    <div className="flex items-center gap-3">
                      {casesData[selectedCase].isCritical && (
                        <span className="hidden sm:inline-block bg-action-red text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                          Missão Crítica
                        </span>
                      )}
                      <button
                        onClick={() => setSelectedCase(null)}
                        className="text-white/80 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/15 transition-all text-sm shrink-0"
                        aria-label="Selecionar para fechar modal"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Scrollable content body */}
                  <div className="overflow-y-auto p-6 md:p-8 space-y-8 flex-1">
                    
                    {/* Numbers highlighted inside the detailed view */}
                    <div className="grid sm:grid-cols-3 gap-4">
                      {casesData[selectedCase].badges.map((b, bIdx) => (
                        <div key={bIdx} className="bg-bg-light-gray border border-gray-150 rounded-2xl p-4 text-center">
                          <span className="block text-primary-blue font-extrabold text-sm sm:text-base font-display">
                            {b}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* 3 Columns structure inside modal */}
                    <div className="grid md:grid-cols-3 gap-8" id="modal-three-columns">
                      
                      {/* Column 1: PROBLEMA */}
                      <div className="bg-red-50/20 border border-red-100 p-6 rounded-2xl space-y-3 relative overflow-hidden flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-action-red">
                            <AlertTriangle className="w-5 h-5 text-action-red" />
                          </div>
                          <h4 className="text-base font-extrabold text-[#E63946] font-display uppercase tracking-wider">
                            O Problema
                          </h4>
                          <p className="text-gray-700 text-sm leading-relaxed">
                            {casesData[selectedCase].problem}
                          </p>
                        </div>
                        <span className="block text-[10px] font-extrabold text-action-red/60 uppercase tracking-widest pt-2 border-t border-red-100/40">Dificuldade Ativa</span>
                      </div>

                      {/* Column 2: SOLUÇÃO */}
                      <div className="bg-blue-50/20 border border-blue-100 p-6 rounded-2xl space-y-3 relative overflow-hidden flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-primary-blue">
                            <Wrench className="w-5 h-5 text-primary-blue" />
                          </div>
                          <h4 className="text-base font-extrabold text-[#1A1A72] font-display uppercase tracking-wider">
                            A Solução
                          </h4>
                          <p className="text-gray-700 text-sm leading-relaxed">
                            {casesData[selectedCase].solution}
                          </p>
                        </div>
                        <span className="block text-[10px] font-extrabold text-primary-blue/60 uppercase tracking-widest pt-2 border-t border-blue-100/40">Engenharia e Ação</span>
                      </div>

                      {/* Column 3: RESULTADO */}
                      <div className="bg-emerald-50/20 border border-emerald-100 p-6 rounded-2xl space-y-3 relative overflow-hidden flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                          </div>
                          <h4 className="text-base font-extrabold text-emerald-600 font-display uppercase tracking-wider">
                            O Resultado
                          </h4>
                          <p className="text-gray-700 text-sm leading-relaxed">
                            {casesData[selectedCase].result}
                          </p>
                        </div>
                        <span className="block text-[10px] font-extrabold text-emerald-600/60 uppercase tracking-widest pt-2 border-t border-emerald-100/40">Sucesso Alcançado</span>
                      </div>

                    </div>

                  </div>

                  {/* Footer actions inside modal */}
                  <div className="bg-bg-light-gray p-6 border-t border-gray-150 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                    <span className="text-xs text-[#666666] font-semibold">
                      Gostou deste resultado? Garanta conformidade na sua empresa
                    </span>
                    <div className="flex gap-3 w-full sm:w-auto">
                      <button
                        onClick={() => setSelectedCase(null)}
                        className="flex-1 sm:flex-none border border-gray-300 hover:bg-gray-100 text-[#4D4D4D] font-bold py-2.5 px-6 rounded-xl text-xs transition-colors uppercase tracking-wider"
                      >
                        Fechar
                      </button>
                      <a
                        href="#contato"
                        onClick={() => setSelectedCase(null)}
                        className="flex-1 sm:flex-none bg-action-red hover:bg-red-600 text-white font-extrabold py-2.5 px-6 rounded-xl text-xs text-center uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                      >
                        <span className="status-dot shrink-0" />
                        Fale com a Engenharia
                      </a>
                    </div>
                  </div>

                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* BLOCO ADICIONAL (Capacidades Demonstradas) */}
          <div className="bg-bg-light-gray p-8 sm:p-12 rounded-3xl border border-gray-200 mt-16 space-y-8" id="capabilities-block">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-extrabold text-primary-blue font-display tracking-tight">
                Capacidades Demonstradas
              </h3>
              <div className="w-12 h-1 bg-action-red mx-auto rounded-full" />
            </div>

            {/* Grid of 4 items with icon, number and label */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6" id="capabilities-grid">
              
              {/* Item 1: Infraestrutura */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-primary-blue shrink-0">
                  <Zap className="w-6 h-6 text-primary-blue" />
                </div>
                <div>
                  <span className="block text-xl font-extrabold text-primary-blue font-mono">2.500+ km</span>
                  <p className="text-[#666666] text-xs font-semibold uppercase mt-1 tracking-wide">
                    de infraestrutura instalada
                  </p>
                </div>
              </div>

              {/* Item 2: Ferramenta */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-action-red shrink-0">
                  <Wrench className="w-6 h-6 text-action-red" />
                </div>
                <div>
                  <span className="block text-xl font-extrabold text-primary-blue font-mono">260+ falhas</span>
                  <p className="text-[#666666] text-xs font-semibold uppercase mt-1 tracking-wide">
                    regularizadas sem troca de equipamento
                  </p>
                </div>
              </div>

              {/* Item 3: Prédio/Loja */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                  <Building className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <span className="block text-xl font-extrabold text-primary-blue font-mono font-sans">Multi-unidade</span>
                  <p className="text-[#666666] text-xs font-semibold uppercase mt-1 tracking-wide">
                    atendimento a redes e grupos
                  </p>
                </div>
              </div>

              {/* Item 4: Relógio */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                  <Clock className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <span className="block text-xl font-extrabold text-primary-blue font-mono font-sans">7 dias</span>
                  <p className="text-[#666666] text-xs font-semibold uppercase mt-1 tracking-wide">
                    resposta em intervenção emergencial
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* Main Quote / Project RFP Capture Lead Form (Contato) */}
      <section className="py-20 bg-bg-light-gray border-b border-gray-150 scroll-mt-20" id="contato">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid lg:grid-cols-12 gap-12" id="contact-split-grid">
            
            {/* Contact details side */}
            <div className="lg:col-span-5 space-y-8" id="contact-details-side">
              <div className="space-y-4">
                <span className="text-action-red font-bold uppercase text-xs tracking-widest block font-display">
                  Canais e Consultoria Corporativa
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-primary-blue font-display tracking-tight">
                  Inicie Seu Estudo de Escopo Técnico Hoje
                </h2>
                <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                  Preencha o formulário e nossa equipe entrará em contato com você em até <strong className="text-primary-blue">1 dia útil</strong>.
                </p>
              </div>

              {/* Direct corporate indicators */}
              <div className="space-y-4 text-sm text-[#444444]" id="contact-direct-channels">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-primary-blue shrink-0">
                    <Phone className="w-5 h-5 text-action-red" />
                  </div>
                  <div>
                    <span className="block font-bold text-gray-800">Telefone e WhatsApp B2B</span>
                    <a href="https://wa.me/5543984160725?text=Olá!%20Gostaria%20de%20um%20diagnóstico%20técnico%20para%20minha%20empresa." target="_blank" rel="noopener noreferrer" className="block text-primary-blue hover:text-action-red hover:underline mt-1 font-extrabold text-xs transition-colors">
                      +55 (43) 98416-0725
                    </a>
                    <p className="text-gray-400 text-[10px] mt-0.5">Atendimento de segunda a sexta, das 8h às 18h.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-primary-blue shrink-0">
                    <Mail className="w-5 h-5 text-action-red" />
                  </div>
                  <div>
                    <span className="block font-bold text-gray-800">Canais de E-mail de Engenharia</span>
                    <a href="mailto:contato@fireowlcontrols.com.br" className="block text-primary-blue hover:text-action-red hover:underline mt-1 font-extrabold text-xs transition-colors">
                      contato@fireowlcontrols.com.br
                    </a>
                    <p className="text-gray-400 text-[10px] mt-0.5">Para envio direto de editais, desenhos em DWG de plantas e escopos licitatórios.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-primary-blue shrink-0">
                    <MapPin className="w-5 h-5 text-action-red" />
                  </div>
                  <div>
                    <span className="block font-bold text-gray-800">Escritório Central</span>
                    <p className="text-gray-600 mt-1 text-xs">AV. Higienópolis, nº70, 7º andar, Sl 62, Centro</p>
                    <p className="text-gray-400 text-[10px] mt-0.5">Londrina - PR, CEP 86020-080</p>
                  </div>
                </div>
              </div>

              {/* Engineering team and speed indicator */}
              <div className="bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden" id="sla-badge-box">
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xl text-warning-yellow">
                    24h
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-warning-yellow uppercase tracking-wider">Compromisso Técnico</span>
                    <span className="block text-md font-bold text-gray-200 mt-0.5">Garantia de Tempo de Resposta Corporativo</span>
                  </div>
                </div>
                <div className="absolute right-[-10px] bottom-[-20px] text-[100px] font-black text-slate-800/10 leading-none">SLA</div>
              </div>
            </div>

            {/* Form side */}
            <div className="lg:col-span-7" id="contact-form-side">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 sm:p-10 relative">
                
                {!contactSubmitted ? (
                  /* Live RFC Capture Form */
                  <form onSubmit={handleContactSubmit} className="space-y-6">
                    <div className="space-y-1">
                      <h3 className="text-xl font-extrabold text-primary-blue font-display">Conforto com o nosso Suporte Comercial</h3>
                      <p className="text-xs text-gray-500">Solicite propostas, visitas técnicas ou estimativas sem compromisso.</p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Seu Nome Completo *</label>
                        <input
                          type="text"
                          required
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          placeholder="Ex: Roberto Carlos"
                          className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:bg-white focus:ring-1 focus:ring-primary-blue outline-hidden text-[#555]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Empresa Representada *</label>
                        <input
                          type="text"
                          required
                          value={contactForm.company}
                          onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                          placeholder="Ex: Empresa de Alimentos S/A"
                          className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:bg-white focus:ring-1 focus:ring-primary-blue outline-hidden text-[#555]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Seu Cargo / Atribuição *</label>
                        <input
                          type="text"
                          required
                          value={contactForm.role}
                          onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                          placeholder="Ex: Engenheiro, Facilities, Compras"
                          className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:bg-white focus:ring-1 focus:ring-primary-blue outline-hidden text-[#555]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">E-mail Profissional *</label>
                        <input
                          type="email"
                          required
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          placeholder="ex: roberto@empresa.com"
                          className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:bg-white focus:ring-1 focus:ring-primary-blue outline-hidden text-[#555]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Telefone com DDD / WhatsApp *</label>
                        <input
                          type="tel"
                          required
                          value={contactForm.phone}
                          onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                          placeholder="Ex: (11) 99999-9999"
                          className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:bg-white focus:ring-1 focus:ring-primary-blue outline-hidden text-[#555]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Cidade - Estado *</label>
                        <input
                          type="text"
                          required
                          value={contactForm.city}
                          onChange={(e) => setContactForm({ ...contactForm, city: e.target.value })}
                          placeholder="Ex: Campinas - SP"
                          className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:bg-white focus:ring-1 focus:ring-primary-blue outline-hidden text-[#555]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">Principal Interesse / Necessidade</label>
                      <select
                        value={contactForm.interest}
                        onChange={(e) => setContactForm({ ...contactForm, interest: e.target.value })}
                        className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:bg-white focus:ring-1 focus:ring-primary-blue outline-hidden text-gray-750 font-medium"
                      >
                        <option value="all">Sistemas Completos Integrados B2B</option>
                        <option value="fire">Alarme e Proteção Contra Incêndio</option>
                        <option value="cctv">CFTV Inteligente, Controle e Câmeras por IA</option>
                        <option value="access">Controle de Acesso Biométrico e RFID</option>
                        <option value="automation">Automação predial BMS e Controle HVAC</option>
                        <option value="upgrade">Manutenção Técnica e Retrofit Tecnológico</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">Mensagem / Escopo Adicional</label>
                      <textarea
                        rows={4}
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        placeholder="Descreva a área aproximada em m², complexidade do projeto e eventuais exigências de normas especiais que seu projeto requeira..."
                        className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:bg-white focus:ring-1 focus:ring-primary-blue outline-hidden text-[#555]"
                      ></textarea>
                    </div>

                    {/* Submit action */}
                    <button
                      type="submit"
                      disabled={isContactSubmitting}
                      className="w-full bg-action-red hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-extrabold py-4 px-6 rounded-xl text-center text-sm tracking-wider uppercase transition-all shadow-md shadow-action-red/10 flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      <span>{isContactSubmitting ? 'Enviando...' : 'Enviar RFQ para Engenharia'}</span>
                      <Send className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
                    </button>
                    {contactError && (
                      <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        {contactError}
                      </p>
                    )}
                  </form>
                ) : (
                  /* Success Screen feedback state */
                  <div className="text-center py-12 space-y-6 animate-fadeIn" id="contact-success-screen">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-2xl font-extrabold text-primary-blue font-display">Solicitação Registrada!</h3>
                      <p className="text-sm text-gray-600 max-w-md mx-auto">
                        Obrigado, <strong>{contactForm.name}</strong>. Nossa equipe técnica de engenharia de segurança já recebeu seu escopo técnico para a empresa <strong>{contactForm.company}</strong>.
                      </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-gray-150 inline-block text-left text-xs max-w-sm">
                      <span className="block font-bold text-[#1A1A72] border-b border-gray-200 pb-2 mb-2 uppercase tracking-tight">CUSTÓDIA RESERVADA DA REQUISIÇÃO</span>
                      <p className="text-[#666] leading-relaxed">
                        • ID de Protocolo: <strong>{protocolId}</strong><br />
                        • SLA Acionamento Técnico: <strong>Máximo 2 horas</strong><br />
                        • Canal de Retorno prioritário: <strong>{contactForm.phone} / {contactForm.email}</strong>
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setContactSubmitted(false);
                        setContactError('');
                        setContactForm({
                          name: '',
                          company: '',
                          role: '',
                          phone: '',
                          email: '',
                          city: '',
                          message: '',
                          interest: 'all',
                        });
                      }}
                      className="block bg-primary-blue hover:bg-blue-900 text-white font-bold py-3 px-6 rounded-lg text-xs tracking-wider uppercase mx-auto"
                    >
                      Nova Solicitação de Suporte
                    </button>
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-primary-blue text-white py-16 scroll-mt-20 border-t border-white/10" id="final-cta">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display text-white">
            Pronto para proteger sua operação?
          </h2>
          <p className="text-slate-200 max-w-2xl mx-auto text-sm sm:text-base">
            Otimize seu orçamento de segurança e garanta total conformidade técnica e legal. Nossos engenheiros estão de prontidão para desenhar seu projeto sob medida.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <a
              href="#contato"
              className="w-full sm:w-auto bg-action-red hover:bg-red-600 text-white font-extrabold py-4 px-8 rounded-xl text-sm uppercase tracking-wider transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg shadow-action-red/20 text-center"
            >
              Agende uma Avaliação Técnica
            </a>
            <a
              href="https://wa.me/5543984160725?text=Olá!%20Gostaria%20de%20agendar%20uma%20avaliação%20técnica%20de%20sistemas."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto border-2 border-white hover:bg-white hover:text-primary-blue text-white font-extrabold py-4 px-8 rounded-xl text-sm uppercase tracking-wider transition-all duration-300 transform hover:-translate-y-0.5 text-center"
            >
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Corporate Certification and Regulatory Compliance Footer Seals */}
      <footer className="bg-primary-blue text-white pt-16 pb-12 mt-auto text-sm border-t border-white/10" id="main-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12" id="footer-grid">
          
          {/* Logo brand grid segment */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 overflow-hidden shrink-0">
                <OfficialLogo className="w-full h-full" isFooter={true} />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white font-display">
                FIREOWL CONTROLS<span className="text-action-red">.</span>
              </span>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">
              Alta confiabilidade técnica em automação predial, sistemas especiais de prevenção e combate a incêndio, circuitos inteligentes de CFTV por inteligência artificial e bloqueios físicos robustos contra intrusões de perímetro e salas de TI.
            </p>
          </div>

          {/* Solution navigation grid fold */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-warning-yellow">Nossas Verticais</h4>
            <ul className="space-y-2 text-xs text-gray-400 font-semibold" id="footer-solutions-links">
              <li><a href="#solucoes" onClick={() => setActiveVerticalTab('fire')} className="hover:text-white transition-colors">Sistemas Contra Incêndio NBR 17240</a></li>
              <li><a href="#solucoes" onClick={() => setActiveVerticalTab('cctv')} className="hover:text-white transition-colors">Câmeras com Inteligência de Borda AI</a></li>
              <li><a href="#solucoes" onClick={() => setActiveVerticalTab('access')} className="hover:text-white transition-colors">Controle de Acesso Biométrico Ip e Rádio</a></li>
              <li><a href="#solucoes" onClick={() => setActiveVerticalTab('automation')} className="hover:text-white transition-colors">Eficiência Energética & BMS de Predios</a></li>
              <li><a href="#contato" className="hover:text-white transition-colors">Laudos de Exigência do Corpo de Bombeiros</a></li>
            </ul>
          </div>

          {/* Legislation certifications references */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-warning-yellow">Canais e Segurança</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Central do Cliente e Suporte de Plantão: <br />
              <a href="https://wa.me/5543984160725?text=Olá!%20Gostaria%20de%20suporte%20técnico%20para%20minha%20instalação." target="_blank" rel="noopener noreferrer" className="text-white hover:text-warning-yellow hover:underline transition-all block mt-1 font-extrabold">
                +55 (43) 98416-0725
              </a>
              Atendimento de Suporte Técnico exclusivo para instalações corporativas homologadas em contrato de SLA ativo.
            </p>
          </div>

          {/* Legal / Engineering values */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-warning-yellow">Navegação</h4>
            <ul className="space-y-2 text-xs text-gray-400 font-semibold">
              <li><a href="#solucoes" className="hover:text-white">Nossas Soluções</a></li>
              <li><a href="#diferenciais" className="hover:text-white">Diferenciais</a></li>
              <li><a href="#contato" className="hover:text-white">Solicitar Avaliação</a></li>
              <li><a href="#cases" className="hover:text-white">Casos Reais</a></li>
              <li><a href="#contato" className="hover:text-white">Contato Direto</a></li>
            </ul>
          </div>

        </div>

        {/* Corporate bottom legal credits block */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 mt-12 border-t border-white/10 flex flex-col md:flex-row justify-between items-center text-xs text-gray-400 gap-4" id="footer-bottom-bar">
          <p>© 2026 Fireowl Controls. Todos os direitos reservados. CNPJ: 57.372.721/0001-40</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">Políticas de Segurança e LGPD</a>
            <span>•</span>
            <a href="#" className="hover:text-white transition-colors">Termos Gerais de Fornecimento B2B</a>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/5543984160725?text=Ol%C3%A1!%20Gostaria%20de%20um%20diagn%C3%B3stico%20t%C3%A9cnico%20para%20minha%20empresa."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-white hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center group rounded-full shadow-2xl p-1 gap-1 border border-gray-100"
        aria-label="Fale com a Engenharia no WhatsApp"
        id="floating-whatsapp-trigger"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-12 h-12 shrink-0">
          <circle cx="16" cy="16" r="16" fill="#25D366"/>
          <path fill="#FFFFFF" d="M23.47 8.52A9.96 9.96 0 0 0 16.04 5.5c-5.52 0-10 4.48-10 10
            0 1.77.46 3.43 1.27 4.87L5.5 26.5l6.3-1.65a9.95 9.95 0 0 0 4.24.95h.01
            c5.52 0 10-4.48 10-10 0-2.67-1.04-5.18-2.58-7.28zM16.05 24.15
            c-1.32 0-2.61-.35-3.74-1.02l-.27-.16-2.78.73.74-2.71-.18-.28
            a8.27 8.27 0 0 1-1.27-4.4c0-4.59 3.74-8.32 8.33-8.32
            2.22 0 4.31.87 5.88 2.44a8.26 8.26 0 0 1 2.44 5.88
            c0 4.59-3.74 8.84-8.15 8.84zm4.56-6.24c-.25-.13-1.47-.73-1.7-.81
            -.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.18-.54.06
            -.25-.13-1.04-.38-1.98-1.22-.73-.65-1.22-1.46-1.36-1.71
            -.14-.25-.02-.38.11-.51.13-.13.29-.34.43-.51.14-.17.19-.29.29-.49
            .1-.2.05-.36-.03-.5-.08-.13-.5-1.2-.69-1.65-.18-.43-.36-.37-.5-.38
            -.13-.01-.29-.01-.44-.01-.15 0-.4.06-.61.29-.21.23-.8.78-.8 1.9
            0 1.12.82 2.21.93 2.37.11.15 1.55 2.37 3.77 3.23
            1.84.72 2.21.58 2.61.54.4-.04 1.3-.53 1.48-1.04
            .18-.51.18-.95.13-1.04-.05-.1-.18-.16-.43-.29z"/>
        </svg>
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:pr-4 group-hover:pl-1 transition-all duration-300 font-extrabold text-xs tracking-wider uppercase text-gray-700 whitespace-nowrap">
          Fale com a Engenharia
        </span>
      </a>
    </div>
  );
}
