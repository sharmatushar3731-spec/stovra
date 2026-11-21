import React, { useState } from 'react';
import { Warehouse } from 'lucide-react';

interface Props {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export const ImageWithFallback: React.FC<Props> = ({ src, alt, className = '', fallbackTitle }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0B1F3A] to-[#13325C] text-slate-200 p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Warehouse className="w-8 h-8 text-teal-400 mb-2" />
        <span className="text-xs font-medium text-slate-300 line-clamp-1">{fallbackTitle || alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
