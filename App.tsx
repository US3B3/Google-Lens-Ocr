
import React, { useState, useRef } from 'react';
import { AppState, OcrResult } from './types';
import { processOcr } from './services/geminiService';
import { Button } from './components/Button';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    fileData: null,
    fileType: null,
    isBatchMode: false,
    batchFiles: [],
    processedCount: 0,
    consolidatedText: '',
    editedText: '',
    isLoading: false,
    result: null,
    error: null,
  });

  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Added copyToClipboard function to fix the missing name error on line 387
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Kopyalama hatası:', err);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const startCamera = async () => {
    try {
      setShowCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error(err);
      alert("Kameraya erişilemedi.");
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        
        setState(prev => ({ 
          ...prev, 
          isBatchMode: false,
          fileData: dataUrl,
          fileType: 'image/jpeg',
          result: null, 
          editedText: '',
          error: null 
        }));
        
        // Stop camera
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
        setShowCamera(false);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setState(prev => ({ 
          ...prev, 
          isBatchMode: false,
          fileData: reader.result as string,
          fileType: file.type,
          result: null, 
          editedText: '',
          error: null 
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = (Array.from(e.target.files || []) as File[]).filter(file => 
      file.type.startsWith('image/') || file.type === 'application/pdf'
    );
    
    if (files.length > 0) {
      setState(prev => ({
        ...prev,
        isBatchMode: true,
        batchFiles: files,
        processedCount: 0,
        consolidatedText: '',
        editedText: '',
        fileData: 'folder_selected',
        result: null,
        error: null
      }));
    }
  };

  const startBatchProcess = async () => {
    if (state.batchFiles.length === 0) return;
    setState(prev => ({ ...prev, isLoading: true, error: null, processedCount: 0, consolidatedText: '', editedText: '' }));
    
    let currentConsolidated = '';
    try {
      for (let i = 0; i < state.batchFiles.length; i++) {
        const file = state.batchFiles[i];
        setState(prev => ({ ...prev, processedCount: i }));
        const base64 = await readFileAsBase64(file);
        const result = await processOcr(base64, file.type);
        const header = i === 0 ? '' : `\n\n--- SAYFA/DOSYA: ${file.name} ---\n\n`;
        currentConsolidated += header + result.correctedText;
        setState(prev => ({ ...prev, consolidatedText: currentConsolidated, editedText: currentConsolidated, processedCount: i + 1 }));
      }
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (err) {
      console.error(err);
      setState(prev => ({ ...prev, isLoading: false, error: "Toplu işlem sırasında hata oluştu." }));
    }
  };

  const handleProcess = async () => {
    if (state.isBatchMode) { await startBatchProcess(); return; }
    if (!state.fileData || !state.fileType) return;
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const ocrResult = await processOcr(state.fileData, state.fileType);
      setState(prev => ({ ...prev, result: ocrResult, editedText: ocrResult.correctedText, isLoading: false }));
    } catch (err) {
      console.error(err);
      setState(prev => ({ ...prev, isLoading: false, error: "Analiz başarısız oldu." }));
    }
  };

  const reset = () => {
    setState({
      fileData: null, fileType: null, isBatchMode: false, batchFiles: [],
      processedCount: 0, consolidatedText: '', editedText: '',
      isLoading: false, result: null, error: null,
    });
    setShowCamera(false);
  };

  const downloadAsTxt = (text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ocr-cikti-${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasResult = !!(state.result || (state.isBatchMode && state.editedText));

  return (
    <div className="min-h-screen pb-12 bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Dynamic Header */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-30 transition-all">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={reset}>
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
              <i className="fas fa-scan text-lg"></i>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black text-slate-800 tracking-tight">Gemini<span className="text-blue-600">Lens</span></h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Smart OCR Workflow</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {hasResult && (
              <div className="flex items-center gap-4 px-4 py-2 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-2">
                <span className="flex items-center gap-1.5"><i className="fas fa-file-alt text-blue-500"></i> {state.editedText.length} Karakter</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span className="flex items-center gap-1.5"><i className="fas fa-paragraph text-indigo-500"></i> {state.editedText.split('\n').filter(p => p.trim()).length} Paragraf</span>
              </div>
            )}
            {state.fileData && (
              <Button variant="secondary" onClick={reset} className="!rounded-full px-5 !text-xs font-bold uppercase tracking-widest border border-slate-200 shadow-sm">
                <i className="fas fa-redo"></i> Yeni
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        {!state.fileData ? (
          <div className="max-w-4xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center mb-12">
              <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tight">Belgelerinizi <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Dijitalleştirin</span></h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
                Gemini Vision AI ile görselleri, PDF'leri ve klasörleri saniyeler içinde hatasız metne dönüştürün.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <label className="cursor-pointer group flex flex-col h-full">
                <div className="flex-1 border-2 border-dashed border-slate-200 bg-white group-hover:border-blue-500 group-hover:bg-blue-50/30 transition-all rounded-[32px] p-8 flex flex-col items-center justify-center text-center shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner">
                    <i className="fas fa-file-upload text-2xl"></i>
                  </div>
                  <h3 className="font-bold text-slate-800">Dosya Yükle</h3>
                  <p className="text-xs text-slate-400 mt-2">Görsel veya PDF</p>
                </div>
                <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} />
              </label>

              <label className="cursor-pointer group flex flex-col h-full">
                <div className="flex-1 border-2 border-dashed border-slate-200 bg-white group-hover:border-indigo-500 group-hover:bg-indigo-50/30 transition-all rounded-[32px] p-8 flex flex-col items-center justify-center text-center shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner">
                    <i className="fas fa-folder-open text-2xl"></i>
                  </div>
                  <h3 className="font-bold text-slate-800">Klasör Tara</h3>
                  <p className="text-xs text-slate-400 mt-2">Çoklu sayfa birleştirme</p>
                </div>
                {/* Fixed error by spreading non-standard input attributes with any casting */}
                <input 
                  type="file" 
                  className="hidden" 
                  {...({ webkitdirectory: "", directory: "" } as any)} 
                  multiple 
                  onChange={handleFolderUpload} 
                />
              </label>

              <div className="cursor-pointer group" onClick={startCamera}>
                <div className="h-full border-2 border-dashed border-slate-200 bg-white group-hover:border-green-500 group-hover:bg-green-50/30 transition-all rounded-[32px] p-8 flex flex-col items-center justify-center text-center shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-green-50 text-green-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner">
                    <i className="fas fa-camera text-2xl"></i>
                  </div>
                  <h3 className="font-bold text-slate-800">Kamera ile Tara</h3>
                  <p className="text-xs text-slate-400 mt-2">Anlık çekim ve OCR</p>
                </div>
              </div>
            </div>

            {showCamera && (
              <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="relative max-w-2xl w-full bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl border border-slate-700">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-auto" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-6">
                    <button onClick={() => { 
                      const stream = videoRef.current?.srcObject as MediaStream;
                      stream?.getTracks().forEach(track => track.stop());
                      setShowCamera(false);
                    }} className="w-16 h-16 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all">
                      <i className="fas fa-times text-xl"></i>
                    </button>
                    <button onClick={capturePhoto} className="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/30 hover:scale-110 active:scale-95 transition-all">
                      <i className="fas fa-camera text-2xl"></i>
                    </button>
                  </div>
                </div>
                <p className="text-white/50 text-xs font-bold mt-6 uppercase tracking-widest">Belgenizi çerçeveye sığdırın</p>
              </div>
            )}
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${hasResult ? 'lg:grid-cols-12' : 'lg:grid-cols-2'} gap-8 items-start`}>
            
            {/* Sidebar Column */}
            <div className={`${hasResult ? 'lg:col-span-4' : ''} space-y-6 lg:sticky lg:top-24`}>
              <div className="bg-white p-4 rounded-[32px] border border-slate-200 shadow-xl overflow-hidden min-h-[300px] flex items-center justify-center relative">
                {state.isBatchMode ? (
                  <div className="text-center p-8 w-full">
                    <div className="w-24 h-24 bg-indigo-50 text-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner border border-indigo-100">
                      <i className="fas fa-layers-group"></i>
                    </div>
                    <h3 className="font-black text-slate-800 text-xl tracking-tight">Yığın İşlem</h3>
                    <p className="text-slate-500 text-sm mt-2 px-4 leading-relaxed font-medium">
                      <span className="font-black text-indigo-600 underline decoration-indigo-200 decoration-4 underline-offset-4">{state.batchFiles.length}</span> belge birleştirilmek üzere sırada bekliyor.
                    </p>
                    
                    {state.isLoading && (
                      <div className="mt-10 w-full max-w-xs mx-auto">
                        <div className="flex justify-between text-[10px] mb-2 font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center gap-2"><i className="fas fa-sync animate-spin"></i> İşleniyor</span>
                          <span>{state.processedCount} / {state.batchFiles.length}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner border border-slate-200 p-0.5">
                          <div 
                            className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 h-full transition-all duration-700 rounded-full shadow-lg" 
                            style={{ width: `${(state.processedCount / state.batchFiles.length) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full">
                     {state.fileType === 'application/pdf' ? (
                       <div className="py-20 flex flex-col items-center">
                          <div className="w-24 h-24 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center shadow-inner border border-red-100 mb-6">
                            <i className="fas fa-file-pdf text-4xl"></i>
                          </div>
                          <p className="font-black text-slate-800">PDF Dokümanı</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Tüm sayfalar taranacak</p>
                       </div>
                     ) : (
                        <img src={state.fileData!} alt="Preview" className="w-full h-auto rounded-2xl max-h-[500px] object-contain shadow-sm" />
                     )}
                  </div>
                )}
              </div>

              {!hasResult && !state.isLoading && (
                <Button 
                  className="w-full h-16 text-lg font-black uppercase tracking-widest shadow-2xl shadow-blue-200 rounded-2xl group transition-all hover:scale-[1.02] active:scale-95" 
                  onClick={handleProcess}
                >
                  <i className="fas fa-wand-magic-sparkles mr-2"></i> Analizi Başlat
                </Button>
              )}

              {state.error && (
                <div className="bg-red-50 border border-red-100 text-red-600 p-6 rounded-3xl flex items-start gap-4 animate-shake shadow-lg shadow-red-100">
                  <i className="fas fa-exclamation-triangle text-xl mt-1"></i>
                  <div>
                    <h4 className="font-bold text-sm">Bir Sorun Oluştu</h4>
                    <p className="text-xs opacity-80 mt-1 font-medium">{state.error}</p>
                  </div>
                </div>
              )}

              {hasResult && !state.isBatchMode && state.result?.corrections && state.result.corrections.length > 0 && (
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden hidden lg:block">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest">AI Düzeltme Günlüğü</h3>
                    <span className="bg-blue-100 text-blue-700 text-[10px] px-3 py-1 rounded-full font-black">{state.result.corrections.length}</span>
                  </div>
                  <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {state.result.corrections.map((corr, idx) => (
                      <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-300 transition-colors group">
                        <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                          <span className="line-through text-slate-400 font-medium px-1 bg-slate-100 rounded">{corr.original}</span>
                          <i className="fas fa-arrow-right text-[10px] text-blue-500"></i>
                          <span className="text-blue-700 font-bold px-1 bg-blue-50 rounded">{corr.fixed}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium italic opacity-70 leading-relaxed">"{corr.reason}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Editor Column */}
            <div className={`${hasResult ? 'lg:col-span-8' : ''} space-y-6`}>
              {state.isLoading && (
                <div className="bg-white p-24 rounded-[40px] border border-slate-200 shadow-2xl text-center flex flex-col items-center justify-center min-h-[500px]">
                  <div className="relative w-28 h-28 mb-10">
                    <div className="absolute inset-0 border-[8px] border-slate-50 rounded-full"></div>
                    <div className="absolute inset-0 border-[8px] border-blue-600 rounded-full border-t-transparent animate-spin shadow-lg"></div>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Yapay Zeka İnceliyor</h3>
                  <p className="text-slate-400 max-w-sm mx-auto leading-relaxed font-medium">
                    Doküman yapısı çözümleniyor, paragraf girintileri korunuyor ve OCR hataları Gemini tarafından ayıklanıyor...
                  </p>
                </div>
              )}

              {hasResult && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-12 duration-1000">
                  <div className="bg-white/80 backdrop-blur-xl p-3 rounded-2xl border border-slate-200 shadow-xl flex items-center justify-between sticky top-[72px] z-20">
                    <div className="flex items-center gap-3 ml-2">
                      <div className="w-8 h-8 rounded-lg bg-green-500 text-white flex items-center justify-center text-xs shadow-lg shadow-green-100">
                        <i className="fas fa-pen-nib"></i>
                      </div>
                      <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Akıllı Editör</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        className="!p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-xl"
                        onClick={() => { copyToClipboard(state.editedText); }}
                        title="Tümünü Kopyala"
                      >
                        <i className="fas fa-copy text-lg"></i>
                      </Button>
                      <Button 
                        className="bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:scale-[1.02] transition-all"
                        onClick={() => downloadAsTxt(state.editedText)}
                      >
                        <i className="fas fa-file-download mr-2"></i> İndir (.txt)
                      </Button>
                    </div>
                  </div>

                  <div className="relative group">
                    <div className="absolute -inset-1.5 bg-gradient-to-b from-blue-200 to-indigo-200 rounded-[48px] blur-2xl opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                    <div className="relative bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden ring-1 ring-slate-900/5">
                      <div className="absolute top-0 left-12 w-[1px] h-full bg-red-100/30 hidden sm:block"></div>
                      <textarea
                        className="w-full min-h-[800px] p-10 sm:p-16 sm:pl-24 focus:outline-none resize-none bg-transparent text-slate-800 leading-[1.8] text-xl font-medium placeholder-slate-200 transition-all scroll-smooth"
                        placeholder="Düzenlenebilir metin burada görünecek..."
                        value={state.editedText}
                        onChange={(e) => setState(prev => ({ ...prev, editedText: e.target.value }))}
                        spellCheck={false}
                        style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.01em' }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center px-6 py-2">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      Canlı Kayıt Aktif
                    </div>
                    <p className="text-[10px] text-slate-300 font-bold italic tracking-wider">Gemini 3.0 Flash Pro OCR Engine</p>
                  </div>
                </div>
              )}
              
              {!hasResult && !state.isLoading && (
                <div className="bg-slate-50/50 rounded-[40px] border-4 border-dashed border-slate-200 p-32 text-center text-slate-300 group hover:border-blue-200 transition-all">
                  <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                    <i className="fas fa-i-cursor text-4xl opacity-10"></i>
                  </div>
                  <p className="font-black text-xs uppercase tracking-[0.2em] max-w-[200px] mx-auto leading-relaxed">Analiz Sonrasında Metni Burada Düzenleyebilirsiniz</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="mt-24 text-center pb-8">
        <div className="flex items-center justify-center gap-6 mb-4">
           <div className="h-[1px] w-12 bg-slate-200"></div>
           <i className="fas fa-brain text-slate-200 text-sm"></i>
           <div className="h-[1px] w-12 bg-slate-200"></div>
        </div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Smart Vision Workspace &copy; 2025</p>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
};

export default App;
