#!/usr/bin/env python3
"""Generate blog post markdown from scraped WeChat content with correct image positions"""

import sys
import re
from datetime import datetime
from pathlib import Path

def generate_blog_post(content_file, slug, title, description, tags, image_mapping, date=None):
    """
    Generate blog post markdown from scraped content.
    
    Args:
        content_file: Path to /tmp/wechat_content.txt
        slug: URL-friendly slug
        title: Post title
        description: Post description
        tags: List of tags
        image_mapping: Dict mapping IMAGE_URL_X to local path, e.g. {"IMAGE_URL_0": "/images/blog/rick-rubin-1.png"}
        date: Optional ISO date string
    """
    
    with open(content_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    match = re.search(r'--- CONTENT WITH IMAGE POSITIONS ---\n\n(.+)', content, re.DOTALL)
    if not match:
        # Fallback for simple content
        body = content.split('--- CONTENT WITH IMAGE POSITIONS ---')[-1].strip()
    else:
        body = match.group(1)
    
    # Replace IMAGE_URL_X placeholders with actual markdown images
    for placeholder, local_path in image_mapping.items():
        # Extract alt text from the markdown that follows the placeholder
        pattern = rf'!\[(.*?)\]\({placeholder}\)'
        matches = re.findall(pattern, body)
        for alt_text in matches:
            old_md = f'![{alt_text}]({placeholder})'
            new_md = f'![{alt_text}]({local_path})'
            body = body.replace(old_md, new_md)
    
    # Format tags
    tags_yaml = '\n'.join([f'  - {tag}' for tag in tags])
    
    # Generate frontmatter
    if not date:
        date = datetime.now().strftime('%Y-%m-%dT12:00:00.000Z')
        
    frontmatter = f"""---
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

"""
    
    return frontmatter + body

def extract_images_from_content(content_file):
    """Extract image info from scraped content"""
    with open(content_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    images = []
    in_images_section = False
    
    for line in content.split('\n'):
        if line.startswith('--- IMAGES ---'):
            in_images_section = True
            continue
        if in_images_section and line.startswith('---'):
            break
        if in_images_section and line.startswith('['):
            # Parse line like: [0] alt text|https://...
            match = re.match(r'\[(\d+)\] (.+)\|(.+)', line)
            if match:
                images.append({
                    'index': int(match.group(1)),
                    'alt': match.group(2),
                    'url': match.group(3)
                })
    
    return images

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python generate_blog_post.py <content_file>")
        print("\nThis script reads scraped WeChat content and generates blog post markdown.")
        print("You need to provide image mappings separately.")
        sys.exit(1)
    
    content_file = sys.argv[1]
    
    # Extract and display images
    images = extract_images_from_content(content_file)
    
    print(f"Found {len(images)} images:")
    for img in images:
        print(f"  IMAGE_URL_{img['index']}: {img['alt']}")
        print(f"    URL: {img['url']}")
    
    print("\n--- COPY THIS TEMPLATE ---")
    print("python generate_blog_post.py \"")
    print(f"  --slug YOUR_SLUG \\")
    print(f"  --title 'YOUR_TITLE' \\")
    print(f"  --description 'YOUR_DESCRIPTION' \\")
    print(f"  --tags tag1 tag2 tag3 \\")
    print(f"  --content-file {content_file} \\")
    for img in images:
        print(f"  --image {img['index']} /images/blog/filename{img['index']}.png \\")
    print("\" > src/blog/YOUR_SLUG.md")
