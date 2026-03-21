import React, { useCallback, useEffect, useRef } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';

const QrScanner = ({ onScan, onError }) => {
  const videoRef = useRef(null);

  const shouldIgnoreError = useCallback((error) => {
    if (!error) return true;
    const name = typeof error === 'string' ? error : error.name || '';
    const message = typeof error === 'string' ? error : error.message || '';
    const combined = `${name} ${message}`.toLowerCase();
    return [
      'notfoundexception',
      'checksumexception',
      'formatexception',
      'no code found',
    ].some((token) => combined.includes(token));
  }, []);

  useEffect(() => {
    if (!videoRef.current) return undefined;

    const codeReader = new BrowserQRCodeReader();
    let isCancelled = false;
    const videoEl = videoRef.current;

    const decodePromise = codeReader.decodeFromVideoDevice(undefined, videoEl, (result, error) => {
      if (isCancelled) return;
      if (result) onScan(result.getText());
      if (error && onError && !shouldIgnoreError(error)) onError(error);
    });

    if (decodePromise && typeof decodePromise.catch === 'function') {
      decodePromise.catch((scanError) => {
        if (!isCancelled && onError && !shouldIgnoreError(scanError)) {
          onError(scanError);
        }
      });
    }

    return () => {
      isCancelled = true;
      if (typeof codeReader.destroy === 'function') codeReader.destroy();
      if (videoEl && videoEl.srcObject) {
        const tracks = videoEl.srcObject.getTracks?.();
        if (tracks && tracks.length) tracks.forEach((track) => track.stop());
        videoEl.srcObject = null;
      }
    };
  }, [onScan, onError, shouldIgnoreError]);

  return (
    <div className="qr-scanner">
      <video ref={videoRef} className="qr-scanner__video" muted playsInline />
    </div>
  );
};

export default QrScanner;
