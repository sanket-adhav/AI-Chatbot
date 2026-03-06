from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        
        # Listen for console logs
        page.on("console", lambda msg: print(f"CONSOLE {msg.type}: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))
        
        print("Navigating to login...")
        page.goto("http://localhost:5173/login")
        
        try:
            print("Logging in...")
            page.fill("input[placeholder='your@email.com']", "testuser@example.com")
            page.fill("input[placeholder='••••••••']", "password")
            page.locator("button[type='submit']").click()
        except:
            pass # might already be authenticated
        
        page.wait_for_timeout(2000)
        
        print("Starting chat...")
        try:
            page.click(".landing-avatar-wrapper")
            page.wait_for_timeout(1000)
            page.click("button:has-text('Start Chat')")
            print("Chat started. Waiting to see if crash occurs...")
            page.wait_for_timeout(4000)
        except Exception as e:
            print(f"Failed to start chat: {e}")
        
        
        
        browser.close()
        print("Done!")

if __name__ == "__main__":
    run()
