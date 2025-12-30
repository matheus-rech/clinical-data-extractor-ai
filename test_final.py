"""Final test showing precise highlights"""
from playwright.sync_api import sync_playwright

def test_final():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page(viewport={'width': 1400, 'height': 900})

        page.goto('http://localhost:3002')
        page.wait_for_load_state('networkidle')

        # Upload PDF
        file_input = page.locator('input[type="file"]')
        file_input.evaluate("el => el.style.display = 'block'")
        file_input.set_input_files('/Users/matheusrech/MinerU/Mattar2021.pdf-c3200d8d-f94a-437d-984f-f76c1f00b11b/Mattar 2021.pdf')
        page.wait_for_timeout(3000)

        # Enable demo and extract
        page.click('text=Demo Mode')
        page.wait_for_timeout(300)
        page.click('button:has-text("Run Demo")')
        page.wait_for_timeout(2500)

        # Screenshot page 1
        page.screenshot(path='/tmp/final_page1.png')
        print("Screenshot 1: Page 1 with highlights → /tmp/final_page1.png")

        # Click a highlight to test navigation
        highlight = page.locator('span[style*="16, 185, 129"]').first  # Green highlight
        if highlight.count() > 0:
            highlight.click()
            page.wait_for_timeout(500)
            page.screenshot(path='/tmp/final_clicked.png')
            print("Screenshot 2: After clicking highlight → /tmp/final_clicked.png")

        # Show the data panel
        page.click('text=Study ID')
        page.wait_for_timeout(500)
        page.screenshot(path='/tmp/final_panel.png')
        print("Screenshot 3: Study ID panel → /tmp/final_panel.png")

        print("\n✓ Done! View screenshots in /tmp/")
        page.wait_for_timeout(2000)
        browser.close()

if __name__ == "__main__":
    test_final()
