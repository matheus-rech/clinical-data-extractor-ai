import Anthropic from "@anthropic-ai/sdk";
import type { CitationBlock, CitedDataPoint, CitationExtractionResult } from "../types";

// JSON Schema for the ExtractionForm tool
const extractionFormSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.org/schemas/clinical-study-master-extraction.schema.json",
  "title": "Clinical Study Master Extraction",
  "type": "object",
  "additionalProperties": false,
  "required": ["studyId", "picoT", "baseline"],
  "properties": {
    "meta": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "schemaVersion": { "type": "string", "default": "1.0.0" }
      }
    },
    "studyId": {
      "type": "object",
      "title": "Step 1: Study ID",
      "additionalProperties": false,
      "required": ["citation"],
      "properties": {
        "citation": { "$ref": "#/$defs/extractedFieldStringRequired" },
        "doi": { "$ref": "#/$defs/extractedFieldString" },
        "pmid": { "$ref": "#/$defs/extractedFieldString" },
        "journal": { "$ref": "#/$defs/extractedFieldString" },
        "year": { "$ref": "#/$defs/extractedFieldInteger" },
        "country": { "$ref": "#/$defs/extractedFieldString" },
        "centers": { "$ref": "#/$defs/extractedFieldString" },
        "funding": { "$ref": "#/$defs/extractedFieldString" },
        "conflicts": { "$ref": "#/$defs/extractedFieldString" },
        "registration": { "$ref": "#/$defs/extractedFieldString" }
      }
    },
    "picoT": {
      "type": "object",
      "title": "Step 2: PICO-T",
      "additionalProperties": false,
      "required": ["inclusionMet"],
      "properties": {
        "population": { "$ref": "#/$defs/extractedFieldString" },
        "intervention": { "$ref": "#/$defs/extractedFieldString" },
        "comparator": { "$ref": "#/$defs/extractedFieldString" },
        "outcomesMeasured": { "$ref": "#/$defs/extractedFieldString" },
        "timingFollowUp": { "$ref": "#/$defs/extractedFieldString" },
        "studyType": { "$ref": "#/$defs/extractedFieldString" },
        "inclusionMet": {
          "allOf": [{ "$ref": "#/$defs/extractedFieldBoolean" }],
          "title": "Inclusion Criteria Met?"
        }
      }
    },
    "baseline": {
      "type": "object",
      "title": "Step 3: Baseline",
      "additionalProperties": false,
      "required": ["sampleSize"],
      "properties": {
        "sampleSize": {
          "type": "object",
          "additionalProperties": false,
          "required": ["totalN"],
          "properties": {
            "totalN": { "$ref": "#/$defs/extractedFieldIntegerRequired" },
            "surgicalN": { "$ref": "#/$defs/extractedFieldInteger" },
            "controlN": { "$ref": "#/$defs/extractedFieldInteger" }
          }
        },
        "age": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "mean": { "$ref": "#/$defs/extractedFieldNumber" },
            "sd": { "$ref": "#/$defs/extractedFieldNumber" },
            "median": { "$ref": "#/$defs/extractedFieldNumber" },
            "iqr": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "lowerQ1": { "$ref": "#/$defs/extractedFieldNumber" },
                "upperQ3": { "$ref": "#/$defs/extractedFieldNumber" }
              }
            }
          }
        },
        "gender": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "maleN": { "$ref": "#/$defs/extractedFieldInteger" },
            "femaleN": { "$ref": "#/$defs/extractedFieldInteger" }
          }
        },
        "clinicalScores": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "prestrokeMRS": { "$ref": "#/$defs/extractedFieldNumber" },
            "nihssMeanOrMedian": { "$ref": "#/$defs/extractedFieldNumber" },
            "gcsMeanOrMedian": { "$ref": "#/$defs/extractedFieldNumber" }
          }
        }
      }
    },
    "imaging": {
      "type": "object",
      "title": "Step 4: Imaging",
      "additionalProperties": false,
      "properties": {
        "vascularTerritory": { "$ref": "#/$defs/extractedFieldString" },
        "infarctVolume": { "$ref": "#/$defs/extractedFieldNumber" },
        "strokeVolumeCerebellum": { "$ref": "#/$defs/extractedFieldString" },
        "edema": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "description": { "$ref": "#/$defs/extractedFieldString" },
            "peakSwellingWindow": { "$ref": "#/$defs/extractedFieldString" }
          }
        },
        "involvementAreas": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "brainstemInvolvement": { "$ref": "#/$defs/extractedFieldTriState" },
            "supratentorialInvolvement": { "$ref": "#/$defs/extractedFieldTriState" },
            "nonCerebellarStroke": { "$ref": "#/$defs/extractedFieldTriState" }
          }
        }
      }
    },
    "interventions": {
      "type": "object",
      "title": "Step 5: Interventions",
      "additionalProperties": false,
      "properties": {
        "surgicalIndications": {
          "type": "array",
          "items": { "$ref": "#/$defs/extractedItem" },
          "default": []
        },
        "interventionTypes": {
          "type": "array",
          "items": { "$ref": "#/$defs/extractedItem" },
          "default": []
        }
      }
    },
    "studyArms": {
      "type": "array",
      "title": "Step 6: Study Arms",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "armId": { "$ref": "#/$defs/extractedFieldString" },
          "label": { "$ref": "#/$defs/extractedFieldString" },
          "description": { "$ref": "#/$defs/extractedFieldString" }
        }
      },
      "default": []
    },
    "outcomes": {
      "type": "object",
      "title": "Step 7: Outcomes",
      "additionalProperties": false,
      "properties": {
        "mortality": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "armId": { "$ref": "#/$defs/extractedFieldString" },
              "timepoint": { "$ref": "#/$defs/extractedFieldString" },
              "deathsN": { "$ref": "#/$defs/extractedFieldInteger" },
              "totalN": { "$ref": "#/$defs/extractedFieldInteger" },
              "notes": { "$ref": "#/$defs/extractedFieldString" }
            }
          },
          "default": []
        },
        "mrs": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "armId": { "$ref": "#/$defs/extractedFieldString" },
              "timepoint": { "$ref": "#/$defs/extractedFieldString" },
              "definition": { "$ref": "#/$defs/extractedFieldString" },
              "eventsN": { "$ref": "#/$defs/extractedFieldInteger" },
              "totalN": { "$ref": "#/$defs/extractedFieldInteger" },
              "notes": { "$ref": "#/$defs/extractedFieldString" }
            }
          },
          "default": []
        }
      }
    },
    "complications": {
      "type": "object",
      "title": "Step 8: Complications",
      "additionalProperties": false,
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "armId": { "$ref": "#/$defs/extractedFieldString" },
              "complication": { "$ref": "#/$defs/extractedFieldString" },
              "eventsN": { "$ref": "#/$defs/extractedFieldInteger" },
              "totalN": { "$ref": "#/$defs/extractedFieldInteger" },
              "timepoint": { "$ref": "#/$defs/extractedFieldString" },
              "notes": { "$ref": "#/$defs/extractedFieldString" }
            }
          },
          "default": []
        },
        "predictorsSummary": { "$ref": "#/$defs/extractedFieldString" },
        "predictorAnalyses": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "predictor": { "$ref": "#/$defs/extractedFieldString" },
              "effectMeasure": { "$ref": "#/$defs/extractedFieldString" },
              "estimate": { "$ref": "#/$defs/extractedFieldNumber" },
              "ciLower": { "$ref": "#/$defs/extractedFieldNumber" },
              "ciUpper": { "$ref": "#/$defs/extractedFieldNumber" },
              "pValue": {
                "allOf": [{ "$ref": "#/$defs/extractedFieldNumber" }],
                "properties": {
                  "value": { "type": "number", "minimum": 0, "maximum": 1 }
                }
              },
              "adjusted": { "$ref": "#/$defs/extractedFieldBoolean" },
              "modelNotes": { "$ref": "#/$defs/extractedFieldString" }
            }
          },
          "default": []
        }
      }
    },
    "extractionLog": {
      "type": "object",
      "title": "Generic extracted_data + summary",
      "additionalProperties": false,
      "properties": {
        "extracted_data": {
          "type": "array",
          "items": { "$ref": "#/$defs/extractedDatum" },
          "default": []
        },
        "summary": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "document_type": { "type": "string" },
            "total_extractions": { "type": "integer", "minimum": 0 },
            "demographics": { "type": "object" },
            "clinical_aspects": { "type": "object" },
            "interventional_aspects": { "type": "object" },
            "picos": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "population": { "type": "string" },
                "intervention": { "type": "string" },
                "comparison": { "type": "string" },
                "outcomes": { "type": "string" }
              }
            }
          }
        }
      }
    }
  },
  "$defs": {
    "confidence": {
      "type": "string",
      "enum": ["high", "medium", "low"]
    },
    "sourceLocation": {
      "type": "object",
      "additionalProperties": false,
      "required": ["page"],
      "properties": {
        "page": { "type": "integer", "minimum": 1 },
        "section": { "type": "string" },
        "specific_location": { "type": "string" },
        "exact_text_reference": { "type": "string" },
        "cited_text": { "type": "string", "description": "Verbatim text from Citations API" },
        "citation_verified": { "type": "boolean", "description": "True if sourced from Citations API" },
        "document_index": { "type": "integer", "minimum": 0, "description": "Document index for multi-doc support" }
      }
    },
    "extractedDatum": {
      "type": "object",
      "additionalProperties": false,
      "required": ["data_type", "content", "source_location", "confidence"],
      "properties": {
        "data_type": { "type": "string" },
        "content": {},
        "source_location": { "$ref": "#/$defs/sourceLocation" },
        "confidence": { "$ref": "#/$defs/confidence" },
        "notes": { "type": "string" }
      }
    },
    "extraction": {
      "type": "object",
      "additionalProperties": false,
      "required": ["content", "source_location", "confidence"],
      "properties": {
        "content": {},
        "source_location": { "$ref": "#/$defs/sourceLocation" },
        "confidence": { "$ref": "#/$defs/confidence" },
        "notes": { "type": "string" }
      }
    },
    "extractedFieldString": {
      "allOf": [{ "$ref": "#/$defs/extraction" }],
      "properties": { "content": { "type": "string" } }
    },
    "extractedFieldStringRequired": {
      "allOf": [{ "$ref": "#/$defs/extraction" }],
      "properties": { "content": { "type": "string", "minLength": 1 } }
    },
    "extractedFieldInteger": {
      "allOf": [{ "$ref": "#/$defs/extraction" }],
      "properties": { "content": { "type": "integer" } }
    },
    "extractedFieldIntegerRequired": {
      "allOf": [{ "$ref": "#/$defs/extraction" }],
      "properties": { "content": { "type": "integer" } }
    },
    "extractedFieldNumber": {
      "allOf": [{ "$ref": "#/$defs/extraction" }],
      "properties": { "content": { "type": "number" } }
    },
    "extractedFieldBoolean": {
      "allOf": [{ "$ref": "#/$defs/extraction" }],
      "properties": { "content": { "type": "boolean" } }
    },
    "extractedFieldTriState": {
      "allOf": [{ "$ref": "#/$defs/extraction" }],
      "properties": { "content": { "type": ["boolean", "null"] } }
    },
    "extractedItem": {
      "type": "object",
      "additionalProperties": false,
      "required": ["data_type", "content", "source_location", "confidence"],
      "properties": {
        "data_type": { "type": "string" },
        "content": {},
        "source_location": { "$ref": "#/$defs/sourceLocation" },
        "confidence": { "$ref": "#/$defs/confidence" },
        "notes": { "type": "string" }
      }
    }
  }
};

