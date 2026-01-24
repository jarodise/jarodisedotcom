import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const BLOG_DIR = path.join(process.cwd(), "src/blog");

// Initialize Anthropic client (uses ANTHROPIC_API_KEY env var)
const anthropic = new Anthropic();

interface PostMetadata {
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
  frontmatter: PostMetadata;
  body: string;
  raw: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Invalid frontmatter format");
  }

  const frontmatterStr = match[1];
  const body = match[2];

  // Parse YAML-like frontmatter
  const frontmatter: Record<string, any> = {};
  const lines = frontmatterStr.split("\n");
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();

      // Handle arrays
      if (value.startsWith("[") && value.endsWith("]")) {
        try {
          frontmatter[key] = JSON.parse(value);
        } catch {
          frontmatter[key] = value;
        }
      }
      // Handle booleans
      else if (value === "true" || value === "false") {
        frontmatter[key] = value === "true";
      }
      // Handle quoted strings
      else if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        frontmatter[key] = value.slice(1, -1);
      }
      // Handle unquoted values
      else {
        frontmatter[key] = value;
      }
    }
  }

  return {
    frontmatter: frontmatter as PostMetadata,
    body,
    raw: frontmatterStr,
  };
}

function sanitizeForYaml(str: string): string {
  return str
    .replace(/\\/g, "")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ")
    .trim();
}

async function generateMetadata(
  title: string,
  body: string
): Promise<{ description: string; tags: string[] }> {
  // Take first 2000 chars of body for context
  const contentPreview = body.slice(0, 2000);

  const prompt = `You are helping to generate metadata for a Chinese blog post about digital nomad lifestyle and related topics.

Title: ${title}

Content preview:
${contentPreview}

Please generate:
1. A description in Chinese (150-200 characters) that summarizes the post for SEO purposes. It should be compelling and capture the main point.
2. 3-5 relevant tags in Chinese that categorize this post. Common categories include: 数字游民, 远程工作, 旅行, 生活方式, 人工智能, 创业, 自由职业, 财务自由, 个人成长, 效率工具, 年终总结, etc.

Respond in JSON format only:
{
  "description": "...",
  "tags": ["tag1", "tag2", "tag3"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        description: sanitizeForYaml(parsed.description || title),
        tags: parsed.tags || ["生活方式"],
      };
    }
  } catch (error) {
    console.error("API error:", error);
  }

  // Fallback
  return {
    description: title,
    tags: ["生活方式"],
  };
}

async function enhancePost(filename: string): Promise<boolean> {
  const filePath = path.join(BLOG_DIR, filename);
  const content = fs.readFileSync(filePath, "utf-8");

  const { frontmatter, body } = parseFrontmatter(content);

  // Skip if already has a good description (not just the title)
  if (
    frontmatter.description &&
    frontmatter.description.length > 50 &&
    frontmatter.description !== frontmatter.title &&
    frontmatter.tags.length > 1
  ) {
    console.log(`Skipping ${filename} - already enhanced`);
    return false;
  }

  console.log(`Enhancing: ${filename}`);

  const { description, tags } = await generateMetadata(frontmatter.title, body);

  // Build new frontmatter
  const newContent = `---
slug: "${frontmatter.slug}"
title: "${sanitizeForYaml(frontmatter.title)}"
description: "${description}"
date: ${frontmatter.date}
author: "${frontmatter.author}"
tags: ${JSON.stringify(tags)}
featured: ${frontmatter.featured}
editable: ${frontmatter.editable}
---
${body}`;

  fs.writeFileSync(filePath, newContent, "utf-8");
  console.log(`  -> Description: ${description.slice(0, 50)}...`);
  console.log(`  -> Tags: ${tags.join(", ")}`);

  return true;
}

async function main(): Promise<void> {
  console.log("AI Enhancement Script");
  console.log("=====================\n");

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required");
    console.log("\nSet it with: export ANTHROPIC_API_KEY=your-key-here");
    process.exit(1);
  }

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));
  console.log(`Found ${files.length} posts to process\n`);

  let enhanced = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    try {
      const wasEnhanced = await enhancePost(file);
      if (wasEnhanced) {
        enhanced++;
        // Rate limiting - wait between API calls
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`Failed to enhance ${file}:`, error);
      failed++;
    }
  }

  console.log("\n======================");
  console.log(`Enhancement complete!`);
  console.log(`Enhanced: ${enhanced}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
