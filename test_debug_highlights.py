"""Debug: See exactly what's being highlighted"""
from playwright.sync_api import sync_playwright

def debug_highlights():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        logs = []
        page.on('console', lambda msg: logs.append(msg.text))

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

        # Count highlights per page
        print("=== HIGHLIGHT ANALYSIS ===\n")

        pages = page.locator('.page-container').all()
        total_highlights = 0

        for i, pg in enumerate(pages[:6], 1):
            all_spans = pg.locator('span[style*="background"]').all()
            count = len(all_spans)
            total_highlights += count

            if count > 0:
                print(f"Page {i}: {count} highlights")
                # Show first few highlight texts
                for j, span in enumerate(all_spans[:5]):
                    text = span.text_content()
                    title = span.get_attribute('title') or ''
                    print(f"  [{j+1}] '{text[:40]}...' → {title[:30]}")
                if count > 5:
                    print(f"  ... and {count - 5} more")
            print()

        print(f"TOTAL: {total_highlights} highlights across {len(pages)} pages")
        print("\nPROBLEM: Too many highlights = imprecise matching")

        browser.close()

if __name__ == "__main__":
    debug_highlights()
