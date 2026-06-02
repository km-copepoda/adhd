"use client";

import { useRef } from "react";

type Props = {
  photoPreview: string | null;
  uploadError: string | null;
  onPhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function QuestPhotoUpload({ photoPreview, uploadError, onPhotoSelect }: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mb-3">
      {photoPreview ? (
        <button
          onClick={() => galleryInputRef.current?.click()}
          className="w-full rounded-xl border-2 border-dashed border-blue-400/50 bg-blue-400/5 py-3 flex flex-col items-center gap-1"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoPreview} alt="プレビュー" className="max-h-40 rounded-lg object-contain" />
          <span className="text-[11px] text-quest-dim mt-1">タップで選び直す</span>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="rounded-xl border-2 border-dashed border-blue-400/40 bg-blue-400/5 py-3 flex flex-col items-center gap-1"
          >
            <span className="text-2xl">📷</span>
            <span className="text-xs text-quest-dim">カメラで撮る</span>
          </button>
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="rounded-xl border-2 border-dashed border-blue-400/40 bg-blue-400/5 py-3 flex flex-col items-center gap-1"
          >
            <span className="text-2xl">🖼</span>
            <span className="text-xs text-quest-dim">ギャラリーから</span>
          </button>
        </div>
      )}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPhotoSelect}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPhotoSelect}
      />
      {!photoPreview && (
        <p className="text-[11px] text-quest-dim text-center mt-1">写真を添付すると +1pt</p>
      )}
      {uploadError && (
        <p className="text-xs text-red-400 mt-1 text-center">{uploadError}</p>
      )}
    </div>
  );
}
