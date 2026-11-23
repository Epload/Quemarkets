import React, { useState } from 'react';

interface QuemarketLogoProps {
  size?: 'sm' | 'md';
}

export function QuemarketLogo({ size = 'md' }: QuemarketLogoProps) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <span
        className={`font-display text-black leading-none select-none whitespace-nowrap shrink-0 font-extrabold tracking-tight ${
          size === 'sm' ? 'text-[20px]' : 'text-[28px]'
        }`}
      >
        Quemarket
      </span>
    );
  }

  return (
    <img
      src="/assets/quemarket-logo.png"
      alt="Quemarket"
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      className={`w-auto object-contain select-none shrink-0 ${
        size === 'sm' ? 'h-5 sm:h-6' : 'h-8 sm:h-9'
      }`}
    />
  );
}
