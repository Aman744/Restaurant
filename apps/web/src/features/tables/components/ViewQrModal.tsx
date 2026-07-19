import React from 'react';
import { Download, X } from 'lucide-react';
import { useTableStore } from '../../../stores/useTableStore';
import { QrCodeGenerator } from '../../../utils/QrCodeGenerator';

interface ViewQrModalProps {
  tenantId: string;
}

export const ViewQrModal: React.FC<ViewQrModalProps> = ({ tenantId }) => {
  const { viewingQrTable, setViewingQrTable } = useTableStore();

  if (!viewingQrTable) return null;

  const targetUrl = `${window.location.origin}/customer/table/${tenantId}/${viewingQrTable.id}`;
  const svgMarkup = QrCodeGenerator.generateSvgString(targetUrl, 260);

  const handleDownload = () => {
    const filename = `qr_${viewingQrTable.number.toLowerCase().replace(/\s+/g, '_')}`;
    QrCodeGenerator.downloadSvg(targetUrl, filename);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-3xl text-white text-center space-y-4 relative">
        <button
          onClick={() => setViewingQrTable(null)}
          className="absolute top-4 right-4 p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div>
          <h3 className="text-lg font-extrabold text-white">{viewingQrTable.number}</h3>
          <p className="text-xs text-zinc-500 mt-1">Scan to open digital menu & place orders</p>
        </div>

        {/* Offline Vector SVG Render */}
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center">
          <div dangerouslySetInnerHTML={{ __html: svgMarkup }} />
        </div>

        <button
          onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10"
        >
          <Download className="h-4 w-4" />
          Download Vector SVG QR
        </button>
      </div>
    </div>
  );
};
