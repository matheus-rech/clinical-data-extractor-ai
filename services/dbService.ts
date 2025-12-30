/**
 * IndexedDB Service for Clinical Data Extractor
 * Handles persistent storage for papers, extraction results, and history
 */

import { ExtractionResults } from '../types';

const DB_NAME = 'ClinicalDataExtractorDB';
const DB_VERSION = 1;

// ============================================
// Types
// ============================================

export interface StoredPaper {
  id: string;
  fileName: string;
  uploadedAt: Date;
  lastModified: Date;
  pdfBase64: string;
  extractionResults: ExtractionResults | null;
  metadata: {
    pageCount?: number;
    fileSize?: number;
    title?: string;
    authors?: string[];
    year?: number;
    doi?: string;
  };
}

export interface HistoryEntry {
  id: string;
  paperId: string;
  timestamp: Date;
  action: 'create' | 'update' | 'extract' | 'manual_edit';
  previousState: ExtractionResults | null;
  currentState: ExtractionResults | null;
  description: string;
}

export interface AppSettings {
  id: 'main';
  activePaperId: string | null;
  recentPaperIds: string[];
  theme: 'light' | 'dark' | 'system';
  autoSaveEnabled: boolean;
  autoSaveIntervalMs: number;
}

// ============================================
// Database Initialization
// ============================================

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('IndexedDB initialized successfully');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Papers store
      if (!db.objectStoreNames.contains('papers')) {
        const papersStore = db.createObjectStore('papers', { keyPath: 'id' });
        papersStore.createIndex('fileName', 'fileName', { unique: false });
        papersStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        papersStore.createIndex('lastModified', 'lastModified', { unique: false });
      }

      // History store for undo/redo
      if (!db.objectStoreNames.contains('history')) {
        const historyStore = db.createObjectStore('history', { keyPath: 'id' });
        historyStore.createIndex('paperId', 'paperId', { unique: false });
        historyStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      console.log('IndexedDB schema created/upgraded');
    };
  });
};

// ============================================
// Paper Operations
// ============================================

/**
 * Generate unique paper ID
 */
