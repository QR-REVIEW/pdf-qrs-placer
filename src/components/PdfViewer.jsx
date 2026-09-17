import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Rnd } from 'react-rnd';
import { UploadCloud, ZoomIn, ZoomOut } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Setup pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ templateFile, onTemplateUpload, positionPct, onPositionChangePct, previewQrFile, bgColor, showGuides, isLocked }) {
  const [numPages, setNumPages] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);
  const baseWidthRef = useRef(0);

  const activeShowGuides = showGuides && !isLocked;
  
  // Refs for construction lines to update them via DOM (zero lag)
  const topLineRef = useRef(null);
  const bottomLineRef = useRef(null);
  const leftLineRef = useRef(null);
  const rightLineRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't nudge if typing in an input, or if locked
      if (e.target.tagName === 'INPUT' || !templateFile || renderSize.width === 0 || isLocked) return;
      
      const step = e.shiftKey ? 10 : 1;
      
      // Convert pixel step to percentage step
      const stepXPct = step / renderSize.width;
      const stepYPct = step / renderSize.height;
      
      switch(e.key) {
        case 'ArrowUp':
          onPositionChangePct(prev => ({ ...prev, y: prev.y - stepYPct }));
          e.preventDefault();
          break;
        case 'ArrowDown':
          onPositionChangePct(prev => ({ ...prev, y: prev.y + stepYPct }));
          e.preventDefault();
          break;
        case 'ArrowLeft':
          onPositionChangePct(prev => ({ ...prev, x: prev.x - stepXPct }));
          e.preventDefault();
          break;
        case 'ArrowRight':
          onPositionChangePct(prev => ({ ...prev, x: prev.x + stepXPct }));
          e.preventDefault();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [templateFile, onPositionChangePct, renderSize]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    if (containerRef.current && baseWidthRef.current === 0) {
      baseWidthRef.current = containerRef.current.clientWidth - 40;
    }
  };

  const handlePageLoadSuccess = (page) => {
    // Get the base (unscaled) viewport to calculate aspect ratio
    const viewport = page.getViewport({ scale: 1 });
    
    // The width we asked it to render at for zoom=1
    const targetWidth = baseWidthRef.current || 400;
    
    // The scale it actually used
    const renderScale = targetWidth / viewport.width;
    
    // The actual rendered dimensions AT ZOOM = 1
    const renderedWidth = viewport.width * renderScale;
    const renderedHeight = viewport.height * renderScale;
    
    setRenderSize({ width: renderedWidth, height: renderedHeight });
  };

  const updateGuideLines = (x, y, w, h) => {
    if (!previewQrFile || !previewQrFile.rawBounds) return;
    const { rawBounds, originalSize } = previewQrFile;
    
    const qrTopOffset = (rawBounds.top / originalSize.height) * h;
    const qrLeftOffset = (rawBounds.left / originalSize.width) * w;
    const qrHeight = (rawBounds.height / originalSize.height) * h;
    const qrWidth = (rawBounds.width / originalSize.width) * w;

    if (topLineRef.current) topLineRef.current.style.top = `${y + qrTopOffset}px`;
    if (bottomLineRef.current) bottomLineRef.current.style.top = `${y + qrTopOffset + qrHeight}px`;
    if (leftLineRef.current) leftLineRef.current.style.left = `${x + qrLeftOffset}px`;
    if (rightLineRef.current) rightLineRef.current.style.left = `${x + qrLeftOffset + qrWidth}px`;
  };

  // Sync guide lines when state changes
  useEffect(() => {
    if (renderSize.width > 0 && showGuides) {
      updateGuideLines(
        positionPct.x * renderSize.width * zoom,
        positionPct.y * renderSize.height * zoom,
        positionPct.width * renderSize.width * zoom,
        positionPct.height * renderSize.height * zoom
      );
    }
  }, [positionPct, renderSize, zoom, activeShowGuides, previewQrFile]);

  const onDrag = (e, d) => {
    if (renderSize.width === 0 || isLocked) return;
    updateGuideLines(d.x, d.y, positionPct.width * renderSize.width * zoom, positionPct.height * renderSize.height * zoom);
  };

  const onDragStop = (e, d) => {
    if (renderSize.width === 0 || isLocked) return;
    onPositionChangePct({ 
      ...positionPct, 
      x: (d.x / zoom) / renderSize.width, 
      y: (d.y / zoom) / renderSize.height 
    });
  };

  const onResize = (e, direction, ref, delta, positionUpdate) => {
    if (renderSize.width === 0 || isLocked) return;
    updateGuideLines(positionUpdate.x, positionUpdate.y, parseInt(ref.style.width, 10), parseInt(ref.style.height, 10));
  };

  const onResizeStop = (e, direction, ref, delta, positionUpdate) => {
    if (renderSize.width === 0 || isLocked) return;
    onPositionChangePct({
      width: (parseInt(ref.style.width, 10) / zoom) / renderSize.width,
      height: (parseInt(ref.style.height, 10) / zoom) / renderSize.height,
      x: (positionUpdate.x / zoom) / renderSize.width,
      y: (positionUpdate.y / zoom) / renderSize.height,
    });
  };

  if (!templateFile) {
    return (
      <div className="pdf-container" style={{ padding: '2rem' }}>
        <label className="upload-area" style={{ width: '100%', height: '100%' }}>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onTemplateUpload(e.target.files[0]);
              }
            }}
            style={{ display: 'none' }}
          />
          <UploadCloud size={48} className="upload-icon" />
          <h3 style={{ fontSize: '1.2rem', margin: '0.5rem 0' }}>Upload PDF Template</h3>
          <p className="info-text">Click to browse or drag and drop your PDF here.</p>
        </label>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '0.5rem', background: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <button className="btn" style={{ width: 'auto', padding: '0.5rem' }} onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} title="Zoom Out">
          <ZoomOut size={18} />
        </button>
        <span style={{ fontWeight: 'bold', minWidth: '60px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button className="btn" style={{ width: 'auto', padding: '0.5rem' }} onClick={() => setZoom(z => Math.min(3, z + 0.25))} title="Zoom In">
          <ZoomIn size={18} />
        </button>
        <span style={{ marginLeft: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tip: Use arrow keys to nudge</span>
      </div>

      <div className="pdf-container" ref={containerRef} style={{ overflow: 'auto', alignItems: 'flex-start', paddingTop: '1rem', height: '65vh' }}>
        <div className="pdf-canvas-wrapper" style={{ margin: '0 auto' }}>
          <Document
            file={templateFile}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div style={{ padding: '2rem', color: 'white' }}>Loading PDF...</div>}
          >
            <Page
              pageNumber={1}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onLoadSuccess={handlePageLoadSuccess}
              width={(baseWidthRef.current || 400) * zoom}
            />
          </Document>

          {/* Construction Guides */}
          {activeShowGuides && previewQrFile && previewQrFile.rawBounds && (
            <>
              {/* Top horizontal line */}
              <div ref={topLineRef} style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: '1px',
                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                zIndex: 30,
                pointerEvents: 'none',
                borderTop: '1px dashed rgba(34, 197, 94, 0.8)'
              }} />
              {/* Bottom horizontal line */}
              <div ref={bottomLineRef} style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: '1px',
                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                zIndex: 30,
                pointerEvents: 'none',
                borderTop: '1px dashed rgba(34, 197, 94, 0.8)'
              }} />
              {/* Left vertical line */}
              <div ref={leftLineRef} style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '1px',
                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                zIndex: 30,
                pointerEvents: 'none',
                borderLeft: '1px dashed rgba(34, 197, 94, 0.8)'
              }} />
              {/* Right vertical line */}
              <div ref={rightLineRef} style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '1px',
                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                zIndex: 30,
                pointerEvents: 'none',
                borderLeft: '1px dashed rgba(34, 197, 94, 0.8)'
              }} />
            </>
          )}

          {/* Selection Box overlay */}
          {renderSize.width > 0 && (
            <Rnd
              className={`selection-box ${isLocked ? 'preview-mode' : ''}`}
              size={{ width: positionPct.width * renderSize.width * zoom, height: positionPct.height * renderSize.height * zoom }}
              position={{ x: positionPct.x * renderSize.width * zoom, y: positionPct.y * renderSize.height * zoom }}
              onDrag={onDrag}
              onDragStop={onDragStop}
              onResize={onResize}
              onResizeStop={onResizeStop}
              bounds="parent"
              lockAspectRatio={true}
              disableDragging={isLocked}
              enableResizing={!isLocked}
              style={{ 
                overflow: 'hidden',
                border: isLocked ? 'none' : undefined,
                background: isLocked ? 'transparent' : undefined,
                backdropFilter: isLocked ? 'none' : undefined,
                zIndex: 20
              }}
            >
            {previewQrFile ? (
              <>
                {/* Background colored div perfectly mapped to the bounds of the QR code */}
                {bgColor !== 'transparent' && previewQrFile.bounds && (
                  <div style={{
                    position: 'absolute',
                    top: `${(previewQrFile.bounds.top / previewQrFile.originalSize.height) * 100}%`,
                    left: `${(previewQrFile.bounds.left / previewQrFile.originalSize.width) * 100}%`,
                    width: `${(previewQrFile.bounds.width / previewQrFile.originalSize.width) * 100}%`,
                    height: `${(previewQrFile.bounds.height / previewQrFile.originalSize.height) * 100}%`,
                    backgroundColor: bgColor,
                    zIndex: -1,
                    borderRadius: '4px'
                  }} />
                )}
                
                <img 
                  src={URL.createObjectURL(previewQrFile.file)} 
                  alt="QR Preview" 
                  draggable={false}
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover', 
                    pointerEvents: 'none',
                    // we no longer apply background color to the img directly
                  }} 
                />
              </>
            ) : (
              !isLocked && <span style={{ display: 'none' }}></span>
            )}
            </Rnd>
          )}
        </div>
      </div>
    </div>
  );
}
