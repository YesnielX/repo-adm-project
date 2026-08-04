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
    <div className="modal-overlay">
      <div className="scanner-modal-card">
        <div className="modal-header">
          <div className="header-title">
            <Camera size={22} className="text-cyan" />
            <h3>Escanear Código QR</h3>
          </div>
          <button type="button" className="btn-close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {cameraError ? (
          <div className="camera-error-box">
            <AlertCircle size={32} className="text-red" />
            <p>{cameraError}</p>
            <button type="button" className="btn-secondary" onClick={handleClose}>
              Ingresar código manualmente
            </button>
          </div>
        ) : (
          <div className="scanner-area">
            <div id="qr-camera-reader" className="camera-viewport"></div>
            <p className="scanner-instruction">Apunta la cámara de tu móvil al código QR del proyector</p>
          </div>
        )}
      </div>
    </div>
  );
};