const systemPrompt = `You are an AI data extraction assistant that processes PDF documents and extracts structured information based on user specifications. Your goal is to analyze the provided PDF, extract the requested information accurately, and present it in a structured format with full transparency about data sources.

Your task is to:

1. **Analyze the PDF content thoroughly**: Read through the entire document to understand its structure, content type, and organization.

2. **Identify relevant information**: Based on the extraction request, locate all sections, tables, graphs, data points, or text passages that contain the requested information.

3. **For peer-reviewed articles, pay special attention to**:
   - **Demographics**: Patient/participant characteristics, sample sizes, age ranges, gender distribution, geographic location, etc.
   - **Clinical aspects**: Diagnoses, conditions, symptoms, clinical measurements, outcomes, adverse events, etc.
   - **Interventional aspects**: Treatments, procedures, medications, dosages, duration, protocols, etc.
   - **PICOs framework**:
     - **P**opulation: Who was studied?
     - **I**ntervention: What was done?
     - **C**omparison: What was it compared to?
     - **O**utcomes: What were the results/endpoints?

4. **Extract data with source linking**: For every piece of data you extract, you must identify and record the exact location in the document where it came from (page number, section heading, paragraph, table number, figure number, etc.).

5. **Structure the output**: Use the ExtractionForm tool to return extracted data in the proper JSON structure.

Important guidelines:

- **Accuracy**: Only extract information that is explicitly stated in the document. Do not infer or assume data that isn't clearly present.
- **Completeness**: Extract all instances of the requested data type, not just the first occurrence.
- **Transparency**: Every extraction must include its source location with enough detail that a human reviewer can easily verify it.
- **Clarity**: If data is ambiguous or unclear in the source document, note this in the "notes" field and mark confidence as "low".
- **Tables and graphs**: For tabular data, preserve the structure. For graphs, extract the underlying data points and trends described.

If the document does not contain the requested information, or if certain requested data types are not present, use null for content and add a note explaining the absence.`;

