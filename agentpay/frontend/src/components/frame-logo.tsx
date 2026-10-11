import React from 'react';

interface FrameIconProps {
  size?: number;
  className?: string;
  variant?: 'blue' | 'white' | 'dark';
}

/**
 * Canonical Frame Brand Mark
 * Geometry: Rounded badge in Frame Blue (#0052ff) with 3 signature horizontal beams.
 */
export function FrameIcon({ size = 28, className = '', variant = 'blue' }: FrameIconProps) {
  const bg = variant === 'blue' ? '#0052ff' : variant === 'dark' ? '#0a0b0d' : '#ffffff';
  const beamColor = variant === 'white' ? '#0052ff' : '#ffffff';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, display: 'inline-block' }}
      aria-label="Frame icon"
    >
      {/* Frame Container Badge */}
      <rect width="32" height="32" rx="8" fill={bg} />

      {/* Signature 3 Staggered Beams */}
      {/* Top beam - full span */}
      <path
        d="M6 9.5H26"
        stroke={beamColor}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* Middle beam - short span */}
      <path
        d="M6 16H18"
        stroke={beamColor}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* Bottom beam - medium span */}
      <path
        d="M6 22.5H22"
        stroke={beamColor}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface FrameLogoProps {
  size?: number;
  textClassName?: string;
  showWordmark?: boolean;
  className?: string;
  variant?: 'blue' | 'white' | 'dark';
}

/**
 * Frame Logo with Wordmark
 */
export function FrameLogo({
  size = 28,
  textClassName = '',
  showWordmark = true,
  className = '',
  variant = 'blue',
}: FrameLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <FrameIcon size={size} variant={variant} />
      {showWordmark && (
        <span
          className={`font-semibold tracking-tight ${textClassName}`}
          style={{ fontSize: size * 0.62 }}
        >
          Frame
        </span>
      )}
    </div>
  );
}

export default FrameLogo;
