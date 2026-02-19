#!/usr/bin/env python3
"""Scrape WeChat article content with images at correct positions using Playwright"""

import asyncio
from playwright.async_api import async_playwright
import sys
import re

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
                # Get structured content with image positions
                # Use JS to extract content with markers for image positions
                content_with_images = await page.evaluate("""
                    () => {
                        const content = document.querySelector('#js_content') || document.querySelector('.rich_media_content');
                        if (!content) return null;
                        
                        // Clone to avoid modifying the page
                        const clone = content.cloneNode(true);
                        
                        // Replace images with placeholders
                        const images = clone.querySelectorAll('img');
                        const imageInfo = [];
                        images.forEach((img, index) => {
                            const src = img.getAttribute('data-src') || img.getAttribute('src');
                            if (src && src.startsWith('http')) {
                                imageInfo.push({
                                    index: index,
                                    src: src,
                                    alt: img.getAttribute('alt') || `image_${index}`
                                });
                                // Replace with placeholder
                                const placeholder = document.createElement('span');
                                placeholder.textContent = `<!-- IMAGE_PLACEHOLDER_${index} -->`;
                                img.parentNode.replaceChild(placeholder, img);
                            }
                        });
                        
                        // Get text with placeholders
                        let text = clone.inner_text || clone.textContent || '';
                        
                        return {
                            text: text,
                            images: imageInfo
                        };
                    }
                """)
                
                if content_with_images:
                    content_text = content_with_images['text']
                    image_data = content_with_images['images']
                else:
                    content_text = ""
                    image_data = []
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

def format_content_with_markdown(title, content_text, images):
    """Format content with markdown images at correct positions"""
    lines = []
    lines.append(f"Title: {title}")
    lines.append("")
    lines.append("--- IMAGES ---")
    for img in images:
        lines.append(f"[{img['index']}] {img['alt']}|{img['src']}")
    lines.append("")
    lines.append("--- CONTENT WITH IMAGE POSITIONS ---")
    lines.append("")
    
    # Replace placeholders with markdown image syntax
    content = content_text
    for img in images:
        placeholder = f"<!-- IMAGE_PLACEHOLDER_{img['index']} -->"
        markdown_img = f"\n![{img['alt']}](IMAGE_URL_{img['index']})\n"
        content = content.replace(placeholder, markdown_img)
    
    lines.append(content)
    return '\n'.join(lines)

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
            print(f"[{img['index']}] {img['alt']}|{img['src']}")
        
        # Save formatted content with image positions
        formatted = format_content_with_markdown(
            result['title'], 
            result['content_text'], 
            result['images']
        )
        
        with open('/tmp/wechat_content.txt', 'w', encoding='utf-8') as f:
            f.write(formatted)
        
        print(f"\nSaved to /tmp/wechat_content.txt")
        print("\nNOTE: The content file now shows IMAGE_URL_X placeholders where images should be inserted.")
        print("Replace IMAGE_URL_X with the actual local image paths when creating the blog post.")
