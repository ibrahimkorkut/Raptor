import React from 'react';

interface RaptorPixelHeadProps {
  className?: string;
  size?: number;
  color?: string;
  eyeColor?: string;
  chomping?: boolean;
  eatingDots?: boolean;
  speed?: 'normal' | 'fast' | 'slow';
}

/**
 * Pure SVG vector pixel-art Dinosaur Mascot (Raptor)
 * Features an optional Pacman-style eating / chomping animation with opening/closing jaws
 * and incoming data pellets.
 */
export const RaptorPixelHead: React.FC<RaptorPixelHeadProps> = ({
  className = 'w-10 h-10',
  size,
  color = '#a3e635',
  eyeColor = '#111612',
  chomping = false,
  eatingDots = false,
  speed = 'normal',
}) => {
  const duration = speed === 'fast' ? '0.26s' : speed === 'slow' ? '0.55s' : '0.36s';
  const viewBox = (chomping || eatingDots) ? '0 -4 34 27' : '0 0 25 21';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      style={size ? { width: size, height: size } : undefined}
      className={`inline-block select-none pointer-events-none overflow-visible ${className}`}
      shapeRendering="crispEdges"
      fill={color}
    >
      {chomping && (
        <style>{`
          @keyframes raptorChompUpper {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(-14deg); }
          }
          @keyframes raptorChompLower {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(18deg); }
          }
          @keyframes raptorDotFeed {
            0% { transform: translateX(12px); opacity: 0; }
            20% { opacity: 1; }
            80% { opacity: 1; }
            100% { transform: translateX(-4px); opacity: 0; }
          }
        `}</style>
      )}

      {/* Feeding Pacman Data Dots */}
      {(chomping || eatingDots) && (
        <g
          fill="#facc15"
          style={{
            animation: `raptorDotFeed ${duration} infinite linear`,
          }}
        >
          <rect x="25" y="11" width="2.2" height="2.2" rx="0.5" />
          <rect x="31" y="11" width="2.2" height="2.2" rx="0.5" />
        </g>
      )}

      {/* Upper Skull & Jaw */}
      <g
        style={
          chomping
            ? {
                transformOrigin: '3px 14px',
                animation: `raptorChompUpper ${duration} infinite ease-in-out`,
              }
            : undefined
        }
      >
        <rect x="8" y="0" width="5" height="1" />
        <rect x="8" y="1" width="6" height="1" />
        <rect x="7" y="2" width="7" height="1" />
        <rect x="7" y="3" width="8" height="1" />
        <rect x="6" y="4" width="4" height="1" />
        <rect x="12" y="4" width="3" height="1" />
        <rect x="6" y="5" width="4" height="1" />
        <rect x="12" y="5" width="4" height="1" />
        <rect x="0" y="6" width="10" height="1" />
        <rect x="12" y="6" width="12" height="1" />
        <rect x="0" y="7" width="25" height="1" />
        <rect x="0" y="8" width="25" height="1" />
        <rect x="0" y="9" width="25" height="1" />
        <rect x="0" y="10" width="16" height="1" />
        <rect x="18" y="10" width="3" height="1" />
        <rect x="23" y="10" width="2" height="1" />
        <rect x="0" y="11" width="16" height="1" />
        <rect x="18" y="11" width="3" height="1" />
        <rect x="23" y="11" width="2" height="1" />
        <rect x="0" y="12" width="16" height="1" />
        <rect x="18" y="12" width="3" height="1" />
        <rect x="23" y="12" width="2" height="1" />
        <rect x="0" y="13" width="24" height="1" />
        <rect x="0" y="14" width="9" height="1" />
        <rect x="0" y="15" width="9" height="1" />

        {/* Eye & Upper Nostril Details */}
        {eyeColor && (
          <g fill={eyeColor}>
            <rect x="10" y="4" width="2" height="2" />
            <rect x="16" y="10" width="2" height="3" />
            <rect x="21" y="10" width="2" height="3" />
          </g>
        )}
      </g>

      {/* Lower Jaw & Chin */}
      <g
        style={
          chomping
            ? {
                transformOrigin: '3px 15px',
                animation: `raptorChompLower ${duration} infinite ease-in-out`,
              }
            : undefined
        }
      >
        <rect x="1" y="16" width="21" height="1" />
        <rect x="2" y="17" width="19" height="1" />
        <rect x="3" y="18" width="18" height="1" />
        <rect x="4" y="19" width="16" height="1" />
        <rect x="5" y="20" width="14" height="1" />

        {/* Mouth cavity line */}
        {eyeColor && (
          <g fill={eyeColor}>
            <rect x="9" y="14" width="16" height="2" />
          </g>
        )}
      </g>
    </svg>
  );
};

export default RaptorPixelHead;
