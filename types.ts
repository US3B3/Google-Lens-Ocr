
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
  id: string;
  name: string;
  data: string; // base64 representation
  type: string;
}

export interface AppState {
  fileData: string | null;
  fileType: string | null;
  
  isBatchMode: boolean;
  batchItems: BatchItem[];
  processedCount: number;
  
  currentBatchIndex: number; 
  totalBatches: number;
  batchLogs: string[];
  
  consolidatedText: string;
  editedText: string;
  
  isLoading: boolean;
  result: OcrResult | null;
  error: string | null;
}
