import { env } from '../config/env.js';

const TIMEOUT_MS = 12000;

export function slugFromUrl(url) {
  const match = String(url || '').match(/leetcode\.com\/problems\/([^/?#]+)/);
  return match ? match[1] : null;
}

// The LeetCode API is a free hosted deployment — it can rate-limit or go down,
// so every caller must tolerate null rather than surfacing a 500.
async function get(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${env.leetcodeApi}${path}`, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[leetcode] ${path} failed: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchProblem(slug) {
  const data = await get(`/problem/${encodeURIComponent(slug)}`);
  if (!data || !data.title) return null;

  return {
    slug,
    title: data.title,
    difficulty: data.difficulty || 'Medium',
    url: `https://leetcode.com/problems/${slug}/`,
    topicTags: (data.topicTags || []).map((t) => t.name || t).filter(Boolean),
    descriptionHtml: data.content || null,
  };
}

export async function fetchDescription(slug) {
  const data = await get(`/problem/${encodeURIComponent(slug)}`);
  return data?.content || null;
}
