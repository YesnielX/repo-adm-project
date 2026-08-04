import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle } from 'lucide-react';

interface QRScannerModalProps {
  onScanSuccess: (roomCode: string) => void;
  onClose: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ onScanSuccess, onClose }) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const scannerId = 'qr-camera-reader';
    const html5Qrcode = new Html5Qrcode(scannerId);
    scannerRef.current = html5Qrcode;

    html5Qrcode
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          let code = decodedText.trim();
          // Si el texto decodificado es una URL con ?room=XXXX
          if (decodedText.includes('room=')) {
            const match = decodedText.match(/room=([0-9]{4})/);
            if (match) code = match[1];
          }

          if (code) {
            if (navigator.vibrate) navigator.vibrate(100);
            html5Qrcode.stop().then(() => {
              onScanSuccess(code);
            }).catch(() => {
              onScanSuccess(code);
            });
          }
        },
        () => {
          // Ignorar errores por fotogramas sin código QR
        }
      )
      .catch((err) => {
        console.error('Error al iniciar la cámara:', err);
        setCameraError('No se pudo acceder a la cámara. Asegúrate de dar permisos de cámara en tu navegador.');
      });

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch((err) => console.error(err));
      }
    };
  }, [onScanSuccess]);

  const handleClose = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().then(() => onClose()).catch(() => onClose());
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="glass-card flex w-full max-w-[400px] flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Camera size={22} className="text-cyber-cyan" />
            <h3 className="text-base font-bold text-white">Escanear Código QR</h3>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            onClick={handleClose}
          >
            <X size={20} />
          </button>
        </div>

        {cameraError ? (
          <div className="flex flex-col items-center gap-3.5 p-5 text-center">
            <AlertCircle size={32} className="text-red-400" />
            <p className="text-sm leading-relaxed text-muted">{cameraError}</p>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/15 px-5 py-3 text-sm font-bold text-cyber-cyan transition hover:-translate-y-0.5 hover:bg-cyan-400/30"
              onClick={handleClose}
            >
              Ingresar código manualmente
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div id="qr-camera-reader" className="w-full overflow-hidden rounded-2xl border-2 border-cyber-cyan"></div>
            <p className="text-center text-xs text-muted">Apunta la cámara de tu móvil al código QR del proyector</p>
          </div>
        )}
      </div>
    </div>
  );
};
