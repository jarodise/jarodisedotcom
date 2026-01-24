import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

const BLOG_DIR = path.join(process.cwd(), "src/blog");
const IMAGE_DIR = path.join(process.cwd(), "src/images");
const MAPPING_FILE = path.join(process.cwd(), "scripts/image-mapping.json");

// Cloudflare R2 configuration - set these via environment variables
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "jarodise-images";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ""; // e.g., https://images.jarodise.com

interface ImageMapping {
  [originalUrl: string]: string;
}

function extractImageUrls(content: string): string[] {
  const urls: string[] = [];

  // Match markdown images: ![alt](url)
  const mdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = mdRegex.exec(content)) !== null) {
    urls.push(match[2]);
  }

  // Match cover images in frontmatter
  const coverRegex = /cover:\s*(.+)/;
  const coverMatch = content.match(coverRegex);
  if (coverMatch) {
    urls.push(coverMatch[1].trim());
  }

  // Filter to hashnode CDN and zhimg URLs
  return urls.filter(
    (url) =>
      url.includes("cdn.hashnode.com") ||
      url.includes("res/hashnode/image") ||
      url.includes("zhimg.com")
  );
}

function downloadImage(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);

    protocol
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirects
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            fs.unlinkSync(dest);
            downloadImage(redirectUrl, dest).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`HTTP ${response.statusCode} for ${url}`));
          return;
        }

        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        file.close();
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest);
        }
        reject(err);
      });
  });
}

function getExtensionFromUrl(url: string): string {
  // Try to extract extension from URL
  const urlPath = new URL(url).pathname;
  const ext = path.extname(urlPath);
  if (ext && [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext.toLowerCase())) {
    return ext;
  }
  // Default to .jpg if no extension found
  return ".jpg";
}

function generateImageFilename(url: string, index: number): string {
  // Extract meaningful name from URL or generate one
  const urlPath = new URL(url).pathname;
  const segments = urlPath.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1] || `image-${index}`;
  const ext = getExtensionFromUrl(url);

  // Clean up the filename
  let filename = lastSegment.replace(/[^a-zA-Z0-9-_]/g, "-");
  if (!filename.endsWith(ext)) {
    filename = filename + ext;
  }

  return filename;
}

async function downloadAllImages(): Promise<ImageMapping> {
  // Ensure image directory exists
  if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
  }

  const mapping: ImageMapping = {};
  const allUrls = new Set<string>();

  // Collect all image URLs from all posts
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const content = fs.readFileSync(path.join(BLOG_DIR, file), "utf-8");
    const urls = extractImageUrls(content);
    urls.forEach((url) => allUrls.add(url));
  }

  console.log(`Found ${allUrls.size} unique images to download\n`);

  let index = 0;
  // Parallel download with concurrency limit
  const CONCURRENCY = 20;
  const queue = Array.from(allUrls);
  let active = 0;
  let completed = 0;

  const next = async () => {
    if (queue.length === 0) return;
    const url = queue.shift()!;
    index++; // Note: index order is not guaranteed to match array order perfectly but that's fine
    const currentIdx = index; // capture for closure

    try {
      const filename = generateImageFilename(url, currentIdx);
      const localPath = path.join(IMAGE_DIR, filename);

      // Skip if already downloaded
      if (fs.existsSync(localPath)) {
        console.log(`[${completed + 1}/${allUrls.size}] Already exists: ${filename}`);
        mapping[url] = `/images/${filename}`;
      } else {
        console.log(`[${completed + 1}/${allUrls.size}] Downloading: ${filename}`);
        await downloadImage(url, localPath);
        mapping[url] = `/images/${filename}`;
      }
    } catch (error) {
      console.error(`Failed to download ${url}:`, error);
      mapping[url] = url;
    } finally {
      completed++;
      await next();
    }
  };

  const workers = [];
  for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
    workers.push(next());
  }

  await Promise.all(workers);

  return mapping;
}

function updatePostsWithLocalImages(mapping: ImageMapping): void {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const filePath = path.join(BLOG_DIR, file);
    let content = fs.readFileSync(filePath, "utf-8");
    let updated = false;

    for (const [originalUrl, newUrl] of Object.entries(mapping)) {
      if (content.includes(originalUrl)) {
        content = content.split(originalUrl).join(newUrl);
        updated = true;
      }
    }

    if (updated) {
      fs.writeFileSync(filePath, content, "utf-8");
      console.log(`Updated image URLs in: ${file}`);
    }
  }
}

async function main(): Promise<void> {
  console.log("Image Migration Script");
  console.log("======================\n");

  // Check for R2 credentials
  if (!R2_PUBLIC_URL) {
    console.log("Note: R2_PUBLIC_URL not set. Images will be stored locally in src/images/");
    console.log("For R2 upload, set these environment variables:");
    console.log("  - R2_ACCOUNT_ID");
    console.log("  - R2_ACCESS_KEY_ID");
    console.log("  - R2_SECRET_ACCESS_KEY");
    console.log("  - R2_BUCKET_NAME");
    console.log("  - R2_PUBLIC_URL\n");
  }

  // Step 1: Download all images locally
  console.log("Step 1: Downloading images from Hashnode CDN...\n");
  const mapping = await downloadAllImages();

  // Save mapping file
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
  console.log(`\nSaved image mapping to: ${MAPPING_FILE}`);

  // Step 2: Update posts with new URLs
  console.log("\nStep 2: Updating posts with new image URLs...\n");
  updatePostsWithLocalImages(mapping);

  console.log("\nImage migration complete!");
  console.log(`Total images processed: ${Object.keys(mapping).length}`);

  // TODO: Step 3 - Upload to R2 (when credentials are available)
  if (R2_PUBLIC_URL && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    console.log("\nStep 3: Uploading to Cloudflare R2...");
    console.log("(R2 upload not yet implemented - images are stored locally)");
  }
}

main().catch(console.error);
