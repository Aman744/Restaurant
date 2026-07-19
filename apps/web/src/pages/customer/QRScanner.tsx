import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, ArrowLeft, QrCode } from 'lucide-react';

export const QRScanner: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    let active = true;
    let localStream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        setCameraError(false);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera API is not supported on this browser or insecure context.');
        }
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (active && videoRef.current) {
          videoRef.current.srcObject = localStream;
          setCameraActive(true);
        }
      } catch (err) {
        console.warn('Camera permission denied or not available:', err);
        if (active) {
          setCameraActive(false);
          setCameraError(true);
        }
      }
    };

    startCamera();

    return () => {
      active = false;
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleSimulateScan = (isValid: boolean) => {
    if (isValid) {
      navigate('/customer/table/tenant_dev_123/table_01');
    } else {
      navigate('/customer/table/tenant_dev_123/table_999');
    }
  };

  return (
    <div className="min-h-screen w-screen bg-black text-white flex flex-col items-center justify-between p-6 font-sans">
      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="p-2 bg-zinc-900/60 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Scan QR Code</span>
        <div className="w-9 h-9" /> {/* Spacer */}
      </div>

      {/* Viewfinder area */}
      <div className="relative w-full max-w-sm aspect-square bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center my-6">
        {/* Live Camera Viewfinder */}
        {cameraActive && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* HUD overlay */}
        <div className="absolute inset-0 border-[24px] border-black/60 flex items-center justify-center pointer-events-none">
          <div className="relative w-48 h-48 border-2 border-emerald-500 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            {/* Corners highlights */}
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl" />
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br" />

            {/* Laser scanning sweep line */}
            <div className="absolute left-0 w-full h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-bounce" style={{ animationDuration: '3s' }} />
          </div>
        </div>

        {/* Fallback Viewport if Camera Denied */}
        {cameraError && (
          <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-zinc-950/90 z-10 space-y-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/15 rounded-full text-amber-500">
              <QrCode className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-zinc-300">Live Camera Stream Unavailable</h4>
            <p className="text-[11px] text-zinc-500 leading-relaxed max-w-xs">
              Ensure camera permissions are enabled on your browser. You can use the quick simulation actions below to test layouts.
            </p>
          </div>
        )}
      </div>

      {/* Simulator Drawer Panel */}
      <div className="w-full max-w-sm bg-zinc-900/40 border border-zinc-900 p-5 rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4.5 w-4.5 text-emerald-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Scan Simulator Actions</h4>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Select an action to simulate scanning a table QR code and opening the digital menu.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => handleSimulateScan(true)}
            className="flex flex-col items-center justify-center p-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/15 hover:border-emerald-500/30 rounded-xl text-center group transition"
          >
            <span className="text-[11px] font-bold text-emerald-400 group-hover:text-emerald-300">Scan Valid Table</span>
            <span className="text-[9px] text-zinc-500 mt-1">Table 1 Menu</span>
          </button>

          <button
            onClick={() => handleSimulateScan(false)}
            className="flex flex-col items-center justify-center p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 hover:border-red-500/30 rounded-xl text-center group transition"
          >
            <span className="text-[11px] font-bold text-red-400 group-hover:text-red-300">Scan Invalid Table</span>
            <span className="text-[9px] text-zinc-500 mt-1">Decommissioned Error</span>
          </button>
        </div>
      </div>
    </div>
  );
};