// Prompt for Pass 1: Citation-enabled extraction
const citationExtractionPrompt = `Extract ALL clinical study data from this document. For EVERY piece of data you extract, you MUST cite it directly from the document.

Focus on extracting:
1. **Study Identification**: Authors, year, journal, DOI, PMID, country, funding, conflicts of interest
2. **PICO-T Elements**: Population characteristics, intervention details, comparators, outcomes measured, follow-up timing
3. **Baseline Characteristics**: Sample sizes (total, by arm), age statistics, gender distribution, clinical scores (mRS, NIHSS, GCS)
4. **Imaging Findings**: Vascular territory, infarct volume, edema description, brainstem/supratentorial involvement
5. **Interventions**: Surgical indications, intervention types, procedures performed
6. **Study Arms**: All groups/arms with their labels and descriptions
7. **Outcomes**: Mortality data (by timepoint), mRS outcomes, functional outcomes
8. **Complications**: All reported complications with event counts

For each data point, cite the EXACT text from the document. This is critical for meta-analysis verification.

Structure your response as a detailed extraction with citations for each item.`;

// Prompt for Pass 2: Structuring cited content
const structuringPrompt = `Based on the extracted clinical data with citations below, organize it into the ExtractionForm schema.

CRITICAL INSTRUCTIONS:
1. For EVERY field's source_location, use the citation information provided:
   - Set "page" from the citation's page number
   - Set "cited_text" to the exact quoted text from the citation
   - Set "citation_verified" to true (since this comes from API-verified citations)
   - Set "exact_text_reference" to the relevant portion of the cited text

2. Assign confidence levels:
   - "high": Data directly cited with exact numbers/text
   - "medium": Data inferred from cited context
   - "low": Data that required interpretation

3. Do not invent data - only include what was extracted and cited.

EXTRACTED DATA WITH CITATIONS:
`;

