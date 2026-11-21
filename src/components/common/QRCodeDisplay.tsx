import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';

interface Props {
  value: string;
  label?: string;
  size?: number;
  allowDownload?: boolean;
}

export const QRCodeDisplay: React.FC<Props> = ({ value, label, size = 180, allowDownload = true }) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 2,
      color: {
        dark: '#0B1F3A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${(label || 'stovra-qr').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
    link.click();
  };

  return (
    <div className="inline-flex flex-col items-center gap-2.5">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-3">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`QR code for ${label || value}`}
            style={{ width: size, height: size }}
            className="block rounded-md"
          />
        ) : (
          <div style={{ width: size, height: size }} className="bg-slate-100 animate-pulse rounded-md" />
        )}
      </div>
      <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 break-all max-w-[220px] text-center">
        {value}
      </p>
      {allowDownload && dataUrl && (
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download QR</span>
        </button>
      )}
    </div>
  );
};
