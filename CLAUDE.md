# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clinical Data Extractor AI - A React web application for extracting structured clinical research data from PDF documents using Claude API (Anthropic) with extended thinking and human-in-the-loop verification.

## Commands

```bash
# Install dependencies
npm install

# Development server (localhost:3000)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Environment Setup

Set `ANTHROPIC_API_KEY` in `.env.local` to your Anthropic API key before running.

## Architecture

### Tech Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS (CDN)
- **Build**: Vite 6
- **AI**: Claude API / Anthropic SDK (@anthropic-ai/sdk)
- **PDF**: PDF.js 3.11 (CDN)
- **Icons**: Lucide React

### File Structure
```
├── App.tsx                 # Main component (~1000 lines, monolithic)
├── types.ts                # TypeScript interfaces for extraction results
├── services/
│   └── claudeService.ts    # Claude API integration with tool use
├── index.tsx               # React entry point
└── index.html              # HTML shell with CDN imports
```

### Data Flow
1. **PDF Upload** → PDF.js extracts text (10 pages max) + images (3 pages)
2. **AI Extraction** → Claude processes text + images using tool use with ExtractionForm schema
3. **Results Display** → 8-section tabbed interface (Study ID → Complications)
4. **Manual Verification** → User selects PDF text and maps to fields

### Key Types (types.ts)

The `ExtractionResults` interface defines the extraction schema with 8 sections:
- `studyId`: Citation, DOI, PMID, journal, year, country, funding
- `picoT`: Population, Intervention, Comparator, Outcomes, Timing (PICOT format)
- `baseline`: Sample size, age, gender, clinical scores
- `imaging`: Vascular territory, infarct volume, edema, involvement areas
- `interventions`: Surgical indications, intervention types
- `studyArms`: Study arm definitions
- `outcomes`: Mortality and mRS (Modified Rankin Scale) data
- `complications`: Adverse events and predictor analyses

Every extracted field follows the `Extraction<T>` pattern:
```typescript
{
  content: T;
  source_location: { page, section?, specific_location?, exact_text_reference? };
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}
```

### Claude Integration (services/claudeService.ts)

- **Model**: `claude-sonnet-4-5-20250929`
- **Extended Thinking**: Optional 16K token thinking budget for complex reasoning
- **Tool Use**: Uses `ExtractionForm` custom tool with full JSON schema for structured output
- **Input**: PDF text (100K char limit) + first 3 page images as base64 JPEG
- **Output**: Structured JSON via tool use matching `ExtractionResults` schema

#### Two-Pass Citation Extraction (API-Verified Provenance)

The service implements a hybrid approach combining Claude's Citations API with Tool Use:

**Pass 1: Citation Extraction** (`extractWithCitations`)
- Sends PDF as native document with `citations: { enabled: true }`
- Returns text with API-verified citation blocks containing:
  - `cited_text`: Verbatim text from document
  - `start_page_number`, `end_page_number`: Exact page locations
  - `document_index`: For multi-document support

**Pass 2: Structured Organization** (`structureExtraction`)
- Takes cited content from Pass 1
- Uses Tool Use with ExtractionForm schema
- Maps citations to `source_location` fields

**Result Enhancement** (`enrichWithCitationFlags`)
- Adds `citation_verified: true` to source_location where applicable
- Includes `cited_text` for tooltip display in UI

**Fallback**: If Pass 1 fails, automatically falls back to single-pass mode.

**UI Indicators**:
- Green "Verified" badge with checkmark on API-verified citations
- Hover tooltip shows exact `cited_text` from document
- Green border on verified data cards

### UI State Management

Single-component state with React hooks (no external state library):
- `file`, `pdfDoc`, `pdfText`, `pdfImages`: PDF document state
- `request`, `useThinking`: Extraction configuration
- `processing`: Status tracking (`isProcessing`, `step`, `progress`, `error`)
- `results`: AI extraction results
- `selectedText`, `focusedField`: Manual mapping workflow state

### PDF Highlighting System

Text spans in PDF viewer are clickable and color-coded:
- **Yellow**: AI-extracted data points
- **Indigo**: Currently focused field
- Selection triggers manual mapping workflow via header banner

## Known Limitations

- No testing infrastructure (no test runner configured)
- No data persistence (results lost on refresh)
- No export functionality
- Single-document processing only
- 10-page text extraction limit, 3-page image limit
- Requires `dangerouslyAllowBrowser: true` for Anthropic SDK in browser context
