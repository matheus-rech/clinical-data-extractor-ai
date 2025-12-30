"""
PDF Extraction Service using pdfplumber
Extracts text with layout preservation for Claude Search Results API
"""
import pdfplumber
import json
import sys
from typing import List, Dict, Any


def extract_pdf_for_search_results(pdf_path: str, max_pages: int = 10) -> List[Dict[str, Any]]:
    """
    Extract PDF pages into Search Results format for Claude API.

    Returns:
        List of search_result blocks ready for Claude API
    """
    search_results = []

    with pdfplumber.open(pdf_path) as pdf:
        num_pages = min(len(pdf.pages), max_pages)

        for i, page in enumerate(pdf.pages[:num_pages]):
            page_num = i + 1

            # Extract text with layout preservation
            text = page.extract_text(layout=True) or ""

            # Extract tables separately for better structure
            tables = page.extract_tables()
            table_text = ""
            if tables:
                for j, table in enumerate(tables):
                    if table and len(table) > 0:
                        table_text += f"\n[Table {j+1}]\n"
                        for row in table:
                            if row:
                                row_text = " | ".join(str(cell) if cell else "" for cell in row)
                                table_text += row_text + "\n"

            # Combine text and tables
            full_text = text
            if table_text:
                full_text += "\n\n--- Tables ---" + table_text

            # Skip empty pages
            if not full_text.strip():
                continue

            # Create search_result block
            search_result = {
                "type": "search_result",
                "source": f"page-{page_num}",
                "title": f"Page {page_num}",
                "content": [
                    {
                        "type": "text",
                        "text": full_text.strip()
                    }
                ],
                "citations": {
                    "enabled": True
                }
            }

            search_results.append(search_result)

    return search_results


def extract_pdf_metadata(pdf_path: str) -> Dict[str, Any]:
    """Extract PDF metadata."""
    with pdfplumber.open(pdf_path) as pdf:
        return {
            "num_pages": len(pdf.pages),
            "metadata": pdf.metadata or {}
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pdf_extractor.py <pdf_path> [max_pages]", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else 10

    try:
        # Extract and output as JSON
        results = extract_pdf_for_search_results(pdf_path, max_pages)
        print(json.dumps(results, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