export const generatePaperId = (): string => {
  return `paper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Save a new paper
 */
export const savePaper = async (paper: StoredPaper): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['papers'], 'readwrite');
    const store = transaction.objectStore('papers');
    const request = store.put(paper);

    request.onsuccess = () => {
      console.log(`Paper saved: ${paper.fileName}`);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Get a paper by ID
 */
export const getPaper = async (id: string): Promise<StoredPaper | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['papers'], 'readonly');
    const store = transaction.objectStore('papers');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Get all papers (sorted by last modified)
 */
export const getAllPapers = async (): Promise<StoredPaper[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['papers'], 'readonly');
    const store = transaction.objectStore('papers');
    const index = store.index('lastModified');
    const request = index.openCursor(null, 'prev'); // Descending

    const papers: StoredPaper[] = [];
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        papers.push(cursor.value);
        cursor.continue();
      } else {
        resolve(papers);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Delete a paper
 */
export const deletePaper = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['papers', 'history'], 'readwrite');

    // Delete paper
    const papersStore = transaction.objectStore('papers');
    papersStore.delete(id);

    // Delete associated history
    const historyStore = transaction.objectStore('history');
    const historyIndex = historyStore.index('paperId');
    const cursorRequest = historyIndex.openCursor(IDBKeyRange.only(id));

    cursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => {
      console.log(`Paper deleted: ${id}`);
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

/**
 * Update paper extraction results
 */
export const updatePaperResults = async (
  id: string,
  results: ExtractionResults,
  action: HistoryEntry['action'] = 'update',
  description: string = 'Updated extraction results'
): Promise<void> => {
  const db = await initDB();
  const paper = await getPaper(id);
  if (!paper) throw new Error(`Paper not found: ${id}`);

  // Create history entry for undo/redo
  const historyEntry: HistoryEntry = {
    id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    paperId: id,
    timestamp: new Date(),
    action,
    previousState: paper.extractionResults,
    currentState: results,
    description
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['papers', 'history'], 'readwrite');

    // Update paper
    const papersStore = transaction.objectStore('papers');
    paper.extractionResults = results;
    paper.lastModified = new Date();
    papersStore.put(paper);

    // Save history
    const historyStore = transaction.objectStore('history');
    historyStore.add(historyEntry);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

// ============================================
// History Operations (Undo/Redo)
// ============================================

/**
 * Get history for a paper
 */
export const getPaperHistory = async (paperId: string): Promise<HistoryEntry[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['history'], 'readonly');
    const store = transaction.objectStore('history');
    const index = store.index('paperId');
    const request = index.getAll(paperId);

    request.onsuccess = () => {
      const entries = request.result as HistoryEntry[];
      // Sort by timestamp descending
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      resolve(entries);
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Undo last change for a paper
 */
export const undoLastChange = async (paperId: string): Promise<ExtractionResults | null> => {
  const history = await getPaperHistory(paperId);
  if (history.length === 0) return null;

  const lastEntry = history[0];
  if (!lastEntry.previousState) return null;

  const paper = await getPaper(paperId);
  if (!paper) return null;

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['papers', 'history'], 'readwrite');

    // Revert paper state
    const papersStore = transaction.objectStore('papers');
    paper.extractionResults = lastEntry.previousState;
    paper.lastModified = new Date();
    papersStore.put(paper);

    // Remove the history entry (or mark as undone)
    const historyStore = transaction.objectStore('history');
    historyStore.delete(lastEntry.id);

    transaction.oncomplete = () => resolve(lastEntry.previousState);
    transaction.onerror = () => reject(transaction.error);
  });
};

// ============================================
// Settings Operations
// ============================================

const DEFAULT_SETTINGS: AppSettings = {
  id: 'main',
  activePaperId: null,
  recentPaperIds: [],
  theme: 'light',
  autoSaveEnabled: true,
  autoSaveIntervalMs: 30000 // 30 seconds
};

/**
 * Get app settings
 */
export const getSettings = async (): Promise<AppSettings> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.get('main');

    request.onsuccess = () => {
      resolve(request.result || DEFAULT_SETTINGS);
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Update app settings
 */
export const updateSettings = async (settings: Partial<AppSettings>): Promise<void> => {
  const db = await initDB();
  const currentSettings = await getSettings();
  const newSettings = { ...currentSettings, ...settings };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');
    const request = store.put(newSettings);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// ============================================
// Export Functions
// ============================================

/**
 * Export paper data as JSON
 */
export const exportAsJSON = (paper: StoredPaper): string => {
  return JSON.stringify({
    metadata: paper.metadata,
    extractionResults: paper.extractionResults,
    exportedAt: new Date().toISOString()
  }, null, 2);
};

/**
 * Export paper data as CSV (for meta-analysis)
 */
export const exportAsCSV = (paper: StoredPaper): string => {
  if (!paper.extractionResults) return '';

  const results = paper.extractionResults;
  const rows: string[][] = [];

  // Header row
  rows.push([
    'Study ID',
    'Year',
    'Country',
    'Design',
    'Total N',
    'Surgical N',
    'Control N',
    'Mean Age',
    'Male %',
    'Intervention',
    'Comparator',
    'Mortality Surgical',
    'Mortality Control',
    'mRS 0-2 Surgical',
    'mRS 0-2 Control'
  ]);

  // Data row
  const getValue = (obj: any, path: string): string => {
    try {
      const parts = path.split('.');
      let current = obj;
      for (const part of parts) {
        current = current?.[part];
      }
      return current?.content?.toString() || current?.toString() || '';
    } catch {
      return '';
    }
  };

  const baseline = results.baseline || {};
  const outcomes = results.outcomes || {};

  rows.push([
    getValue(results, 'studyId.citation'),
    getValue(results, 'studyId.year'),
    getValue(results, 'studyId.country'),
    getValue(results, 'picoT.studyType'),
    getValue(baseline, 'sampleSize.totalN'),
    getValue(baseline, 'sampleSize.surgicalN'),
    getValue(baseline, 'sampleSize.controlN'),
    getValue(baseline, 'age.mean'),
    baseline.gender?.maleN && baseline.sampleSize?.totalN?.content
      ? ((baseline.gender.maleN.content / baseline.sampleSize.totalN.content) * 100).toFixed(1)
      : '',
    getValue(results, 'picoT.intervention'),
    getValue(results, 'picoT.comparator'),
    outcomes.mortality?.[0]?.deathsN?.content?.toString() || '',
    outcomes.mortality?.[1]?.deathsN?.content?.toString() || '',
    outcomes.mrs?.[0]?.eventsN?.content?.toString() || '',
    outcomes.mrs?.[1]?.eventsN?.content?.toString() || ''
  ]);

  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
};

/**
 * Export paper data for R (data frame format)
 */
export const exportForR = (papers: StoredPaper[]): string => {
  const lines: string[] = [
    '# Clinical Data Extractor - R Export',
    `# Exported at: ${new Date().toISOString()}`,
    `# Number of studies: ${papers.length}`,
    '',
    '# Create data frame',
    'clinical_data <- data.frame(',
    '  study_id = c(' + papers.map(p => `"${p.metadata.title || p.fileName}"`).join(', ') + '),',
    '  year = c(' + papers.map(p => p.extractionResults?.studyId?.year?.content || 'NA').join(', ') + '),',
    '  n_total = c(' + papers.map(p => p.extractionResults?.baseline?.sampleSize?.totalN?.content || 'NA').join(', ') + '),',
    '  n_intervention = c(' + papers.map(p => p.extractionResults?.baseline?.sampleSize?.surgicalN?.content || 'NA').join(', ') + '),',
    '  n_control = c(' + papers.map(p => p.extractionResults?.baseline?.sampleSize?.controlN?.content || 'NA').join(', ') + '),',
    '  mean_age = c(' + papers.map(p => p.extractionResults?.baseline?.age?.mean?.content || 'NA').join(', ') + '),',
    '  events_intervention = c(' + papers.map(p => {
      const mortality = p.extractionResults?.outcomes?.mortality;
      return Array.isArray(mortality) && mortality[0]?.deathsN?.content || 'NA';
    }).join(', ') + '),',
    '  events_control = c(' + papers.map(p => {
      const mortality = p.extractionResults?.outcomes?.mortality;
      return Array.isArray(mortality) && mortality[1]?.deathsN?.content || 'NA';
    }).join(', ') + ')',
    ')',
    '',
    '# For meta-analysis with metafor:',
    '# library(metafor)',
    '# es <- escalc(measure="OR", ai=events_intervention, n1i=n_intervention,',
    '#              ci=events_control, n2i=n_control, data=clinical_data)',
    '# res <- rma(yi, vi, data=es)',
    ''
  ];

  return lines.join('\n');
};

