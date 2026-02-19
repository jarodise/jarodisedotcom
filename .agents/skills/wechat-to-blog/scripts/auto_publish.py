#!/usr/bin/env python3
"""Fully automated WeChat to blog publishing - one command does everything"""

import asyncio
import sys
import re
import subprocess
import json
from datetime import datetime
from pathlib import Path
from playwright.async_api import async_playwright

# Configuration
BLOG_DIR = Path("src/blog")
IMAGES_DIR = Path("public/images/blog")

async def scrape_wechat(url):
    """Scrape WeChat article with full formatting"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
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
                result = await page.evaluate("""
                    () => {
                        const content = document.querySelector('#js_content') || document.querySelector('.rich_media_content');
                        if (!content) return null;
                        
                        const clone = content.cloneNode(true);
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
                                const placeholder = document.createElement('span');
                                placeholder.textContent = `\\n<!-- IMAGE_${index} -->\\n`;
                                img.parentNode.replaceChild(placeholder, img);
                            }
                        });
                        
                        // Extract with paragraph structure
                        let paragraphs = [];
                        function extractText(element) {
                            const tagName = element.tagName?.toLowerCase();
                            const blockElements = ['p', 'div', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'];
                            const isBlock = blockElements.includes(tagName);
                            
                            if (element.nodeType === Node.ELEMENT_NODE && element.tagName === 'SPAN' && 
                                element.textContent.includes('<!-- IMAGE_')) {
                                return element.textContent;
                            }
                            
                            if (isBlock && element.children.length > 0) {
                                let text = '';
                                for (const child of element.childNodes) {
                                    text += extractText(child);
                                }
                                text = text.trim();
                                if (text) return text + '\\n\\n';
                                return '';
                            }
                            
                            if (element.nodeType === Node.TEXT_NODE) {
                                return element.textContent;
                            }
                            
                            if (element.nodeType === Node.ELEMENT_NODE) {
                                let text = '';
                                for (const child of element.childNodes) {
                                    text += extractText(child);
                                }
                                return text;
                            }
                            return '';
                        }
                        
                        let fullText = '';
                        for (const child of clone.childNodes) {
                            fullText += extractText(child);
                        }
                        
                        return {
                            text: fullText.trim().replace(/\\n{3,}/g, '\\n\\n'),
                            images: images
                        };
                    }
                """)
                
                await browser.close()
                return {'title': title, **result}
            else:
                await browser.close()
                return {'error': 'Could not find content'}
                
        except Exception as e:
            await browser.close()
            return {'error': str(e)}

def download_image(url, filepath):
    """Download image using curl"""
    try:
        subprocess.run(['curl', '-sL', url, '-o', str(filepath)], check=True)
        return filepath.stat().st_size > 0
    except:
        return False

def slugify(title):
    """Convert title to URL-friendly slug"""
    # Remove non-alphanumeric chars except Chinese
    slug = re.sub(r'[^\w\s\u4e00-\u9fff-]', '', title)
    # Replace spaces with hyphens
    slug = re.sub(r'\s+', '-', slug)
    # Convert to lowercase (for English parts)
    slug = slug.lower()
    # Remove multiple hyphens
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')[:80]

def generate_description(content):
    """Generate description from first paragraph"""
    lines = [l.strip() for l in content.split('\n') if l.strip()]
    if lines:
        first = lines[0]
        if len(first) > 200:
            return first[:197] + '...'
        return first
    return ""

def auto_select_tags(content, title):
    """Auto-select tags based on content keywords"""
    text = (title + ' ' + content).lower()
    tags = []
    
    tag_keywords = {
        '科技AI': ['ai', '人工智能', 'chatgpt', '模型', '算法', 'openai', 'deepseek', 'stable', 'digital', '技术', 'code', 'coding'],
        '思考哲学': ['哲学', '思考', '思维', '认知', '意义', '价值', '自由', '存在', '本质', 'framework', 'economy', '社会'],
        '数字游民': ['数字游民', '远程', '旅居', '旅行', '签证', 'location', 'nomad', 'freelance'],
        '生活方式': ['生活', '习惯', '健康', '饮食', '运动', '睡眠', 'routine'],
        '创业赚钱': ['创业', '赚钱', '商业', '生意', '收入', '财富', 'startup', 'business'],
        '自我成长': ['成长', '学习', '读书', '技能', '提升', '进步', 'productivity'],
        '旅行旅居': ['旅行', '旅游', '目的地', '国家', '城市', '住宿'],
        '英语学习': ['英语', '英文', 'ielts', '口语', '听力', 'learning']
    }
    
    for tag, keywords in tag_keywords.items():
        if any(kw in text for kw in keywords):
            tags.append(tag)
    
    # Default to 科技AI if no match
    if not tags:
        tags = ['科技AI']
    
    return tags[:3]

async def publish_article(url, manual_title=None):
    """Main publishing workflow"""
    print(f"🔄 Scraping article from {url}...")
    
    # Step 1: Scrape
    data = await scrape_wechat(url)
    if 'error' in data:
        print(f"❌ Error: {data['error']}")
        return
    
    title = data['title'] or manual_title
    content = data['text']
    images = data['images']
    
    if not title:
        # Try to extract from first line of content
        first_line = content.split('\n')[0].strip()
        if len(first_line) < 100 and ('：' in first_line or '?' in first_line or '？' in first_line or first_line.endswith('!') or first_line.endswith('！')):
            title = first_line
            # Remove title from content if found
            content = '\n'.join(content.split('\n')[1:]).strip()
        else:
            print("❌ Could not auto-extract title")
            print(f"   First line: {first_line[:50]}...")
            print("   Please provide title manually:")
            print(f"   python auto_publish.py '{url}' 'Your Title Here'")
            return
    
    print(f"✅ Title: {title}")
    print(f"✅ Found {len(images)} images")
    
    # Step 2: Generate metadata
    slug = slugify(title)
    description = generate_description(content)
    tags = auto_select_tags(content, title)
    date = datetime.now().strftime('%Y-%m-%dT12:00:00.000Z')
    
    print(f"✅ Generated slug: {slug}")
    print(f"✅ Auto-selected tags: {', '.join(tags)}")
    
    # Step 3: Download images
    print(f"\n🔄 Downloading images...")
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    image_mapping = {}
    
    for i, img in enumerate(images):
        ext = 'png' if 'png' in img['src'] else 'jpg'
        filename = f"{slug}-{i}.{ext}"
        filepath = IMAGES_DIR / filename
        
        if download_image(img['src'], filepath):
            print(f"  ✅ {filename}")
            image_mapping[f"<!-- IMAGE_{i} -->"] = f"/images/blog/{filename}"
        else:
            print(f"  ⚠️  Failed to download image {i}")
    
    # Step 4: Generate markdown
    print(f"\n🔄 Generating blog post...")
    
    # Replace image placeholders
    for placeholder, path in image_mapping.items():
        content = content.replace(placeholder, f"\n![图片]({path})\n")
    
    # Build frontmatter
    tags_yaml = '\n'.join([f'  - {tag}' for tag in tags])
    
    markdown = f"""---
