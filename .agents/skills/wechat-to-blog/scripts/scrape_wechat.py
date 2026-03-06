#!/usr/bin/env python3
"""Scrape WeChat article content with images at correct positions using Playwright"""

import os
import asyncio
from playwright.async_api import async_playwright
import sys
import re

async def download_image(context, url, path):
    try:
        response = await context.request.get(url)
        if response.status == 200:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'wb') as f:
                f.write(await response.body())
            return True
    except Exception as e:
        print(f"Error downloading {url}: {e}")
    return False

async def scrape_wechat(url, slug=None):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        try:
            max_retries = 3
            retry_count = 0
            while retry_count < max_retries:
                try:
                    await page.goto(url, wait_until='networkidle', timeout=60000)
                    break
                except Exception as e:
                    retry_count += 1
                    if retry_count == max_retries:
                        raise e
                    await asyncio.sleep(2 * retry_count)
            await asyncio.sleep(3)
            
            # Get title - try multiple selectors
            title = ""
            title_selectors = [
                'h1.rich_media_title',
                'h2.rich_media_title', 
                '#activity_name',
                '.rich_media_title',
                '#js_panel_card .rich_media_title',
                'meta[property="og:title"]',
                'meta[name="twitter:title"]',
                'title'
            ]
            
            for selector in title_selectors:
                try:
                    if selector.startswith('meta'):
                        elem = await page.query_selector(selector)
                        if elem:
                            title = await elem.get_attribute('content') or ""
                    else:
                        elem = await page.query_selector(selector)
                        if elem:
                            title = await elem.inner_text()
                    title = title.strip() if title else ""
                    if title and title != '微信公众平台':
                        break
                except:
                    continue
            
            # Fallback: try to get from page title
            if not title or title == '微信公众平台':
                page_title = await page.title()
                if page_title and '微信公众平台' not in page_title:
                    # Page title usually has format "文章标题" or "文章标题 | 公众号名"
                    title = page_title.split('|')[0].strip().strip('"')
            
            title = title.strip() if title else ""
            
            # Get content with proper structure
            content_elem = await page.query_selector('#js_content') or await page.query_selector('.rich_media_content')
            
            if content_elem:
                # Extract structured content preserving paragraphs
                result = await page.evaluate("""
                    () => {
                        const content = document.querySelector('#js_content') || document.querySelector('.rich_media_content');
                        if (!content) return null;
                        
                        // Clone to avoid modifying the page
                        const clone = content.cloneNode(true);
                        
                        // Get all images first
                        const images = [];
                        const imgElements = clone.querySelectorAll('img');
                        imgElements.forEach((img, index) => {
                            const src = img.getAttribute('data-src') || img.getAttribute('src');
                            if (src && src.startsWith('http')) {
                                images.push({
                                    index: index,
                                    src: src,
                                    alt: img.getAttribute('alt') || `image_${index}`
                                });
                                // Replace with placeholder
                                const placeholder = document.createElement('span');
                                placeholder.textContent = `\\n<!-- IMAGE_PLACEHOLDER_${index} -->\\n`;
                                img.parentNode.replaceChild(placeholder, img);
                            }
                        });
                        
                        // Extract text preserving paragraph structure
                        // Walk through all elements and collect text with proper breaks
                        let paragraphs = [];
                        
                        function extractTextWithStructure(element) {
                            const tagName = element.tagName?.toLowerCase();
                            
                            // Block elements that should create new paragraphs
                            const blockElements = ['p', 'div', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'];
                            const isBlock = blockElements.includes(tagName);
                            
                            // Image placeholders
                            if (element.nodeType === Node.ELEMENT_NODE && element.tagName === 'SPAN' && 
                                element.textContent.startsWith('<!-- IMAGE_PLACEHOLDER_')) {
                                return element.textContent;
                            }
                            
                            // For block elements, process children and wrap with newlines
                            if (isBlock && element.children.length > 0) {
                                let text = '';
                                for (const child of element.childNodes) {
                                    text += extractTextWithStructure(child);
                                }
                                // Clean up the text
                                text = text.trim();
                                if (text) {
                                    return text + '\\n\\n';
                                }
                                return '';
                            }
                            
                            // For text nodes, return the text
                            if (element.nodeType === Node.TEXT_NODE) {
                                return element.textContent;
                            }
                            
                            // For inline elements, process children
                            if (element.nodeType === Node.ELEMENT_NODE) {
                                let text = '';
                                for (const child of element.childNodes) {
                                    text += extractTextWithStructure(child);
                                }
                                return text;
                            }
                            
                            return '';
                        }
                        
                        // Process all direct children of the content container
                        let fullText = '';
                        for (const child of clone.childNodes) {
                            fullText += extractTextWithStructure(child);
                        }
                        
                        // Clean up excessive newlines
                        fullText = fullText.replace(/\\n{3,}/g, '\\n\\n');
                        
                        return {
                            text: fullText.trim(),
                            images: images
                        };
                    }
                """)
                
                if result:
                    content_text = result['text']
                    image_data = result['images']
                else:
                    content_text = ""
                    image_data = []
            else:
                content_text = ""
                image_data = []
            
            # Download images if slug is provided
            if slug:
                for img in image_data:
                    ext = 'png' if 'png' in img['src'].lower() else 'jpg'
                    img_path = f"public/images/blog/{slug}-{img['index']}.{ext}"
                    print(f"Downloading image {img['index']} to {img_path}...")
                    success = await download_image(context, img['src'], img_path)
                    if success:
                        img['local_path'] = img_path
                    else:
                        print(f"Failed to download image {img['index']}")
            
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
        path = img.get('local_path', img['src'])
        lines.append(f"[{img['index']}] {img['alt']}|{path}")
    lines.append("")
    lines.append("--- CONTENT WITH IMAGE POSITIONS ---")
    lines.append("")
    
    # Replace placeholders with markdown image syntax
    content = content_text
    for img in images:
        placeholder = f"<!-- IMAGE_PLACEHOLDER_{img['index']} -->"
        path = img.get('local_path', f"IMAGE_URL_{img['index']}")
        markdown_img = f"\n![{img['alt']}]({path})\n"
        content = content.replace(placeholder, markdown_img)
    
    lines.append(content)
    return '\n'.join(lines)

if __name__ == '__main__':
    url = sys.argv[1] if len(sys.argv) > 1 else ''
    slug = sys.argv[2] if len(sys.argv) > 2 else None
    
    if not url:
        print("Usage: python scrape_wechat.py <WECHAT_URL> [SLUG]")
        sys.exit(1)
    
    result = asyncio.run(scrape_wechat(url, slug))
    
    if 'error' in result:
        print(f"Error: {result['error']}")
        sys.exit(1)
    else:
        print(f"Title: {result['title']}")
        print(f"\n--- IMAGES ({len(result['images'])}) ---")
        for img in result['images']:
            path = img.get('local_path', 'No local path')
            print(f"[{img['index']}] {img['alt']}|{path}")
        
        # Save formatted content with image positions
        formatted = format_content_with_markdown(
            result['title'], 
            result['content_text'], 
            result['images']
        )
        
        with open('/tmp/wechat_content.txt', 'w', encoding='utf-8') as f:
            f.write(formatted)
        
        print(f"\nSaved to /tmp/wechat_content.txt")