/**
 * Export paper data for RevMan (Cochrane Review Manager)
 */
export const exportForRevMan = (paper: StoredPaper): string => {
  if (!paper.extractionResults) return '';

  const results = paper.extractionResults;
  const outcomes = results.outcomes || {};

  // RevMan uses a specific XML format for data import
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<RevMan_Data>
  <STUDY>
    <NAME>${paper.metadata.title || paper.fileName}</NAME>
    <YEAR>${results.studyId?.year?.content || ''}</YEAR>
    <COUNTRY>${results.studyId?.country?.content || ''}</COUNTRY>
    <DESIGN>${results.picoT?.studyType?.content || ''}</DESIGN>

    <PARTICIPANTS>
      <TOTAL>${results.baseline?.sampleSize?.totalN?.content || ''}</TOTAL>
      <INTERVENTION_N>${results.baseline?.sampleSize?.surgicalN?.content || ''}</INTERVENTION_N>
      <CONTROL_N>${results.baseline?.sampleSize?.controlN?.content || ''}</CONTROL_N>
      <MEAN_AGE>${results.baseline?.age?.mean?.content || ''}</MEAN_AGE>
    </PARTICIPANTS>

    <INTERVENTIONS>
      <INTERVENTION>${results.picoT?.intervention?.content || ''}</INTERVENTION>
      <COMPARATOR>${results.picoT?.comparator?.content || ''}</COMPARATOR>
    </INTERVENTIONS>

    <OUTCOMES>
      ${Array.isArray(outcomes.mortality) ? outcomes.mortality.map((m: any, i: number) => `
      <MORTALITY group="${m.armId?.content || i}">
        <EVENTS>${m.deathsN?.content || ''}</EVENTS>
        <TOTAL>${m.totalN?.content || ''}</TOTAL>
        <TIMEPOINT>${m.timepoint?.content || ''}</TIMEPOINT>
      </MORTALITY>`).join('') : ''}

      ${Array.isArray(outcomes.mrs) ? outcomes.mrs.map((m: any, i: number) => `
      <MRS group="${m.armId?.content || i}">
        <EVENTS>${m.eventsN?.content || ''}</EVENTS>
        <TOTAL>${m.totalN?.content || ''}</TOTAL>
        <DEFINITION>${m.definition?.content || ''}</DEFINITION>
        <TIMEPOINT>${m.timepoint?.content || ''}</TIMEPOINT>
      </MRS>`).join('') : ''}
    </OUTCOMES>
  </STUDY>
</RevMan_Data>`;

  return xml;
};

/**
 * Export all papers as combined dataset
 */
export const exportAllPapersForMetaAnalysis = async (): Promise<{
  csv: string;
  r: string;
  json: string;
}> => {
  const papers = await getAllPapers();
  const papersWithResults = papers.filter(p => p.extractionResults);

  // Combined CSV header
  const csvLines: string[] = [
    '"Study","Year","Country","Design","N_Total","N_Intervention","N_Control","Mean_Age","Events_Intervention","Total_Intervention","Events_Control","Total_Control"'
  ];

  papersWithResults.forEach(paper => {
    const r = paper.extractionResults!;
    const mortality = r.outcomes?.mortality;
    const interventionMortality = Array.isArray(mortality) ? mortality.find((m: any) => m.armId?.content === 'surgical') : null;
    const controlMortality = Array.isArray(mortality) ? mortality.find((m: any) => m.armId?.content === 'control') : null;

    csvLines.push([
      paper.metadata.title || paper.fileName,
      r.studyId?.year?.content || '',
      r.studyId?.country?.content || '',
      r.picoT?.studyType?.content || '',
      r.baseline?.sampleSize?.totalN?.content || '',
      r.baseline?.sampleSize?.surgicalN?.content || '',
      r.baseline?.sampleSize?.controlN?.content || '',
      r.baseline?.age?.mean?.content || '',
      interventionMortality?.deathsN?.content || '',
      interventionMortality?.totalN?.content || '',
      controlMortality?.deathsN?.content || '',
      controlMortality?.totalN?.content || ''
    ].map(v => `"${v}"`).join(','));
  });

  return {
    csv: csvLines.join('\n'),
    r: exportForR(papersWithResults),
    json: JSON.stringify(papersWithResults.map(p => ({
      study: p.metadata.title || p.fileName,
      year: p.extractionResults?.studyId?.year?.content,
      results: p.extractionResults
    })), null, 2)
  };
};
