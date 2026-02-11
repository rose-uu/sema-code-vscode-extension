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
    // 在差异块之间添加视觉分隔符（第一个块除外）
    if (index > 0) {
      rows.push({
        type: 'separator',
        content: '',
      });
    }

    let currentOldLine = hunk.oldStart; // 当前旧行号
    let currentNewLine = hunk.newStart; // 当前新行号

    hunk.lines.forEach((line) => {
      if (line.startsWith('\\ No newline')) return; // 忽略无换行符标记

      const marker = line[0]; // 行首标记
      const content = line.slice(1); // 实际内容

      if (marker === '-') {
        rows.push({
          type: 'removed',
          oldLineNumber: currentOldLine++,
          content: content,
        });
      } else if (marker === '+') {
        rows.push({
          type: 'added',
          newLineNumber: currentNewLine++,
          content: content,
        });
      } else {
        // 上下文行
        rows.push({
          type: 'context',
          oldLineNumber: currentOldLine++,
          newLineNumber: currentNewLine++,
          content: content,
        });
      }
    });
  });

  if (diffContent.diffText) {
    rows.push({
      type: 'meta',
      content: diffContent.diffText,
    });
  }

  return rows;
};

/**
 * 后处理行数据，为相邻的删除/添加块计算单词级差异
 */
const computeWordDiffs = (rows: RenderRow[]): RenderRow[] => {
  const result = [...rows];
  let i = 0;

  while (i < result.length) {
    if (result[i].type === 'removed') {
      const removedStart = i;
      let removedEnd = i;

      // 查找删除块的结束位置
      while (removedEnd < result.length && result[removedEnd].type === 'removed') {
        removedEnd++;
      }

      // 检查是否紧跟着添加块
      const addedStart = removedEnd;
      let addedEnd = addedStart;

      while (addedEnd < result.length && result[addedEnd].type === 'added') {
        addedEnd++;
      }

      // 如果同时存在两种块，则配对进行单词级差异计算
      if (addedEnd > addedStart) {
        const pairCount = Math.min(removedEnd - removedStart, addedEnd - addedStart); // 配对数量

        for (let j = 0; j < pairCount; j++) {
          const removedRowIdx = removedStart + j;
          const addedRowIdx = addedStart + j;

          const removedContent = result[removedRowIdx].content;
          const addedContent = result[addedRowIdx].content;

          // 计算单词级差异并分配给两行
          const parts = diffWordsWithSpace(removedContent, addedContent);
          result[removedRowIdx].diffParts = parts;
          result[addedRowIdx].diffParts = parts;
        }
      }

      i = addedEnd; // 跳过已处理块
    } else {
      i++;
    }
  }

  return result;
};

/**
 * 渲染行的单词级差异部分
 */
const renderDiffParts = (parts: Change[], rowType: 'removed' | 'added'): React.ReactNode => {
  return (
    <span>
      {parts.map((part, i) => {
        // 跳过相反类型的部分
        if (rowType === 'removed' && part.added) return null;
        if (rowType === 'added' && part.removed) return null;

        // 高亮显示更改部分
        if ((rowType === 'removed' && part.removed) || (rowType === 'added' && part.added)) {
          const highlightClass = rowType === 'removed'
            ? 'diff-highlight diff-highlight-removed' // 删除高亮类
            : 'diff-highlight diff-highlight-added'; // 添加高亮类
          return (
            <span key={i} className={highlightClass}>
              {part.value}
            </span>
          );
        }

        // 渲染未更改部分
        return <span key={i}>{part.value}</span>;
      })}
    </span>
  );
};

/**
 * 如果可用，使用 highlight.js 高亮代码
 */
const highlightCode = (content: string, language: string): React.ReactNode => {
  if (!window.hljs) {
    return <span>{content}</span>; // 回退到普通文本
  }

  try {
    const result = window.hljs.highlight(content, { language, ignoreIllegals: true });
    return <span dangerouslySetInnerHTML={{ __html: result.value }} />; // 使用高亮后的 HTML
  } catch (e) {
    return <span>{content}</span>; // 出错时回退
  }
};

const UpdateCodeDiff: React.FC<UpdateCodeDiffProps> = React.memo(({ diffContent, language}) => {
  // 计算渲染行数据
  const rows = useMemo(() => {
    const rawRows = processPatchToRows(diffContent);
    return computeWordDiffs(rawRows);
  }, [diffContent]);

  // 渲染行内容
  const renderContent = useCallback((row: RenderRow) => {
    // 空行处理：返回零宽空格保持行高
    if (!row.content) return <span>{'\u200B'}</span>;

    // 如果有单词级差异则渲染差异部分
    if (row.diffParts && (row.type === 'removed' || row.type === 'added')) {
      return renderDiffParts(row.diffParts, row.type);
    }

    // 否则使用语法高亮
    return highlightCode(row.content, language);
  }, [language]);

  return (
    <div className="update-code-diff">
      <div className="update-code-diff-scroll">
      <table>
        <colgroup>
          <col /> {/* 行号列 */}
          <col /> {/* 符号列 */}
          <col /> {/* 内容列 */}
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
                  <td colSpan={3}>
                    {row.content}
                  </td>
                </tr>
              );
            }

            // 确定行类、行号和符号
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
                <td className="diff-line-number">
                  {lineNum || ''} {/* 行号显示 */}
                </td>
                <td className="diff-sign">
                  {sign} {/* 差异符号 */}
                </td>
                <td className="diff-content">
                  {renderContent(row)} {/* 行内容 */}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
});

UpdateCodeDiff.displayName = 'UpdateCodeDiff';

export default UpdateCodeDiff;