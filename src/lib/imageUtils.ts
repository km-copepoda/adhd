export const MAX_WIDTH = 1280;
export const MAX_HEIGHT = 1280;
export const JPEG_QUALITY = 0.8;

/** スケールダウン係数を計算（拡大しない）。テスト可能な純粋関数 */
export function calcScale(w: number, h: number): number {
  return Math.min(1, MAX_WIDTH / w, MAX_HEIGHT / h);
}

/**
 * 画像ファイルを Canvas でリサイズ・JPEG圧縮して返す。
 * - 最大 MAX_WIDTH × MAX_HEIGHT に収まるよう縦横比を維持してスケールダウン
 * - それ以下のサイズはそのまま（拡大しない）
 * - canvas.toBlob が失敗した場合は元ファイルをそのまま返す（フォールバック）
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
          if (!blob) {
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name, { type: "image/jpeg" });
          resolve(compressed);
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // フォールバック
    };

    img.src = url;
  });
}