/**
 * PASS 1: Extract data from PDF with Citations API enabled
 * Returns raw text with citation blocks for API-verified provenance
 */
export const extractWithCitations = async (
  pdfBase64: string,
  request: string
): Promise<CitationExtractionResult> => {
  const anthropic = new Anthropic({
    apiKey: process.env.API_KEY,
    dangerouslyAllowBrowser: true
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64
            },
            citations: { enabled: true }
          } as any, // Type assertion needed for citations property
          {
            type: "text",
            text: `${citationExtractionPrompt}\n\nAdditional focus: ${request}`
          }
        ]
      }]
    });

    // Parse the response to extract text and citation blocks
    return parseCitationResponse(response);
  } catch (error: any) {
    console.error("Citation extraction failed:", error);
    throw new Error(`Citation extraction failed: ${error.message}`);
  }
};

/**
 * Parse Anthropic response to extract text and citation blocks
 */
function parseCitationResponse(response: Anthropic.Message): CitationExtractionResult {
  const cited_data: CitedDataPoint[] = [];
  let raw_text = "";
  let currentContext = "";

  for (const block of response.content) {
    if (block.type === 'text') {
      raw_text += block.text;
      currentContext = block.text;
    } else if ((block as any).type === 'cite') {
      // This is a citation block from the Citations API
      const citeBlock = block as any;
      cited_data.push({
        field_path: inferFieldPath(currentContext),
        extracted_value: currentContext.trim().split('\n').pop() || "",
        citation: {
          type: 'cite',
          cited_text: citeBlock.cited_text,
          document_index: citeBlock.document_index || 0,
          start_page_number: citeBlock.start_page_number,
          end_page_number: citeBlock.end_page_number
        }
      });
    }
  }

  return { raw_text, cited_data };
}

