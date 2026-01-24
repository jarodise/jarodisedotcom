import * as fs from "fs";
import * as path from "path";

const HASHNODE_DIR = path.join(process.cwd(), "hashnode");
const BLOG_DIR = path.join(process.cwd(), "src/blog");
const AUTHOR = "数字游民Jarod";

interface HashnodeFrontmatter {
  title: string;
  datePublished: string;
  cuid: string;
  slug: string;
  cover?: string;
}

interface RyzeFrontmatter {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  featured: boolean;
  editable: boolean;
}

function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Invalid frontmatter format");
  }

  const frontmatterStr = match[1];
  const body = match[2];

  const frontmatter: Record<string, string> = {};
  const lines = frontmatterStr.split("\n");
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      // Remove surrounding quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

function parseDate(dateStr: string): string {
  // Parse date like "Fri Feb 07 2025 06:18:18 GMT+0000 (Coordinated Universal Time)"
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    // Fallback to current date if parsing fails
    return new Date().toISOString().split("T")[0];
  }
  return date.toISOString().split("T")[0];
}

function cleanMarkdown(body: string): string {
  // Remove Hashnode-specific image alignment attributes
  let cleaned = body.replace(/ align="(left|center|right)"/g, "");

  // Convert YouTube embeds from %[url] format to markdown links
  cleaned = cleaned.replace(/%\[(https:\/\/www\.youtube\.com[^\]]+)\]/g, (_, url) => {
    return `[Watch on YouTube](${url})`;
  });

  // Clean up escaped asterisks
  cleaned = cleaned.replace(/\\\*/g, "*");

  // Remove WordPress caption shortcodes
  cleaned = cleaned.replace(/\\\[caption[^\]]*\\\]/g, "");
  cleaned = cleaned.replace(/\\\[\/caption\\\]/g, "");

  // Comment out local image references that will break the build
  // These are old WordPress images that need to be recovered separately
  cleaned = cleaned.replace(/!\[([^\]]*)\]\(images\/([^)]+)\)/g, (match, alt, path) => {
    return `<!-- Image needs recovery: ${alt || path} -->`;
  });

  // Also handle linked images with local paths
  cleaned = cleaned.replace(/\[!\[([^\]]*)\]\(images\/([^)]+)\)\]\(([^)]+)\)/g, (match, alt, imgPath, linkPath) => {
    return `<!-- Image needs recovery: ${alt || imgPath} -->`;
  });

  return cleaned;
}

function sanitizeForYaml(str: string): string {
  // Remove or escape characters that break YAML
  let sanitized = str
    // Remove backslashes followed by special chars
    .replace(/\\+\[/g, "[")
    .replace(/\\+\]/g, "]")
    .replace(/\\_/g, "_")
    .replace(/\\"/g, '"')
    // Remove remaining backslashes
    .replace(/\\/g, "")
    // Remove HTML tags
    .replace(/<[^>]+>/g, "")
    // Remove markdown image syntax
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // Remove markdown link syntax but keep text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Remove WordPress shortcodes
    .replace(/\[caption[^\]]*\]/g, "")
    .replace(/\[\/caption\]/g, "")
    // Collapse multiple spaces
    .replace(/\s+/g, " ")
    .trim();

  // Escape double quotes for YAML
  sanitized = sanitized.replace(/"/g, '\\"');

  return sanitized;
}

function generatePlaceholderDescription(title: string, body: string): string {
  // Extract first meaningful paragraph as placeholder description
  const paragraphs = body
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed.length > 0 &&
        !trimmed.startsWith("#") &&
        !trimmed.startsWith("!") &&
        !trimmed.startsWith("-") &&
        !trimmed.startsWith(">") &&
        !trimmed.startsWith("<") &&
        !trimmed.startsWith("```") &&
        !trimmed.startsWith("%") &&
        !trimmed.startsWith("[caption") &&
        !trimmed.startsWith("\\[caption")
      );
    })
    .map((p) => p.trim());

  let description = title;

  if (paragraphs.length > 0) {
    // Try to find a paragraph that looks like real content
    for (const para of paragraphs) {
      const cleaned = sanitizeForYaml(para);
      if (cleaned.length > 20 && !cleaned.includes("undefined")) {
        description = cleaned;
        break;
      }
    }
  }

  // Truncate if too long
  if (description.length > 160) {
    description = description.slice(0, 157) + "...";
  }

  return sanitizeForYaml(description);
}

