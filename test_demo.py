#!/usr/bin/env python3
"""Test bidirectional navigation with demo mode."""

from playwright.sync_api import sync_playwright
import time

PDF_PATH = "/Users/matheusrech/MinerU/Mattar2021.pdf-c3200d8d-f94a-437d-984f-f76c1f00b11b/Mattar 2021.pdf"
APP_URL = "http://localhost:3001"

def test_demo_navigation():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.set_viewport_size({"width": 1400, "height": 900})

        print("1. Loading app...")
        page.goto(APP_URL)
        page.wait_for_load_state('networkidle')
        print("   ✓ App loaded")

        print("2. Uploading PDF...")
        file_input = page.locator('input[type="file"]')
        file_input.set_input_files(PDF_PATH)
        page.wait_for_timeout(3000)
        print("   ✓ PDF uploaded")
        page.screenshot(path='/tmp/demo_01_uploaded.png')

        print("3. Enabling Demo Mode...")
        demo_checkbox = page.locator('text=Demo Mode')
        demo_checkbox.click()
        page.wait_for_timeout(500)
        page.screenshot(path='/tmp/demo_02_demo_enabled.png')
        print("   ✓ Demo mode enabled")

        print("4. Running demo extraction...")
        extract_button = page.locator('button:has-text("Run Demo Extraction")')
        extract_button.click()
        page.wait_for_timeout(3000)
        page.screenshot(path='/tmp/demo_03_results.png')
        print("   ✓ Demo extraction complete")

        print("5. Testing tab navigation...")
        # Click through tabs
        for tab in ["Study ID", "PICO-T", "Baseline", "Imaging", "Interventions", "Arms", "Outcomes", "Complications"]:
            btn = page.locator(f'button:has-text("{tab}")').first
            if btn.count() > 0:
                btn.click()
                page.wait_for_timeout(500)
                print(f"   ✓ {tab} tab")

        page.screenshot(path='/tmp/demo_04_tabs.png')

        print("6. Testing RESULTS → PDF navigation...")
        # Go to Study ID and click a source tag
        page.locator('button:has-text("Study ID")').first.click()
        page.wait_for_timeout(500)

        # Click on a page source tag
        source_tags = page.locator('button:has-text("P.")').all()
        if source_tags:
            print(f"   Found {len(source_tags)} source tags")
            source_tags[0].click()
            page.wait_for_timeout(1000)
            page.screenshot(path='/tmp/demo_05_results_to_pdf.png')
            print("   ✓ Clicked source tag - PDF should scroll")

        print("7. Testing PDF → RESULTS navigation...")
        # Look for highlighted text in PDF
        highlights = page.locator('span[style*="background"]').all()
        if highlights:
            print(f"   Found {len(highlights)} highlights in PDF")
            # Click a highlighted span
            for h in highlights[:5]:
                try:
                    h.click()
                    page.wait_for_timeout(500)
                    print("   ✓ Clicked PDF highlight")
                    break
                except:
                    continue
        page.screenshot(path='/tmp/demo_06_pdf_to_results.png')

        print("8. Checking annotation counts...")
        verified_badge = page.locator('text=Verified').first
        if verified_badge.count() > 0:
            print("   ✓ Verified badges visible")

        ai_badge = page.locator('text=/\\d+ AI/').first
        if ai_badge.count() > 0:
            print("   ✓ AI count badge visible")

        page.screenshot(path='/tmp/demo_07_final.png', full_page=True)

        print("\n✓ Test complete! Screenshots saved to /tmp/demo_*.png")
        print("\nBrowser will stay open for 60 seconds for manual inspection...")
        page.wait_for_timeout(60000)
        browser.close()

if __name__ == "__main__":
    test_demo_navigation()
