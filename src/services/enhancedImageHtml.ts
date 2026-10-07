/** Local-only display document. Never embeds a file path or a remote URL. */
export function enhancedImageHtml(base64: string, mime: string): string {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || !base64.length)
    throw new Error('Invalid image data');
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(mime))
    throw new Error('Unsupported image type');
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}
img{display:block;width:100%;height:100%;object-fit:contain;image-rendering:auto;filter:url(#sharpen)}
svg{position:absolute;width:0;height:0}</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg"><defs><filter id="sharpen" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
<feConvolveMatrix order="3" kernelMatrix="0 -0.15 0 -0.15 1.6 -0.15 0 -0.15 0" divisor="1" bias="0" preserveAlpha="true" edgeMode="duplicate"/>
</filter></defs></svg><img src="data:${mime};base64,${base64}"></body></html>`;
}
