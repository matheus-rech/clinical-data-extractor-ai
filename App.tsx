
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { 
  FileText, Search, BrainCircuit, Loader2, CheckCircle2, AlertCircle, 
  Download, Database, Info, Layers, FileSearch, Zap, Github, 
  ChevronDown, ChevronUp, Table, ClipboardList, Activity, Stethoscope, 
  UserCircle, Microscope, Link as LinkIcon, Scissors, Type as TypeIcon,
  Bot, Sparkles, Target, MousePointer2
} from 'lucide-react';
import { runExtraction } from './services/claudeService';
import { ExtractionResults, ProcessingState, Extraction, TextPosition, SearchMatch, PreciseHighlight } from './types';

// PDF.js worker setup
// @ts-ignore
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const STEP_MAPPING: { [key: string]: number } = {
  studyId: 1,
  picoT: 2,
  baseline: 3,
  imaging: 4,
  interventions: 5,
  studyArms: 6,
  outcomes: 7,
  complications: 8
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfText, setPdfText] = useState<string>("");
  const [pageTexts, setPageTexts] = useState<Array<{ page: number; text: string }>>([]);
  const [pdfImages, setPdfImages] = useState<string[]>([]);
  const [pdfBase64, setPdfBase64] = useState<string>("");  // For two-pass citation extraction
  const [request, setRequest] = useState<string>("Extract comprehensive clinical study data: Study ID, PICO-T details, Baseline demographics (age/sex/N), Imaging findings, Interventions, Study Arms, Outcomes (Mortality/mRS), and Complications.");
  const [useThinking, setUseThinking] = useState(true);
  const [useDemoMode, setUseDemoMode] = useState(false);  // Demo mode for testing without API
  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    step: 'Idle',
    progress: 0
  });
  const [results, setResults] = useState<ExtractionResults | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [selectedText, setSelectedText] = useState<{ text: string; page: number } | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Precise search-based highlighting state (Ctrl+F approach)
  const [textIndex, setTextIndex] = useState<TextPosition[]>([]);
  const [preciseHighlights, setPreciseHighlights] = useState<Map<string, PreciseHighlight>>(new Map());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfViewerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setProcessing({ isProcessing: true, step: 'Reading PDF...', progress: 10 });

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();

      // Store base64 for two-pass citation extraction
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      setPdfBase64(base64);

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(pdf);

      let fullText = "";
      const images: string[] = [];
      const extractedPageTexts: Array<{ page: number; text: string }> = [];

      // Build searchable text index (Ctrl+F approach)
      const newTextIndex: TextPosition[] = [];
      let charOffset = 0;

      for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
        setProcessing(prev => ({ ...prev, progress: 10 + (i / Math.min(pdf.numPages, 10)) * 20 }));
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.5 });

        // Build text index for this page
        textContent.items.forEach((item: any, idx: number) => {
          const text = item.str || '';
          const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);

          newTextIndex.push({
            pageNum: i,
            itemIndex: idx,
            text: text,
            normalizedText: text.toLowerCase().trim(),
            charStart: charOffset,
            charEnd: charOffset + text.length,
            x: transform[4],
            y: transform[5]
          });

          charOffset += text.length + 1; // +1 for space between items
        });

        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;

        // Store individual page text for Search Results API
        extractedPageTexts.push({ page: i, text: pageText });

        if (i <= 3) {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;
            images.push(canvas.toDataURL('image/jpeg', 0.8));
          }
        }
      }

      setTextIndex(newTextIndex);
      setPageTexts(extractedPageTexts);
      console.log(`Built text index with ${newTextIndex.length} items across ${pdf.numPages} pages`);
      console.log(`Stored ${extractedPageTexts.length} page texts for Search Results API`);

      setPdfText(fullText);
      setPdfImages(images);
      setProcessing({ isProcessing: false, step: 'Ready', progress: 100 });
    } catch (err) {
      setProcessing({ isProcessing: false, step: 'Error', progress: 0, error: 'Failed to parse PDF document.' });
    }
  };

  // Mock data for demo mode - demonstrates bidirectional navigation
  // Citations use longer, exact phrases that appear verbatim in the PDF
  const generateDemoResults = () => {
    return {
      studyId: {
        citation: { content: "Mattar et al. (2021)", source_location: { page: 1, cited_text: "Interdisciplinary Neurosurgery: Advanced Techniques and Case Management", citation_verified: true }, confidence: "high" },
        doi: { content: "10.1016/j.wneu.2020.12.053", source_location: { page: 1, cited_text: "https://doi.org/10.1016/j.inat.2020.100822", citation_verified: true }, confidence: "high" },
        journal: { content: "Interdisciplinary Neurosurgery", source_location: { page: 1, cited_text: "Interdisciplinary Neurosurgery", citation_verified: true }, confidence: "high" },
        year: { content: 2021, source_location: { page: 1 }, confidence: "high" },
        country: { content: "Egypt", source_location: { page: 1, cited_text: "Department of Neurosurgery, College of Medicine", citation_verified: true }, confidence: "high" },
      },
      picoT: {
        population: { content: "Patients with massive cerebellar infarction", source_location: { page: 2, cited_text: "massive cerebellar infarction", citation_verified: true }, confidence: "high" },
        intervention: { content: "Emergent suboccipital craniectomy (ESC)", source_location: { page: 2, cited_text: "emergent suboccipital craniectomy", citation_verified: true }, confidence: "high" },
        comparator: { content: "Conservative medical management", source_location: { page: 2 }, confidence: "medium" },
        outcomesMeasured: { content: "Mortality, mRS at discharge and follow-up", source_location: { page: 3, cited_text: "modified Rankin Scale score", citation_verified: true }, confidence: "high" },
        timingFollowUp: { content: "Discharge and follow-up", source_location: { page: 3 }, confidence: "medium" },
        studyType: { content: "Retrospective cohort study", source_location: { page: 2, cited_text: "retrospective study was conducted", citation_verified: true }, confidence: "high" },
        inclusionMet: { content: true, source_location: { page: 2 }, confidence: "high" },
      },
      baseline: {
        sampleSize: {
          totalN: { content: 42, source_location: { page: 3, cited_text: "a sum of 42 patients", citation_verified: true }, confidence: "high" },
          surgicalN: { content: 20, source_location: { page: 3, cited_text: "20 cases had emergent suboccipital craniectomy", citation_verified: true }, confidence: "high" },
          controlN: { content: 22, source_location: { page: 3, cited_text: "22 patients were treated conservatively", citation_verified: true }, confidence: "high" },
        },
        age: {
          mean: { content: 58.5, source_location: { page: 3, cited_text: "mean age of 58.5 years", citation_verified: true }, confidence: "high" },
          sd: { content: 10.2, source_location: { page: 3 }, confidence: "medium" },
        },
        gender: {
          maleN: { content: 36, source_location: { page: 3, cited_text: "36 men, 6 women", citation_verified: true }, confidence: "high" },
          femaleN: { content: 6, source_location: { page: 3 }, confidence: "high" },
        },
        clinicalScores: {
          gcsMeanOrMedian: { content: 10, source_location: { page: 3, cited_text: "GCS score on admission", citation_verified: true }, confidence: "high" },
          nihssMeanOrMedian: { content: 15, source_location: { page: 3 }, confidence: "medium" },
        },
      },
      imaging: {
        vascularTerritory: { content: "PICA territory", source_location: { page: 3, cited_text: "PICA (posterior inferior cerebellar artery)", citation_verified: true }, confidence: "high" },
        strokeVolumeCerebellum: { content: ">1/3 cerebellar hemisphere", source_location: { page: 3 }, confidence: "medium" },
        edema: {
          description: { content: "Significant edema with mass effect", source_location: { page: 4, cited_text: "mass effect on the surrounding neurological structures", citation_verified: true }, confidence: "high" },
        },
        involvementAreas: {
          brainstemInvolvement: { content: true, source_location: { page: 4, cited_text: "brainstem compression", citation_verified: true }, confidence: "high" },
          supratentorialInvolvement: { content: false, source_location: { page: 4 }, confidence: "medium" },
        },
      },
      interventions: {
        surgicalIndications: [
          { content: "Deteriorating consciousness", source_location: { page: 4, cited_text: "deterioration in conscious level", citation_verified: true }, confidence: "high", data_type: "indication" },
          { content: "Hydrocephalus", source_location: { page: 4, cited_text: "obstructive hydrocephalus", citation_verified: true }, confidence: "high", data_type: "indication" },
          { content: "Brainstem compression", source_location: { page: 4, cited_text: "compression of the brainstem", citation_verified: true }, confidence: "high", data_type: "indication" },
        ],
        interventionTypes: [
          { content: "Suboccipital decompressive craniectomy", source_location: { page: 4, cited_text: "suboccipital decompressive craniectomy", citation_verified: true }, confidence: "high", data_type: "procedure" },
          { content: "EVD placement", source_location: { page: 4, cited_text: "external ventricular drain", citation_verified: true }, confidence: "high", data_type: "procedure" },
        ],
      },
      studyArms: [
        { armId: { content: "surgical", source_location: { page: 3 }, confidence: "high" }, label: { content: "ESC Group", source_location: { page: 3, cited_text: "emergent suboccipital craniectomy group", citation_verified: true }, confidence: "high" }, description: { content: "Patients who underwent emergent suboccipital craniectomy", source_location: { page: 3 }, confidence: "high" } },
        { armId: { content: "control", source_location: { page: 3 }, confidence: "high" }, label: { content: "Conservative Group", source_location: { page: 3 }, confidence: "high" }, description: { content: "Patients managed with conservative medical treatment", source_location: { page: 3 }, confidence: "high" } },
      ],
      outcomes: {
        mortality: [
          { armId: { content: "surgical" }, timepoint: { content: "In-hospital" }, deathsN: { content: 4, source_location: { page: 5, cited_text: "mortality rate was 20%", citation_verified: true }, confidence: "high" }, totalN: { content: 20 }, notes: { content: "20% mortality" } },
          { armId: { content: "control" }, timepoint: { content: "In-hospital" }, deathsN: { content: 12, source_location: { page: 5, cited_text: "mortality rate in the conservative group", citation_verified: true }, confidence: "high" }, totalN: { content: 22 }, notes: { content: "54.5% mortality" } },
        ],
        mrs: [
          { armId: { content: "surgical" }, timepoint: { content: "Discharge" }, definition: { content: "mRS 0-2 (favorable)" }, eventsN: { content: 10, source_location: { page: 5, cited_text: "good outcomes in the surgical group", citation_verified: true }, confidence: "high" }, totalN: { content: 16 }, notes: { content: "62.5% favorable" } },
          { armId: { content: "control" }, timepoint: { content: "Discharge" }, definition: { content: "mRS 0-2 (favorable)" }, eventsN: { content: 4, source_location: { page: 5 }, confidence: "medium" }, totalN: { content: 10 }, notes: { content: "40% favorable" } },
        ],
      },
      complications: {
        items: [
          { armId: { content: "surgical" }, complication: { content: "CSF leak", source_location: { page: 5, cited_text: "CSF diversion via temporary EVD", citation_verified: true }, confidence: "high" }, eventsN: { content: 2 }, totalN: { content: 20 }, timepoint: { content: "Post-operative" }, notes: { content: "" } },
          { armId: { content: "surgical" }, complication: { content: "Wound infection", source_location: { page: 5, cited_text: "superficial wound infection", citation_verified: true }, confidence: "medium" }, eventsN: { content: 1 }, totalN: { content: 20 }, timepoint: { content: "Post-operative" }, notes: { content: "" } },
        ],
      },
      extractionLog: {
        extracted_data: [],
        summary: {
          document_type: "Clinical research article",
          total_extractions: 42,
          demographics: { total_patients: 45, male: 27, female: 18 },
          clinical_aspects: { mean_age: 62.4, gcs: 11.2 },
          interventional_aspects: { surgical: 28, conservative: 17 },
          picos: {
            population: "Cerebellar stroke patients",
            intervention: "SDC",
            comparison: "Conservative management",
            outcomes: "Mortality, mRS",
          },
        },
      },
    };
  };

  // ============================================
  // Precise Search-Based Highlighting (Ctrl+F)
  // ============================================

  /**
   * Ctrl+F style search: finds which text items contain the query string.
   * STRICT MODE: Only exact substring matches, only on the hint page.
   */
  const searchForCitedText = useCallback((query: string, hintPage?: number): SearchMatch | null => {
    // Require minimum 12 characters for highlighting (avoid short generic matches)
    if (!query || query.length < 12 || textIndex.length === 0) return null;

    // Skip pure numbers or very generic terms
    if (/^\d+\.?\d*$/.test(query.trim())) return null; // Skip "45", "8.5", etc.

    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');

    // ONLY search on the specific page indicated (no page-hopping)
    if (!hintPage) return null;

    const pageItems = textIndex.filter(t => t.pageNum === hintPage);
    if (pageItems.length === 0) return null;

    // Concatenate all text items for this page with spaces
    const pageTexts = pageItems.map(t => t.text);
    const fullPageText = pageTexts.join(' ');
    const normalizedPageText = fullPageText.toLowerCase();

    // ONLY exact substring match (true Ctrl+F behavior)
    const matchIndex = normalizedPageText.indexOf(normalizedQuery);
    if (matchIndex !== -1) {
      // Find which items span this character range
      const itemIndices = findItemsForCharRange(pageItems, matchIndex, matchIndex + normalizedQuery.length);

      // Limit to max 3 consecutive items (avoid highlighting entire paragraphs)
      if (itemIndices.length > 0 && itemIndices.length <= 5) {
        return {
          pageNum: hintPage,
          itemIndices,
          exactMatch: true,
          confidence: 1.0
        };
      }
    }

    return null;
  }, [textIndex]);

  /**
   * Helper: Given a character range in concatenated page text,
   * find which text item indices it spans.
   */
  const findItemsForCharRange = (pageItems: TextPosition[], startChar: number, endChar: number): number[] => {
    const indices: number[] = [];
    let currentChar = 0;

    for (const item of pageItems) {
      const itemStart = currentChar;
      const itemEnd = currentChar + item.text.length;

      // Check if this item overlaps with the search range
      if (itemEnd > startChar && itemStart < endChar) {
        indices.push(item.itemIndex);
      }

      currentChar = itemEnd + 1; // +1 for the space between items
    }

    return indices;
  };

  /**
   * Build precise highlights for all mappings by searching for their cited_text.
   * This runs after extraction results are available.
   */
  const buildPreciseHighlights = useCallback((mappingItems: MappingItem[]): Map<string, PreciseHighlight> => {
    const highlights = new Map<string, PreciseHighlight>();

    for (const mapping of mappingItems) {
      // Prioritize cited_text (most accurate from Citations API)
      const searchQuery = mapping.citedText || mapping.text;
      if (!searchQuery || searchQuery.length < 2) continue;

      const match = searchForCitedText(searchQuery, mapping.page);
      if (match) {
        // Add a highlight entry for each matched item
        for (const itemIdx of match.itemIndices) {
          const key = `${match.pageNum}-${itemIdx}`;
          highlights.set(key, {
            pageNum: match.pageNum,
            itemIndex: itemIdx,
            path: mapping.path,
            verified: mapping.verified,
            citedText: mapping.citedText || searchQuery
          });
        }
      }
    }

    console.log(`Built ${highlights.size} precise highlights from ${mappingItems.length} mappings`);
    return highlights;
  }, [searchForCitedText]);

  // Note: useEffect for preciseHighlights is placed after mappings is defined (below)

  const startExtraction = async () => {
    if (!pdfText) {
      alert("No PDF text found. Please wait for the document to finish processing or try re-uploading.");
      return;
    }
    setProcessing({ isProcessing: true, step: 'Starting extraction...', progress: 10 });

    // Demo mode - use mock data for UI testing
    if (useDemoMode) {
      setProcessing({ isProcessing: true, step: 'Generating demo data...', progress: 50 });
      await new Promise(resolve => setTimeout(resolve, 1500));
      const demoResults = generateDemoResults();
      console.log("Demo Results:", demoResults);
      setResults(demoResults as any);
      setProcessing({ isProcessing: false, step: 'Complete (Demo Mode)', progress: 100 });
      setActiveStep(1);
      return;
    }

    // Progress callback for real-time UI updates
    const onProgress = (step: string, progress: number) => {
      setProcessing(prev => ({ ...prev, step, progress }));
    };

    try {
      // Pass pageTexts for Search Results API (preferred), then pdfBase64 for two-pass fallback
      const res = await runExtraction(
        pdfText,
        request,
        useThinking,
        pdfImages,
        pdfBase64 || undefined,  // Enable two-pass mode if base64 available
        onProgress,
        pageTexts.length > 0 ? pageTexts : undefined  // Enable Search Results API if pages available
      );
      console.log("Claude Response:", res);
      setResults(res);
      setProcessing({ isProcessing: false, step: 'Complete', progress: 100 });
      setActiveStep(1);
    } catch (err: any) {
      console.error(err);
      setProcessing({ isProcessing: false, step: 'Extraction Failed', progress: 0, error: err.message });
    }
  };

  const mapSelectedToField = useCallback((path: string) => {
    if (!selectedText) return;

    setResults(prev => {
      const baseResults = prev ? JSON.parse(JSON.stringify(prev)) : {
        studyId: {}, picoT: {}, baseline: {}, imaging: {}, interventions: {}, studyArms: [], outcomes: {}, complications: {}, extractionLog: { extracted_data: [] }
      };
      
      const newResults = baseResults;
      const keys = path.split('.');
      let current = newResults;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      
      const lastKey = keys[keys.length - 1];
      current[lastKey] = {
        content: selectedText.text,
        source_location: {
          page: selectedText.page,
          exact_text_reference: selectedText.text
        },
        confidence: 'high',
        notes: 'Manually mapped by user'
      };

      if (!newResults.extractionLog) newResults.extractionLog = { extracted_data: [] };
      if (!newResults.extractionLog.extracted_data) newResults.extractionLog.extracted_data = [];
      
      newResults.extractionLog.extracted_data.unshift({
        data_type: path,
        content: selectedText.text,
        source_location: {
          page: selectedText.page
        },
        confidence: 'high',
        notes: 'User manual mapping'
      });

      return newResults;
    });

    setSelectedText(null);
    // Automatically focus the field we just mapped
    setTimeout(() => handleResultFocus(path, selectedText.page), 100);
  }, [selectedText]);

  const getMappings = useCallback(() => {
    if (!results) return [];
    const mappings: {
      page: number;
      text: string;
      label: string;
      path: string;
      type: 'manual' | 'ai';
      verified: boolean;
      citedText?: string;
    }[] = [];

    const traverse = (obj: any, path: string) => {
      if (!obj) return;

      if (obj.source_location?.page && obj.content) {
        // Prioritize cited_text (API-verified) > exact_text_reference > content
        const citedText = obj.source_location.cited_text;
        const exactRef = obj.source_location.exact_text_reference;
        const contentStr = String(obj.content);

        // Use cited_text for matching if available (most accurate from Citations API)
        const textForMatching = citedText || exactRef || contentStr;

        mappings.push({
          page: obj.source_location.page,
          text: textForMatching,
          label: path.split('.').pop() || path,
          path: path,
          type: obj.notes?.toLowerCase().includes('manual') || obj.notes?.toLowerCase().includes('user') ? 'manual' : 'ai',
          verified: !!obj.source_location.citation_verified,
          citedText: citedText
        });
      }

      if (typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          if (key !== 'source_location' && key !== 'content' && key !== 'confidence' && key !== 'notes') {
             traverse(obj[key], path ? `${path}.${key}` : key);
          }
        });
      }
    };

    traverse(results, '');
    return mappings;
  }, [results]);

  const mappings = useMemo(() => getMappings(), [getMappings]);

  // Effect: Rebuild precise highlights when mappings or textIndex change
  useEffect(() => {
    if (textIndex.length > 0 && mappings.length > 0) {
      const newHighlights = buildPreciseHighlights(mappings);
      setPreciseHighlights(newHighlights);
    } else {
      setPreciseHighlights(new Map());
    }
  }, [textIndex, mappings, buildPreciseHighlights]);

  const handleScrollToPage = (page: number) => {
    const el = pageRefs.current[page];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleResultFocus = (path: string, page?: number) => {
    setFocusedField(path);
    if (page) handleScrollToPage(page);
  };

  const handlePdfHighlightClick = (path: string, page: number) => {
    setFocusedField(path);
    const rootKey = path.split('.')[0];
    const step = STEP_MAPPING[rootKey];
    
    if (step) {
      setActiveStep(step);
      // Wait for tab switch animation/render
      setTimeout(() => {
        const element = document.getElementById(`field-${path}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a temporary flash effect class if needed, though state style handles it
        }
      }, 150);
    }
  };

  const resultSteps = useMemo(() => {
    if (!results) return []; 
    return [
      { id: 1, label: "Study ID", icon: <Database className="w-4 h-4" />, data: results.studyId, path: "studyId" },
      { id: 2, label: "PICO-T", icon: <Layers className="w-4 h-4" />, data: results.picoT, path: "picoT" },
      { id: 3, label: "Baseline", icon: <UserCircle className="w-4 h-4" />, data: results.baseline, path: "baseline" },
      { id: 4, label: "Imaging", icon: <Microscope className="w-4 h-4" />, data: results.imaging, path: "imaging" },
      { id: 5, label: "Interventions", icon: <Stethoscope className="w-4 h-4" />, data: results.interventions, path: "interventions" },
      { id: 6, label: "Arms", icon: <ClipboardList className="w-4 h-4" />, data: results.studyArms, path: "studyArms" },
      { id: 7, label: "Outcomes", icon: <Activity className="w-4 h-4" />, data: results.outcomes, path: "outcomes" },
      { id: 8, label: "Complications", icon: <AlertCircle className="w-4 h-4" />, data: results.complications, path: "complications" },
    ];
  }, [results]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-slate-200 shadow-sm">
        <div className="max-w-full mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-indigo-200 shadow-lg">
              <BrainCircuit className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">ClinicalExtract<span className="text-indigo-600">AI</span></h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Agentic Document Intelligence</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {selectedText && (
              <div className="animate-in fade-in slide-in-from-right-4 flex items-center gap-3 bg-indigo-600 text-white px-5 py-2 rounded-full shadow-lg shadow-indigo-200">
                <Scissors className="w-4 h-4" />
                <p className="text-xs font-bold truncate max-w-[200px]">"{selectedText.text}"</p>
                <button 
                  onClick={() => setSelectedText(null)}
                  className="bg-white/20 hover:bg-white/30 rounded-full p-1 transition-colors"
                >
                  <AlertCircle className="w-4 h-4" />
                </button>
              </div>
            )}
            <button 
              onClick={() => window.location.reload()}
              className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest flex items-center gap-2"
            >
              <Zap className="w-3 h-3" /> New Session
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-full mx-auto w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-80px)] overflow-hidden">
        
        {/* Left Column: PDF Viewer */}
        <div className="lg:col-span-6 flex flex-col bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden h-full">
          <div className="p-4 border-b border-slate-100 flex flex-col gap-2 bg-white z-10">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                Document Workspace
              </h2>
              {file && (
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-lg uppercase tracking-wide truncate max-w-[120px]" title={file.name}>{file.name}</span>
                   {mappings.length > 0 && (
                     <>
                       <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg uppercase tracking-wide flex items-center gap-1">
                         <CheckCircle2 className="w-3 h-3" />
                         {mappings.filter(m => m.verified).length} Verified
                       </span>
                       <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded-lg uppercase tracking-wide">
                         {mappings.filter(m => !m.verified).length} AI
                       </span>
                     </>
                   )}
                </div>
              )}
            </div>
            {/* Color Legend */}
            {results && mappings.length > 0 && (
              <div className="flex items-center gap-4 text-[9px] font-medium text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-emerald-400/40"></span> Verified Citation
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-amber-300/50"></span> AI Extracted
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-indigo-500/60"></span> Focused
                </span>
                <span className="ml-auto italic">Click highlights to navigate →</span>
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent" ref={pdfViewerRef}>
            {pdfDoc ? (
              <PdfRenderer
                pdfDoc={pdfDoc}
                onTextSelect={(text, page) => setSelectedText({ text, page })}
                mappings={mappings}
                preciseHighlights={preciseHighlights}
                onRegisterPageRef={(page, ref) => pageRefs.current[page] = ref}
                focusedField={focusedField}
                onHighlightClick={handlePdfHighlightClick}
              />
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-white hover:bg-indigo-50/30 hover:border-indigo-200 transition-all cursor-pointer group"
              >
                <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={handleFileChange} />
                <div className="bg-slate-50 p-8 rounded-full group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all mb-6">
                  <FileSearch className="w-16 h-16 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                </div>
                <h3 className="text-lg font-black text-slate-700 group-hover:text-indigo-700">Upload Clinical PDF</h3>
                <p className="mt-2 text-sm font-medium text-slate-400">Drag & drop or click to browse</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Extraction Results */}
        <div className="lg:col-span-6 flex flex-col gap-4 h-full overflow-hidden">
          
          {!results && !processing.isProcessing ? (
            <div className="h-full flex flex-col justify-center">
              <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
                
                <h2 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-3 relative z-10">
                  <Bot className="w-8 h-8 text-indigo-600" />
                  Agentic Extraction Config
                </h2>
                <p className="text-sm text-slate-500 mb-6 font-medium max-w-md relative z-10">Define your extraction goals. The AI agent will reason through the document structure to extract precise clinical datapoints.</p>
                
                <div className="relative z-10">
                  <div className="mb-2 flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Extraction Prompt</label>
                  </div>
                  <textarea
                    value={request}
                    onChange={(e) => setRequest(e.target.value)}
                    className="w-full h-40 rounded-2xl border border-slate-200 p-5 text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all resize-none bg-slate-50 font-medium text-slate-700 shadow-inner"
                  />
                  
                  <div className="mt-4 flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={useThinking} onChange={() => setUseThinking(!useThinking)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-indigo-600">Extended Thinking</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={useDemoMode} onChange={() => setUseDemoMode(!useDemoMode)} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-emerald-600">Demo Mode</span>
                    </label>
                  </div>

                  <div className="mt-6 flex gap-4">
                    <button
                      disabled={!file || processing.isProcessing}
                      onClick={startExtraction}
                      className={`flex-1 ${useDemoMode ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-indigo-600'} disabled:opacity-50 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-slate-200 active:scale-[0.98] flex items-center justify-center gap-3 group`}
                    >
                      {processing.isProcessing ? (
                        <>Processing...</>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 text-indigo-400 group-hover:text-white transition-colors" />
                          {useDemoMode ? 'Run Demo Extraction' : 'Automate Full Agentic Extraction'}
                        </>
                      )}
                    </button>
                  </div>

                  {useDemoMode && (
                    <p className="mt-3 text-xs text-emerald-600 font-medium text-center">
                      Demo mode uses mock data to test UI features without API calls
                    </p>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="flex flex-col h-full gap-4">
              {/* Steps Nav */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide shrink-0 pt-1">
                {resultSteps.map(step => (
                  <button
                    key={step.id}
                    onClick={() => setActiveStep(step.id)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border shadow-sm
                      ${activeStep === step.id 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200 scale-105' 
                        : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                  >
                    {step.icon}
                    {step.label}
                  </button>
                ))}
              </div>

              {/* Dynamic Content Area */}
              <div className="flex-1 bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-white">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      {resultSteps[activeStep - 1]?.icon}
                    </div>
                    {resultSteps[activeStep - 1]?.label} Data
                  </h3>
                  <div className="flex gap-2">
                    {selectedText && (
                       <div className="text-[10px] font-bold text-indigo-600 animate-pulse flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg">
                         <Target className="w-3.5 h-3.5" /> Select field to map highlight
                       </div>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200">
                  {results && (
                    <>
                      {activeStep === 1 && <StudyIDSection data={results.studyId} onMap={(f) => mapSelectedToField(`studyId.${f}`)} canMap={!!selectedText} onFocus={handleResultFocus} focusedField={focusedField} />}
                      {activeStep === 2 && <PICOTSection data={results.picoT} onMap={(f) => mapSelectedToField(`picoT.${f}`)} canMap={!!selectedText} onFocus={handleResultFocus} focusedField={focusedField} />}
                      {activeStep === 3 && <BaselineSection data={results.baseline} onMap={(f) => mapSelectedToField(`baseline.${f}`)} canMap={!!selectedText} onFocus={handleResultFocus} focusedField={focusedField} />}
                      {activeStep === 4 && <ImagingSection data={results.imaging} onMap={(f) => mapSelectedToField(`imaging.${f}`)} canMap={!!selectedText} onFocus={handleResultFocus} focusedField={focusedField} />}
                      {activeStep === 5 && <InterventionsSection data={results.interventions} onFocus={handleResultFocus} focusedField={focusedField} />}
                      {activeStep === 6 && <StudyArmsSection data={results.studyArms} />}
                      {activeStep === 7 && <OutcomesSection data={results.outcomes} focusedField={focusedField} onFocus={handleResultFocus} />}
                      {activeStep === 8 && <ComplicationsSection data={results.complications} focusedField={focusedField} onFocus={handleResultFocus} />}
                    </>
                  )}
                  {processing.isProcessing && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-6">
                      <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                        <Loader2 className="w-16 h-16 text-indigo-600 animate-spin relative z-10" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 mb-2">Analyzing Document</h3>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{processing.step}</p>
                      </div>
                      <div className="w-64 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${processing.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// PDF Rendering Components
interface MappingItem {
  page: number;
  text: string;
  label: string;
  path: string;
  type: 'manual' | 'ai';
  verified: boolean;
  citedText?: string;
}

interface PdfRendererProps {
  pdfDoc: any;
  onTextSelect: (text: string, page: number) => void;
  mappings: MappingItem[];
  preciseHighlights: Map<string, PreciseHighlight>;
  onRegisterPageRef: (page: number, ref: HTMLDivElement | null) => void;
  focusedField: string | null;
  onHighlightClick: (path: string, page: number) => void;
}

function PdfRenderer({ pdfDoc, onTextSelect, mappings, preciseHighlights, onRegisterPageRef, focusedField, onHighlightClick }: PdfRendererProps) {
  const [pages, setPages] = useState<number[]>([]);

  useEffect(() => {
    const p = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) p.push(i);
    setPages(p);
  }, [pdfDoc]);

  return (
    <div className="space-y-6">
      {pages.map(pageNum => (
        <PdfPage
          key={pageNum}
          pdfDoc={pdfDoc}
          pageNum={pageNum}
          onTextSelect={onTextSelect}
          highlights={mappings.filter(m => m.page === pageNum)}
          preciseHighlights={preciseHighlights}
          onRegisterRef={(ref) => onRegisterPageRef(pageNum, ref)}
          focusedField={focusedField}
          onHighlightClick={onHighlightClick}
        />
      ))}
    </div>
  );
}

interface PdfPageProps {
  pdfDoc: any;
  pageNum: number;
  onTextSelect: (text: string, page: number) => void;
  highlights: MappingItem[];
  preciseHighlights: Map<string, PreciseHighlight>;
  onRegisterRef: (ref: HTMLDivElement | null) => void;
  focusedField: string | null;
  onHighlightClick: (path: string, page: number) => void;
}

function PdfPage({ pdfDoc, pageNum, onTextSelect, highlights, preciseHighlights, onRegisterRef, focusedField, onHighlightClick }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      onRegisterRef(containerRef.current);
    }
  }, [onRegisterRef]);

  useEffect(() => {
    const renderPage = async () => {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        await page.render({ canvasContext: context, viewport }).promise;
      }

      // Render text layer with precise highlighting
      const textContent = await page.getTextContent();
      const textLayer = textLayerRef.current;
      if (textLayer) {
        // Safe DOM clearing - remove all children
        while (textLayer.firstChild) {
          textLayer.removeChild(textLayer.firstChild);
        }
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;

        textContent.items.forEach((item: any, idx: number) => {
          const span = document.createElement('span');
          const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const style = `left: ${transform[4]}px; top: ${transform[5]}px; font-size: ${item.height * viewport.scale}px; font-family: ${item.fontName};`;
          span.style.cssText = style;
          span.textContent = item.str;

          // ★ PRECISE LOOKUP: O(1) Map lookup instead of O(n) fuzzy matching
          const key = `${pageNum}-${idx}`;
          const preciseHighlight = preciseHighlights.get(key);

          if (preciseHighlight) {
            const isFocused = focusedField === preciseHighlight.path;
            const isVerified = preciseHighlight.verified;

            // Color coding: Indigo (focused) > Green (verified) > Yellow (AI-extracted)
            if (isFocused) {
              span.style.backgroundColor = 'rgba(99, 102, 241, 0.6)'; // Indigo
              span.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.4)';
              span.style.zIndex = '10';
            } else if (isVerified) {
              span.style.backgroundColor = 'rgba(16, 185, 129, 0.35)'; // Green for verified
            } else {
              span.style.backgroundColor = 'rgba(252, 211, 77, 0.4)'; // Yellow for AI
            }

            span.style.borderRadius = '2px';
            span.style.cursor = 'pointer';
            span.style.pointerEvents = 'auto';

            span.onclick = (e) => {
              e.stopPropagation();
              onHighlightClick(preciseHighlight.path, pageNum);
            };

            // Add title with cited text for verification
            const pathLabel = preciseHighlight.path.split('.').pop() || preciseHighlight.path;
            span.title = `${pathLabel}${isVerified ? ' ✓ Verified' : ''}\n"${preciseHighlight.citedText}"`;
          }

          textLayer.appendChild(span);
        });
      }
    };

    renderPage();
  }, [pdfDoc, pageNum, preciseHighlights, focusedField]);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
       const text = selection.toString().replace(/\s+/g, ' ').trim();
       if (text.length > 0) {
         onTextSelect(text, pageNum);
       }
    }
  };

  return (
    <div className="page-container rounded-lg overflow-hidden border border-slate-200" ref={containerRef} onMouseUp={handleMouseUp}>
      <canvas ref={canvasRef} className="block w-full h-auto" />
      <div ref={textLayerRef} className="textLayer absolute top-0 left-0 overflow-hidden pointer-events-auto" />
      <div className="absolute top-3 left-3 flex gap-2">
        <div className="bg-slate-900/80 text-white px-2.5 py-1 rounded-md text-[10px] font-bold backdrop-blur-sm shadow-sm">
          Page {pageNum}
        </div>
        {highlights.length > 0 && (
          <div className="bg-indigo-600/90 text-white px-2.5 py-1 rounded-md text-[10px] font-bold backdrop-blur-sm shadow-sm flex items-center gap-1">
             <Target className="w-3 h-3" /> {highlights.length} Annotations
          </div>
        )}
      </div>
    </div>
  );
}

// Enhanced UI Sections
function StudyIDSection({ data, onMap, canMap, onFocus, focusedField }: { data: any; onMap: (f: string) => void; canMap: boolean, onFocus: (path: string, page?: number) => void, focusedField: string | null }) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Citation Information</h4>
          {canMap && (
            <button 
              onClick={() => onMap('citation')} 
              className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:underline"
            >
              <Scissors className="w-3 h-3" /> Map highlight to Citation
            </button>
          )}
        </div>
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <p className="text-sm font-bold text-slate-800 leading-tight mb-4">{data?.citation?.content || "N/A"}</p>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            <MapableInfoBox label="Year" value={data?.year} path="studyId.year" onMap={() => onMap('year')} canMap={canMap} onFocus={onFocus} isFocused={focusedField === 'studyId.year'} />
            <MapableInfoBox label="DOI" value={data?.doi} path="studyId.doi" onMap={() => onMap('doi')} canMap={canMap} onFocus={onFocus} isFocused={focusedField === 'studyId.doi'} />
            <MapableInfoBox label="Journal" value={data?.journal} path="studyId.journal" onMap={() => onMap('journal')} canMap={canMap} onFocus={onFocus} isFocused={focusedField === 'studyId.journal'} />
            <MapableInfoBox label="Country" value={data?.country} path="studyId.country" onMap={() => onMap('country')} canMap={canMap} onFocus={onFocus} isFocused={focusedField === 'studyId.country'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PICOTSection({ data, onMap, canMap, onFocus, focusedField }: { data: any; onMap: (f: string) => void; canMap: boolean, onFocus: (path: string, page?: number) => void, focusedField: string | null }) {
  const fields = [
    { key: 'population', label: 'Population' },
    { key: 'intervention', label: 'Intervention' },
    { key: 'comparator', label: 'Comparator' },
    { key: 'outcomesMeasured', label: 'Outcomes' },
    { key: 'timingFollowUp', label: 'Timing' }
  ];

  return (
    <div className="grid grid-cols-1 gap-6">
      {fields.map(f => (
        <div key={f.key} className="relative group">
          <ResultItem 
            label={f.label} 
            value={data?.[f.key]} 
            path={`picoT.${f.key}`}
            large 
            onFocus={onFocus} 
            isFocused={focusedField === `picoT.${f.key}`}
          />
          {canMap && (
            <button 
              onClick={() => onMap(f.key)}
              className="absolute top-4 right-4 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-lg flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <LinkIcon className="w-3 h-3" /> Map Selection
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function BaselineSection({ data, onMap, canMap, onFocus, focusedField }: { data: any; onMap: (f: string) => void; canMap: boolean, onFocus: (path: string, page?: number) => void, focusedField: string | null }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-4">
        <MapableInfoBox label="Total N" value={data?.sampleSize?.totalN} path="baseline.sampleSize.totalN" onMap={() => onMap('sampleSize.totalN')} canMap={canMap} large onFocus={onFocus} isFocused={focusedField === 'baseline.sampleSize.totalN'} />
        <MapableInfoBox label="Surg N" value={data?.sampleSize?.surgicalN} path="baseline.sampleSize.surgicalN" onMap={() => onMap('sampleSize.surgicalN')} canMap={canMap} onFocus={onFocus} isFocused={focusedField === 'baseline.sampleSize.surgicalN'} />
        <MapableInfoBox label="Ctrl N" value={data?.sampleSize?.controlN} path="baseline.sampleSize.controlN" onMap={() => onMap('sampleSize.controlN')} canMap={canMap} onFocus={onFocus} isFocused={focusedField === 'baseline.sampleSize.controlN'} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Age Distribution</h4>
          <div className="bg-slate-50 p-5 rounded-xl space-y-4">
            <MapableInfoBox label="Mean Age" value={data?.age?.mean} path="baseline.age.mean" onMap={() => onMap('age.mean')} canMap={canMap} onFocus={onFocus} isFocused={focusedField === 'baseline.age.mean'} />
            <MapableInfoBox label="Median Age" value={data?.age?.median} path="baseline.age.median" onMap={() => onMap('age.median')} canMap={canMap} onFocus={onFocus} isFocused={focusedField === 'baseline.age.median'} />
          </div>
        </div>
        <div className="space-y-4">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Clinical Scores</h4>
          <div className="bg-slate-50 p-5 rounded-xl space-y-4">
            <MapableInfoBox label="NIHSS" value={data?.clinicalScores?.nihssMeanOrMedian} path="baseline.clinicalScores.nihssMeanOrMedian" onMap={() => onMap('clinicalScores.nihssMeanOrMedian')} canMap={canMap} onFocus={onFocus} isFocused={focusedField === 'baseline.clinicalScores.nihssMeanOrMedian'} />
            <MapableInfoBox label="pre-mRS" value={data?.clinicalScores?.prestrokeMRS} path="baseline.clinicalScores.prestrokeMRS" onMap={() => onMap('clinicalScores.prestrokeMRS')} canMap={canMap} onFocus={onFocus} isFocused={focusedField === 'baseline.clinicalScores.prestrokeMRS'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ImagingSection({ data, onMap, canMap, onFocus, focusedField }: { data: any; onMap: (f: string) => void; canMap: boolean, onFocus: (path: string, page?: number) => void, focusedField: string | null }) {
  if (!data) return <EmptyState />;
  return (
    <div className="grid grid-cols-1 gap-6">
      <MapableInfoBox label="Vascular Territory" value={data?.vascularTerritory} path="imaging.vascularTerritory" onMap={() => onMap('vascularTerritory')} canMap={canMap} onFocus={onFocus} isFocused={focusedField === 'imaging.vascularTerritory'} />
      <MapableInfoBox label="Infarct Volume" value={data?.infarctVolume} path="imaging.infarctVolume" onMap={() => onMap('infarctVolume')} canMap={canMap} onFocus={onFocus} isFocused={focusedField === 'imaging.infarctVolume'} />
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Brain Involvement</p>
        <div className="space-y-2">
          <TriStateItem label="Brainstem" value={data?.involvementAreas?.brainstemInvolvement} />
          <TriStateItem label="Supratentorial" value={data?.involvementAreas?.supratentorialInvolvement} />
        </div>
      </div>
    </div>
  );
}

function InterventionsSection({ data, onFocus, focusedField }: { data: any, onFocus: (path: string, page?: number) => void, focusedField: string | null }) {
  if (!data) return <EmptyState />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-4">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Surgical Indications</h4>
        <div className="space-y-3">
          {data.surgicalIndications?.map((item: any, i: number) => {
            const path = `interventions.surgicalIndications.${i}`;
            const isFocused = focusedField === path;
            const isVerified = item.source_location?.citation_verified;
            return (
            <div
              key={i}
              id={`field-${path}`}
              className={`p-3 rounded-lg border text-sm font-medium transition-all cursor-pointer
                ${isFocused ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200' : 'bg-slate-50 border-slate-100 text-slate-700 hover:border-slate-300'}
                ${isVerified ? 'border-emerald-200 bg-emerald-50/30' : ''}`}
              onClick={() => onFocus(path, item.source_location?.page)}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{item.content}</span>
                <div className="flex items-center gap-2">
                  {item.confidence && <ConfidenceBadge level={item.confidence} small />}
                  <SourceTag
                    page={item.source_location?.page}
                    verified={isVerified}
                    citedText={item.source_location?.cited_text}
                  />
                </div>
              </div>
            </div>
          )})}
        </div>
      </div>
      <div className="space-y-4">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Intervention Types</h4>
        <div className="space-y-3">
          {data.interventionTypes?.map((item: any, i: number) => {
             const path = `interventions.interventionTypes.${i}`;
             const isFocused = focusedField === path;
             const isVerified = item.source_location?.citation_verified;
             return (
            <div
              key={i}
              id={`field-${path}`}
              className={`p-3 rounded-lg border text-sm font-medium transition-all cursor-pointer
                ${isFocused ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200' : 'bg-slate-50 border-slate-100 text-slate-700 hover:border-slate-300'}
                ${isVerified ? 'border-emerald-200 bg-emerald-50/30' : ''}`}
              onClick={() => onFocus(path, item.source_location?.page)}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{item.content}</span>
                <div className="flex items-center gap-2">
                  {item.confidence && <ConfidenceBadge level={item.confidence} small />}
                  <SourceTag
                    page={item.source_location?.page}
                    verified={isVerified}
                    citedText={item.source_location?.cited_text}
                  />
                </div>
              </div>
            </div>
          )})}
        </div>
      </div>
    </div>
  );
}

function StudyArmsSection({ data }: { data: any }) {
  if (!data || !data.length) return <EmptyState />;
  return (
    <div className="space-y-6">
      {data.map((arm: any, i: number) => (
        <div key={i} className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center mb-3">
            <h5 className="font-bold text-slate-900">{arm.label?.content || `Arm ${i+1}`}</h5>
            <div className="flex items-center gap-2">
              {arm.label?.confidence && <ConfidenceBadge level={arm.label.confidence} small />}
              <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase">{arm.armId?.content}</span>
            </div>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed italic">{arm.description?.content}</p>
        </div>
      ))}
    </div>
  );
}

function OutcomesSection({ data, onFocus, focusedField }: { data: any, onFocus: (path: string, page?: number) => void, focusedField: string | null }) {
  if (!data) return <EmptyState />;
  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Mortality Outcomes</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="pb-3 pr-4 font-bold text-slate-400 uppercase tracking-tighter text-[10px]">Arm</th>
                <th className="pb-3 pr-4 font-bold text-slate-400 uppercase tracking-tighter text-[10px]">Timepoint</th>
                <th className="pb-3 pr-4 font-bold text-slate-400 uppercase tracking-tighter text-[10px]">N / Total</th>
                <th className="pb-3 pr-4 font-bold text-slate-400 uppercase tracking-tighter text-[10px]">Notes</th>
                <th className="pb-3 font-bold text-slate-400 uppercase tracking-tighter text-[10px]">Conf</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.mortality?.map((m: any, i: number) => {
                const path = `outcomes.mortality.${i}.deathsN`; // Key metric path
                const isFocused = focusedField?.startsWith(`outcomes.mortality.${i}`);
                return (
                <tr
                  key={i}
                  id={`field-${path}`}
                  className={`group transition-colors cursor-pointer ${isFocused ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}
                  onClick={() => onFocus(path, m.deathsN?.source_location?.page)}
                >
                  <td className="py-4 pr-4 font-bold text-indigo-600">{m.armId?.content}</td>
                  <td className="py-4 pr-4 font-medium">{m.timepoint?.content}</td>
                  <td className="py-4 pr-4 font-black">{m.deathsN?.content} / {m.totalN?.content}</td>
                  <td className="py-4 pr-4 text-slate-500 text-xs">{m.notes?.content}</td>
                  <td className="py-4">{m.deathsN?.confidence && <ConfidenceBadge level={m.deathsN.confidence} small />}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="space-y-6">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Functional (mRS) Outcomes</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="pb-3 pr-4 font-bold text-slate-400 uppercase tracking-tighter text-[10px]">Arm</th>
                <th className="pb-3 pr-4 font-bold text-slate-400 uppercase tracking-tighter text-[10px]">Timepoint</th>
                <th className="pb-3 pr-4 font-bold text-slate-400 uppercase tracking-tighter text-[10px]">Definition</th>
                <th className="pb-3 pr-4 font-bold text-slate-400 uppercase tracking-tighter text-[10px]">Events / N</th>
                <th className="pb-3 font-bold text-slate-400 uppercase tracking-tighter text-[10px]">Conf</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.mrs?.map((m: any, i: number) => {
                 const path = `outcomes.mrs.${i}.eventsN`;
                 const isFocused = focusedField?.startsWith(`outcomes.mrs.${i}`);
                 return (
                <tr
                  key={i}
                  id={`field-${path}`}
                  className={`group transition-colors cursor-pointer ${isFocused ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}
                  onClick={() => onFocus(path, m.eventsN?.source_location?.page)}
                >
                  <td className="py-4 pr-4 font-bold text-indigo-600">{m.armId?.content}</td>
                  <td className="py-4 pr-4 font-medium">{m.timepoint?.content}</td>
                  <td className="py-4 pr-4 text-xs italic">{m.definition?.content}</td>
                  <td className="py-4 pr-4 font-black">{m.eventsN?.content} / {m.totalN?.content}</td>
                  <td className="py-4">{m.eventsN?.confidence && <ConfidenceBadge level={m.eventsN.confidence} small />}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ComplicationsSection({ data, onFocus, focusedField }: { data: any, onFocus: (path: string, page?: number) => void, focusedField: string | null }) {
  if (!data) return <EmptyState />;
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6">
        {data.items?.map((comp: any, i: number) => {
          const path = `complications.items.${i}`;
          const isFocused = focusedField?.startsWith(path);
          return (
          <div 
            key={i} 
            id={`field-${path}`}
            className={`p-5 rounded-xl border flex justify-between items-start cursor-pointer transition-all ${isFocused ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
            onClick={() => onFocus(path, comp.complication?.source_location?.page)}
          >
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase mb-1">{comp.armId?.content}</p>
              <h5 className="font-bold text-slate-800">{comp.complication?.content}</h5>
              <p className="text-xs text-slate-500 mt-1">{comp.notes?.content}</p>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <p className="text-xl font-black text-slate-800">{comp.eventsN?.content} <span className="text-slate-300 text-sm">/ {comp.totalN?.content}</span></p>
              <p className="text-[10px] font-bold text-slate-400 uppercase">{comp.timepoint?.content}</p>
              {comp.complication?.confidence && <ConfidenceBadge level={comp.complication.confidence} small />}
            </div>
          </div>
        )})}
      </div>
      {data.predictorsSummary && (
        <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
          <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest mb-3">Predictors Summary</h4>
          <p className="text-sm text-amber-900 leading-relaxed font-medium">{data.predictorsSummary.content}</p>
        </div>
      )}
    </div>
  );
}

// Low-level UI Helpers

// Citation Verification Badge - shows when data is API-verified
function CitationVerifiedBadge({ citedText, small = false }: { citedText?: string, small?: boolean }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-flex">
      <span
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`inline-flex items-center gap-1 font-bold rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-inset ring-emerald-100 ${small ? 'text-[8px] px-1.5 py-0.5' : 'text-[9px] px-2 py-1'} uppercase tracking-wider cursor-help`}
        title="Citation verified by Claude API"
      >
        <CheckCircle2 className={`${small ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
        Verified
      </span>
      {showTooltip && citedText && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-1">
          <p className="font-bold text-emerald-400 mb-1 text-[10px] uppercase tracking-wider">Cited Text</p>
          <p className="text-slate-200 italic leading-relaxed">"{citedText}"</p>
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900"></div>
        </div>
      )}
    </div>
  );
}

function SourceTag({ page, onClick, verified, citedText }: { page?: number, onClick?: () => void, verified?: boolean, citedText?: string }) {
  if (!page) return null;
  return (
    <div className="flex items-center gap-1.5">
      {verified && <CitationVerifiedBadge citedText={citedText} small />}
      <button
        onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
        className={`flex items-center gap-1 text-[9px] font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md border border-indigo-200 whitespace-nowrap shadow-sm transition-colors ${onClick ? 'hover:bg-indigo-100 hover:text-indigo-900 cursor-pointer' : ''}`}
      >
        <FileText className="w-3 h-3 text-indigo-500" /> P. {page}
      </button>
    </div>
  );
}

function ConfidenceBadge({ level, small = false }: { level: string, small?: boolean }) {
  if (!level) return null;
  const styles = {
    high: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-100',
    low: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-100'
  };
  const colorClass = styles[level.toLowerCase() as keyof typeof styles] || styles.medium;
  
  return (
    <span className={`inline-flex items-center justify-center font-bold rounded-md border ring-1 ring-inset ${colorClass} ${small ? 'text-[8px] px-1.5 py-0.5' : 'text-[9px] px-2 py-1'} uppercase tracking-wider`}>
      {level}
    </span>
  );
}

function SourceFooter({ location, confidence, notes, onScrollToPage }: { location?: any, confidence?: string, notes?: string, onScrollToPage?: (p: number) => void }) {
  if (!location && !confidence && !notes) return null;
  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 mt-auto w-full">
      <div className="flex items-center justify-between gap-2">
        {confidence ? <ConfidenceBadge level={confidence} /> : <span></span>}
        {location?.page && (
          <SourceTag
            page={location.page}
            onClick={() => onScrollToPage && onScrollToPage(location.page)}
            verified={location.citation_verified}
            citedText={location.cited_text}
          />
        )}
      </div>
      {notes && <p className="text-[10px] font-medium text-slate-500 bg-slate-100/50 p-2 rounded-lg italic">{notes}</p>}
    </div>
  );
}

function MapableInfoBox({ label, value, path, onMap, canMap, large = false, inline = false, onFocus, isFocused }: { label: string, value?: any, path: string, onMap: () => void, canMap: boolean, large?: boolean, inline?: boolean, onFocus: (p: string, page?: number) => void, isFocused: boolean }) {
  const content = typeof value === 'object' ? value?.content : value;
  const page = value?.source_location?.page;
  const confidence = value?.confidence;
  const isManual = value?.notes?.includes('Manual') || value?.notes?.includes('user');
  const isVerified = value?.source_location?.citation_verified;
  const citedText = value?.source_location?.cited_text;

  return (
    <div
      id={`field-${path}`}
      className={`relative group p-4 border rounded-xl shadow-sm transition-all flex flex-col h-full cursor-pointer
        ${isFocused ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'}
        ${isManual ? 'border-indigo-300 bg-indigo-50/20 shadow-indigo-100' : ''}
        ${isVerified ? 'border-emerald-200 bg-emerald-50/10' : ''}`}
      onClick={() => onFocus(path, page)}
    >
      <div className="flex justify-between items-start mb-2">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${isFocused ? 'text-indigo-600' : isVerified ? 'text-emerald-600' : 'text-slate-400'}`}>{label}</p>
        {canMap && (
          <button
            onClick={(e) => { e.stopPropagation(); onMap(); }}
            className="text-indigo-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-indigo-50 rounded"
            title="Map Highlight Here"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="mb-3 flex-1">
        <span className={`${large ? 'text-2xl' : 'text-sm'} font-bold text-slate-800 block break-words leading-snug`}>
          {content ?? <span className="text-slate-300 italic font-medium">Not found</span>}
        </span>
      </div>

      {(page || confidence || isVerified) && (
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-slate-50">
           {confidence && <ConfidenceBadge level={confidence} small />}
           {page && (
             <SourceTag
               page={page}
               onClick={() => onFocus(path, page)}
               verified={isVerified}
               citedText={citedText}
             />
           )}
        </div>
      )}

      {isManual && (
        <div className="absolute -top-1.5 -right-1.5 z-10">
          <span className="flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600 border-2 border-white"></span>
          </span>
        </div>
      )}
    </div>
  );
}

function ResultItem({ label, value, path, large = false, onFocus, isFocused }: { label: string, value?: any, path: string, large?: boolean, onFocus: (p: string, page?: number) => void, isFocused: boolean }) {
  const content = typeof value === 'object' ? value?.content : value;
  const page = value?.source_location?.page;

  return (
    <div 
      id={`field-${path}`}
      className={`p-6 rounded-2xl border transition-all cursor-pointer h-full
        ${isFocused ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
      onClick={() => onFocus(path, page)}
    >
      <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isFocused ? 'text-indigo-600' : 'text-slate-400'}`}>{label}</p>
      <div className="space-y-4">
        <p className={`${large ? 'text-base' : 'text-sm'} font-bold text-slate-800 leading-relaxed`}>{content || "Not identified"}</p>
        <SourceFooter location={value?.source_location} confidence={value?.confidence} />
      </div>
    </div>
  );
}

function TriStateItem({ label, value }: { label: string, value?: any }) {
  const content = value?.content;
  const confidence = value?.confidence;
  return (
    <div className="flex justify-between items-center p-2 rounded bg-white border border-slate-100">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        {confidence && <ConfidenceBadge level={confidence} small />}
        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${content === true ? 'bg-emerald-100 text-emerald-700' : content === false ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'}`}>
          {content === true ? 'Yes' : content === false ? 'No' : 'Unknown'}
        </span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-300">
      <Database className="w-12 h-12 mb-4 opacity-20" />
      <p className="text-sm font-bold uppercase tracking-widest">No detailed data found for this section</p>
    </div>
  );
}