/**
 * Infer the schema field path from context (best effort)
 */
function inferFieldPath(context: string): string {
  const lowerContext = context.toLowerCase();

  // Study ID fields
  if (lowerContext.includes('author') || lowerContext.includes('citation')) return 'studyId.citation';
  if (lowerContext.includes('doi')) return 'studyId.doi';
  if (lowerContext.includes('pmid')) return 'studyId.pmid';
  if (lowerContext.includes('journal')) return 'studyId.journal';
  if (lowerContext.includes('year') || lowerContext.includes('published')) return 'studyId.year';
  if (lowerContext.includes('country') || lowerContext.includes('countries')) return 'studyId.country';

  // Baseline fields
  if (lowerContext.includes('sample size') || lowerContext.includes('total n') || lowerContext.includes('patients enrolled')) return 'baseline.sampleSize.totalN';
  if (lowerContext.includes('surgical') && lowerContext.includes('n ')) return 'baseline.sampleSize.surgicalN';
  if (lowerContext.includes('control') && lowerContext.includes('n ')) return 'baseline.sampleSize.controlN';
  if (lowerContext.includes('age') && lowerContext.includes('mean')) return 'baseline.age.mean';
  if (lowerContext.includes('age') && lowerContext.includes('median')) return 'baseline.age.median';
  if (lowerContext.includes('male')) return 'baseline.gender.maleN';
  if (lowerContext.includes('female')) return 'baseline.gender.femaleN';
  if (lowerContext.includes('nihss')) return 'baseline.clinicalScores.nihssMeanOrMedian';
  if (lowerContext.includes('gcs')) return 'baseline.clinicalScores.gcsMeanOrMedian';
  if (lowerContext.includes('mrs') && !lowerContext.includes('outcome')) return 'baseline.clinicalScores.prestrokeMRS';

  // PICO fields
  if (lowerContext.includes('population') || lowerContext.includes('inclusion') || lowerContext.includes('eligib')) return 'picoT.population';
  if (lowerContext.includes('intervention') && !lowerContext.includes('type')) return 'picoT.intervention';
  if (lowerContext.includes('comparator') || lowerContext.includes('control group')) return 'picoT.comparator';
  if (lowerContext.includes('outcome') && lowerContext.includes('measure')) return 'picoT.outcomesMeasured';
  if (lowerContext.includes('follow') && lowerContext.includes('up')) return 'picoT.timingFollowUp';
  if (lowerContext.includes('study type') || lowerContext.includes('design')) return 'picoT.studyType';

  // Outcomes
  if (lowerContext.includes('mortality') || lowerContext.includes('death')) return 'outcomes.mortality';
  if (lowerContext.includes('mrs') && lowerContext.includes('outcome')) return 'outcomes.mrs';

  // Complications
  if (lowerContext.includes('complication') || lowerContext.includes('adverse')) return 'complications.items';

  // Default
  return 'extractionLog.extracted_data';
}

/**
 * Format cited content for Pass 2 structuring
 */
export function formatCitedContent(citationResult: CitationExtractionResult): string {
  let formatted = citationResult.raw_text + "\n\n";
  formatted += "=== CITATION DETAILS ===\n\n";

  for (const dataPoint of citationResult.cited_data) {
    formatted += `Field: ${dataPoint.field_path}\n`;
    formatted += `Value: ${dataPoint.extracted_value}\n`;
    formatted += `Cited Text: "${dataPoint.citation.cited_text}"\n`;
    formatted += `Page: ${dataPoint.citation.start_page_number || 'N/A'}`;
    if (dataPoint.citation.end_page_number && dataPoint.citation.end_page_number !== dataPoint.citation.start_page_number) {
      formatted += `-${dataPoint.citation.end_page_number}`;
    }
    formatted += `\n\n`;
  }

  return formatted;
}

/**
 * PASS 2: Structure the cited content using tool use
 * Takes citation data from Pass 1 and returns structured ExtractionResults
 */