slug: {slug}
title: {title}
description: {description}
date: {date}
author: 数字游民Jarod
tags:
{tags_yaml}
featured: false
editable: true
---

{content}

---

*本文系数字游民Jarod原创，如需转载请联系作者授权。*

*原文发表于微信公众号：数字游民部落*
"""
    
    # Step 5: Save file
    BLOG_DIR.mkdir(parents=True, exist_ok=True)
    filepath = BLOG_DIR / f"{slug}.md"
    filepath.write_text(markdown, encoding='utf-8')
    print(f"✅ Saved to {filepath}")
    
    # Step 6: Build
    print(f"\n🔄 Building site...")
    try:
        subprocess.run(['npm', 'run', 'build'], check=True, capture_output=True)
        print(f"✅ Build successful")
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Build failed: {e}")
        return
    
    # Summary
    print(f"\n{'='*50}")
    print(f"✅ Article published successfully!")
    print(f"   URL: https://www.jarodise.com/{slug}")
    print(f"   File: {filepath}")
    print(f"   Images: {len(image_mapping)}")
    print(f"\nNext step: git add . && git commit -m \"Add: {title[:50]}...\" && git push")
    print(f"{'='*50}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python auto_publish.py <WECHAT_URL> [TITLE]")
        print("\nExamples:")
        print('  python auto_publish.py "https://mp.weixin.qq.com/s/xxxxx"')
        print('  python auto_publish.py "https://mp.weixin.qq.com/s/xxxxx" "My Article Title"')
        sys.exit(1)
    
    url = sys.argv[1]
    manual_title = sys.argv[2] if len(sys.argv) > 2 else None
    asyncio.run(publish_article(url, manual_title))
