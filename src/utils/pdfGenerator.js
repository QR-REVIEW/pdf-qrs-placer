import { PDFDocument, rgb } from 'pdf-lib';

/**
 * Helper to convert SVG File to PNG ArrayBuffer
 */
const convertSvgToPngBuffer = (svgFile) => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(svgFile);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Render at a high resolution for crisp QR codes
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        resolve(await blob.arrayBuffer());
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.onerror = reject;
    img.src = url;
  });
};

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : null;
};

/**
 * Generates a single PDF with multiple pages, each containing the template
 * and one of the provided QR codes positioned at the given coordinates.
 *
 * @param {File} templateFile - The PDF template file
 * @param {File[]} qrFiles - Array of QR code image files
 * @param {Object} positionPct - Coordinates {x, y, width, height} of the QR relative to the PDF page as percentages (0 to 1)
 * @param {string} bgColor - Background color string ('transparent' or hex code)
 * @returns {Promise<Uint8Array>} The generated PDF as a byte array
 */
export async function generatePdf(templateFile, qrFiles, positionPct, bgColor = 'transparent') {
  // Load the template PDF
  const templateArrayBuffer = await templateFile.arrayBuffer();
  
  // We will create a new PDF to hold all the generated pages
  const finalPdf = await PDFDocument.create();
  
  // To avoid reloading the template for every page, we can load it once
  // However, pdf-lib doesn't have a simple way to duplicate a page within the same doc easily without embedding.
  // Instead, we will load the template doc, and for each QR, copy the first page into our finalPdf.
  
  const templatePdf = await PDFDocument.load(templateArrayBuffer);
  
  let bgRgb = null;
  if (bgColor && bgColor !== 'transparent') {
    bgRgb = hexToRgb(bgColor);
  }
  
  for (let i = 0; i < qrFiles.length; i++) {
    const qrData = qrFiles[i];
    const file = qrData.file;
    const bounds = qrData.bounds;
    const originalSize = qrData.originalSize;
    
    // Copy the first page of the template to the final PDF
    const [copiedPage] = await finalPdf.copyPages(templatePdf, [0]);
    finalPdf.addPage(copiedPage);
    
    // Get the CropBox of the copied page (which react-pdf renders)
    const cropBox = copiedPage.getCropBox();
    
    // Calculate actual position and size of the ENTIRE placeholder in PDF points
    // Since positionPct is relative to the CropBox, we just multiply
    const placeholderWidth = positionPct.width * cropBox.width;
    const placeholderHeight = positionPct.height * cropBox.height;
    
    // X is offset by the CropBox X
    const placeholderX = cropBox.x + (positionPct.x * cropBox.width);
    
    // Y is offset by the CropBox Y, and we must invert from top-left to bottom-left
    const placeholderY = (cropBox.y + cropBox.height) - (positionPct.y * cropBox.height) - placeholderHeight;
    
    // Read the QR code image and handle SVG conversion
    let qrArrayBuffer;
    let isPng = false;
    
    if (file.type === 'image/svg+xml') {
      qrArrayBuffer = await convertSvgToPngBuffer(file);
      isPng = true; // converted to PNG
    } else {
      qrArrayBuffer = await file.arrayBuffer();
      isPng = file.type === 'image/png';
    }
    
    // Embed the QR code image
    let qrImage;
    if (isPng) {
      qrImage = await finalPdf.embedPng(qrArrayBuffer);
    } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      qrImage = await finalPdf.embedJpg(qrArrayBuffer);
    } else {
      throw new Error(`Unsupported image type: ${file.type}`);
    }
    
    // Draw background if specified, but STRICTLY to the QR bounds
    if (bgRgb && bounds && originalSize) {
      const bgX = placeholderX + (bounds.left / originalSize.width) * placeholderWidth;
      
      // Invert Y for PDF coordinates: bounds.top is from top, so we calculate from bottom
      const boundBottomFromTop = bounds.top + bounds.height;
      const distFromBottom = originalSize.height - boundBottomFromTop;
      const bgY = placeholderY + (distFromBottom / originalSize.height) * placeholderHeight;
      
      const bgWidth = (bounds.width / originalSize.width) * placeholderWidth;
      const bgHeight = (bounds.height / originalSize.height) * placeholderHeight;
      
      copiedPage.drawRectangle({
        x: bgX,
        y: bgY,
        width: bgWidth,
        height: bgHeight,
        color: rgb(bgRgb.r, bgRgb.g, bgRgb.b)
      });
    }

    // Draw the image on the page
    copiedPage.drawImage(qrImage, {
      x: placeholderX,
      y: placeholderY,
      width: placeholderWidth,
      height: placeholderHeight,
    });
  }
  
  // Serialize the PDFDocument to bytes (a Uint8Array)
  return await finalPdf.save();
}

/**
 * Triggers a file download in the browser
 */
export function downloadPdf(pdfBytes, filename = 'generated-qrs.pdf') {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
