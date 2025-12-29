
export interface OcrCorrection {
  original: string;
  fixed: string;
  reason: string;
}

export interface OcrResult {
  rawText: string;
  correctedText: string;
  corrections: OcrCorrection[];
  language: string;
  confidence: number;
}

export interface BatchItem {
  name: string;
  result: OcrResult | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export interface AppState {
  // Single file mode
  fileData: string | null;
  fileType: string | null;
  
  // Batch mode
  isBatchMode: boolean;
  batchFiles: File[];
  processedCount: number;
  consolidatedText: string;
  
  // Editor state
  editedText: string;
  
  isLoading: boolean;
  result: OcrResult | null;
  error: string | null;
}
