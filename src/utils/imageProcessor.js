/**
 * Finds the bounding box of the non-transparent pixels in an image file.
 */
export const findQrBounds = (file) => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Draw to a canvas to read pixels
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      // Use a high resolution for crispness
      canvas.width = 1024;
      canvas.height = 1024;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let top = null, bottom = null, left = null, right = null;
      
      // Find top
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 5) { // Threshold for transparency
            top = y;
            break;
          }
        }
        if (top !== null) break;
      }
      
      // Find bottom
      for (let y = canvas.height - 1; y >= 0; y--) {
        for (let x = 0; x < canvas.width; x++) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 5) {
            bottom = y;
            break;
          }
        }
        if (bottom !== null) break;
      }
      
      // Find left
      for (let x = 0; x < canvas.width; x++) {
        for (let y = 0; y < canvas.height; y++) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 5) {
            left = x;
            break;
          }
        }
        if (left !== null) break;
      }
      
      // Find right
      for (let x = canvas.width - 1; x >= 0; x--) {
        for (let y = 0; y < canvas.height; y++) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 5) {
            right = x;
            break;
          }
        }
        if (right !== null) break;
      }
      
      // If image is completely transparent, just return original
      if (top === null) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      
      const rawBounds = {
        top,
        bottom,
        left,
        right,
        width: right - left + 1,
        height: bottom - top + 1
      };
      
      // Optional: add a tiny padding so the edges aren't strictly clipped
      // 28px out of 1024px is ~2.7%, which equals roughly 4px visually at a 150x150 size
      const padding = 28;
      top = Math.max(0, top - padding);
      bottom = Math.min(canvas.height - 1, bottom + padding);
      left = Math.max(0, left - padding);
      right = Math.min(canvas.width - 1, right + padding);
      
      const bounds = {
        top,
        bottom,
        left,
        right,
        width: right - left + 1,
        height: bottom - top + 1
      };
      
      URL.revokeObjectURL(url);
      resolve({ 
        file, 
        bounds, 
        rawBounds,
        originalSize: { width: canvas.width, height: canvas.height } 
      });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ file, bounds: null, rawBounds: null, originalSize: null });
    };
    
    img.src = url;
  });
};
