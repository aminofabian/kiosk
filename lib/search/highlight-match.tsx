"use client";

import type { ReactNode } from "react";

const MARK_CLASS =
  "bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/15 text-[#1c6a1e] dark:text-[#2a8a30] font-semibold rounded-[1px] px-[0.5px]";

/** Highlight matching segments: exact → word-level → fuzzy character-level. */
export function highlightSearchMatch(text: string, query: string): ReactNode {
  if (!query || query.length < 1) return <>{text}</>;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  if (regex.test(text)) {
    const parts = text.split(regex);
    regex.lastIndex = 0;
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className={MARK_CLASS} style={{ textDecoration: "none" }}>
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </>
    );
  }

  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length > 1) {
    const wordPattern = words
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const wordRegex = new RegExp(`(${wordPattern})`, "gi");
    if (wordRegex.test(text)) {
      const parts = text.split(wordRegex);
      wordRegex.lastIndex = 0;
      return (
        <>
          {parts.map((part, i) =>
            wordRegex.test(part) ? (
              <mark key={i} className={MARK_CLASS} style={{ textDecoration: "none" }}>
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </>
      );
    }
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndices = new Set<number>();
  let qi = 0;
  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) {
      matchIndices.add(ti);
      qi++;
    }
  }

  if (matchIndices.size === 0) return <>{text}</>;

  const elements: ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    if (matchIndices.has(i)) {
      let end = i;
      while (end < text.length && matchIndices.has(end)) end++;
      elements.push(
        <mark key={i} className={MARK_CLASS} style={{ textDecoration: "none" }}>
          {text.slice(i, end)}
        </mark>,
      );
      i = end;
    } else {
      let end = i;
      while (end < text.length && !matchIndices.has(end)) end++;
      elements.push(<span key={i}>{text.slice(i, end)}</span>);
      i = end;
    }
  }
  return <>{elements}</>;
}
