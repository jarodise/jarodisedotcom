---
name: wechat-to-blog
description: Scrape WeChat articles and publish them to a static blog (Astro-based). Use when the user wants to (1) fetch a WeChat article by URL and publish it to their blog, (2) convert WeChat content to markdown format, or (3) migrate WeChat posts to a static site. Preserves original titles and all images at correct positions.
---

# WeChat to Blog

Scrape WeChat articles and publish them to an Astro-based static blog.

## Workflow

### 1. Scrape WeChat Article

```bash
source .venv/bin/activate && python .agents/skills/wechat-to-blog/scripts/scrape_wechat.py "<WECHAT_URL>"
```

This outputs content with `IMAGE_URL_X` placeholders at exact positions.

### 2. Download Images

```bash
curl -sL "<image-url-from-scraper>" -o public/images/blog/descriptive-name.png
```

**CRITICAL:** Note which IMAGE_URL_X corresponds to which downloaded file.

### 3. Create Blog Post - FOOLPROOF METHOD

**DO NOT GUESS IMAGE POSITIONS. Use this exact method:**

```bash
# Read the scraped content
cat /tmp/wechat_content.txt
```

1. **Copy the content section** (everything after `--- CONTENT WITH IMAGE POSITIONS ---`)

2. **Find all IMAGE_URL_X placeholders**, e.g.:
   ```
   ![图片描述](IMAGE_URL_0)
   ![图片描述](IMAGE_URL_1)
   ```

3. **DO NOT MOVE ANYTHING.** Simply replace the placeholders with actual paths:
   ```
   ![图片描述](/images/blog/rick-rubin-1.png)
   ![图片描述](/images/blog/rick-rubin-2.jpg)
   ```

4. **Add frontmatter at the top:**
   ```yaml
   ---
   slug: <slug>
   title: <exact-title>
   description: <description>
   date: <YYYY-MM-DD>T12:00:00.000Z
   author: 数字游民Jarod
   tags:
     - <tag1>
     - <tag2>
   featured: false
   editable: true
   ---
   ```

5. **Add section headings** - Compare with original WeChat article and add `##` headings where needed (WeChat uses styled text, not HTML headings)

### 4. CRITICAL: Verification Steps

**MUST CHECK before committing:**

- [ ] **Image count matches**: Count `![` in your file = count of images downloaded
- [ ] **No IMAGE_URL_X left**: Search for `IMAGE_URL_` - should find 0 results
- [ ] **Image positions match scraper**: Open `/tmp/wechat_content.txt` side-by-side with your file, verify each image is at the same relative position
- [ ] **No duplicate paragraphs**: Read through once to check
- [ ] **Section headings present**: Compare structure with original WeChat article

### 5. Build and Push

```bash
npm run build
git add src/blog/<slug>.md public/images/blog/<images>
git commit -m "Add new post: <title>"
git push
```

---

## WHY IMAGES GET PLACED WRONG

**The #1 mistake:** Looking at the image filename/description and guessing where it should go.

**Example:** Image filename is "rick-rubin-johnny-cash.jpg" → "Johnny Cash is mentioned in paragraph 3, so I'll put it there."

**WRONG!** The image filename has NOTHING to do with its position. Only the scraper's `IMAGE_URL_X` placeholder tells you the correct position.

**Correct approach:** Ignore the filename. Look only at `IMAGE_URL_X` placeholder position in the scraped content. Replace it there and ONLY there.

---

## Common Issues

### Images at wrong positions
**Cause:** Guessing based on filename/content instead of following placeholders.
**Fix:** Use the foolproof method above - copy content and replace placeholders exactly where they are.

### No paragraph breaks (wall of text)
**Cause:** The scraper strips paragraph formatting, outputting text as one long line.
**Fix:** You MUST manually add paragraph breaks. Open the original WeChat article side-by-side and insert blank lines between paragraphs.

### Missing section headings
**Cause:** WeChat uses styled text, not HTML headings.
**Fix:** Open original WeChat article, manually identify section headings, add as `## Heading`.

### Duplicate content
**Fix:** Read through entire post, delete duplicates.

---

## Tag Guidelines

Use only existing tags: 数字游民, 思考哲学, 旅行旅居, 生活方式, 创业赚钱, 自我成长, 科技AI, 英语学习

Check with: `grep -h "^  - " src/blog/*.md | sort | uniq`