export const structureExtraction = async (
  citationResult: CitationExtractionResult,
  useThinking: boolean
): Promise<any> => {
  const anthropic = new Anthropic({
    apiKey: process.env.API_KEY,
    dangerouslyAllowBrowser: true
  });

  const formattedContent = formatCitedContent(citationResult);

  const requestConfig: Anthropic.MessageCreateParams = {
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 16000,
    temperature: 1,
    system: systemPrompt,
    messages: [{
      role: "user",
      content: structuringPrompt + formattedContent
    }],
    tools: [{
      type: "custom",
      name: "ExtractionForm",
      description: "Extracts structured clinical study data from cited content. Use citation information for source_location fields.",
      input_schema: extractionFormSchema as Anthropic.Tool.InputSchema
    }]
  };

  if (useThinking) {
    (requestConfig as any).thinking = {
      type: "enabled",
      budget_tokens: 16000
    };
  }

  try {
    const response = await anthropic.messages.create(requestConfig);

    // Extract tool use result
    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === 'ExtractionForm') {
        // Enrich with citation_verified flags
        return enrichWithCitationFlags(block.input, citationResult);
      }
    }

    // Fallback to JSON parsing
    for (const block of response.content) {
      if (block.type === 'text') {
        const jsonMatch = block.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return enrichWithCitationFlags(JSON.parse(jsonMatch[0]), citationResult);
        }
      }
    }

    throw new Error("No structured extraction results found");
  } catch (error: any) {
    console.error("Structure extraction failed:", error);
    throw new Error(`Structure extraction failed: ${error.message}`);
  }
};

/**
 * Enrich extraction results with citation_verified flags
 */
function enrichWithCitationFlags(extraction: any, citationResult: CitationExtractionResult): any {
  // Create a map of field paths to citations for quick lookup
  const citationMap = new Map<string, CitedDataPoint>();
  for (const dataPoint of citationResult.cited_data) {
    citationMap.set(dataPoint.field_path, dataPoint);
  }

  // Recursively process the extraction to add citation flags
  function processField(obj: any, path: string = ""): any {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item, index) => processField(item, `${path}[${index}]`));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (key === 'source_location' && typeof value === 'object' && value !== null) {
        // This is a source_location field - check if we have a citation for the parent
        const parentPath = path;
        const citation = citationMap.get(parentPath) ||
                         findBestMatchingCitation(parentPath, citationMap);

        if (citation) {
          result[key] = {
            ...value,
            cited_text: citation.citation.cited_text,
            citation_verified: true,
            document_index: citation.citation.document_index
          };
        } else {
          result[key] = value;
        }
      } else {
        result[key] = processField(value, currentPath);
      }
    }
    return result;
  }

  return processField(extraction);
}

/**
 * Find the best matching citation for a field path
 */
function findBestMatchingCitation(
  fieldPath: string,
  citationMap: Map<string, CitedDataPoint>
): CitedDataPoint | undefined {
  // Try exact match first
  if (citationMap.has(fieldPath)) {
    return citationMap.get(fieldPath);
  }

  // Try parent path
  const parts = fieldPath.split('.');
  while (parts.length > 1) {
    parts.pop();
    const parentPath = parts.join('.');
    if (citationMap.has(parentPath)) {
      return citationMap.get(parentPath);
    }
  }

  // Try partial match (for array items)
  for (const [path, dataPoint] of citationMap) {
    if (fieldPath.startsWith(path) || path.startsWith(fieldPath.replace(/\[\d+\]/g, ''))) {
      return dataPoint;
    }
  }

  return undefined;
}

/**
 * Progress callback type for UI updates
 */
export type ExtractionProgressCallback = (step: string, progress: number) => void;

/**
 * Search Result block for Claude API
 */
interface SearchResultBlock {
  type: "search_result";
  source: string;
  title: string;
  content: Array<{ type: "text"; text: string }>;
  citations: { enabled: boolean };
}

/**
 * Citation from Claude's response
 */
interface SearchResultCitation {
  type: "search_result_location";
  source: string;
  title: string;
  cited_text: string;
  search_result_index: number;
  start_block_index: number;
  end_block_index: number;
}

/**
 * NEW: Extract using Search Results API (single-pass with native citations)
 *
 * This approach:
 * 1. Converts PDF pages into search_result blocks
 * 2. Claude extracts data and automatically cites with exact text
 * 3. Returns structured data with `cited_text` guaranteed to be exact
 */
