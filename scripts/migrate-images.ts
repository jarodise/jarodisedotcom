import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

const BLOG_DIR = path.join(process.cwd(), "src/blog");
const IMAGE_DIR = path.join(process.cwd(), "src/images");
const MAPPING_FILE = path.join(process.cwd(), "scripts/image-mapping.json");

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

  // Filter to any external http/https URL that isn't already our domain
  // This effectively migrates EVERYTHING external to local
  return urls.filter(
    (url) =>
      url.startsWith('http') &&
      !url.includes("jarodise.com") &&
      !url.includes("localhost")
  );
}

function downloadImage(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);

    protocol
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
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
  try {
    const urlPath = new URL(url).pathname;
    const ext = path.extname(urlPath);
    if (ext && [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext.toLowerCase())) {
      return ext;
    }
  } catch (e) {
    // ignore invalid urls
  }
  return ".jpg";
}

function generateImageFilename(url: string, index: number): string {
  try {
    const urlPath = new URL(url).pathname;
    const segments = urlPath.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || `image-${index}`;
    const ext = getExtensionFromUrl(url);

    let filename = lastSegment.replace(/[^a-zA-Z0-9-_]/g, "-");
    // truncated if too long
    if (filename.length > 50) filename = filename.substring(0, 50);

    if (!filename.toLowerCase().endsWith(ext.toLowerCase())) {
      filename = filename + ext;
    }
    return filename;
  } catch (e) {
    return `image-${index}.jpg`;
  }
}

async function downloadAllImages(): Promise<ImageMapping> {
  if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
  }

  const mapping: ImageMapping = {};
  const allUrls = new Set<string>();

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const content = fs.readFileSync(path.join(BLOG_DIR, file), "utf-8");
    const urls = extractImageUrls(content);
    urls.forEach((url) => allUrls.add(url));
  }

  console.log(`Found ${allUrls.size} unique images to download\n`);

  let index = 0;
  const CONCURRENCY = 10;
  const queue = Array.from(allUrls);
  let completed = 0;

  const next = async () => {
    if (queue.length === 0) return;
    const url = queue.shift()!;
    index++;
    const currentIdx = index;

    try {
      const filename = generateImageFilename(url, currentIdx);
      const localPath = path.join(IMAGE_DIR, filename);

      // Download if not exists
      if (!fs.existsSync(localPath)) {
        console.log(`[${completed + 1}/${allUrls.size}] Downloading: ${filename}`);
        await downloadImage(url, localPath);
      } else {
        console.log(`[${completed + 1}/${allUrls.size}] Exists: ${filename}`);
      }

      // Update mapping to use Astro's public path (assuming images are imported or in public)
      // Since we are putting them in src/images, we likely want to use Astro's image optimization
      // But for now, let's assume we want to reference them relative to the markdown file OR as absolute paths
      // If we use absolute paths like /src/images/..., Astro might pick them up if configured correctly
      // However, usually for dynamic MD images, it's safer to put them in public/images for raw access 
      // OR use relative paths like ../../images/filename

      // Strategy: Use filesystem relative path which Astro's markdown processor usually resolves
      // If the markdown file is in src/blog/post.md and images are in src/images/
      // The relative path is ../images/filename

      const relativePath = `../images/${filename}`;
      mapping[url] = relativePath;

    } catch (error) {
      console.error(`Failed to download ${url}:`, error);
      mapping[url] = url; // keep original if failed
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
      if (content.includes(originalUrl) && originalUrl !== newUrl) {
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

function cleanupUnusedImages(): void {
  console.log("\nCleaning up unused images...");
  if (!fs.existsSync(IMAGE_DIR)) return;

  const allImages = fs.readdirSync(IMAGE_DIR);
  const usedImages = new Set<string>();

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const content = fs.readFileSync(path.join(BLOG_DIR, file), "utf-8");

    // Regex for Markdown links: ![alt](/images/filename) or ../images/filename
    const imgRegex = /!\[.*?\]\((.*?)\)/g;
    let match;
    while ((match = imgRegex.exec(content)) !== null) {
      const url = match[1];
      // We only care about images we manage, which are in src/images presumably
      // Check if it's a local file reference
      if (url.includes("images/") || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) {
        // Resolve query params if any
        try {
          const cleanUrl = url.split('?')[0].split('#')[0];
          usedImages.add(path.basename(cleanUrl));
        } catch (e) {
          usedImages.add(path.basename(url));
        }
      }
    }

    // Frontmatter cover
    const coverMatch = content.match(/cover:\s*(.+)/);
    if (coverMatch) {
      const url = coverMatch[1].trim();
      try {
        const cleanUrl = url.split('?')[0].split('#')[0];
        usedImages.add(path.basename(cleanUrl));
      } catch (e) {
        usedImages.add(path.basename(url));
      }
    }
  }

  let deleted = 0;
  for (const image of allImages) {
    // Skip hidden files or non-image files if needed
    if (image.startsWith(".")) continue;

    if (!usedImages.has(image)) {
      try {
        fs.unlinkSync(path.join(IMAGE_DIR, image));
        console.log(`Deleted orphan: ${image}`);
        deleted++;
      } catch (e) {
        console.error(`Failed to delete ${image}:`, e);
      }
    }
  }
  console.log(`Cleanup complete. Deleted ${deleted} unused images.`);
}

async function main(): Promise<void> {
  console.log("Image Migration Script (Local Only)");
  console.log("===================================\n");

  const mapping = await downloadAllImages();

  if (Object.keys(mapping).length > 0) {
    fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
    console.log(`\nSaved image mapping to: ${MAPPING_FILE}`);

    console.log("\nUpdating posts with new image URLs...\n");
    updatePostsWithLocalImages(mapping);
  } else {
    console.log("\nNo new images to download.");
  }

  cleanupUnusedImages();

  console.log("\nImage migration complete!");
}

main().catch(console.error);
