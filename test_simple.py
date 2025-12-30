"""Simple test to check app loading"""
from playwright.sync_api import sync_playwright

def test_simple():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        console_logs = []
        page.on('console', lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        print("1. Loading app...")
        page.goto('http://localhost:3002')
        page.wait_for_timeout(3000)

        # Take screenshot
        page.screenshot(path='/tmp/app_load.png')
        print("   Screenshot saved to /tmp/app_load.png")

        # Print page title
        print(f"2. Page title: {page.title()}")

        # Check for any errors
        errors = [log for log in console_logs if 'error' in log.lower()]
        if errors:
            print("\n--- Errors ---")
            for err in errors:
                print(f"  {err}")

        # Check what's on the page
        body_text = page.locator('body').text_content()
        print(f"\n3. Page content preview: {body_text[:500] if body_text else 'Empty'}")

        browser.close()

if __name__ == "__main__":
    test_simple()
