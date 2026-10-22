import React from 'react';

interface TurnIconProps {
  type: 'straight' | 'turn-left' | 'turn-right' | 'slight-left' | 'slight-right' | 'sharp-left' | 'sharp-right' | 'u-turn' | 'roundabout' | 'arrive' | 'depart';
  className?: string;
  size?: number;
  color?: string;
}

export const TurnIcon: React.FC<TurnIconProps> = ({
  type,
  className = '',
  size = 48,
  color = '#ffffff',
}) => {
  const strokeWidth = 3.5;

  switch (type) {
    case 'arrive':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <circle cx="24" cy="24" r="18" stroke={color} strokeWidth={strokeWidth} />
          <circle cx="24" cy="24" r="8" fill="#22c55e" />
          <path d="M24 16v-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        </svg>
      );

    case 'depart':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path d="M24 38V12M24 12L14 22M24 12L34 22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="24" cy="40" r="3" fill={color} />
        </svg>
      );

    case 'turn-left':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path
            d="M34 38V24C34 18.4772 29.5228 14 24 14H12M12 14L20 6M12 14L20 22"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'turn-right':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path
            d="M14 38V24C14 18.4772 18.4772 14 24 14H36M36 14L28 6M36 14L28 22"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'slight-left':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path
            d="M30 38L24 24L14 12M14 12H24M14 12V22"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'slight-right':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path
            d="M18 38L24 24L34 12M34 12H24M34 12V22"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'sharp-left':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path
            d="M32 38V20C32 14 28 10 22 10C16 10 12 16 12 26M12 26L6 20M12 26L18 20"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'sharp-right':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path
            d="M16 38V20C16 14 20 10 26 10C32 10 36 16 36 26M36 26L42 20M36 26L30 20"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'u-turn':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path
            d="M32 38V20C32 13.3726 26.6274 8 20 8C13.3726 8 8 13.3726 8 20V34M8 34L2 28M8 34L14 28"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'roundabout':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <circle cx="24" cy="24" r="10" stroke={color} strokeWidth={strokeWidth} strokeDasharray="4 4" />
          <path d="M24 40V34M24 14V8M8 24H14M34 24H40" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <path d="M24 8L20 12M24 8L28 12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'straight':
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path
            d="M24 38V10M24 10L14 20M24 10L34 20"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};
