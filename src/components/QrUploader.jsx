import React, { useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { findQrBounds } from '../utils/imageProcessor';

export default function QrUploader({ qrFiles, setQrFiles }) {
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (e) => {
    if (e.target.files) {
      setIsProcessing(true);
      const files = Array.from(e.target.files);
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      
      const processedFiles = [];
      for (const file of imageFiles) {
        const qrData = await findQrBounds(file);
        processedFiles.push(qrData);
      }
      
      setQrFiles(prev => [...prev, ...processedFiles]);
      setIsProcessing(false);
    }
  };

  const removeFile = (indexToRemove) => {
    setQrFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div>
      <div 
        className="upload-area" 
        onClick={() => fileInputRef.current?.click()}
        style={{ padding: '1.5rem', marginBottom: '1rem' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png, image/jpeg, image/svg+xml"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          disabled={isProcessing}
        />
        {isProcessing ? (
          <Loader2 size={32} className="upload-icon" style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <Upload size={32} className="upload-icon" />
        )}
        <h4 style={{ margin: '0.5rem 0' }}>{isProcessing ? 'Processing Images...' : 'Upload QR Codes'}</h4>
        <p className="info-text">{isProcessing ? 'Auto-cropping margins' : 'Select PNG, JPG, or SVG images'}</p>
      </div>

      {qrFiles.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{qrFiles.length} uploaded</span>
            <button 
              onClick={() => setQrFiles([])} 
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Clear All
            </button>
          </div>
          
          <div className="qr-list" style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
            {qrFiles.map((item, idx) => (
              <div key={`${item.file.name}-${idx}`} className="qr-preview-item">
                <img src={URL.createObjectURL(item.file)} alt={`QR ${idx + 1}`} />
                <button 
                  className="remove-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  title="Remove"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
