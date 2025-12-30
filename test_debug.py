#!/usr/bin/env python3
"""Debug test - capture console errors and test extraction."""

from playwright.sync_api import sync_playwright
import time

PDF_PATH = "/Users/matheusrech/MinerU/Mattar2021.pdf-c3200d8d-f94a-437d-984f-f76c1f00b11b/Mattar 2021.pdf"
APP_URL = "http://localhost:3001"

def test_with_debug():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.set_viewport_size({"width": 1400, "height": 900})

        # Capture console messages
        console_messages = []
        page.on("console", lambda msg: console_messages.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: console_messages.append(f"[PAGE ERROR] {err}"))

        print("1. Loading app...")
        page.goto(APP_URL)
        page.wait_for_load_state('networkidle')
        print("   ✓ App loaded")

        print("2. Uploading PDF...")
        file_input = page.locator('input[type="file"]')
        file_input.set_input_files(PDF_PATH)
        page.wait_for_timeout(5000)
        print("   ✓ PDF uploaded")

        print("3. Checking button state...")
        button = page.locator('button:has-text("Automate Full Agentic Extraction")')
        is_disabled = button.is_disabled()
        print(f"   Button disabled: {is_disabled}")

        print("4. Clicking extraction button...")
        button.click()
        print("   ✓ Button clicked")

        # Wait and monitor
        print("5. Monitoring for 60 seconds...")
        for i in range(12):
            page.wait_for_timeout(5000)
            page.screenshot(path=f'/tmp/debug_{i:02d}.png')
            print(f"   [{(i+1)*5}s] Screenshot saved")

            # Check for loading indicator
            loader = page.locator('.animate-spin').count()
            if loader > 0:
                print(f"   [{(i+1)*5}s] Loading indicator visible")

            # Check for results
            study_id_btn = page.locator('button:has-text("Study ID")').count()
            if study_id_btn > 0:
                print(f"   [{(i+1)*5}s] ✓ Results appeared!")
                break

        print("\n=== Console Messages ===")
        for msg in console_messages[-30:]:
            print(msg)

        page.screenshot(path='/tmp/debug_final.png')
        print("\n6. Keeping browser open for 30s...")
        page.wait_for_timeout(30000)
        browser.close()

if __name__ == "__main__":
    test_with_debug()
