# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clinical Data Extractor AI - A React web application for extracting structured clinical research data from PDF documents using Claude API (Anthropic) with extended thinking, human-in-the-loop verification, and multi-paper management for systematic reviews and meta-analysis.

## Commands

```bash
# Install dependencies
npm install

# Development server (localhost:3000 or next available port)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Environment Setup

API key can be configured in two ways:
1. Set `ANTHROPIC_API_KEY` in `.env.local` (backend/development)
2. Use the Settings modal in the UI (frontend, with persistence options)

## Architecture

### Tech Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS (CDN)
- **Build**: Vite 6
- **AI**: Claude API / Anthropic SDK (@anthropic-ai/sdk)
- **PDF**: PDF.js 3.11 (CDN)
- **Icons**: Lucide React
- **Storage**: IndexedDB (via custom dbService)

### File Structure
```
├── App.tsx                 # Main component with all UI features
├── types.ts                # TypeScript interfaces for extraction results
├── services/
│   ├── claudeService.ts    # Claude API integration with tool use
│   └── dbService.ts        # IndexedDB persistence layer
├── index.tsx               # React entry point
└── index.html              # HTML shell with CDN imports
```

### Data Flow
1. **PDF Upload** → PDF.js extracts text (10 pages max) + images (3 pages) → Auto-saves to IndexedDB
2. **AI Extraction** → Claude processes text + images using tool use with ExtractionForm schema
3. **Results Display** → 8-section tabbed interface (Study ID → Complications)
4. **Manual Verification** → User selects PDF text and maps to fields
5. **Citation Panel** → Click citations to navigate to source text in PDF
6. **Export** → Download as CSV, JSON, R Script, or RevMan XML for meta-analysis

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
  source_location: { page, section?, specific_location?, exact_text_reference?, cited_text? };
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

### IndexedDB Persistence (services/dbService.ts)

Local database with three object stores:

**`papers` store:**
- `id`: Unique paper identifier
- `fileName`: Original PDF filename
- `pdfBase64`: Full PDF content for re-loading
- `extractionResults`: Structured extraction data
- `metadata`: Title, year, DOI, page count

**`history` store:**
- Tracks all changes for undo functionality
- Stores previous/current state pairs
- Enables reverting to previous extraction states

**`settings` store:**
- Active paper ID
- Recent paper IDs
- Auto-save preferences

### UI Features

#### Header Controls
- **Papers Dropdown**: Switch between uploaded papers, add new, delete existing
- **Undo Button**: Revert to previous extraction state
- **Save Button**: Manual save with visual indicator
- **Export Button**: Open export modal
- **Settings Button**: API key configuration
- **Citations Button**: Toggle citation panel

#### Settings Modal
- API key input with show/hide toggle
- Three storage options:
  - Memory Only (session only)
  - Session Storage (until tab closes)
  - Persistent (localStorage)
- Real-time API key validation

#### Citation Panel (Slide-out)
- Color-coded by category (figure, table, method, result, conclusion, reference)
- Click to navigate to cited text in PDF
- Category filters
- Export citations

#### Export Modal
- **CSV**: Spreadsheet format for Excel/Google Sheets
- **JSON**: Complete structured data
- **R Script**: Pre-formatted for metafor package with example code
- **RevMan XML**: Cochrane Review Manager compatible format
- **Export All**: Combine all papers for meta-analysis

### PDF Highlighting System

Text spans in PDF viewer are clickable and color-coded:
- **Yellow**: AI-extracted data points
- **Indigo**: Currently focused field
- **Purple/Blue/Green/etc.**: Citation categories
- Selection triggers manual mapping workflow via header banner

#### Precise Search-Based Highlighting (Ctrl+F Approach)
- Builds searchable text index on PDF load
- Uses exact substring matching for citations
- Maps character ranges to text item indices
- O(1) lookup for highlight rendering

## Auto-Save Functionality

- 30-second timer after last change
- Visual indicator shows save status
- Creates history entry for each save
- Enables undo to previous states

## Export Formats for Meta-Analysis

### CSV Export
Standard columns for systematic review data extraction tables.

### R Script Export
```r
# Creates data frame with:
clinical_data <- data.frame(
  study_id, year, n_total, n_intervention, n_control,
  mean_age, events_intervention, events_control
)

# Includes metafor example code:
library(metafor)
es <- escalc(measure="OR", ai=events_intervention, n1i=n_intervention,
             ci=events_control, n2i=n_control, data=clinical_data)
res <- rma(yi, vi, data=es)
```

### RevMan XML Export
Compatible with Cochrane Review Manager 5+.

## Known Limitations

- No testing infrastructure (no test runner configured)
- 10-page text extraction limit, 3-page image limit
- Requires `dangerouslyAllowBrowser: true` for Anthropic SDK in browser context
- IndexedDB storage limits vary by browser (~50MB-unlimited)
