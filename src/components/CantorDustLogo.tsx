import React from 'react';

interface LogoProps {
  className?: string;
  iconSize?: number;
  showText?: boolean;
  textClassName?: string;
}

export default function CantorDustLogo({ 
  className = "flex items-center gap-2.5", 
  iconSize = 32, 
  showText = true,
  textClassName = "font-extrabold text-white tracking-wider text-sm select-none"
}: LogoProps) {
  return (
    <div className={className} id="cantordust-logo-container">
      {/* 3D Isometric Interlocking Celtic Cube Icon */}
      <svg 
        width={iconSize} 
        height={iconSize} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 hover:scale-105"
      >
        {/* Outer Hexagon skeleton */}
        <path 
          d="M50 5 L90 28 L90 72 L50 95 L10 72 L10 28 Z" 
          stroke="currentColor" 
          strokeWidth="5" 
          strokeLinejoin="round" 
          className="text-white"
        />
        {/* Isometric interior vertices */}
        <path 
          d="M50 5 L50 45" 
          stroke="currentColor" 
          strokeWidth="5" 
          strokeLinecap="round"
          className="text-white"
        />
        <path 
          d="M90 28 L50 45" 
          stroke="currentColor" 
          strokeWidth="5" 
          strokeLinecap="round"
          className="text-white"
        />
        <path 
          d="M10 28 L50 45" 
          stroke="currentColor" 
          strokeWidth="5" 
          strokeLinecap="round"
          className="text-white"
        />
        
        {/* Center central Y-junction split / circuit path */}
        <path 
          d="M50 45 L50 72" 
          stroke="currentColor" 
          strokeWidth="5" 
          strokeLinecap="round"
          className="text-slate-400"
        />
        <path 
          d="M50 72 L90 72" 
          stroke="currentColor" 
          strokeWidth="5" 
          strokeLinecap="round"
          className="text-slate-450"
        />
        <path 
          d="M50 72 L10 72" 
          stroke="currentColor" 
          strokeWidth="5" 
          strokeLinecap="round"
          className="text-slate-450"
        />

        {/* Inner square/box facets to give distinct 3D depth */}
        <polygon 
          points="50,45 74,35 50,25 26,35" 
          fill="currentColor" 
          className="text-white/10"
        />
        <polygon 
          points="50,45 50,72 26,59 26,35" 
          fill="currentColor" 
          className="text-white/5"
        />
        <polygon 
          points="50,45 74,35 74,59 50,72" 
          fill="currentColor" 
          className="text-white/15"
        />
      </svg>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={textClassName}>CANTOR DUST</span>
          <span className="text-[8px] text-slate-500 font-mono tracking-widest mt-0.5">MEDIAFLOW PLATFORM</span>
        </div>
      )}
    </div>
  );
}