export const extractWithSearchResults = async (
  pageTexts: Array<{ page: number; text: string }>,
  request: string,
  useThinking: boolean,
  onProgress?: ExtractionProgressCallback
): Promise<{ extraction: any; citations: Map<string, string> }> => {
  const anthropic = new Anthropic({
    apiKey: process.env.API_KEY,
    dangerouslyAllowBrowser: true
  });

  onProgress?.("Preparing PDF pages as search results...", 20);

  // Convert pages to search_result blocks
  const searchResults: SearchResultBlock[] = pageTexts.map(({ page, text }) => ({
    type: "search_result",
    source: `page-${page}`,
    title: `Page ${page}`,
    content: [{ type: "text", text: text.substring(0, 50000) }], // Limit per page
    citations: { enabled: true }
  }));

  onProgress?.("Extracting with native citations...", 40);

  // Build the message content: search results + extraction prompt
  const messageContent: any[] = [
    ...searchResults,
    {
      type: "text",
      text: `Based on the above PDF pages, extract all clinical study data using the ExtractionForm tool.

CRITICAL: For EVERY field you extract, Claude will automatically cite the exact source text.
The citations will include the precise page and quoted text.

Focus on:
1. Study ID: Authors, year, journal, DOI, country
2. PICO-T: Population, intervention, comparator, outcomes, timing
3. Baseline: Sample sizes, age, gender, clinical scores
4. Imaging: Vascular territory, volume, edema
5. Interventions: Indications, procedures
6. Outcomes: Mortality, mRS scores
7. Complications: All reported adverse events

${request ? `Additional focus: ${request}` : ""}

Use the ExtractionForm tool to structure your findings.`
    }
  ];

  const requestConfig: Anthropic.MessageCreateParams = {
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 16000,
    temperature: 1,
    system: systemPrompt,
    messages: [{ role: "user", content: messageContent }],
    tools: [{
      type: "custom",
      name: "ExtractionForm",
      description: "Extracts structured clinical study data with automatic citation tracking.",
      input_schema: extractionFormSchema as Anthropic.Tool.InputSchema
    }]
  };

  if (useThinking) {
    (requestConfig as any).thinking = {
      type: "enabled",
      budget_tokens: 16000
    };
  }

  try {
    onProgress?.("Processing extraction...", 60);
    const response = await anthropic.messages.create(requestConfig);

    // Collect all citations from the response
    const citationsMap = new Map<string, string>();
    let extraction: any = null;

    for (const block of response.content) {
      // Extract tool use result
      if (block.type === 'tool_use' && block.name === 'ExtractionForm') {
        extraction = block.input;
      }

      // Extract citations from text blocks
      if (block.type === 'text' && (block as any).citations) {
        for (const citation of (block as any).citations as SearchResultCitation[]) {
          // Key: page-fieldContext, Value: exact cited_text
          const pageNum = parseInt(citation.source.replace('page-', ''));
          citationsMap.set(`${citation.source}:${citation.cited_text.substring(0, 50)}`, citation.cited_text);
        }
      }
    }

    onProgress?.("Enriching with citations...", 80);

    // Enrich extraction with cited_text from citations
    if (extraction) {
      enrichExtractionWithSearchCitations(extraction, citationsMap);
    }

    onProgress?.("Extraction complete", 100);

    return {
      extraction: extraction || {},
      citations: citationsMap
    };
  } catch (error: any) {
    console.error("Search results extraction failed:", error);
    throw new Error(`Search results extraction failed: ${error.message}`);
  }
};

/**
 * Enrich extraction results with cited_text from Search Results citations
 */
function enrichExtractionWithSearchCitations(
  obj: any,
  citationsMap: Map<string, string>,
  path: string = ""
): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => enrichExtractionWithSearchCitations(item, citationsMap, `${path}[${i}]`));
    return;
  }

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (key === 'source_location' && typeof value === 'object' && value !== null) {
      const sourceLocation = value as any;

      // If we have a page number, try to find matching citation
      if (sourceLocation.page) {
        const pageKey = `page-${sourceLocation.page}`;

        // Look for any citation from this page
        for (const [citationKey, citedText] of citationsMap) {
          if (citationKey.startsWith(pageKey)) {
            sourceLocation.cited_text = citedText;
            sourceLocation.citation_verified = true;
            break;
          }
        }
      }
    } else if (typeof value === 'object') {
      enrichExtractionWithSearchCitations(value, citationsMap, currentPath);
    }
  }
}

