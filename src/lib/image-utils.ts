/**
 * Compress an image file to JPEG at the given quality.
 * If the file is already JPEG, returns it as-is.
 * For PNG, WebP, etc. — re-encodes to JPEG at 85% quality.
 */
export async function compressImageToJpeg(file: File, quality = 0.85): Promise<File> {
  // Already JPEG — return as-is
  if (file.type === "image/jpeg" || file.type === "image/jpg") {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
          resolve(new File([blob], name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}