function generatePlaceholderTags(title: string): string[] {
  // Generate basic placeholder tags based on common themes
  const tags: string[] = [];

  const lowerTitle = title.toLowerCase();

  if (
    lowerTitle.includes("数字游民") ||
    lowerTitle.includes("digital nomad") ||
    lowerTitle.includes("游民")
  ) {
    tags.push("数字游民");
  }
  if (
    lowerTitle.includes("ai") ||
    lowerTitle.includes("人工智能") ||
    lowerTitle.includes("chatgpt") ||
    lowerTitle.includes("claude")
  ) {
    tags.push("人工智能");
  }
  if (
    lowerTitle.includes("远程") ||
    lowerTitle.includes("remote") ||
    lowerTitle.includes("工作")
  ) {
    tags.push("远程工作");
  }
  if (lowerTitle.includes("旅行") || lowerTitle.includes("travel")) {
    tags.push("旅行");
  }
  if (lowerTitle.includes("创业") || lowerTitle.includes("startup")) {
    tags.push("创业");
  }
  if (
    lowerTitle.includes("总结") ||
    lowerTitle.includes("review") ||
    lowerTitle.includes("年终")
  ) {
    tags.push("年终总结");
  }

  // Always add a general tag if no specific ones matched
  if (tags.length === 0) {
    tags.push("生活方式");
  }

  return tags.slice(0, 5);
}

function migratePost(filename: string): void {
  const filePath = path.join(HASHNODE_DIR, filename);
  const content = fs.readFileSync(filePath, "utf-8");

  const { frontmatter: hashnode, body } = parseFrontmatter(content);

  const slug = hashnode.slug || filename.replace(".md", "");
  const title = hashnode.title || "Untitled";
  const date = parseDate(hashnode.datePublished || new Date().toISOString());

  const cleanedBody = cleanMarkdown(body);
  const description = generatePlaceholderDescription(title, cleanedBody);
  const tags = generatePlaceholderTags(title);

  const ryzeFrontmatter: RyzeFrontmatter = {
    slug,
    title,
    description,
    date,
    author: AUTHOR,
    tags,
    featured: false,
    editable: true,
  };

  // Build new markdown content
  const safeTitle = sanitizeForYaml(ryzeFrontmatter.title);
  const safeDescription = ryzeFrontmatter.description; // Already sanitized

  const newContent = `---
slug: "${ryzeFrontmatter.slug}"
title: "${safeTitle}"
description: "${safeDescription}"
date: ${ryzeFrontmatter.date}
author: "${ryzeFrontmatter.author}"
tags: ${JSON.stringify(ryzeFrontmatter.tags)}
featured: ${ryzeFrontmatter.featured}
editable: ${ryzeFrontmatter.editable}
---
${cleanedBody}`;

  // Write to blog directory using slug as filename
  const outputPath = path.join(BLOG_DIR, `${slug}.md`);
  fs.writeFileSync(outputPath, newContent, "utf-8");
  console.log(`Migrated: ${filename} -> ${slug}.md`);
}

function main(): void {
  // Ensure blog directory exists
  if (!fs.existsSync(BLOG_DIR)) {
    fs.mkdirSync(BLOG_DIR, { recursive: true });
  }

  // Remove sample Ryze posts
  const existingPosts = fs.readdirSync(BLOG_DIR);
  for (const post of existingPosts) {
    if (post.startsWith("ryze-")) {
      fs.unlinkSync(path.join(BLOG_DIR, post));
      console.log(`Removed sample post: ${post}`);
    }
  }

  // Get all markdown files from hashnode directory
  const files = fs.readdirSync(HASHNODE_DIR).filter((f) => f.endsWith(".md"));

  console.log(`Found ${files.length} posts to migrate\n`);

  let migrated = 0;
  let failed = 0;

  for (const file of files) {
    try {
      migratePost(file);
      migrated++;
    } catch (error) {
      console.error(`Failed to migrate ${file}:`, error);
      failed++;
    }
  }

  console.log(`\nMigration complete!`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Failed: ${failed}`);
}

main();
