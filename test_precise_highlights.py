"""Test precise search-based highlighting (Ctrl+F approach)"""
from playwright.sync_api import sync_playwright
import time

def test_precise_highlighting():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        console_logs = []
        page.on('console', lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        print("1. Loading app...")
        page.goto('http://localhost:3002')
        page.wait_for_load_state('networkidle')

        print("2. Uploading PDF...")
        # The file input is hidden, need to make it visible or use force
        file_input = page.locator('input[type="file"]')
        # Force upload even though input is hidden
        file_input.evaluate("el => el.style.display = 'block'")
        file_input.set_input_files('/Users/matheusrech/MinerU/Mattar2021.pdf-c3200d8d-f94a-437d-984f-f76c1f00b11b/Mattar 2021.pdf')

        # Wait for PDF to load and text index to build
        page.wait_for_timeout(3000)

        print("3. Checking text index build...")
        # Look for the console log about text index
        text_index_log = [log for log in console_logs if 'text index' in log.lower()]
        if text_index_log:
            print(f"   ✓ {text_index_log[-1]}")
        else:
            print("   ⚠ No text index log found yet")

        print("4. Enabling demo mode...")
        demo_checkbox = page.locator('text=Demo Mode').locator('..')
        demo_checkbox.click()

        print("5. Running demo extraction...")
        extract_btn = page.get_by_role('button', name='Run Demo Extraction')
        extract_btn.click()

        # Wait for demo extraction
        page.wait_for_timeout(2500)

        print("6. Checking precise highlights...")
        # Look for precise highlights console log
        precise_log = [log for log in console_logs if 'precise highlights' in log.lower()]
        if precise_log:
            print(f"   ✓ {precise_log[-1]}")
        else:
            print("   ⚠ No precise highlights log found")

        # Check for highlights on page 1
        page1_container = page.locator('.page-container').first
        highlighted_spans = page1_container.locator('span[style*="background"]')
        highlight_count = highlighted_spans.count()

        print(f"7. Found {highlight_count} highlighted spans on page 1")

        # Test bidirectional navigation - click on Total N field
        print("8. Testing bidirectional navigation...")
        page.click('text=Baseline')  # Switch to Baseline tab
        page.wait_for_timeout(500)

        # Click on Total N field
        total_n_field = page.locator('[id="field-baseline.sampleSize.totalN"]').first
        if total_n_field.count() > 0:
            total_n_field.click()
            page.wait_for_timeout(500)
            print("   ✓ Clicked on Total N field")

            # Check if a highlight is now focused (indigo color)
            focused_highlights = page.locator('span[style*="99, 102, 241"]')
            focused_count = focused_highlights.count()
            print(f"   ✓ Found {focused_count} focused highlight(s)")
        else:
            print("   ⚠ Could not find Total N field")

        # Print all console logs for debugging
        print("\n--- Console Logs ---")
        for log in console_logs[-15:]:
            print(f"  {log}")

        # Take screenshot
        page.screenshot(path='/tmp/precise_highlights_test.png', full_page=True)
        print("\n✓ Screenshot saved to /tmp/precise_highlights_test.png")

        browser.close()
        print("\n✓ Test completed!")

if __name__ == "__main__":
    test_precise_highlighting()
