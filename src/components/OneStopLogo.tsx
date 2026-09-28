import React from 'react';

interface OneStopLogoProps {
  size?: number; // emblem size in px
  customLogoUrl?: string;
  mainTitle?: string;
  subTitle?: string;
  slogan?: string;
  textColor?: string;
  sloganColor?: string;
  variant?: 'full' | 'emblem_only' | 'horizontal' | 'vertical';
  className?: string;
  isDark?: boolean;
}

/**
 * Biểu trưng chuẩn Bộ nhận diện thương hiệu Bộ phận Một cửa các cấp (QĐ số 468/QĐ-TTg)
 * 5 bàn tay cách điệu màu đỏ gạch kết nối tạo hình ngôi sao vàng ở tâm.
 */
export const OneStopEmblem: React.FC<{ size?: number; className?: string }> = ({ size = 48, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
    >
      <defs>
        {/* Subtle gold gradient for star center */}
        <linearGradient id="goldStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#EAB308" />
          <stop offset="100%" stopColor="#CA8A04" />
        </linearGradient>
        {/* Rich red-terracotta gradient for hands */}
        <linearGradient id="handGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A8201A" />
          <stop offset="70%" stopColor="#8A1515" />
          <stop offset="100%" stopColor="#6E0F0F" />
        </linearGradient>
        <filter id="subtleGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Central Gold Star Backdrop */}
      <polygon
        points="60,24 69,45 92,45 74,59 81,81 60,67 39,81 46,59 28,45 51,45"
        fill="url(#goldStarGrad)"
      />

      {/* 5 Clustered Interlocking Hands forming the outer circle and inner star */}
      {/* Hand 1 (Top-right) */}
      <g filter="url(#subtleGlow)">
        <path
          d="M60,14 C66,14 74,18 80,24 C83,27 88,34 85,38 C82,42 76,41 72,37 C68,33 63,28 58,26 C54,24 53,19 56,16 C57,15 59,14 60,14 Z"
          fill="url(#handGrad)"
        />
        {/* Finger grooves / lines */}
        <path d="M68,20 C73,23 78,28 80,33" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        <path d="M72,23 C76,26 80,30 82,35" stroke="#FFF" strokeWidth="0.8" strokeLinecap="round" opacity="0.4" />
      </g>

      {/* Hand 2 (Right-down) */}
      <g filter="url(#subtleGlow)" transform="rotate(72 60 60)">
        <path
          d="M60,14 C66,14 74,18 80,24 C83,27 88,34 85,38 C82,42 76,41 72,37 C68,33 63,28 58,26 C54,24 53,19 56,16 C57,15 59,14 60,14 Z"
          fill="url(#handGrad)"
        />
        <path d="M68,20 C73,23 78,28 80,33" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      </g>

      {/* Hand 3 (Bottom-right) */}
      <g filter="url(#subtleGlow)" transform="rotate(144 60 60)">
        <path
          d="M60,14 C66,14 74,18 80,24 C83,27 88,34 85,38 C82,42 76,41 72,37 C68,33 63,28 58,26 C54,24 53,19 56,16 C57,15 59,14 60,14 Z"
          fill="url(#handGrad)"
        />
        <path d="M68,20 C73,23 78,28 80,33" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      </g>

      {/* Hand 4 (Bottom-left) */}
      <g filter="url(#subtleGlow)" transform="rotate(216 60 60)">
        <path
          d="M60,14 C66,14 74,18 80,24 C83,27 88,34 85,38 C82,42 76,41 72,37 C68,33 63,28 58,26 C54,24 53,19 56,16 C57,15 59,14 60,14 Z"
          fill="url(#handGrad)"
        />
        <path d="M68,20 C73,23 78,28 80,33" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      </g>

      {/* Hand 5 (Top-left) */}
      <g filter="url(#subtleGlow)" transform="rotate(288 60 60)">
        <path
          d="M60,14 C66,14 74,18 80,24 C83,27 88,34 85,38 C82,42 76,41 72,37 C68,33 63,28 58,26 C54,24 53,19 56,16 C57,15 59,14 60,14 Z"
          fill="url(#handGrad)"
        />
        <path d="M68,20 C73,23 78,28 80,33" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      </g>

      {/* Realistic 5 finger wrist blocks matching national standard */}
      <g>
        {[0, 72, 144, 216, 288].map((angle, idx) => (
          <g key={idx} transform={`rotate(${angle} 60 60)`}>
            {/* Palm wrist curved block */}
            <path
              d="M48,18 C52,15 62,15 68,18 C74,21 78,26 80,33 C77,35 73,34 70,30 C66,24 58,20 50,22 C47,21 47,19 48,18 Z"
              fill="#9A1B1B"
            />
            {/* 3 distinct white/yellow finger separation lines */}
            <line x1="72" y1="28" x2="66" y2="23" stroke="#FDE047" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="75" y1="31" x2="70" y2="26" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
            <line x1="78" y1="34" x2="74" y2="30" stroke="#FDE047" strokeWidth="1.4" strokeLinecap="round" />
          </g>
        ))}
      </g>
    </svg>
  );
};

export const OneStopLogo: React.FC<OneStopLogoProps> = ({
  size = 52,
  customLogoUrl,
  mainTitle = 'TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG',
  subTitle = 'XÃ CHÂN MÂY – LĂNG CÔ',
  slogan = 'Hành chính phục vụ',
  textColor,
  sloganColor,
  variant = 'horizontal',
  className = '',
  isDark = false,
}) => {
  if (variant === 'emblem_only') {
    if (customLogoUrl) {
      return (
        <img
          src={customLogoUrl}
          alt="Logo"
          style={{ width: size, height: size }}
          className={`object-contain ${className}`}
        />
      );
    }
    return <OneStopEmblem size={size} className={className} />;
  }

  const defaultMainColor = isDark ? 'text-white' : 'text-[#990000]';
  const defaultSubColor = isDark ? 'text-red-300' : 'text-[#990000]';
  const defaultSloganColor = isDark ? 'text-slate-300' : 'text-slate-600';

  return (
    <div
      className={`flex items-center gap-3.5 ${
        variant === 'vertical' ? 'flex-col text-center' : 'flex-row text-left'
      } ${className}`}
    >
      {/* Emblem or Custom Image */}
      <div className="shrink-0 flex items-center justify-center">
        {customLogoUrl ? (
          <img
            src={customLogoUrl}
            alt="Logo Đơn Vị"
            style={{ width: size, height: size }}
            className="object-contain drop-shadow-sm"
          />
        ) : (
          <OneStopEmblem size={size} />
        )}
      </div>

      {/* Official Typography Lockup (Matching national identity) */}
      <div className="flex flex-col justify-center leading-tight">
        <div
          className={`font-black uppercase tracking-tight text-xs sm:text-sm md:text-base ${
            textColor ? '' : defaultMainColor
          }`}
          style={textColor ? { color: textColor } : undefined}
        >
          {mainTitle}
        </div>
        <div
          className={`font-black uppercase tracking-wide text-xs sm:text-sm md:text-base mt-0.5 ${
            textColor ? '' : defaultSubColor
          }`}
          style={textColor ? { color: textColor } : undefined}
        >
          {subTitle}
        </div>
        {slogan && (
          <div
            className={`font-bold text-[11px] sm:text-xs md:text-[13px] mt-0.5 ${
              sloganColor ? '' : defaultSloganColor
            }`}
            style={sloganColor ? { color: sloganColor } : undefined}
          >
            {slogan}
          </div>
        )}
      </div>
    </div>
  );
};
