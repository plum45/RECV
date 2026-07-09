"use client";

import React from "react";
import { TrendingUp, TrendingDown, AlertTriangle, ShieldAlert, Award, FileText, CheckCircle } from "lucide-react";

interface AnalysisPanelProps {
  reportText: string | null;
  loading: boolean;
}

// Clean inline markdown helper: converts **bold** to JSX
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-extrabold text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

// Custom parser that splits markdown by header lines and renders custom UI blocks
function renderCustomMarkdown(report: string): React.ReactNode {
  const sections = report.split(/(?=^##\s+\d+\.)/m); // Split by "## X."
  
  return (
    <div className="space-y-8">
      {sections.map((section, sIdx) => {
        const lines = section.trim().split("\n");
        if (lines.length === 0 || lines[0] === "") return null;

        const headerLine = lines[0];
        const rawTitle = headerLine.replace(/^##\s+\d+\.\s*/, "").trim();
        const contentLines = lines.slice(1);

        // Classify the section to render custom cards
        const isLongSetup = rawTitle.toLowerCase().includes("long setup");
        const isShortSetup = rawTitle.toLowerCase().includes("short setup");
        const isRiskMgmt = rawTitle.toLowerCase().includes("risk management");
        const isWarning = rawTitle.toLowerCase().includes("คำเตือน");
        const isSummary = rawTitle.toLowerCase().includes("สรุปแบบภาษาคนทั่วไป");
        const isScore = rawTitle.toLowerCase().includes("rocket score");

        // General Card wrapper styles
        let cardStyles = "bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-lg";
        let iconElement = <FileText className="text-indigo-400 shrink-0" size={20} />;

        if (isLongSetup) {
          cardStyles = "bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden";
          iconElement = <TrendingUp className="text-emerald-400 shrink-0" size={20} />;
        } else if (isShortSetup) {
          cardStyles = "bg-rose-950/20 border border-rose-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden";
          iconElement = <TrendingDown className="text-rose-400 shrink-0" size={20} />;
        } else if (isRiskMgmt || isWarning) {
          cardStyles = "bg-amber-950/15 border border-amber-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden";
          iconElement = <ShieldAlert className="text-amber-400 shrink-0" size={20} />;
        } else if (isScore) {
          cardStyles = "bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-lg relative overflow-hidden";
          iconElement = <Award className="text-indigo-400 shrink-0" size={20} />;
        } else if (isSummary) {
          cardStyles = "bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg border-l-4 border-l-indigo-500";
          iconElement = <CheckCircle className="text-indigo-400 shrink-0" size={20} />;
        }

        // Parse list items, paragraphs, and tables in the content lines
        const parsedContent: React.ReactNode[] = [];
        let tableRows: string[][] = [];
        let isInsideTable = false;

        const pushTable = (rows: string[][], key: string) => {
          if (rows.length === 0) return;
          const headers = rows[0];
          const bodies = rows.slice(2); // Skip separator row (idx 1)

          parsedContent.push(
            <div key={key} className="overflow-x-auto w-full my-4 border border-slate-800/80 rounded-xl">
              <table className="min-w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-900 text-[10px] text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="px-4 py-3">
                        {h.trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                  {bodies.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-900/40 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-4 py-2.5 font-medium">
                          {parseInlineMarkdown(cell.trim())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        };

        for (let i = 0; i < contentLines.length; i++) {
          const line = contentLines[i].trim();

          // 1. Parse tables
          if (line.startsWith("|")) {
            isInsideTable = true;
            const cells = line.split("|").slice(1, -1); // Remove empty first and last elements
            tableRows.push(cells);
            continue;
          } else {
            if (isInsideTable) {
              pushTable(tableRows, `table-${sIdx}-${i}`);
              tableRows = [];
              isInsideTable = false;
            }
          }

          // 2. Parse subheaders (e.g. ### Header)
          if (line.startsWith("###")) {
            const subtitle = line.replace(/^###\s*/, "").trim();
            parsedContent.push(
              <h4 key={i} className="text-sm font-bold text-slate-200 mt-4 mb-2 uppercase tracking-wide">
                {subtitle}
              </h4>
            );
            continue;
          }

          // 3. Parse list items (e.g. * Item or - Item)
          if (line.startsWith("*") || line.startsWith("-")) {
            const listText = line.replace(/^[*+-]\s*/, "").trim();
            parsedContent.push(
              <div key={i} className="flex items-start gap-2 text-xs text-slate-300 ml-2 my-1.5 leading-relaxed">
                <span className="text-indigo-400 mt-1 shrink-0">•</span>
                <span className="flex-1">{parseInlineMarkdown(listText)}</span>
              </div>
            );
            continue;
          }

          // 4. Parse plain paragraphs
          if (line !== "") {
            parsedContent.push(
              <p key={i} className="text-xs text-slate-300 leading-relaxed my-2">
                {parseInlineMarkdown(line)}
              </p>
            );
          }
        }

        // Push any remaining table rows
        if (isInsideTable && tableRows.length > 0) {
          pushTable(tableRows, `table-${sIdx}-end`);
        }

        return (
          <div key={sIdx} className={cardStyles}>
            {/* Colored side indicators for setups */}
            {isLongSetup && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />}
            {isShortSetup && <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />}
            {isRiskMgmt && <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />}
            {isWarning && <div className="absolute top-0 left-0 w-full h-1 bg-rose-600 animate-pulse" />}

            {/* Header section */}
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3 mb-4">
              {iconElement}
              <h3 className="text-base font-extrabold text-slate-100 tracking-wide uppercase">
                {rawTitle}
              </h3>
            </div>

            {/* Content body */}
            <div className="space-y-1">{parsedContent}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalysisPanel({ reportText, loading }: AnalysisPanelProps) {
  if (loading) {
    return (
      <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl animate-pulse space-y-6">
        <div className="h-6 bg-slate-800 rounded w-1/3"></div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-800 rounded"></div>
          <div className="h-4 bg-slate-800 rounded w-5/6"></div>
          <div className="h-4 bg-slate-800 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!reportText) {
    return (
      <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 shadow-xl flex flex-col items-center justify-center min-h-[300px]">
        <AlertTriangle size={32} className="text-slate-600 mb-3 animate-pulse" />
        <p className="text-base font-bold text-slate-400">ยังไม่มีรายงานการวิเคราะห์</p>
        <p className="text-xs text-slate-600 mt-1 max-w-sm">
          เลือกคู่เหรียญ กรอบเวลา และสไตล์เทรดที่คุณต้องการ จากนั้นกดปุ่ม "Analyze" เพื่อสร้างแผนการวิเคราะห์ระบบ AI
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {renderCustomMarkdown(reportText)}
    </div>
  );
}
