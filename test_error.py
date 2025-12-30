"""Test to capture full error details"""
from playwright.sync_api import sync_playwright

def test_error():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture ALL console logs including errors
        logs = []
        page.on('console', lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
        page.on('pageerror', lambda err: logs.append(f"[PAGEERROR] {err}"))

        print("Loading app...")
        page.goto('http://localhost:3002')
        page.wait_for_timeout(5000)

        print("\n=== All Console Messages ===")
        for log in logs:
            print(log)

        browser.close()

if __name__ == "__main__":
    test_error()
