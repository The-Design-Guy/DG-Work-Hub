/** Shrinks a picked image in the browser before upload (max 1200×900, WebP or JPEG). */
export async function resizeImage(file: File, maxW = 1200, maxH = 900) {
  if (!/^image\//.test(file.type)) throw new Error("Choose an image file.");
  if (file.size > 30 * 1024 * 1024) throw new Error("That image is larger than 30 MB.");
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width, maxH / bmp.height);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the image.");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();

  const toBlob = (type: string, q: number) =>
    new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), type, q));
  let blob = await toBlob("image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg", 0.85);
  if (!blob) throw new Error("Couldn't process the image.");
  return { blob, width: w, height: h };
}

/** Center-crops any image (file or data URL, incl. .ico and .svg) to a square, up to 256×256. */
export async function squareImage(src: Blob | string) {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Couldn't read that image."));
      el.src = url;
    });
    const w = img.naturalWidth || 256;
    const h = img.naturalHeight || 256;
    const side = Math.min(w, h);
    const size = Math.max(64, Math.min(256, side));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process the image.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
    const toBlob = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), type, 0.9));
    let blob = await toBlob("image/webp");
    if (!blob || blob.type !== "image/webp") blob = await toBlob("image/png");
    if (!blob) throw new Error("Couldn't process the image.");
    return { blob, size };
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}
