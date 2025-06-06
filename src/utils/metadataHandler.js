import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import logger from "./logger.js";
import { parseDocument, stringify } from "yaml";

export function getCourseTitle(metadata) {
  const courseTitle = metadata?.course_title;
  if (courseTitle === undefined) {
    throw new Error("No 'course_title' found in the metadata");
  }
  return courseTitle;
}

export function getCourseId(metadata) {
  const courseId = metadata?.course_id;
  if (courseId === undefined) {
    throw new Error("No 'course_id' found in the metadata");
  }
  return courseId;
}

export function getVersion(metadata) {
  const version = metadata?.version;
  // if (version === undefined) {
  //   throw new Error("No 'version' found in the metadata");
  // }
  return version;
}

export function getCourseFormat(metadata) {
  const courseFormat = metadata?.format;
  if (courseFormat === undefined) {
    throw new Error("No 'format' found in the metadata");
  }
  return courseFormat;
}

export function getCourseDuration(metadata) {
  const courseDuration = metadata?.duration;
  if (courseDuration === undefined) {
    throw new Error("No 'duration' found in the metadata");
  }
  return courseDuration;
}

export function getCourseAudience(metadata) {
  const courseAudience = metadata?.audience;
  if (courseAudience === undefined) {
    throw new Error("No 'audience' found in the metadata");
  }
  return courseAudience;
}

export function getCourseGA(metadata) {
  const courseGA = metadata?.ga;
  if (courseGA === undefined) {
    return [null, "No 'ga' found in the metadata"];
  }
  return [courseGA, null];
}

// TODO: MOVE TO FILEHANDLER
export function slugify(text) {
  logger.debug(`Slugifying text: "${text}"`);
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export async function getMetadataPath(sourceDir) {
  const metadataExtensions = ["yaml", "yml"];
  let metadataPath;

  // Try both .yaml and .yml extensions
  for (const ext of metadataExtensions) {
    const filePath = path.join(sourceDir, `metadata.${ext}`);
    try {
      await fs.access(filePath);
      metadataPath = filePath;
      break;
    } catch (err) {
      continue;
    }
  }

  if (!metadataPath) {
    logger.error("Metadata file not found (metadata.yaml or metadata.yml)");
    process.exit(1);
  }

  return metadataPath;
}

export async function loadMetadata(metadataPath) {
  const metadataRaw = await fs.readFile(metadataPath, "utf8");
  const metadata = yaml.load(metadataRaw) || {};

  if (metadata.course_id) {
    metadata.course_id = metadata.course_id.toString().padStart(4, "0");
  }

  logger.info(`🚚 Loading metadata ${metadataPath}`);

  return metadata;
}

export async function updateMetadataDate(
  metadataPath,
  metadata,
  courseUpdated
) {
  const yamlContent = await fs.readFile(metadataPath, "utf8");

  const yamlDoc = parseDocument(yamlContent);

  if (metadata.course_id) {
    yamlDoc.setIn(
      ["course_id"],
      metadata.course_id.toString().padStart(4, "0")
    );
  }
  yamlDoc.setIn(["updated"], courseUpdated);

  const newYaml = stringify(yamlDoc);

  await fs.writeFile(metadataPath, newYaml, "utf8");

  logger.info(`🏷️  Updating metadata.updated: ${courseUpdated}`);
}

export function getFormattedDate(dateString) {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function valiDate(input) {
  const date = new Date(input);

  if (isNaN(date.getTime())) {
    throw new Error(
      `Invalid date format. Use YYYY-MM-DD. You entered: ${input}`
    );
  }
  return date.toISOString().split("T")[0];
}
