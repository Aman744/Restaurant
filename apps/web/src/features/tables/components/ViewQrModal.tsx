import React, { useState, useEffect } from 'react';
import { Download, X, Copy, ExternalLink, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { useTableStore } from '../../../stores/useTableStore';
import { useToast } from '../../../components/shared/ToastContext';

interface ViewQrModalProps {
  tenantId: string;
}

export const ViewQrModal: React.FC<ViewQrModalProps> = ({ tenantId }) => {
  const { viewingQrTable, setViewingQrTable } = useTableStore();
  const toast = useToast();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const baseUrl = `${window.location.origin}${window.location.pathname}`.replace(/\/$/, '');
  const targetUrl = viewingQrTable
    ? `${baseUrl}/#/customer/table/${tenantId}/${viewingQrTable.id}`
    : '';

  useEffect(() => {
    if (!targetUrl) return;

    let active = true;

    // Generate real ISO-Standard camera-scannable QR DataURL
    QRCode.toDataURL(targetUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => console.error('QR DataURL error:', err));

    return () => {
      active = false;
    };
  }, [targetUrl]);

  if (!viewingQrTable) return null;

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const filename = `qr_${viewingQrTable.number.toLowerCase().replace(/\s+/g, '_')}.png`;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded high-res scannable QR code for ${viewingQrTable.number}!`);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetUrl);
    toast.success('Copied table order URL to clipboard!');
  };

  const handleOpenLink = () => {
    window.open(targetUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="w-full max-w-sm border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-3xl text-white text-center space-y-5 relative">
        <button
          onClick={() => setViewingQrTable(null)}
          className="absolute top-4 right-4 p-1.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition"
          title="Close Modal"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <QrCode className="h-5 w-5 text-emerald-400" />
            <h3 className="text-lg font-extrabold text-white">{viewingQrTable.number}</h3>
          </div>
          <p className="text-xs text-zinc-400">Scan QR code with any phone camera to open digital menu</p>
        </div>

        {/* Real ISO-Standard Camera Scannable QR Code Image */}
        <div className="p-5 bg-white border border-zinc-200 rounded-2xl flex flex-col items-center justify-center shadow-xl space-y-2">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR Code for ${viewingQrTable.number}`} className="w-56 h-56 object-contain" />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-zinc-400 text-xs font-semibold">
              Generating QR Matrix...
            </div>
          )}
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-800">
            {viewingQrTable.number} • Scan to Order
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10 transition"
          >
            <Download className="h-4 w-4" />
            Download Printable PNG QR
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl transition"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy URL
            </button>
            <button
              onClick={handleOpenLink}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-emerald-400 text-xs font-semibold rounded-xl transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Test Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
