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
  // Split by top-level or section headers (## or # at start of line)
  const sections = report.split(/(?=^##\s+|^#\s+)/m);
  
  return (
    <div className="space-y-6">
      {sections.map((section, sIdx) => {
        const lines = section.trim().split("\n");
        if (lines.length === 0 || lines[0] === "") return null;

        const headerLine = lines[0];
        // Clean title: remove #, ##, numbers, and ═══ decorative characters
        const rawTitle = headerLine
          .replace(/^#+\s*(?:.*?\d+\.\s*|\d+\.\s*)?/, "")
          .replace(/═══/g, "")
          .trim() || "Overview / Analysis Note";

        const contentLines = lines.slice(1);

        // Classify the section to render custom cards
        const isLongSetup = rawTitle.toLowerCase().includes("long setup") || rawTitle.includes("ฝั่งซื้อ");
        const isShortSetup = rawTitle.toLowerCase().includes("short setup") || rawTitle.includes("ฝั่งขาย");
        const isRiskMgmt = rawTitle.toLowerCase().includes("risk management") || rawTitle.toLowerCase().includes("position setup");
        const isWarning = rawTitle.toLowerCase().includes("คำเตือน") || headerLine.includes("⚠️");
        const isPriceProjection = rawTitle.toLowerCase().includes("price projection") || rawTitle.includes("คาดการณ์โซนราคา") || rawTitle.toLowerCase().includes("scenario");
        const isSummary = rawTitle.toLowerCase().includes("สรุป");
        const isScore = rawTitle.toLowerCase().includes("rocket score");

        // General Card wrapper styles
        let cardStyles = "bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-lg relative overflow-hidden transition-all";
        let iconElement = <FileText className="text-indigo-400 shrink-0" size={20} />;

        if (isLongSetup) {
          cardStyles = "bg-emerald-950/20 border border-emerald-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden";
          iconElement = <TrendingUp className="text-emerald-400 shrink-0" size={22} />;
        } else if (isShortSetup) {
          cardStyles = "bg-rose-950/20 border border-rose-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden";
          iconElement = <TrendingDown className="text-rose-400 shrink-0" size={22} />;
        } else if (isRiskMgmt || isWarning) {
          cardStyles = "bg-amber-950/15 border border-amber-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden";
          iconElement = <ShieldAlert className="text-amber-400 shrink-0" size={22} />;
        } else if (isPriceProjection) {
          cardStyles = "bg-gradient-to-br from-slate-950 via-cyan-950/20 to-purple-950/20 border border-cyan-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden border-l-4 border-l-cyan-400";
          iconElement = <CheckCircle className="text-cyan-400 shrink-0 animate-pulse" size={22} />;
        } else if (isScore) {
          cardStyles = "bg-indigo-950/20 border border-indigo-500/30 rounded-2xl p-6 shadow-lg relative overflow-hidden";
          iconElement = <Award className="text-indigo-400 shrink-0" size={22} />;
        } else if (isSummary) {
          cardStyles = "bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg border-l-4 border-l-indigo-500";
          iconElement = <CheckCircle className="text-indigo-400 shrink-0" size={20} />;
        }

        // Parse list items, paragraphs, tables, alerts, and subheaders
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
                <thead className="bg-slate-900 text-[11px] text-slate-300 uppercase tracking-wider font-bold border-b border-slate-800">
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
          const indentSpaces = contentLines[i].match(/^\s*/)?.[0].length || 0;
          let line = contentLines[i].trim();

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

          // 2. Parse Alerts (> [!WARNING], > [!CAUTION], > [!NOTE])
          if (line.startsWith("> [!")) {
            const alertTypeMatch = line.match(/^>\s*\[!(WARNING|CAUTION|NOTE|IMPORTANT|TIP)\]/i);
            const alertType = alertTypeMatch ? alertTypeMatch[1].toUpperCase() : "NOTE";
            let alertTextLines: string[] = [];
            let j = i + 1;
            while (j < contentLines.length && contentLines[j].trim().startsWith(">")) {
              alertTextLines.push(contentLines[j].trim().replace(/^>\s*/, ""));
              j++;
            }
            i = j - 1; // Advance loop

            let alertStyle = "bg-slate-900 border-l-4 border-l-blue-500 text-slate-300";
            let alertIcon = <FileText size={18} className="text-blue-400 shrink-0 mt-0.5" />;
            if (alertType === "WARNING") {
              alertStyle = "bg-amber-950/30 border border-amber-500/40 border-l-4 border-l-amber-500 text-amber-200";
              alertIcon = <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />;
            } else if (alertType === "CAUTION") {
              alertStyle = "bg-rose-950/40 border border-rose-500/40 border-l-4 border-l-rose-500 text-rose-200";
              alertIcon = <ShieldAlert size={18} className="text-rose-400 shrink-0 mt-0.5" />;
            } else if (alertType === "IMPORTANT" || alertType === "TIP") {
              alertStyle = "bg-emerald-950/30 border border-emerald-500/40 border-l-4 border-l-emerald-500 text-emerald-200";
              alertIcon = <CheckCircle size={18} className="text-emerald-400 shrink-0 mt-0.5" />;
            }

            parsedContent.push(
              <div key={`alert-${i}`} className={`p-4 my-3 rounded-xl flex items-start gap-3 shadow-md ${alertStyle}`}>
                {alertIcon}
                <div className="text-xs leading-relaxed space-y-1">
                  {alertTextLines.map((l, lIdx) => (
                    <div key={lIdx}>{parseInlineMarkdown(l)}</div>
                  ))}
                </div>
              </div>
            );
            continue;
          }

          // Simple blockquote starting with > without [!TYPE]
          if (line.startsWith(">")) {
            const blockText = line.replace(/^>\s*/, "");
            parsedContent.push(
              <blockquote key={i} className="p-3.5 my-2 border-l-4 border-l-indigo-500 bg-indigo-950/20 rounded-r-xl text-xs text-indigo-200 italic">
                {parseInlineMarkdown(blockText)}
              </blockquote>
            );
            continue;
          }

          // 3. Parse subheaders (### Header or #### Subheader)
          if (line.startsWith("###") || line.startsWith("####")) {
            const subtitle = line.replace(/^#{3,4}\s*/, "").replace(/═══/g, "").trim();
            const isLevel4 = line.startsWith("####");
            parsedContent.push(
              <h4
                key={i}
                className={`${
                  isLevel4 ? "text-xs font-semibold text-indigo-300 mt-3 mb-1.5" : "text-sm font-bold text-slate-100 mt-5 mb-2 uppercase tracking-wide border-b border-slate-800/60 pb-1.5"
                }`}
              >
                {subtitle}
              </h4>
            );
            continue;
          }

          // 4. Parse list items (* Item or - Item)
          if (line.startsWith("*") || line.startsWith("-")) {
            const listText = line.replace(/^[*+-]\s*/, "").trim();
            const indentClass = indentSpaces >= 4 ? "ml-8" : indentSpaces >= 2 ? "ml-4" : "ml-1.5";

            // Check if it is a Checkbox item (- [ ] or - [x])
            const checkboxMatch = listText.match(/^\[([ xX/])\]\s*(.*)/);
            if (checkboxMatch) {
              const isChecked = checkboxMatch[1].toLowerCase() === "x" || checkboxMatch[1] === "/";
              const cleanText = checkboxMatch[2];
              parsedContent.push(
                <div key={i} className={`flex items-start gap-2.5 text-xs ${indentClass} my-1.5 leading-relaxed`}>
                  {isChecked ? (
                    <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-4 h-4 border border-slate-600 rounded shrink-0 mt-0.5 bg-slate-900/60 flex items-center justify-center"></div>
                  )}
                  <span className={`flex-1 ${isChecked ? "text-slate-200 font-medium" : "text-slate-400"}`}>
                    {parseInlineMarkdown(cleanText)}
                  </span>
                </div>
              );
              continue;
            }

            // Check if it is a Price Projection summary metric (Current Price, Upside Target Zone, etc.)
            if (isPriceProjection) {
              const metricMatch = listText.match(/^(Current Price|Upside Target Zone|Upside Zone|Base Range|Downside Target Zone|Downside Zone|Time Horizon|Confidence Rating|Confidence|Confirmation Conditions|Invalidation Conditions|News\/Event Risk|Event Risk Status)\s*:\s*(.*)/i);
              if (metricMatch) {
                const label = metricMatch[1].trim();
                const value = metricMatch[2].trim();
                let borderHighlight = "border-slate-800/80 bg-slate-900/60";
                let labelColor = "text-cyan-400";
                if (/Upside/i.test(label)) { borderHighlight = "border-emerald-500/30 bg-emerald-950/20"; labelColor = "text-emerald-400"; }
                else if (/Downside/i.test(label)) { borderHighlight = "border-rose-500/30 bg-rose-950/20"; labelColor = "text-rose-400"; }
                else if (/Base/i.test(label)) { borderHighlight = "border-amber-500/30 bg-amber-950/20"; labelColor = "text-amber-400"; }
                else if (/Risk|Invalidation/i.test(label)) { borderHighlight = "border-purple-500/30 bg-purple-950/20"; labelColor = "text-purple-400"; }

                parsedContent.push(
                  <div key={i} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 p-3 my-2 rounded-xl border ${borderHighlight} shadow-sm text-xs`}>
                    <span className={`font-bold ${labelColor} uppercase tracking-wider shrink-0`}>
                      {label}
                    </span>
                    <span className="text-slate-200 sm:text-right font-medium">
                      {parseInlineMarkdown(value)}
                    </span>
                  </div>
                );
                continue;
              }
            }

            parsedContent.push(
              <div key={i} className={`flex items-start gap-2 text-xs text-slate-300 ${indentClass} my-1.5 leading-relaxed`}>
                <span className="text-indigo-400 mt-0.5 shrink-0 font-bold">•</span>
                <span className="flex-1">{parseInlineMarkdown(listText)}</span>
              </div>
            );
            continue;
          }

          // 5. Parse plain paragraphs
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

        const sectionId = isLongSetup
          ? "long-trading-setup"
          : isShortSetup
            ? "short-trading-setup"
            : undefined;

        return (
          <div key={sIdx} id={sectionId} className={cardStyles}>
            {/* Colored side indicators for setups */}
            {isLongSetup && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />}
            {isShortSetup && <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />}
            {isRiskMgmt && !isLongSetup && !isShortSetup && <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />}
            {isWarning && <div className="absolute top-0 left-0 w-full h-1 bg-rose-600 animate-pulse" />}
            {isScore && <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500" />}

            {/* Header section */}
            <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3 mb-4">
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
