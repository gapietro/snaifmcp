/**
 * File system utility functions
 */

import * as fs from "fs/promises";
import * as path from "path";

/**
 * Check if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Copy a directory recursively
 */
export async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Extract description from a markdown file (first paragraph after title)
 */
export async function extractDescription(filePath: string): Promise<string | undefined> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");

    // Skip title line(s) and find first paragraph
    let inParagraph = false;
    let paragraph: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines at start
      if (!inParagraph && trimmed === "") continue;

      // Skip title lines
      if (trimmed.startsWith("#")) {
        inParagraph = false;
        paragraph = [];
        continue;
      }

      // Skip horizontal rules
      if (trimmed.match(/^[-=]{3,}$/)) continue;

      // Start collecting paragraph
      if (trimmed !== "") {
        inParagraph = true;
        paragraph.push(trimmed);
      } else if (inParagraph && paragraph.length > 0) {
        // End of paragraph
        break;
      }
    }

    if (paragraph.length > 0) {
      const desc = paragraph.join(" ");
      // Truncate if too long
      return desc.length > 200 ? desc.substring(0, 200) + "..." : desc;
    }
  } catch {
    // File read error
  }
  return undefined;
}

/**
 * Read file content safely
 */
export async function readFileContent(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Extract sections from markdown content
 */
export function extractMarkdownSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = content.split("\n");
  let currentSection = "intro";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headerMatch) {
      // Save previous section
      if (currentContent.length > 0) {
        sections.set(currentSection, currentContent.join("\n").trim());
      }
      currentSection = headerMatch[1].toLowerCase().trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentContent.length > 0) {
    sections.set(currentSection, currentContent.join("\n").trim());
  }

  return sections;
}

/**
 * Get word count
 */
export function getWordCount(content: string): number {
  return content.split(/\s+/).filter(w => w.length > 0).length;
}
