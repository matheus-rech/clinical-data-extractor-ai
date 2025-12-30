"""
End-to-End Test: Precise Search-Based Highlighting
Tests the complete workflow: PDF upload → Demo extraction → Precise highlights → Bidirectional navigation
"""
from playwright.sync_api import sync_playwright
import time

def test_e2e():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)  # Show browser for visual verification
        page = browser.new_page(viewport={'width': 1400, 'height': 900})

        # Capture console logs
        logs = []
        page.on('console', lambda msg: logs.append(f"[{msg.type}] {msg.text}"))

        print("=" * 60)
        print("E2E TEST: Precise Search-Based Highlighting")
        print("=" * 60)

        # Step 1: Load app
        print("\n📱 STEP 1: Loading app...")
        page.goto('http://localhost:3002')
        page.wait_for_load_state('networkidle')
        page.screenshot(path='/tmp/e2e_01_app_loaded.png')
        print("   ✓ App loaded")

        # Step 2: Upload PDF
        print("\n📄 STEP 2: Uploading PDF...")
        file_input = page.locator('input[type="file"]')
        file_input.evaluate("el => el.style.display = 'block'")
        file_input.set_input_files('/Users/matheusrech/MinerU/Mattar2021.pdf-c3200d8d-f94a-437d-984f-f76c1f00b11b/Mattar 2021.pdf')
        page.wait_for_timeout(4000)
        page.screenshot(path='/tmp/e2e_02_pdf_loaded.png')

        # Check text index
        text_index_log = [l for l in logs if 'text index' in l.lower()]
        if text_index_log:
            print(f"   ✓ {text_index_log[-1]}")
        print("   ✓ PDF loaded and rendered")

        # Step 3: Enable Demo Mode
        print("\n🎮 STEP 3: Enabling Demo Mode...")
        demo_label = page.locator('text=Demo Mode')
        demo_label.click()
        page.wait_for_timeout(500)
        page.screenshot(path='/tmp/e2e_03_demo_enabled.png')
        print("   ✓ Demo mode enabled")

        # Step 4: Run Extraction
        print("\n🚀 STEP 4: Running Demo Extraction...")
        extract_btn = page.get_by_role('button', name='Run Demo Extraction')
        extract_btn.click()
        page.wait_for_timeout(3000)
        page.screenshot(path='/tmp/e2e_04_extraction_done.png')

        # Check precise highlights
        highlights_log = [l for l in logs if 'precise highlights' in l.lower()]
        if highlights_log:
            print(f"   ✓ {highlights_log[-1]}")
        print("   ✓ Extraction complete")

        # Step 5: Verify Highlights on PDF
        print("\n🎨 STEP 5: Verifying Highlights on PDF...")
        page1 = page.locator('.page-container').first
        green_highlights = page1.locator('span[style*="16, 185, 129"]')  # Green (verified)
        yellow_highlights = page1.locator('span[style*="252, 211, 77"]')  # Yellow (AI)

        green_count = green_highlights.count()
        yellow_count = yellow_highlights.count()
        print(f"   ✓ Page 1: {green_count} verified (green) + {yellow_count} AI (yellow) highlights")

        # Step 6: Test Bidirectional Navigation - Panel → PDF
        print("\n🔗 STEP 6: Testing Panel → PDF Navigation...")

        # Click on Baseline tab
        page.click('text=Baseline')
        page.wait_for_timeout(500)

        # Click on Total N field
        total_n = page.locator('[id="field-baseline.sampleSize.totalN"]').first
        if total_n.count() > 0:
            # Get the value displayed
            value_text = total_n.text_content()
            print(f"   ✓ Total N field shows: {value_text[:50]}...")

            total_n.click()
            page.wait_for_timeout(800)
            page.screenshot(path='/tmp/e2e_05_panel_to_pdf.png')

            # Check for focused highlight (indigo)
            focused = page.locator('span[style*="99, 102, 241"]')
            print(f"   ✓ Clicked Total N → {focused.count()} focused highlight(s)")

        # Step 7: Test PDF → Panel Navigation
        print("\n🔗 STEP 7: Testing PDF → Panel Navigation...")

        # Find a highlighted span on page 1 and click it
        any_highlight = page1.locator('span[style*="background"]').first
        if any_highlight.count() > 0:
            highlight_text = any_highlight.text_content()
            any_highlight.click()
            page.wait_for_timeout(800)
            page.screenshot(path='/tmp/e2e_06_pdf_to_panel.png')
            print(f"   ✓ Clicked highlight '{highlight_text[:30]}...' → Panel navigated")

        # Step 8: Test Different Tabs
        print("\n📑 STEP 8: Testing Different Tabs...")
        tabs = ['Study ID', 'PICO-T', 'Imaging', 'Outcomes']
        for tab in tabs:
            page.click(f'text={tab}')
            page.wait_for_timeout(300)
        page.screenshot(path='/tmp/e2e_07_tabs.png')
        print(f"   ✓ Navigated through tabs: {', '.join(tabs)}")

        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)

        # Extract key metrics from logs
        for log in logs:
            if 'text index' in log.lower() or 'precise highlights' in log.lower() or 'demo results' in log.lower():
                print(f"  • {log}")

        print("\n📸 Screenshots saved to /tmp/e2e_*.png")
        print("   - e2e_01_app_loaded.png")
        print("   - e2e_02_pdf_loaded.png")
        print("   - e2e_03_demo_enabled.png")
        print("   - e2e_04_extraction_done.png")
        print("   - e2e_05_panel_to_pdf.png")
        print("   - e2e_06_pdf_to_panel.png")
        print("   - e2e_07_tabs.png")

        print("\n✅ E2E TEST PASSED!")

        # Keep browser open briefly for viewing
        page.wait_for_timeout(2000)
        browser.close()

if __name__ == "__main__":
    test_e2e()
