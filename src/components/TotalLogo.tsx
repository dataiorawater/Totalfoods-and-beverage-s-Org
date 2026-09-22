import React from 'react';

interface TotalEmblemProps {
  className?: string;
  size?: number | string;
}

/**
 * TOTAL Foods & Beverage circular emblem icon
 */
export const TotalEmblem: React.FC<TotalEmblemProps> = ({
  className = 'w-8 h-8',
  size,
}) => {
  return (
    <svg
      viewBox="0 0 256 256"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="TOTAL Foods & Beverage Logo"
    >
      <defs>
        <clipPath id="totalInnerClip">
          <circle cx="128" cy="128" r="95" />
        </clipPath>
      </defs>

      {/* Outer Ring */}
      <circle
        cx="128"
        cy="128"
        r="102"
        fill="#ffffff"
        stroke="#1D5297"
        strokeWidth="17"
      />

      {/* Inner clipped fluid waves */}
      <g clipPath="url(#totalInnerClip)">
        <rect x="0" y="0" width="256" height="256" fill="#ffffff" />

        {/* Top-left light blue dot */}
        <circle cx="104" cy="85" r="14" fill="#5A88B7" />

        {/* Right ocean blue wave */}
        <path
          d="M 110 100
             C 136 68, 174 76, 193 103
             C 208 123, 204 156, 189 176
             C 174 196, 136 198, 113 186
             C 90 175, 94 122, 110 100 Z"
          fill="#1B75BC"
        />

        {/* Bottom left deep navy fluid */}
        <path
          d="M 48 110
             C 63 99, 86 103, 105 122
             C 132 149, 170 145, 185 176
             C 166 206, 120 218, 86 210
             C 55 202, 40 167, 44 133
             C 46 122, 47 114, 48 110 Z"
          fill="#12376A"
        />

        {/* Overlap shadow */}
        <path
          d="M 105 122
             C 124 110, 151 114, 166 133
             C 180 151, 185 176, 166 195
             C 147 210, 116 206, 105 191
             C 86 166, 91 136, 105 122 Z"
          fill="#174E93"
          opacity="0.85"
        />
      </g>
    </svg>
  );
};

interface TotalLogoFullProps {
  className?: string;
  showSubtitle?: boolean;
}

/**
 * Full TOTAL Foods & Beverage Logo (Emblem + Typography)
 */
export const TotalLogoFull: React.FC<TotalLogoFullProps> = ({
  className = 'w-48',
  showSubtitle = true,
}) => {
  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <TotalEmblem className="w-20 h-20 drop-shadow-sm" />
      <div className="text-center mt-2.5">
        <span className="block text-2xl sm:text-3xl font-black tracking-wider text-[#1D5297] leading-none">
          TOTAL
        </span>
        {showSubtitle && (
          <span className="block text-[9px] sm:text-[10px] font-bold tracking-[0.28em] text-[#1D5297] mt-1 uppercase">
            Foods &amp; Beverage
          </span>
        )}
      </div>
    </div>
  );
};
