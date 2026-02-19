#!/usr/bin/env python3
"""Scrape WeChat article content with images using Playwright"""

import asyncio
from playwright.async_api import async_playwright
import sys

async def scrape_wechat(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        try:
            await page.goto(url, wait_until='networkidle', timeout=60000)
            await asyncio.sleep(3)
            
            # Get title
            title_elem = await page.query_selector('h2.rich_media_title') or await page.query_selector('#activity_name')
            title = await title_elem.inner_text() if title_elem else ""
            title = title.strip() if title else ""
            
            # Get content
            content_elem = await page.query_selector('#js_content') or await page.query_selector('.rich_media_content')
            
            if content_elem:
                # Get all images
                images = await content_elem.query_selector_all('img')
                image_data = []
                for i, img in enumerate(images):
                    src = await img.get_attribute('data-src') or await img.get_attribute('src')
                    if src and src.startswith('http'):
                        alt = await img.get_attribute('alt') or f"image_{i}"
                        image_data.append({'src': src, 'alt': alt})
                
                # Get text content
                content_text = await content_elem.inner_text()
            else:
                content_text = ""
                image_data = []
            
            await browser.close()
            
            return {
                'title': title,
                'content_text': content_text,
                'images': image_data
            }
            
        except Exception as e:
            await browser.close()
            return {'error': str(e)}

if __name__ == '__main__':
    url = sys.argv[1] if len(sys.argv) > 1 else ''
    if not url:
        print("Usage: python scrape_wechat.py <WECHAT_URL>")
        sys.exit(1)
    
    result = asyncio.run(scrape_wechat(url))
    
    if 'error' in result:
        print(f"Error: {result['error']}")
        sys.exit(1)
    else:
        print(f"Title: {result['title']}")
        print(f"\n--- IMAGES ({len(result['images'])}) ---")
        for img in result['images']:
            print(f"{img['alt']}|{img['src']}")
        
        # Save to file
        with open('/tmp/wechat_content.txt', 'w', encoding='utf-8') as f:
            f.write(f"Title: {result['title']}\n")
            f.write(f"\n--- IMAGES ---\n")
            for img in result['images']:
                f.write(f"{img['alt']}|{img['src']}\n")
            f.write(f"\n--- CONTENT ---\n")
            f.write(result['content_text'])
        
        print(f"\nSaved to /tmp/wechat_content.txt")
