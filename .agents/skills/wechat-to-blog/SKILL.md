---
name: wechat-to-blog
description: When the user wants to publish a WeChat article to their blog jarodise.com, I will handle the entire workflow automatically. Just give me the WeChat URL (and optionally the title if known), and I will scrape, format, download images, create the blog post, build, commit and push.
triggers:
  - "publish this wechat article"
  - "post this wechat to my blog"
  - "convert this wechat article"
  - "https://mp.weixin.qq.com/s/"
---

# WeChat to Blog Publishing

When the user shares a WeChat article URL and wants it published to jarodise.com, I handle everything automatically.

## User Request Format

User says something like:

- "Publish this to my blog: https://mp.weixin.qq.com/s/xxxxx"
- "Post this WeChat article: https://mp.weixin.qq.com/s/xxxxx"
- Just shares a URL starting with https://mp.weixin.qq.com/

## My Workflow

### Step 1: Scrape the Article

Run the scraping script:

```bash
source .venv/bin/activate && python .agents/skills/wechat-to-blog/scripts/scrape_wechat.py "<WECHAT_URL>"
```

This gives me:

- Title (if extractable)
- Content with IMAGE_URL_X placeholders at correct positions
- List of images with URLs

### Step 2: Handle Title

If the scraper couldn't extract the title:

- Ask the user: "What's the title of this article?"
- Or extract from the first line if it's clearly a title

### Step 3: Generate Slug

**IMPORTANT:** Generate a short, clean, URL-friendly English slug based on the article content/topic. Do NOT use long pinyin slugs.

**Examples:**

- Title "新年伊始，我vibe code了一个能让任何人帮我朗读有声书的APP" → slug: `clonepub-audiobook-ai-app`
- Title "Emad Mostaque的《The Last Economy》" → slug: `emad-last-economy-ai-futures`
- Title "数字游民生活方式指南" → slug: `digital-nomad-lifestyle-guide`

**Rules:**

1. Extract the core topic/theme from the title/content
2. Use short English words (3-5 words max)
3. Lowercase with hyphens
4. Max 50 characters

**Never use full pinyin transliteration** - it creates unreadable URLs like `xin-nian-yi-shi-wo-vibe-code-liao-yi-ge-neng-rang-ren-he-ren-bang-wo-lang-du-you-sheng-shu-de-app-fu-xia-zai-lian-jie`

### Step 4: Download Images

For each image from the scraper:

```bash
curl -sL "<image-url>" -o public/images/blog/<slug>-<index>.<ext>
```

Use .png if the URL contains 'png', otherwise .jpg

### Step 5: Create Blog Post

Create file: `src/blog/<slug>.md`

Content structure:

```markdown
---
slug: <slug>
title: <exact-title-from-wechat>
description: <first-paragraph-of-content>
date: <YYYY-MM-DD>T12:00:00.000Z
author: 数字游民Jarod
tags:
  - <auto-selected-tag-1>
  - <auto-selected-tag-2>
featured: false
editable: true
---

<content-with-image-placeholders-replaced>

---

_本文系数字游民Jarod原创，如需转载请联系作者授权。_

_原文发表于微信公众号：数字游民部落_
```

**CRITICAL RULES:**

- Replace `IMAGE_URL_X` placeholders exactly where they appear - DO NOT MOVE IMAGES
- Keep all paragraph breaks from scraped content
- Preserve section structure
- **Convert section headings to `##` markdown format** - WeChat scraper returns plain text headings without markdown syntax. Identify section headings (typically standalone short phrases on their own line) and add `## ` prefix to format them properly

### Step 6: Auto-Select Tags

Based on content keywords, choose from:

- **科技AI**: AI, ChatGPT, 人工智能, code, algorithm, model, tech
- **思考哲学**: 哲学, 思考, 价值, 社会, 意义, 未来
- **数字游民**: 数字游民, 远程, 旅居, 旅行, nomad
- **生活方式**: 生活, 健康, 习惯, 日常
- **创业赚钱**: 创业, 商业, 收入, 赚钱, business
- **自我成长**: 成长, 学习, 读书, 进步
- **旅行旅居**: 旅行, 目的地, 签证, 国家
- **英语学习**: 英语, 英文, IELTS, 口语, 听力

Pick 2-3 most relevant tags.

### Step 7: Build

```bash
npm run build
```

If build fails, fix the issue (usually malformed frontmatter or missing images).

### Step 8: Commit and Push

```bash
git add -A
git commit -m "Add new post: <title>"
git push
```

### Step 9: Confirm to User

Tell user:

- "Published! URL: https://www.jarodise.com/<slug>"
- If there were any issues (title not found, images missing, etc.)

## Common Issues I Handle

### Title not extracted

WeChat loads title via JS which can fail. Solutions:

1. Ask user for title
2. Look at first line of content - if it looks like a title, use it

### Images fail to download

Try curl with retry, or report to user which images failed.

### Build errors

Usually:

- Special characters in title (escape them)
- Missing images (check paths)
- Malformed YAML (check indentation)

## Example Complete Session

User: "Publish this: https://mp.weixin.qq.com/s/xxxxx"

Me:

1. Run scrape script
2. Scraper returns title "Emad Mostaque的《The Last Economy》"
3. Generate slug: "emad-mostaque-de-the-last-economy"
4. Download 3 images to public/images/blog/
5. Create src/blog/emad-mostaque-de-the-last-economy.md with proper formatting
6. Auto-select tags: 科技AI, 思考哲学
7. Build succeeds
8. Commit and push
9. Tell user: "Done! Published at https://www.jarodise.com/emad-mostaque-de-the-last-economy"

## What I NEVER Do

- NEVER guess image positions based on filenames
- NEVER move images from where IMAGE_URL_X placeholders indicate
- NEVER modify the article title (use exact from WeChat)
- NEVER skip the build step
- NEVER commit without verifying build passes
