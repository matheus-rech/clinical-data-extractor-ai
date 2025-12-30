#!/usr/bin/env python3
"""Test the Clinical Data Extractor AI app with a real PDF."""

from playwright.sync_api import sync_playwright
import time

PDF_PATH = "/Users/matheusrech/MinerU/Mattar2021.pdf-c3200d8d-f94a-437d-984f-f76c1f00b11b/Mattar 2021.pdf"
APP_URL = "http://localhost:3001"

def test_clinical_extractor():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)  # Visible for testing
        page = browser.new_page()
        page.set_viewport_size({"width": 1400, "height": 900})

        print("1. Navigating to app...")
        page.goto(APP_URL)
        page.wait_for_load_state('networkidle')
        page.screenshot(path='/tmp/test_01_initial.png')
        print("   ✓ App loaded")

        print("2. Uploading PDF...")
        # Find the file input and upload
        file_input = page.locator('input[type="file"]')
        file_input.set_input_files(PDF_PATH)

        # Wait for PDF to process
        page.wait_for_timeout(3000)
        page.screenshot(path='/tmp/test_02_pdf_uploaded.png')
        print("   ✓ PDF uploaded and processed")

        print("3. Starting extraction...")
        # Click the extraction button
        extract_button = page.locator('button:has-text("Automate Full Agentic Extraction")')
        extract_button.click()

        # Wait for extraction to complete (this may take a while)
        print("   Waiting for extraction (this may take 30-60 seconds)...")
        page.wait_for_timeout(5000)
        page.screenshot(path='/tmp/test_03_extracting.png')

        # Wait for results to appear (look for the step buttons)
        try:
            page.wait_for_selector('button:has-text("Study ID")', timeout=120000)
            print("   ✓ Extraction complete!")
        except:
            print("   ⚠ Extraction still in progress or failed")
            page.screenshot(path='/tmp/test_03b_extraction_status.png')

        page.screenshot(path='/tmp/test_04_results.png')

        print("4. Testing navigation...")
        # Click on Study ID tab
        page.locator('button:has-text("Study ID")').click()
        page.wait_for_timeout(1000)
        page.screenshot(path='/tmp/test_05_study_id.png')

        # Click on Baseline tab
        page.locator('button:has-text("Baseline")').click()
        page.wait_for_timeout(1000)
        page.screenshot(path='/tmp/test_06_baseline.png')

        # Click on Outcomes tab
        page.locator('button:has-text("Outcomes")').click()
        page.wait_for_timeout(1000)
        page.screenshot(path='/tmp/test_07_outcomes.png')

        print("5. Testing bidirectional navigation...")
        # Try clicking on a data field to test PDF navigation
        # First, go back to Study ID
        page.locator('button:has-text("Study ID")').click()
        page.wait_for_timeout(500)

        # Click on any field that has a source tag
        source_tags = page.locator('button:has-text("P.")').all()
        if source_tags:
            print(f"   Found {len(source_tags)} source tags")
            source_tags[0].click()
            page.wait_for_timeout(1000)
            page.screenshot(path='/tmp/test_08_clicked_source.png')
            print("   ✓ Clicked source tag - should scroll PDF")

        # Check PDF highlights
        page.screenshot(path='/tmp/test_09_final.png', full_page=True)

        print("\n✓ Test complete! Screenshots saved to /tmp/test_*.png")

        # Keep browser open for manual inspection
        print("\nBrowser will stay open for 30 seconds for manual inspection...")
        page.wait_for_timeout(30000)

        browser.close()

if __name__ == "__main__":
    test_clinical_extractor()
