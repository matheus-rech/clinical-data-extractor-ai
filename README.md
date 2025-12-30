<p align="center">
  <img src="https://img.shields.io/badge/React-19.x-61DAFB?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6.x-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/Claude_API-Anthropic-CC785C?style=flat-square" alt="Claude API" />
  <img src="https://github.com/matheus-rech/clinical-data-extractor-ai/actions/workflows/ci.yml/badge.svg" alt="CI Status" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
</p>

# 🏥 Clinical Data Extractor AI

A sophisticated AI-powered tool for extracting structured clinical research data from PDF documents. Built for **systematic reviews** and **meta-analyses**, featuring Claude's advanced reasoning capabilities, human-in-the-loop verification, and comprehensive export formats.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI-Powered Extraction** | Uses Claude Sonnet with extended thinking for accurate data extraction |
| 📄 **PDF Processing** | Extracts text and images from PDF documents using PDF.js |
| 🎯 **Citation Highlighting** | Click-to-navigate citations with color-coded categories |
| 📊 **8-Section Schema** | Structured extraction covering Study ID, PICOT, Baseline, Imaging, Interventions, Study Arms, Outcomes, and Complications |
| 💾 **Multi-Paper Management** | Upload and manage multiple papers for systematic reviews |
| ↩️ **Undo/Auto-Save** | Never lose work with automatic saving and undo history |
| 📤 **Meta-Analysis Export** | Export to CSV, JSON, R Script (metafor), and RevMan XML |
| 🔐 **Secure API Key Storage** | Choose between memory-only, session, or persistent storage |

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/matheus-rech/clinical-data-extractor-ai.git
cd clinical-data-extractor-ai

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and configure your Anthropic API key in Settings.

## 📋 Prerequisites

- **Node.js** 18.x or higher
- **Anthropic API Key** ([Get one here](https://console.anthropic.com/))

## ⚙️ Configuration

### Option 1: Environment Variable (Development)

Create `.env.local` in the project root:

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
```

### Option 2: Settings Modal (Recommended)

1. Click the **⚙️ Settings** button in the app header
2. Enter your API key
3. Choose storage preference:
   - **Memory Only**: Key cleared on page refresh
   - **Session Storage**: Key persists until tab closes
   - **Persistent**: Key stored in localStorage

## 📖 Usage

### Basic Workflow

1. **Upload PDF** - Drag & drop or click to upload a clinical research paper
2. **Extract Data** - Click "Extract with AI" to process the document
3. **Review & Verify** - Check extracted data across 8 tabbed sections
4. **Manual Mapping** - Select text in PDF to manually map to fields
5. **Export** - Download in your preferred format for meta-analysis

### Multi-Paper Systematic Review

1. Upload your first paper
2. Click **+ Add Paper** to upload additional papers
3. Use the dropdown to switch between papers
4. Click **Export All** to combine data for meta-analysis

### Citation Navigation

- Click the **📑 Citations** button to open the citation panel
- Citations are color-coded by category:
  - 🟡 **Figure** - Figure references
  - 🔵 **Table** - Table references
  - 🟢 **Method** - Methodology citations
  - 🟣 **Result** - Results citations
  - 🟠 **Conclusion** - Conclusion citations
- Click any citation to navigate to its location in the PDF

## 📤 Export Formats

### CSV
Standard spreadsheet format compatible with Excel, Google Sheets, and data analysis tools.

### JSON
Complete structured data export preserving all extraction metadata and source locations.

### R Script (metafor)
Ready-to-run R script for meta-analysis:

```r
library(metafor)

# Data frame with extracted study data
clinical_data <- data.frame(
  study_id = c("Smith2020", "Jones2021"),
  year = c(2020, 2021),
  n_intervention = c(45, 52),
  n_control = c(43, 48),
  events_intervention = c(12, 15),
  events_control = c(8, 10)
)

# Calculate effect sizes
es <- escalc(measure = "OR",
             ai = events_intervention, n1i = n_intervention,
             ci = events_control, n2i = n_control,
             data = clinical_data)

# Random effects meta-analysis
res <- rma(yi, vi, data = es)
summary(res)
forest(res)
```

### RevMan XML
Cochrane Review Manager 5+ compatible format for Cochrane systematic reviews.

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript |
| Styling | Tailwind CSS (CDN) |
| Build | Vite 6 |
| AI | Claude API (Anthropic SDK) |
| PDF | PDF.js 3.11 |
| Storage | IndexedDB |
| Icons | Lucide React |

### Project Structure

```
clinical-data-extractor-ai/
├── .github/
│   └── workflows/
│       ├── ci.yml          # Build & type-check
│       └── deploy.yml      # GitHub Pages deployment
├── services/
│   ├── claudeService.ts    # Claude API integration
│   └── dbService.ts        # IndexedDB persistence
├── App.tsx                 # Main application component
├── types.ts                # TypeScript interfaces
├── index.tsx               # React entry point
├── index.html              # HTML shell
├── vite.config.ts          # Vite configuration
└── package.json
```

### Extraction Schema

The app extracts data into 8 structured sections:

| Section | Fields |
|---------|--------|
| **Study ID** | Citation, DOI, PMID, Journal, Year, Country, Funding |
| **PICOT** | Population, Intervention, Comparator, Outcomes, Timing |
| **Baseline** | Sample size, Age, Gender, Clinical scores |
| **Imaging** | Vascular territory, Infarct volume, Edema |
| **Interventions** | Surgical indications, Intervention types |
| **Study Arms** | Arm definitions, Participant counts |
| **Outcomes** | Mortality, mRS scores at various timepoints |
| **Complications** | Adverse events, Predictor analyses |

## 🔧 Development

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check
```

### Local Development with Demo Mode

The app includes a demo mode for testing without an API key:
1. Click "Extract with AI" without setting an API key
2. The app will generate mock extraction data
3. Use this to test the UI and export functionality

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Use TypeScript strict mode
- Follow the existing code style
- Add comments for complex logic
- Test manually before submitting PR

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com) for the Claude API
- [PDF.js](https://mozilla.github.io/pdf.js/) for PDF rendering
- [Lucide](https://lucide.dev) for beautiful icons
- [Vite](https://vitejs.dev) for the blazing fast build tool

---

<p align="center">
  Made with ❤️ for clinical researchers and systematic reviewers
</p>
