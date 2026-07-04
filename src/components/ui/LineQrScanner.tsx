"use client";

// LINE QR reader for the customer form. Uses the native BarcodeDetector API
// (no external dependency). Where unsupported (e.g. iOS Safari), it shows a
// graceful fallback message so the operator can enter the LINE ID manually.

import { useEffect, useRef, useState } from "react";

interface Props {
  onDetect: (value: string) => void;
  onClose:  () => void;
}

/** Extract a LINE id from a friend-add URL, else return the raw QR value. */
export function extractLineId(raw: string): string {
  const s = raw.trim();
  const m = s.match(/line\.me\/(?:R\/)?ti\/p\/(~?@?[\w.-]+)/i);
  if (m) return m[1].replace(/^~/, "");
  return s;
}

export default function LineQrScanner({ onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported] = useState(
    () => typeof window !== "undefined" && "BarcodeDetector" in window,
  );

  useEffect(() => {
    if (!supported) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    // BarcodeDetector is not in the TS DOM lib.
    // @ts-expect-error - BarcodeDetector global
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = videoRef.current;
        if (v) { v.srcObject = stream; await v.play(); }
        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && codes[0].rawValue) {
              onDetect(extractLineId(codes[0].rawValue));
              return; // stop scanning once found
            }
          } catch { /* transient detect error — keep scanning */ }
          raf = requestAnimationFrame(scan);
        };
        raf = requestAnimationFrame(scan);
      } catch {
        setError("カメラを起動できませんでした。権限を確認してください。");
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [supported, onDetect]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-[#1e293b] border border-slate-700 rounded-xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-100">LINE QRを読み取る</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded text-slate-400 hover:text-slate-100 text-lg">✕</button>
        </div>
        {!supported ? (
          <p className="text-xs text-amber-400">
            このブラウザはQR読み取りに対応していません（iOS Safari等）。LINE IDを手入力してください。
          </p>
        ) : error ? (
          <p className="text-xs text-amber-400">{error}</p>
        ) : (
          <>
            <div className="relative rounded-lg overflow-hidden bg-black aspect-square">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-8 border-2 border-blue-400/70 rounded-lg pointer-events-none" />
            </div>
            <p className="text-[10px] text-slate-500 mt-2">友だち追加QRを枠内に合わせてください</p>
          </>
        )}
      </div>
    </div>
  );
}
