Implement the following plan:                                                                                      
                                                                                                                     
  # Hashnode to Astro (Ryze Theme) Migration Plan                                                                    
                                                                                                                     
  ## Overview                                                                                                        
                                                                                                                     
  Migrate 108 blog posts from Hashnode to an Astro static site using the Ryze theme, hosted on Cloudflare Pages      
  with images on Cloudflare R2.                                                                                      
                                                                                                                     
  **Key Decisions:**                                                                                                 
  - Author: `数字游民Jarod`                                                                                          
  - Images: Upload to Cloudflare R2 storage                                                                          
  - Tags: AI-generated from post content                                                                             
  - Descriptions: AI-generated summaries                                                                             
  - URLs: Preserve existing slugs (no changes)                                                                       
                                                                                                                     
  ---                                                                                                                
                                                                                                                     
  ## Phase 1: Project Setup                                                                                          
                                                                                                                     
  ### 1.1 Clone and Configure Ryze Theme                                                                             
  ```bash                                                                                                            
  cd /Users/jarodise/Documents/GitHub/jarodisedotcom                                                                 
  git clone https://github.com/8366888C/Ryze.git .                                                                   
  npm install                                                                                                        
  ```                                                                                                                
                                                                                                                     
  ### 1.2 Configure Site Settings                                                                                    
  - Edit `astro.config.mjs` with site URL (`https://jarodise.com`)                                                   
  - Update site metadata (title, description, social links)                                                          
                                                                                                                     
  ### 1.3 Set Up Cloudflare R2                                                                                       
  1. Log into Cloudflare Dashboard → R2 Object Storage                                                               
  2. Create new bucket: `jarodise-images`                                                                            
  3. Enable public access via custom domain or R2.dev subdomain                                                      
  4. Generate API credentials for upload script                                                                      
  5. Note the public URL pattern for image references                                                                
                                                                                                                     
  ---                                                                                                                
                                                                                                                     
  ## Phase 2: Content Migration Scripts                                                                              
                                                                                                                     
  ### 2.1 Create Migration Script (`scripts/migrate-posts.ts`)                                                       
                                                                                                                     
  **Frontmatter Transformation:**                                                                                    
  | Hashnode Field | Ryze Field | Transformation |                                                                   
  |----------------|------------|----------------|                                                                   
  | `title` | `title` | Direct copy |                                                                                
  | `slug` | `slug` | Direct copy |                                                                                  
  | `datePublished` | `date` | Parse to Date object |                                                                
  | `cover` | (embedded) | Transform to R2 URL |                                                                     
  | - | `description` | AI-generate from content |                                                                   
  | - | `author` | Set to `数字游民Jarod` |                                                                          
  | - | `tags` | AI-generate from content |                                                                          
  | - | `featured` | Set to `false` |                                                                                
  | - | `editable` | Set to `true` |                                                                                 
                                                                                                                     
  ### 2.2 Create Image Migration Script (`scripts/migrate-images.ts`)                                                
  1. Parse all markdown files for image URLs                                                                         
  2. Download images from `cdn.hashnode.com`                                                                         
  3. Upload to Cloudflare R2                                                                                         
  4. Return mapping of old URL → new R2 URL                                                                          
                                                                                                                     
  ### 2.3 Create AI Enhancement Script (`scripts/enhance-posts.ts`)                                                  
  For each post:                                                                                                     
  1. Send content to Claude API                                                                                      
  2. Generate: description (150-200 chars), tags (3-5 relevant tags)                                                 
  3. Return structured metadata                                                                                      
                                                                                                                     
  ---                                                                                                                
                                                                                                                     
  ## Phase 3: Execute Migration                                                                                      
                                                                                                                     
  ### 3.1 Image Migration                                                                                            
  ```bash                                                                                                            
  # Run image migration first                                                                                        
  npx ts-node scripts/migrate-images.ts                                                                              
  # Output: image-mapping.json with old→new URL pairs                                                                
  ```                                                                                                                
                                                                                                                     
  ### 3.2 Content Migration                                                                                          
  ```bash                                                                                                            
  # Transform and migrate posts                                                                                      
  npx ts-node scripts/migrate-posts.ts                                                                               
  # Reads: hashnode/*.md                                                                                             
  # Writes: src/blog/*.md (with transformed frontmatter and updated image URLs)                                      
  ```                                                                                                                
                                                                                                                     
  ### 3.3 AI Enhancement                                                                                             
  ```bash                                                                                                            
  # Generate descriptions and tags                                                                                   
  npx ts-node scripts/enhance-posts.ts                                                                               
  # Updates: src/blog/*.md with AI-generated metadata                                                                
  ```                                                                                                                
                                                                                                                     
  ---                                                                                                                
                                                                                                                     
  ## Phase 4: Theme Customization                                                                                    
                                                                                                                     
  ### 4.1 Update content.config.ts                                                                                   
  - Verify schema matches our frontmatter                                                                            
  - Add any custom fields if needed                                                                                  
                                                                                                                     
  ### 4.2 Customize Components                                                                                       
  - Update `src/components/Header.astro` with site branding                                                          
  - Modify `src/components/Footer.astro` with social links                                                           
  - Adjust styling in `src/styles/global.css` if needed                                                              
                                                                                                                     
  ### 4.3 Update Static Assets                                                                                       
  - Replace favicon                                                                                                  
  - Update any branding assets                                                                                       
                                                                                                                     
  ---                                                                                                                
                                                                                                                     
  ## Phase 5: Cloudflare Pages Deployment                                                                            
                                                                                                                     
  ### 5.1 Connect Repository                                                                                         
  1. Push to GitHub repository                                                                                       
  2. Go to Cloudflare Pages → Create a project                                                                       
  3. Connect GitHub repository                                                                                       
  4. Configure build settings:                                                                                       
  - Build command: `npm run build`                                                                                   
  - Build output directory: `dist`                                                                                   
  - Node version: 18+                                                                                                
                                                                                                                     
  ### 5.2 Configure Custom Domain                                                                                    
  1. In Cloudflare Pages → Custom domains                                                                            
  2. Add `jarodise.com` (already on Cloudflare DNS)                                                                  
  3. Cloudflare will auto-configure DNS records                                                                      
                                                                                                                     
  ### 5.3 Environment Variables                                                                                      
  - Set any required API keys for build                                                                              
                                                                                                                     
  ---                                                                                                                
                                                                                                                     
  ## Critical Files                                                                                                  
                                                                                                                     
  | File | Purpose |                                                                                                 
  |------|---------|                                                                                                 
  | `/Users/jarodise/Documents/GitHub/jarodisedotcom/hashnode/*.md` | Source posts (108 files) |                     
  | `src/blog/*.md` | Migrated posts destination |                                                                   
  | `src/content.config.ts` | Content schema definition |                                                            
  | `astro.config.mjs` | Site configuration |                                                                        
  | `scripts/migrate-posts.ts` | Post migration script |                                                             
  | `scripts/migrate-images.ts` | Image migration script |                                                           
  | `scripts/enhance-posts.ts` | AI metadata generation |                                                            
                                                                                                                     
  ---                                                                                                                
                                                                                                                     
  ## Verification Checklist                                                                                          
                                                                                                                     
  ### Local Testing                                                                                                  
  - [ ] Run `npm run dev` and verify site loads                                                                      
  - [ ] Check all 108 posts are accessible                                                                           
  - [ ] Verify images load from R2                                                                                   
  - [ ] Test navigation and pagination                                                                               
  - [ ] Confirm URLs match original slugs (e.g., `/will-ai-replace-coders-and-software-engineers`)                   
  - [ ] Test dark/light mode toggle                                                                                  
                                                                                                                     
  ### Production Testing                                                                                             
  - [ ] Deploy to Cloudflare Pages                                                                                   
  - [ ] Verify custom domain works                                                                                   
  - [ ] Test SSL certificate                                                                                         
  - [ ] Check all post URLs work                                                                                     
  - [ ] Verify image loading performance                                                                             
  - [ ] Test on mobile devices                                                                                       
                                                                                                                     
  ### SEO/Redirects                                                                                                  
  - [ ] Verify meta tags are correct                                                                                 
  - [ ] Confirm canonical URLs are set                                                                               
  - [ ] Test OpenGraph/Twitter cards                                                                                 
                                                                                                                     
  ---                                                                                                                
                                                                                                                     
  ## Rollback Plan                                                                                                   
                                                                                                                     
  If issues arise:                                                                                                   
  1. Keep Hashnode site running until migration is verified                                                          
  2. Don't change DNS until Cloudflare Pages site is confirmed working                                               
  3. Original markdown files preserved in `hashnode/` folder                                                         
                                                                                                                     
  ---                                                                                                                
                                                                                                                     
  ## Estimated Post-Migration Cleanup                                                                                
                                                                                                                     
  - Remove `hashnode/` folder after verification                                                                     
  - Remove migration scripts                                                                                         
  - Set up GitHub Actions for auto-deploy (optional)                                                                 
                                                                 