/**
 * Main extraction orchestrator - supports Search Results (preferred), two-pass, and single-pass modes
 *
 * @param pdfText - Extracted text from PDF (used for single-pass fallback)
 * @param request - User's extraction request
 * @param useThinking - Enable extended thinking for complex reasoning
 * @param images - Optional page images for visual analysis
 * @param pdfBase64 - Optional base64 PDF for two-pass citation extraction
 * @param onProgress - Optional callback for progress updates
 * @param pageTexts - Optional array of page texts for Search Results API (preferred)
 */
export const runExtraction = async (
  pdfText: string,
  request: string,
  useThinking: boolean,
  images?: string[],
  pdfBase64?: string,
  onProgress?: ExtractionProgressCallback,
  pageTexts?: Array<{ page: number; text: string }>
): Promise<any> => {

  // PREFERRED: Search Results API (single-pass with native exact citations)
  if (pageTexts && pageTexts.length > 0) {
    try {
      onProgress?.("Using Search Results API for precise citations...", 10);

      const { extraction, citations } = await extractWithSearchResults(
        pageTexts,
        request,
        useThinking,
        onProgress
      );

      console.log(`Search Results extraction complete: ${citations.size} citations collected`);
      return extraction;
    } catch (error: any) {
      console.warn("Search Results extraction failed, falling back to two-pass:", error.message);
      onProgress?.("Falling back to two-pass extraction...", 20);
      // Fall through to two-pass mode
    }
  }

  // FALLBACK 1: Two-pass mode with Citations API
  if (pdfBase64) {
    try {
      onProgress?.("Extracting with citations (Pass 1)...", 25);

      // Pass 1: Extract with citations enabled
      const citationResult = await extractWithCitations(pdfBase64, request);

      onProgress?.("Structuring extracted data (Pass 2)...", 60);

      // Pass 2: Structure the cited content
      const structuredResult = await structureExtraction(citationResult, useThinking);

      onProgress?.("Extraction complete", 100);

      return structuredResult;
    } catch (error: any) {
      console.warn("Two-pass extraction failed, falling back to single-pass:", error.message);
      onProgress?.("Falling back to single-pass extraction...", 30);
      // Fall through to single-pass mode
    }
  }

  // SINGLE-PASS MODE: Original approach (fallback)
  onProgress?.("Processing document...", 30);

  const anthropic = new Anthropic({
    apiKey: process.env.API_KEY,
    dangerouslyAllowBrowser: true
  });

  // Build content array with text and images
  const contentParts: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

  // Add the main prompt text
  const promptText = `Here is the PDF document to analyze:

<pdf_document>
${pdfText.substring(0, 100000)}
</pdf_document>

Here is the user's extraction request specifying what type of data they want extracted:

<extraction_request>
${request}
</extraction_request>

Please analyze the document thoroughly and use the ExtractionForm tool to extract all relevant clinical study data following the schema structure. Ensure every field includes source_location with page numbers and exact_text_reference where possible.`;

  contentParts.push({ type: "text", text: promptText });

  // Add images if provided
  if (images && images.length > 0) {
    images.forEach((img) => {
      const base64Data = img.includes(',') ? img.split(",")[1] : img;
      contentParts.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: base64Data
        }
      });
    });
  }

  onProgress?.("Analyzing content...", 50);

  const requestConfig: Anthropic.MessageCreateParams = {
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 16000,
    temperature: 1,
    system: systemPrompt,
    messages: [{ role: "user", content: contentParts }],
    tools: [{
      type: "custom",
      name: "ExtractionForm",
      description: "Extracts structured clinical study data from PDF documents for meta-analysis.",
      input_schema: extractionFormSchema as Anthropic.Tool.InputSchema
    }]
  };

  if (useThinking) {
    (requestConfig as any).thinking = {
      type: "enabled",
      budget_tokens: 16000
    };
  }

  try {
    onProgress?.("Generating structured output...", 70);
    const response = await anthropic.messages.create(requestConfig);

    // Extract tool use result
    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === 'ExtractionForm') {
        onProgress?.("Extraction complete", 100);
        return block.input;
      }
    }

    // Fallback to JSON parsing
    for (const block of response.content) {
      if (block.type === 'text') {
        const jsonMatch = block.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          onProgress?.("Extraction complete", 100);
          return JSON.parse(jsonMatch[0]);
        }
      }
    }

    throw new Error("No extraction results found in the response");
  } catch (e: any) {
    console.error("Failed to process Claude response", e);
    throw new Error(`Extraction failed: ${e.message || "Unknown error"}. Please try again.`);
  }
};
