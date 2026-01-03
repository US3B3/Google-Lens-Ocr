
import React, { useState, useRef, useEffect } from 'react';
import { AppState, BatchItem } from './types';
import { processOcr } from './services/geminiService';
import { Button } from './components/Button';
import * as driveService from './services/driveService';

const STORAGE_KEY = 'gemini_lens_persistence_v1';

if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
  (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    fileData: null,
    fileType: null,
    isBatchMode: false,
    batchItems: [],
    processedCount: 0,
    currentBatchIndex: 0,
    totalBatches: 0,
    batchLogs: [],
    consolidatedText: '',
    editedText: '',
    isLoading: false,
    result: null,
    error: null,
  });

  const [showCamera, setShowCamera] = useState(false);
  const [hasRecoverableData, setHasRecoverableData] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize GAPI
  useEffect(() => {
    const loadGapi = () => {
        (window as any).gapi.load('picker', () => console.log('Picker loaded'));
    };
    loadGapi();
  }, []);

  const handleDriveProcess = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null, batchLogs: ["🔐 Drive yetkilendirmesi bekleniyor..."] }));
      const token = await driveService.initDriveAuth();
      
      setState(prev => ({ ...prev, batchLogs: [...prev.batchLogs, "📂 Klasör seçimi bekleniyor..."] }));
      const folderId = await driveService.pickDriveFolder();
      
      setState(prev => ({ ...prev, batchLogs: [...prev.batchLogs, "🔍 Dosyalar taranıyor..."] }));
      const allFiles = await driveService.listFolderFiles(folderId, token);
      
      // FILTRE: İsim "ocr" ile başlıyorsa ATLA
      const validFiles = allFiles.filter((f: any) => {
        const isAlreadyProcessed = f.name.toLowerCase().startsWith('ocr');
        const isSupported = f.mimeType.startsWith('image/') || f.mimeType === 'application/pdf';
        return !isAlreadyProcessed && isSupported;
      });

      const skippedCount = allFiles.length - validFiles.length;
      
      if (validFiles.length === 0) {
        setState(prev => ({ ...prev, isLoading: false, error: "İşlenecek yeni dosya bulunamadı. (Mevcut dosyalar 'ocr' ile başlıyor olabilir)" }));
        return;
      }

      const items: BatchItem[] = validFiles.map((f: any) => ({
        id: f.id,
        name: f.name,
        data: 'drive_id:' + f.id, // Mark as drive item to download later
        type: f.mimeType
      }));

      setState(prev => ({
        ...prev,
        isBatchMode: true,
        batchItems: items,
        processedCount: 0,
        editedText: '',
        fileData: 'drive_selected',
        isLoading: false,
        batchLogs: [...prev.batchLogs, `✅ ${items.length} dosya kuyruğa eklendi.`, `ℹ️ ${skippedCount} dosya 'ocr' ön eki nedeniyle atlandı.`]
      }));

    } catch (err: any) {
      console.error(err);
      setState(prev => ({ ...prev, isLoading: false, error: "Drive bağlantısı kurulamadı. Client ID'nizi kontrol edin." }));
    }
  };

  const startBatchProcess = async () => {
    if (state.batchItems.length === 0) return;
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    let fullConsolidatedText = state.editedText;
    let driveToken: string | null = null;

    try {
      // If we have drive items, we might need a token
      if (state.batchItems.some(i => i.data.startsWith('drive_id:'))) {
        driveToken = await driveService.initDriveAuth();
      }

      for (let i = state.processedCount; i < state.batchItems.length; i++) {
        let item = state.batchItems[i];
        setState(prev => ({ ...prev, processedCount: i + 1 }));

        let base64 = item.data;
        
        // Drive'dan anlık indir (Bellek tasarrufu için sadece işlenirken çekiyoruz)
        if (base64.startsWith('drive_id:')) {
            const fileId = base64.split(':')[1];
            base64 = await driveService.downloadDriveFile(fileId, driveToken!);
        }

        // PDF ise sayfalara ayır ve işle
        if (item.type === 'application/pdf') {
            // PDF işleme mantığı (Basitleştirilmiş: Sadece ilk sayfayı veya mevcut splitPdfToImages kullanarak döngüye sokulabilir)
            // Ancak hız için direkt base64 gönderimi (Gemini PDF destekler) de tercih edilebilir
            // Burada önceki versiyonlardaki splitPdfToImages mantığını çağırabiliriz.
        }

        const result = await processOcr(base64, item.type);
        const header = `\n\n--- [${item.name}] ---\n\n`;
        fullConsolidatedText += header + result.correctedText;
        
        setState(prev => ({ 
          ...prev, 
          editedText: fullConsolidatedText,
          batchLogs: [...prev.batchLogs, `📄 ${item.name} işlendi.`]
        }));
      }

      downloadAsTxt(fullConsolidatedText);
      setState(prev => ({ ...prev, isLoading: false, batchLogs: [...prev.batchLogs, "🎉 İşlem tamamlandı!"] }));
    } catch (err) {
      setState(prev => ({ ...prev, isLoading: false, error: "İşlem yarıda kesildi." }));
    }
  };

  // Helper methods... (Reset, Download, etc. same as before)
  const downloadAsTxt = (text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GeminiLens_Output_${new Date().getTime()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setState({
      fileData: null, fileType: null, isBatchMode: false, batchItems: [],
      processedCount: 0, currentBatchIndex: 0, totalBatches: 0, batchLogs: [],
      consolidatedText: '', editedText: '', isLoading: false, result: null, error: null,
    });
  };

  const hasResult = !!(state.result || (state.isBatchMode && state.editedText));

  return (
    <div className="min-h-screen pb-12 bg-slate-50 font-sans">
      <header className="bg-white/90 backdrop-blur-xl border-b sticky top-0 z-30 shadow-sm h-16 flex items-center px-4">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={reset}>
            <div className="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg">
              <i className="fas fa-cloud-upload-alt"></i>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800">Gemini<span className="text-blue-600">Drive</span></h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none italic">Smart Skip Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasResult && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{state.processedCount}/{state.batchItems.length} İşlendi</span>}
            {state.fileData && <Button variant="secondary" onClick={reset} className="!rounded-full px-5 text-xs">Sıfırla</Button>}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-12">
        {!state.fileData ? (
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-6xl font-black text-slate-900 mb-6 tracking-tighter">Dosyaları <span className="text-blue-600">Akıllı</span> Yönetin</h2>
              <p className="text-slate-500 text-xl max-w-2xl mx-auto font-medium">Klasördeki "ocr" ile başlayan dosyalar otomatik olarak atlanır, sadece yeni dökümanlar işlenir.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Drive Card */}
              <div onClick={handleDriveProcess} className="group cursor-pointer relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-green-500 rounded-[36px] blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative h-full border bg-white rounded-[32px] p-8 flex flex-col items-center text-center shadow-sm transition-transform group-hover:-translate-y-2">
                  <div className="w-20 h-20 rounded-3xl drive-gradient flex items-center justify-center text-white mb-6 shadow-xl">
                    <i className="fab fa-google-drive text-3xl"></i>
                  </div>
                  <h3 className="font-black text-slate-800 text-lg">Drive Klasörü</h3>
                  <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-widest">Akıllı Filtreleme</p>
                </div>
              </div>

              {/* PDF Card */}
              <label className="cursor-pointer group">
                <div className="h-full border bg-white group-hover:border-blue-500 transition-all rounded-[32px] p-8 flex flex-col items-center text-center shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mb-6 shadow-inner"><i className="fas fa-file-pdf text-2xl"></i></div>
                  <h3 className="font-bold text-slate-800">Yerel PDF</h3>
                  <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => {/* existing handler */}} />
                </div>
              </label>

              {/* Folder Card */}
              <label className="cursor-pointer group">
                <div className="h-full border bg-white group-hover:border-indigo-500 transition-all rounded-[32px] p-8 flex flex-col items-center text-center shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-6 shadow-inner"><i className="fas fa-folder-open text-2xl"></i></div>
                  <h3 className="font-bold text-slate-800">Yerel Klasör</h3>
                  <input type="file" className="hidden" {...({ webkitdirectory: "", directory: "" } as any)} multiple />
                </div>
              </label>

              {/* Camera Card */}
              <div onClick={() => setShowCamera(true)} className="cursor-pointer group">
                <div className="h-full border bg-white group-hover:border-green-500 transition-all rounded-[32px] p-8 flex flex-col items-center text-center shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-green-50 text-green-500 flex items-center justify-center mb-6 shadow-inner"><i className="fas fa-camera text-2xl"></i></div>
                  <h3 className="font-bold text-slate-800">Kamera</h3>
                </div>
              </div>
            </div>
            
            {state.error && <div className="mt-12 p-6 bg-red-50 border border-red-100 rounded-3xl text-red-600 text-center font-bold animate-bounce">{state.error}</div>}
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${hasResult ? 'lg:grid-cols-12' : 'lg:grid-cols-2'} gap-8 items-start`}>
            <div className={`${hasResult ? 'lg:col-span-4' : ''} space-y-6 lg:sticky lg:top-24`}>
                <div className="bg-white p-8 rounded-[40px] border shadow-2xl text-center">
                    <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner">
                        <i className={state.fileData === 'drive_selected' ? "fab fa-google-drive" : "fas fa-copy"}></i>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">Kuyruk Hazır</h3>
                    <p className="text-slate-500 font-medium">{state.batchItems.length} yeni dosya tespit edildi.</p>
                    
                    {state.isLoading && (
                        <div className="mt-10 space-y-6">
                            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner border">
                                <div className="h-full bg-blue-600 transition-all duration-700" style={{ width: `${(state.processedCount / (state.batchItems.length || 1)) * 100}%` }}></div>
                            </div>
                            <div className="flex items-center justify-center gap-3 text-blue-600 font-black text-xs uppercase tracking-widest animate-pulse">
                                <i className="fas fa-brain"></i> Gemini Analiz Ediyor...
                            </div>
                        </div>
                    )}

                    {!hasResult && !state.isLoading && (
                        <Button className="w-full h-16 text-lg font-black uppercase rounded-2xl mt-8 shadow-xl shadow-blue-100" onClick={startBatchProcess}>
                            İşlemi Başlat
                        </Button>
                    )}
                </div>

                <div className="bg-white rounded-[32px] border p-6 space-y-3 shadow-lg">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Oturum Detayları</h4>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                        {state.batchLogs.map((log, i) => (
                            <div key={i} className="text-[11px] font-bold text-slate-600 flex items-center gap-2">
                                <i className="fas fa-check-circle text-green-500"></i> {log}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className={`${hasResult ? 'lg:col-span-8' : ''}`}>
                {hasResult && (
                    <div className="space-y-6 animate-in fade-in duration-1000">
                        <div className="bg-white/80 backdrop-blur-md p-4 rounded-[28px] border shadow-xl flex items-center justify-between sticky top-20 z-20">
                            <div className="flex items-center gap-3 ml-4">
                                <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center"><i className="fas fa-file-alt"></i></div>
                                <span className="font-black text-slate-800 uppercase text-xs tracking-widest">Birleştirilmiş Çıktı</span>
                            </div>
                            <div className="flex gap-2">
                                <Button className="bg-slate-900 text-white px-8 rounded-xl font-black text-xs uppercase" onClick={() => downloadAsTxt(state.editedText)}>İndir</Button>
                            </div>
                        </div>
                        <div className="bg-white rounded-[48px] shadow-2xl border-4 border-white overflow-hidden ring-1 ring-slate-100">
                            <textarea
                                className="w-full min-h-[900px] p-12 sm:p-20 focus:outline-none resize-none bg-transparent text-slate-800 leading-[2] text-xl font-medium"
                                value={state.editedText}
                                onChange={(e) => setState(prev => ({ ...prev, editedText: e.target.value }))}
                                spellCheck={false}
                            />
                        </div>
                    </div>
                )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
