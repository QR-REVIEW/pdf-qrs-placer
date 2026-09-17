import React, { useState, useEffect } from 'react';
import { Download, LayoutTemplate, Settings2 } from 'lucide-react';
import PdfViewer from './components/PdfViewer';
import QrUploader from './components/QrUploader';
import { generatePdf, downloadPdf } from './utils/pdfGenerator';
import './index.css';

function App() {
  const [templateFile, setTemplateFile] = useState(null);
  const [qrFiles, setQrFiles] = useState([]);
  
  // Selection box state in percentages (0 to 1)
  const [positionPct, setPositionPct] = useState(() => {
    const saved = localStorage.getItem('qr-position-pct');
    return saved ? JSON.parse(saved) : { x: 0.1, y: 0.1, width: 0.2, height: 0.2 };
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [bgColor, setBgColor] = useState('transparent');
  const [showGuides, setShowGuides] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Load saved template on mount
  useEffect(() => {
    const savedPdfData = localStorage.getItem('qr-template-pdf');
    if (savedPdfData) {
      fetch(savedPdfData)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "saved-template.pdf", { type: 'application/pdf' });
          setTemplateFile(file);
        })
        .catch(console.error);
    }
  }, []);

  // Save position whenever it changes
  useEffect(() => {
    localStorage.setItem('qr-position-pct', JSON.stringify(positionPct));
  }, [positionPct]);

  const handleTemplateChange = (file) => {
    setTemplateFile(file);
    if (!file) {
      localStorage.removeItem('qr-template-pdf');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        localStorage.setItem('qr-template-pdf', e.target.result);
      } catch (err) {
        console.warn("Could not save PDF to localStorage (might be too large)", err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!templateFile || qrFiles.length === 0) return;
    
    setIsGenerating(true);
    try {
      const pdfBytes = await generatePdf(templateFile, qrFiles, positionPct, bgColor);
      downloadPdf(pdfBytes, 'generated-qr-designs.pdf');
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("There was an error generating the PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>QR Design Automator</h1>
        <p>Map your QR area on a template and automate bulk generation instantly.</p>
      </header>

      <div className="workspace">
        {/* Main Editor Area */}
        <div className="panel" style={{ flexGrow: 1 }}>
          <h2 className="panel-title">
            <LayoutTemplate className="icon" /> 
            Template Workspace
            {templateFile && (
              <button 
                onClick={() => handleTemplateChange(null)}
                style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '0.3rem 0.8rem', background: 'var(--border-color)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
              >
                Change Template
              </button>
            )}
          </h2>
          
          <PdfViewer 
            templateFile={templateFile} 
            onTemplateUpload={handleTemplateChange}
            positionPct={positionPct}
            onPositionChangePct={setPositionPct}
            previewQrFile={qrFiles.length > 0 ? qrFiles[0] : null}
            bgColor={bgColor}
            showGuides={showGuides}
            isLocked={isLocked}
          />
          
          {templateFile && (
            <p className="info-text" style={{ textAlign: 'left', marginTop: '0' }}>
              Drag and resize the green box to match where you want the QR code to be placed on the final PDF.
            </p>
          )}
        </div>

        {/* Sidebar */}
        <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Controls Panel */}
          <div className="panel">
            <h2 className="panel-title">
              <Settings2 className="icon" />
              Settings
            </h2>
            
            <QrUploader qrFiles={qrFiles} setQrFiles={setQrFiles} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <span style={{ fontWeight: 600 }}>Show Construction Guides</span>
                <input 
                  type="checkbox" 
                  checked={showGuides} 
                  onChange={(e) => setShowGuides(e.target.checked)} 
                  style={{ transform: 'scale(1.2)' }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>Background Color</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    checked={bgColor !== 'transparent'} 
                    onChange={(e) => setBgColor(e.target.checked ? '#ffffff' : 'transparent')}
                  />
                  {bgColor !== 'transparent' && (
                    <input 
                      type="color" 
                      value={bgColor} 
                      onChange={(e) => setBgColor(e.target.value)}
                      style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', width: '24px', height: '24px' }}
                    />
                  )}
                </div>
              </label>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '0.5rem', background: isLocked ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)', borderRadius: '6px' }}>
                <span style={{ fontWeight: 600, color: isLocked ? '#22c55e' : 'inherit' }}>
                  {isLocked ? '🔒 Layout Locked' : '🔓 Lock Layout'}
                </span>
                <input 
                  type="checkbox" 
                  checked={isLocked} 
                  onChange={(e) => setIsLocked(e.target.checked)} 
                  style={{ transform: 'scale(1.2)' }}
                />
              </label>
            </div>

            <button 
              className="btn" 
              onClick={handleGenerate}
              disabled={!templateFile || qrFiles.length === 0 || isGenerating}
            >
              <Download size={20} />
              {isGenerating ? 'Generating...' : 'Generate PDF'}
            </button>
          </div>

          {/* Stats Panel */}
          <div className="panel" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>QR Codes</span>
              <strong>{qrFiles.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Expected Output</span>
              <strong>{qrFiles.length} Pages</strong>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

export default App;
