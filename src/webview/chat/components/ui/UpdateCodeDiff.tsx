import React, { useMemo, useCallback } from 'react';
import { diffWordsWithSpace, Change } from 'diff';
import '../../style/code.css';

export interface UpdateCodeDiffProps {
  diffContent: DiffContent;
  language: string;
}

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

interface DiffContent {
  type: string;
  patch: DiffHunk[];
  diffText: string;
}

interface RenderRow {
  type: 'context' | 'added' | 'removed' | 'meta' | 'separator';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
  diffParts?: Change[];
}

/**
 * 将统一差异补丁格式转换为用于渲染的扁平行列表
 */
const processPatchToRows = (diffContent: DiffContent): RenderRow[] => {
  const rows: RenderRow[] = [];

  diffContent.patch.forEach((hunk, index) => {
    if (index > 0) {
      rows.push({ type: 'separator', content: '' });
    }

    let currentOldLine = hunk.oldStart;
    let currentNewLine = hunk.newStart;

    hunk.lines.forEach((line) => {
      if (line.startsWith('\\ No newline')) return;

      const marker = line[0];
      const content = line.slice(1);

      if (marker === '-') {
        rows.push({
          type: 'removed',
          oldLineNumber: currentOldLine++,
          content,
        });
      } else if (marker === '+') {
        rows.push({
          type: 'added',
          newLineNumber: currentNewLine++,
          content,
        });
      } else {
        rows.push({
          type: 'context',
          oldLineNumber: currentOldLine++,
          newLineNumber: currentNewLine++,
          content,
        });
      }
    });
  });

  if (diffContent.diffText) {
    rows.push({ type: 'meta', content: diffContent.diffText });
  }

  return rows;
};

const computeLineSimilarity = (a: string, b: string): number => {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // ---- 公共前缀长度 ----
  let prefixLen = 0;
  const minLen = Math.min(a.length, b.length);
  while (prefixLen < minLen && a[prefixLen] === b[prefixLen]) {
    prefixLen++;
  }

  // ---- 字符级重叠量 ----
  const changes = diffWordsWithSpace(a, b);
  let commonLen = 0;
  for (const change of changes) {
    if (!change.added && !change.removed) {
      commonLen += change.value.length;
    }
  }

  const maxLen = Math.max(a.length, b.length);
  const charSimilarity = commonLen / maxLen;

  // 用前缀相对于「较短串」的占比，而非较长串
  const prefixRatio = prefixLen / minLen;

  return charSimilarity * 0.3 + prefixRatio * 0.7;
};

const matchLines = (
  removedLines: string[],
  addedLines: string[]
): Map<number, number> => {
  const SIMILARITY_THRESHOLD = 0.35;

  const scores: { ai: number; ri: number; score: number }[] = [];

  for (let ai = 0; ai < addedLines.length; ai++) {
    for (let ri = 0; ri < removedLines.length; ri++) {
      const score = computeLineSimilarity(removedLines[ri], addedLines[ai]);
      if (score >= SIMILARITY_THRESHOLD) {
        scores.push({ ai, ri, score });
      }
    }
  }

  scores.sort((a, b) => b.score - a.score);

  const matches = new Map<number, number>();
  const usedAdded = new Set<number>();
  const usedRemoved = new Set<number>();

  for (const { ai, ri } of scores) {
    if (usedAdded.has(ai) || usedRemoved.has(ri)) continue;
    matches.set(ai, ri);
    usedAdded.add(ai);
    usedRemoved.add(ri);
  }

  return matches;
};

