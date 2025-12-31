import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import { PATHS } from "../config";
import { logger } from "../logger";
import type { CommentThread, DocumentContent, Review, ThreadsFile } from "./types";

export function getReview(reviewId: string): Review | null {
  const filePath = path.join(PATHS.reviews, `${reviewId}.json`);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as Review;
  } catch {
    return null;
  }
}

export function saveReview(review: Review): void {
  ensureReviewsDir();
  const filePath = path.join(PATHS.reviews, `${review.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(review, null, 2), "utf-8");
  logger.debug("Review saved", { reviewId: review.id });
}

export function listReviews(): Review[] {
  ensureReviewsDir();
  const files = fs.readdirSync(PATHS.reviews);
  const reviews: Review[] = [];

  for (const file of files) {
    if (file.startsWith("rev_") && file.endsWith(".json") && !file.includes("_threads")) {
      const reviewId = file.replace(".json", "");
      const review = getReview(reviewId);
      if (review) {
        reviews.push(review);
      }
    }
  }

  return reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getThreads(reviewId: string): CommentThread[] {
  const filePath = path.join(PATHS.reviews, `${reviewId}_threads.json`);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content) as ThreadsFile;
    return data.threads;
  } catch {
    return [];
  }
}

export function saveThreads(reviewId: string, threads: CommentThread[]): void {
  ensureReviewsDir();
  const filePath = path.join(PATHS.reviews, `${reviewId}_threads.json`);
  const data: ThreadsFile = { reviewId, threads };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  logger.debug("Threads saved", { reviewId, count: threads.length });
}

export function findReviewByPath(documentPath: string): Review | null {
  const reviews = listReviews();
  return reviews.find((r) => r.documentPath === documentPath) ?? null;
}

export function computeHash(content: string): string {
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  return `sha256:${hash}`;
}

export function readDocument(documentPath: string): DocumentContent | null {
  try {
    const stat = fs.statSync(documentPath);
    const content = fs.readFileSync(documentPath, "utf-8");
    const lines = content.split("\n");
    const hash = computeHash(content);

    return {
      path: documentPath,
      content,
      lines,
      hash,
      lastModified: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

function ensureReviewsDir(): void {
  if (!fs.existsSync(PATHS.reviews)) {
    fs.mkdirSync(PATHS.reviews, { recursive: true });
  }
}
