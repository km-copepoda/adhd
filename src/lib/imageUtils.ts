export const MAX_WIDTH = 1280;
export const MAX_HEIGHT = 1280;
export const IMAGE_QUALITY = 0.8;

/** スケールダウン係数を計算（拡大しない）。テスト可能な純粋関数 */
export function calcScale(w: number, h: number): number {
  return Math.min(1, MAX_WIDTH / w, MAX_HEIGHT / h);
}

/**
 * 画像ファイルを Canvas でリサイズ・WebP 圧縮して返す。
 * - 最大 MAX_WIDTH × MAX_HEIGHT に収まるよう縦横比を維持してスケールダウン
 * - それ以下のサイズはそのまま（拡大しない）
 * - WebP 未対応環境（iOS 古い Safari 等）は JPEG にフォールバック
 * - canvas.toBlob が両方失敗した場合のみ元ファイルをそのまま返す
 */
export function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { naturalWidth: w, naturalHeight: h } = img;

      const scale = calcScale(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: "image/webp" }));
            return;
          }
          // WebP 未対応: JPEG にフォールバック
          canvas.toBlob(
            (jpegBlob) => {
              if (jpegBlob) {
                resolve(new File([jpegBlob], file.name, { type: "image/jpeg" }));
              } else {
                resolve(file);
              }
            },
            "image/jpeg",
            IMAGE_QUALITY,
          );
        },
        "image/webp",
        IMAGE_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
