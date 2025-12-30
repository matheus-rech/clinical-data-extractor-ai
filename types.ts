
export interface SourceLocation {
  page: number;
  section?: string;
  specific_location?: string;
  exact_text_reference?: string;
  // Citation API fields - API-verified provenance
  cited_text?: string;           // Verbatim text from Citations API
  citation_verified?: boolean;   // True if sourced from Citations API
  document_index?: number;       // For multi-document support
}

// Types for two-pass citation extraction
export interface CitationBlock {
  type: 'cite';
  cited_text: string;
  document_index: number;
  start_page_number?: number;
  end_page_number?: number;
}

export interface CitedDataPoint {
  field_path: string;           // e.g., "studyId.citation", "baseline.sampleSize.totalN"
  extracted_value: string;      // The extracted content
  citation: CitationBlock;      // Citation info from API
}

export interface CitationExtractionResult {
  raw_text: string;             // Full response text
  cited_data: CitedDataPoint[]; // Parsed citation mappings
}

export interface Extraction<T> {
  content: T;
  source_location: SourceLocation;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

export type ExtractedFieldString = Extraction<string>;
export type ExtractedFieldInteger = Extraction<number>;
export type ExtractedFieldNumber = Extraction<number>;
export type ExtractedFieldBoolean = Extraction<boolean>;
export type ExtractedFieldTriState = Extraction<boolean | null>;

export interface ExtractedItem {
  data_type: string;
  content: any;
  source_location: SourceLocation;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface ExtractionResults {
  studyId: {
    citation: ExtractedFieldString;
    doi?: ExtractedFieldString;
    pmid?: ExtractedFieldString;
    journal?: ExtractedFieldString;
    year?: ExtractedFieldInteger;
    country?: ExtractedFieldString;
    centers?: ExtractedFieldString;
    funding?: ExtractedFieldString;
    conflicts?: ExtractedFieldString;
    registration?: ExtractedFieldString;
  };
  picoT: {
    population?: ExtractedFieldString;
    intervention?: ExtractedFieldString;
    comparator?: ExtractedFieldString;
    outcomesMeasured?: ExtractedFieldString;
    timingFollowUp?: ExtractedFieldString;
    studyType?: ExtractedFieldString;
    inclusionMet: ExtractedFieldBoolean;
  };
  baseline: {
    sampleSize: {
      totalN: ExtractedFieldInteger;
      surgicalN?: ExtractedFieldInteger;
      controlN?: ExtractedFieldInteger;
    };
    age?: {
      mean?: ExtractedFieldNumber;
      sd?: ExtractedFieldNumber;
      median?: ExtractedFieldNumber;
      iqr?: {
        lowerQ1?: ExtractedFieldNumber;
        upperQ3?: ExtractedFieldNumber;
      };
    };
    gender?: {
      maleN?: ExtractedFieldInteger;
      femaleN?: ExtractedFieldInteger;
    };
    clinicalScores?: {
      prestrokeMRS?: ExtractedFieldNumber;
      nihssMeanOrMedian?: ExtractedFieldNumber;
      gcsMeanOrMedian?: ExtractedFieldNumber;
    };
  };
  imaging?: {
    vascularTerritory?: ExtractedFieldString;
    infarctVolume?: ExtractedFieldNumber;
    strokeVolumeCerebellum?: ExtractedFieldString;
    edema?: {
      description?: ExtractedFieldString;
      peakSwellingWindow?: ExtractedFieldString;
    };
    involvementAreas?: {
      brainstemInvolvement?: ExtractedFieldTriState;
      supratentorialInvolvement?: ExtractedFieldTriState;
      nonCerebellarStroke?: ExtractedFieldTriState;
    };
  };
  interventions?: {
    surgicalIndications?: ExtractedItem[];
    interventionTypes?: ExtractedItem[];
  };
  studyArms?: Array<{
    armId: ExtractedFieldString;
    label: ExtractedFieldString;
    description: ExtractedFieldString;
  }>;
  outcomes?: {
    mortality?: Array<{
      armId: ExtractedFieldString;
      timepoint: ExtractedFieldString;
      deathsN: ExtractedFieldInteger;
      totalN: ExtractedFieldInteger;
      notes: ExtractedFieldString;
    }>;
    mrs?: Array<{
      armId: ExtractedFieldString;
      timepoint: ExtractedFieldString;
      definition: ExtractedFieldString;
      eventsN: ExtractedFieldInteger;
      totalN: ExtractedFieldInteger;
      notes: ExtractedFieldString;
    }>;
  };
  complications?: {
    items?: Array<{
      armId: ExtractedFieldString;
      complication: ExtractedFieldString;
      eventsN: ExtractedFieldInteger;
      totalN: ExtractedFieldInteger;
      timepoint: ExtractedFieldString;
      notes: ExtractedFieldString;
    }>;
    predictorsSummary?: ExtractedFieldString;
    predictorAnalyses?: Array<{
      predictor: ExtractedFieldString;
      effectMeasure: ExtractedFieldString;
      estimate: ExtractedFieldNumber;
      ciLower: ExtractedFieldNumber;
      ciUpper: ExtractedFieldNumber;
      pValue: ExtractedFieldNumber & { value?: number };
      adjusted: ExtractedFieldBoolean;
      modelNotes: ExtractedFieldString;
    }>;
  };
  extractionLog: {
    extracted_data: ExtractedItem[];
    summary: {
      document_type: string;
      total_extractions: number;
      demographics: any;
      clinical_aspects: any;
      interventional_aspects: any;
      picos: {
        population: string;
        intervention: string;
        comparison: string;
        outcomes: string;
      };
    };
  };
}

export interface ProcessingState {
  isProcessing: boolean;
  step: string;
  progress: number;
  error?: string;
}
