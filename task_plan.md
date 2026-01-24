# Hashnode to Astro (Ryze Theme) Migration Plan

## Goal
Migrate 108 blog posts from Hashnode to an Astro static site using the Ryze theme, hosted on Cloudflare Pages with images on Cloudflare R2.

## Key Decisions
- Author: `数字游民Jarod`
- Images: Upload to Cloudflare R2 storage
- Tags: AI-generated from post content
- Descriptions: AI-generated summaries
- URLs: Preserve existing slugs (no changes)

---

## Phases

### Phase 1: Project Setup `[complete]`
- [x] Clone Ryze theme to `/Users/jarodise/Documents/GitHub/jarodisedotcom`
- [x] Run `npm install`
- [x] Configure `astro.config.mjs` with site URL
- [ ] Set up Cloudflare R2 bucket `jarodise-images`

### Phase 2: Content Migration Scripts `[complete]`
- [x] Create `scripts/migrate-posts.ts` - frontmatter transformation
- [x] Create `scripts/migrate-images.ts` - image download/upload to R2
- [x] Create `scripts/enhance-posts.ts` - AI-generated descriptions/tags

### Phase 3: Execute Migration `[complete]`
- [x] Run migrate-posts.ts - 108 posts migrated to `src/blog/`
- [x] Site builds successfully (155 pages)
- [ ] Image migration to R2 (status unknown)
- [ ] AI enhancement (descriptions/tags) (status unknown)

### Phase 4: Theme Customization `[in_progress]`
- [ ] Update `src/content.config.ts` - verify schema matches frontmatter
- [ ] Customize `src/components/Header.astro` - site branding
- [ ] Customize `src/components/Footer.astro` - social links
- [ ] Adjust styling in `src/styles/global.css` if needed
- [ ] Replace favicon and branding assets

### Phase 5: Cloudflare Pages Deployment `[pending]`
- [ ] Push to GitHub repository
- [ ] Connect to Cloudflare Pages
- [ ] Configure build settings (npm run build, dist)
- [ ] Add custom domain `jarodise.com`
- [ ] Set environment variables if needed

---

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none logged yet) | | |

---

## Critical Files
| File | Purpose |
|------|---------|
| `hashnode/*.md` | Source posts (108 files) |
| `src/blog/*.md` | Migrated posts destination |
| `src/content.config.ts` | Content schema definition |
| `astro.config.mjs` | Site configuration |
| `scripts/migrate-posts.ts` | Post migration script |
| `scripts/migrate-images.ts` | Image migration script |
| `scripts/enhance-posts.ts` | AI metadata generation |

---

## Verification Checklist
### Local Testing
- [x] Run `npm run dev` and verify site loads
- [x] Build succeeds (155 pages)
- [ ] All 108 posts accessible
- [ ] Images load from R2
- [ ] Navigation and pagination work
- [ ] Dark/light mode toggle works

### Production Testing
- [ ] Deploy to Cloudflare Pages
- [ ] Custom domain works
- [ ] SSL certificate valid
- [ ] All post URLs work
- [ ] Image loading performance OK
- [ ] Mobile responsive