const computePairInlineDiff = (
  removedLine: string,
  addedLine: string
): { removedParts: Change[]; addedParts: Change[] } | null => {
  // 完全相同则不需要行内高亮
  if (removedLine === addedLine) return null;

  // ---- 找公共前缀 ----
  let prefixLen = 0;
  const minLen = Math.min(removedLine.length, addedLine.length);
  while (prefixLen < minLen && removedLine[prefixLen] === addedLine[prefixLen]) {
    prefixLen++;
  }

  // ---- 找公共后缀（不越过前缀）----
  let suffixLen = 0;
  while (
    suffixLen < removedLine.length - prefixLen &&
    suffixLen < addedLine.length - prefixLen &&
    removedLine[removedLine.length - 1 - suffixLen] ===
      addedLine[addedLine.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const removedMiddle = removedLine.slice(
    prefixLen,
    suffixLen > 0 ? removedLine.length - suffixLen : undefined
  );
  const addedMiddle = addedLine.slice(
    prefixLen,
    suffixLen > 0 ? addedLine.length - suffixLen : undefined
  );

  // 如果中间变化部分占比超过 70%，不做行内高亮（整行已经足够显眼）
  const totalLen = Math.max(removedLine.length, addedLine.length);
  const changedLen = Math.max(removedMiddle.length, addedMiddle.length);
  if (totalLen > 0 && changedLen / totalLen > 0.7) return null;

  const prefixPart: Change = { value: removedLine.slice(0, prefixLen), added: false, removed: false, count: 1 };
  const suffixPart: Change = { value: removedLine.slice(removedLine.length - suffixLen), added: false, removed: false, count: 1 };

  const removedParts: Change[] = [];
  const addedParts: Change[] = [];

  if (prefixLen > 0) {
    removedParts.push(prefixPart);
    addedParts.push({ ...prefixPart, value: addedLine.slice(0, prefixLen) });
  }
  if (removedMiddle) {
    removedParts.push({ value: removedMiddle, removed: true, added: false, count: 1 });
  }
  if (addedMiddle) {
    addedParts.push({ value: addedMiddle, added: true, removed: false, count: 1 });
  }
  if (suffixLen > 0) {
    removedParts.push(suffixPart);
    addedParts.push({ ...suffixPart, value: addedLine.slice(addedLine.length - suffixLen) });
  }

  return { removedParts, addedParts };
};

const computeWordDiffs = (rows: RenderRow[]): RenderRow[] => {
  const result = [...rows];
  let i = 0;

  while (i < result.length) {
    if (result[i].type === 'removed') {
      const removedStart = i;
      let removedEnd = i;
      while (removedEnd < result.length && result[removedEnd].type === 'removed') {
        removedEnd++;
      }

      const addedStart = removedEnd;
      let addedEnd = addedStart;
      while (addedEnd < result.length && result[addedEnd].type === 'added') {
        addedEnd++;
      }

      if (addedEnd > addedStart) {
        const removedLines = result.slice(removedStart, removedEnd).map((r) => r.content);
        const addedLines = result.slice(addedStart, addedEnd).map((r) => r.content);

        const matches = matchLines(removedLines, addedLines);

        for (const [ai, ri] of matches) {
          const pairDiff = computePairInlineDiff(removedLines[ri], addedLines[ai]);
          if (pairDiff) {
            result[removedStart + ri].diffParts = pairDiff.removedParts;
            result[addedStart + ai].diffParts = pairDiff.addedParts;
          }
        }
      }

      i = addedEnd;
    } else {
      i++;
    }
  }

  return result;
};

/**
 * 简单的 HTML 特殊字符转义（用于不经过 hljs 的回退路径）
 */
const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * 将整体高亮后的 HTML 按换行符分割为多行。
 * 在每个换行处关闭所有开放的 span，在下一行开头重新打开，
 * 保证每一行的 HTML 都是独立合法的片段（正确处理跨行注释/字符串等）。
 */
const splitHighlightedHtmlByLines = (html: string): string[] => {
  const lines: string[] = [];
  let currentLine = '';
  const openSpans: string[] = [];
  let i = 0;

  while (i < html.length) {
    if (html[i] === '\n') {
      currentLine += '</span>'.repeat(openSpans.length);
      lines.push(currentLine);
      currentLine = openSpans.join('');
      i++;
    } else if (html[i] === '<') {
      const tagEnd = html.indexOf('>', i);
      if (tagEnd === -1) {
        currentLine += html.slice(i);
        break;
      }
      const tag = html.slice(i, tagEnd + 1);
      currentLine += tag;
      if (tag.startsWith('</')) {
        openSpans.pop();
      } else if (!tag.endsWith('/>')) {
        openSpans.push(tag);
      }
      i = tagEnd + 1;
    } else {
      currentLine += html[i];
      i++;
    }
  }

  // 处理最后一行（无末尾换行符的情况）
  currentLine += '</span>'.repeat(openSpans.length);
  lines.push(currentLine);

  return lines;
};

/**
 * 对多行内容整体做 hljs 语法高亮，再按行分割。
 * 相比逐行高亮，能正确处理跨行的多行注释、模板字符串等语法结构。
 * 若行数不一致则回退到逐行高亮。
 */
const highlightAllLines = (lines: string[], language: string): string[] => {
  if (lines.length === 0) return [];
  if (!window.hljs) return lines.map(escapeHtml);

  const fullCode = lines.join('\n');
  let fullHtml: string;
  try {
    fullHtml = window.hljs.highlight(fullCode, { language, ignoreIllegals: true }).value;
  } catch {
    return lines.map(escapeHtml);
  }

  const splitLines = splitHighlightedHtmlByLines(fullHtml);

  // 行数不一致时回退到逐行模式（保险措施）
  if (splitLines.length !== lines.length) {
    return lines.map((line) => {
      try {
        return window.hljs!.highlight(line, { language, ignoreIllegals: true }).value;
      } catch {
        return escapeHtml(line);
      }
    });
  }

  return splitLines;
};

/**
 * 获取整行的 hljs 高亮 HTML（单行回退路径）。
 */
const getHighlightedHtml = (content: string, language: string): string => {
  if (!window.hljs) return escapeHtml(content);
  try {
    return window.hljs.highlight(content, { language, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(content);
  }
};

/**
 * 把 diff 高亮区间注入到已有的 hljs HTML 中。
 *
 * 算法：
 *  - 遍历 HTML 字符串，同时维护一个"原始文本字符偏移量"（跳过 HTML 标签和实体）
 *  - 在对应偏移量处插入 <span class="..."> 和 </span>
 *  - 遇到 hljs 的 </span> 标签时，若当前处于 diff 高亮中，需要先关闭再重开，
 *    以保证 HTML 合法嵌套
 */
const insertDiffHighlightsIntoHtml = (
  html: string,
  ranges: { start: number; end: number }[],
  className: string
): string => {
  if (ranges.length === 0) return html;

  // 将区间转为有序事件列表
  type Event = { pos: number; type: 'open' | 'close' };
  const events: Event[] = [];
  for (const r of ranges) {
    events.push({ pos: r.start, type: 'open' });
    events.push({ pos: r.end, type: 'close' });
  }
  // 同位置时先 close 再 open（避免空 span）
  events.sort((a, b) => a.pos - b.pos || (a.type === 'close' ? -1 : 1));

  let result = '';
  let charPos = 0;       // 原始文本中的字符偏移
  let htmlIdx = 0;       // html 字符串中的当前位置
  let eventIdx = 0;
  let insideDiff = false; // 当前是否处于 diff 高亮 span 内

  // hljs 标签栈，用于在 diff span 中断时恢复
  const hlTagStack: string[] = [];

  const flushEventsAt = (pos: number) => {
    while (eventIdx < events.length && events[eventIdx].pos === pos) {
      const ev = events[eventIdx++];
      if (ev.type === 'open' && !insideDiff) {
        result += `<span class="${className}">`;
        insideDiff = true;
      } else if (ev.type === 'close' && insideDiff) {
        result += '</span>';
        insideDiff = false;
      }
    }
  };

  while (htmlIdx < html.length) {
    flushEventsAt(charPos);

    if (html[htmlIdx] === '<') {
      // HTML 标签：不计入 charPos
      const tagEnd = html.indexOf('>', htmlIdx);
      if (tagEnd === -1) {
        // 异常：直接追加剩余内容
        result += html.slice(htmlIdx);
        break;
      }
      const tag = html.slice(htmlIdx, tagEnd + 1);

      if (tag.startsWith('</')) {
        // 关闭标签
        if (insideDiff) {
          // 先关闭 diff span，输出 hljs 关闭标签，再重开 diff span
          result += `</span>${tag}<span class="${className}">`;
        } else {
          result += tag;
        }
        hlTagStack.pop();
      } else {
        // 开启标签（自闭合标签不压栈，这里 hljs 不会产生自闭合标签）
        hlTagStack.push(tag);
        result += tag;
      }

      htmlIdx = tagEnd + 1;
    } else if (html[htmlIdx] === '&') {
      // HTML 实体：算作一个原始字符
      const entityEnd = html.indexOf(';', htmlIdx);
      if (entityEnd === -1) {
        result += html[htmlIdx];
        htmlIdx++;
        charPos++;
      } else {
        result += html.slice(htmlIdx, entityEnd + 1);
        htmlIdx = entityEnd + 1;
        charPos++;
      }
    } else {
      result += html[htmlIdx];
      htmlIdx++;
      charPos++;
    }
  }

  // 处理末尾可能剩余的 close 事件
  flushEventsAt(charPos);
  if (insideDiff) {
    result += '</span>';
  }

  return result;
};

/**
 * 渲染带 diff 高亮的行。
 * 优先使用预计算的整体高亮 HTML，回退到单行高亮。
 */
const renderDiffParts = (
  parts: Change[],
  rowType: 'removed' | 'added',
  language: string,
  preHighlightedHtml?: string
): React.ReactNode => {
  // 1. 从 parts 重建完整行文本
  const fullText = parts.map((p) => p.value).join('');

  // 2. 计算需要高亮的字符区间
  const ranges: { start: number; end: number }[] = [];
  let pos = 0;
  for (const part of parts) {
    const len = part.value.length;
    if (part.removed || part.added) {
      ranges.push({ start: pos, end: pos + len });
    }
    pos += len;
  }

  // 3. 使用预计算的整体高亮 HTML，或回退到单行高亮
  const highlightedHtml = preHighlightedHtml ?? getHighlightedHtml(fullText, language);

  // 4. 把 diff 区间注入 HTML
  const highlightClass =
    rowType === 'removed'
      ? 'diff-highlight diff-highlight-removed'
      : 'diff-highlight diff-highlight-added';

  const finalHtml = insertDiffHighlightsIntoHtml(highlightedHtml, ranges, highlightClass);

  return <span dangerouslySetInnerHTML={{ __html: finalHtml }} />;
};

/**
 * 普通行（非 diff 行）的语法高亮。
 * 优先使用预计算的整体高亮 HTML，回退到单行高亮。
 */
const highlightCode = (content: string, language: string, preHighlightedHtml?: string): React.ReactNode => {
  const html = preHighlightedHtml ?? getHighlightedHtml(content, language);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};


const UpdateCodeDiff: React.FC<UpdateCodeDiffProps> = React.memo(
  ({ diffContent, language }) => {
    const rows = useMemo(() => {
      const rawRows = processPatchToRows(diffContent);
      const result = computeWordDiffs(rawRows);

      const collect = (type: 'removed' | 'added') =>
        result
          .filter((r) => r.type === type)
          .map((r) => {
            const parts: Change[] = r.diffParts ?? [{ value: r.content, removed: type === 'removed', added: type === 'added', count: 1 }];
            return parts.filter((p) => p.removed || p.added).map((p) => p.value).join('');
          })
          .filter(Boolean);

      const removed = collect('removed');
      const added = collect('added');
      console.log(`removed: (${removed.length})`, removed);
      console.log(`added: (${added.length})`, added);

      return result;
    }, [diffContent]);

    // 整体语法高亮：收集所有需要高亮的行，一次性调用 hljs，再按行分割
    const preHighlightedMap = useMemo(() => {
      const contentRows = rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) =>
          row.type === 'context' || row.type === 'added' || row.type === 'removed'
        );

      const lines = contentRows.map(({ row }) => row.content);
      const highlighted = highlightAllLines(lines, language);

      const map = new Map<number, string>();
      contentRows.forEach(({ index }, i) => {
        map.set(index, highlighted[i]);
      });
      return map;
    }, [rows, language]);

    const renderContent = useCallback(
      (row: RenderRow, rowIndex: number) => {
        if (!row.content) return <span>{'\u200B'}</span>;

        const preHtml = preHighlightedMap.get(rowIndex);

        if (row.type === 'removed' || row.type === 'added') {
          const parts: Change[] = row.diffParts ?? [
            {
              value: row.content,
              added: row.type === 'added',
              removed: row.type === 'removed',
              count: 1,
            },
          ];
          return renderDiffParts(parts, row.type, language, preHtml);
        }

        return highlightCode(row.content, language, preHtml);
      },
      [language, preHighlightedMap]
    );

    return (
      <div className="update-code-diff">
        <div className="update-code-diff-scroll">
          <table>
            <colgroup>
              <col />
              <col />
              <col />
            </colgroup>
            <tbody>
              {rows.map((row, index) => {
                if (row.type === 'separator') {
                  return (
                    <tr key={index} className="diff-row-separator">
                      <td></td>
                      <td></td>
                      <td>
                        <div className="diff-separator-pattern"></div>
                      </td>
                    </tr>
                  );
                }

                if (row.type === 'meta') {
                  return (
                    <tr key={index} className="diff-row-meta">
                      <td colSpan={3}>{row.content}</td>
                    </tr>
                  );
                }

                let rowClass = '';
                let lineNum: number | undefined;
                let sign = '';

                if (row.type === 'added') {
                  rowClass = 'diff-row-added';
                  lineNum = row.newLineNumber;
                  sign = '+';
                } else if (row.type === 'removed') {
                  rowClass = 'diff-row-removed';
                  lineNum = row.oldLineNumber;
                  sign = '-';
                } else if (row.type === 'context') {
                  lineNum = row.newLineNumber;
                }

                return (
                  <tr key={index} className={rowClass}>
                    <td className="diff-line-number">{lineNum || ''}</td>
                    <td className="diff-sign">{sign}</td>
                    <td className="diff-content">{renderContent(row, index)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
);

UpdateCodeDiff.displayName = 'UpdateCodeDiff';

export default UpdateCodeDiff;