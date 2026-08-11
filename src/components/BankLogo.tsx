import React from 'react';
import { Wallet, Landmark } from 'lucide-react';

export interface BankLogoProps {
  code: string;
  className?: string;
  size?: number;
}

export const getNormalizedBankCode = (code?: string): 'sicoob' | 'cresol' | 'inter' | 'outros' => {
  if (!code) return 'outros';
  const c = code.toLowerCase();
  if (c === '756' || c === 'sicoob' || c.includes('sicoob')) return 'sicoob';
  if (c === '133' || c === 'cresol' || c.includes('cresol')) return 'cresol';
  if (c === '077' || c === 'inter' || c.includes('inter')) return 'inter';
  return 'outros';
};

export const BankLogo: React.FC<BankLogoProps> = ({ code, className = 'w-12 h-12', size = 48 }) => {
  const normalized = getNormalizedBankCode(code);

  switch (normalized) {
    case 'sicoob':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          {/* Sicoob background badge */}
          <rect width="48" height="48" rx="12" fill="#003641" />
          {/* Stylized Sicoob Leaf Pinwheel */}
          <g transform="translate(6, 6)">
            {/* Top-left Teal Leaf */}
            <path
              d="M18 6C18 6 12 10 12 18C12 21 14 23 18 23C18 23 24 19 24 11C24 8 22 6 18 6Z"
              fill="#00A859"
            />
            {/* Bottom-right Green Leaf */}
            <path
              d="M18 30C18 30 24 26 24 18C24 15 22 13 18 13C18 13 12 17 12 25C12 28 14 30 18 30Z"
              fill="#78BE20"
            />
            {/* Left Sweep */}
            <path
              d="M6 18C6 18 10 12 18 12C21 12 23 14 23 18C23 18 19 24 11 24C8 24 6 22 6 18Z"
              fill="#008060"
            />
            {/* Right Sweep */}
            <path
              d="M30 18C30 18 26 24 18 24C15 24 13 22 13 18C13 18 17 12 25 12C28 12 30 14 30 18Z"
              fill="#00A859"
              opacity="0.9"
            />
          </g>
        </svg>
      );

    case 'cresol':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          {/* Cresol background badge */}
          <rect width="48" height="48" rx="12" fill="#007BC0" />
          {/* Stylized 'C' with Green Arc Sweep */}
          <path
            d="M 31 16 C 27 11, 17 11, 14 17 C 11 23, 11 29, 14 33 C 18 38, 27 38, 32 32"
            stroke="#FFFFFF"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Cresol Green Arc */}
          <path
            d="M 12 28 C 16 36, 28 38, 36 30 C 38 28, 39 25, 37 23"
            stroke="#00A651"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );

    case 'inter':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          {/* Inter Orange background badge */}
          <rect width="48" height="48" rx="12" fill="#FF7A00" />
          <text
            x="24"
            y="29"
            fill="#FFFFFF"
            fontSize="13"
            fontWeight="800"
            fontFamily="system-ui, -apple-system, sans-serif"
            textAnchor="middle"
            letterSpacing="-0.5"
          >
            inter
          </text>
        </svg>
      );

    case 'outros':
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          <rect width="48" height="48" rx="12" fill="#F1F5F9" />
          <g transform="translate(12, 12)">
            <Wallet size={24} className="text-slate-500" strokeWidth={2} />
          </g>
        </svg>
      );
  }
};
