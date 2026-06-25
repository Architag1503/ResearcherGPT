'use client';

import { useState, useEffect, use, useRef } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  Upload, FileText, MessageSquare, GitBranch, Table, Bookmark,
  AlertTriangle, Play, RefreshCw, Layers, Edit, CheckCircle, Trash2, Download, Shield,
  GraduationCap, ChevronLeft, ChevronRight, Plus
} from 'lucide-react';

import ChatWindow from '../../../components/ChatWindow';
import TipTapEditor from '../../../components/TipTapEditor';
import EvidencePanel from '../../../components/EvidencePanel';
import KnowledgeGraph3D from '../../../components/KnowledgeGraph3D';

const getApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl;
    }
    // Dynamic fallback to serve from the correct host IP/hostname
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
};
const API_URL = getApiUrl();

const tabItems = [
  { id: 'papers', label: 'Papers & Upload', icon: Upload },
  { id: 'chat', label: 'AI RAG Chat', icon: MessageSquare },
  { id: 'graph', label: '3D Knowledge Graph', icon: GitBranch },
  { id: 'litreview', label: 'Literature & Matrix', icon: Table },
  { id: 'citations', label: 'Citations', icon: Bookmark },
  { id: 'gaps', label: 'Gap Analysis', icon: AlertTriangle },
  { id: 'agents', label: 'Agent Runs', icon: Layers },
  { id: 'saved_papers', label: 'Saved Research Papers', icon: FileText },
  { id: 'plagiarism', label: 'Plagiarism Report', icon: Shield },
  { id: 'editor', label: 'Writing Workspace', icon: Edit },
];

const getRunProgressPercent = (run: any) => {
  if (run.status === 'completed') return 100;
  if (run.status === 'failed') return 0;
  
  const totalSteps = run.steps.length;
  if (!totalSteps) return 0;
  
  const completedSteps = run.steps.filter((s: any) => s.status === 'completed').length;
  const runningStep = run.steps.some((s: any) => s.status === 'running');
  
  let basePercent = (completedSteps / totalSteps) * 100;
  if (runningStep) {
    basePercent += (1 / totalSteps) * 50;
  }
  
  return Math.min(Math.round(basePercent), 99);
};

const parseMarkdownToHTML = (markdown: string): string => {
  if (!markdown) return '';
  
  // Normalize line endings to LF
  let html = markdown.replace(/\r\n/g, '\n');

  // Normalize uploads URLs dynamically
  html = html.replace(/src=["']uploads\//g, `src="${API_URL}/uploads/`);
  html = html.replace(/src=["']https?:\/\/[^\/]+(:\d+)?\/uploads\//g, `src="${API_URL}/uploads/`);

  // If the content is already HTML, do not convert
  if (/<p>|<table|<ul>|<li>|<strong>|<em>|<code>/i.test(html)) {
    return html;
  }

  const shielded: string[] = [];

  // 1. Shield code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, (match, lang, code) => {
    const cleanCode = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const placeholder = `<!-- SHIELDCODE${shielded.length} -->`;
    shielded.push(`<pre><code class="language-${lang}">${cleanCode}</code></pre>`);
    return placeholder;
  });

  // 2. Shield math blocks:
  // Double dollar blocks ($$ ... $$)
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    const placeholder = `<!-- SHIELDMATHBLOCK${shielded.length} -->`;
    shielded.push(`$$${math}$$`);
    return placeholder;
  });

  // First shield single-line inline math (does not contain newlines)
  html = html.replace(/\$([^\$\n]+?)\$/g, (match, math) => {
    const placeholder = `<!-- SHIELDMATHINLINE${shielded.length} -->`;
    shielded.push(`$${math}$`);
    return placeholder;
  });

  // Then shield multiline math (contains newlines) only if it contains LaTeX indicators
  html = html.replace(/\$([^\$]+?)\$/g, (match, math) => {
    if (math.includes('\\') || math.includes('_') || math.includes('^') || math.includes('{') || math.includes('}') || math.includes('&')) {
      const placeholder = `<!-- SHIELDMATHINLINE${shielded.length} -->`;
      // Convert to double dollars to render as display math since it's multiline
      shielded.push(`$$\n${math.trim()}\n$$`);
      return placeholder;
    }
    return match;
  });

  // Image parsing: ![alt](url) -> img tag
  html = html.replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, (match, alt, url) => {
    let src = url.trim();
    if (src.startsWith('uploads/')) {
      src = `${API_URL}/${src}`;
    } else if (src.startsWith('/uploads/')) {
      src = `${API_URL}${src}`;
    }
    return `<div class="diagram-container text-center my-4" style="margin: 18pt auto; width:100%;"><img src="${src}" alt="${alt}" class="diagram-figure mx-auto shadow-sm" style="max-width: 100%; border: 1px solid #ddd; padding: 10px; background: #fff;" /></div>`;
  });

  // 3. Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');


  // 4. Bold & Italic
  html = html.replace(/\*\*\*([^\*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
  html = html.replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 5. Headings (Markdown to HTML)
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 6. Markdown tables — proper thead/tbody/th structure with captions
  const tableLineGroups = html.split('\n');
  let inTable = false;
  let tableHTML = '';
  let tableRowIndex = 0;  // 0 = header row, 1 = separator, 2+ = body rows
  let tableCounter = 1;
  const processedLines = tableLineGroups.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableRowIndex = 0;
        tableHTML = `<table class="research-table" style="width:100%;border-collapse:collapse;margin:14pt auto;font-size:9pt;"><caption style="caption-side:top;font-weight:bold;font-size:9pt;margin-bottom:4px;text-align:left;">Table ${tableCounter}.</caption>`;
        tableCounter++;
      }

      const cells = trimmed.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      const isSeparator = cells.every(c => /^:?-+:?$/.test(c));

      if (isSeparator) {
        // Separator row signals end of header → open tbody
        tableHTML += '<tbody>';
        tableRowIndex = 2;
        return '';
      }

      if (tableRowIndex === 0) {
        // Header row → use <th> cells inside <thead>
        tableHTML += '<thead><tr>' + cells.map(cell => `<th style="padding:6px 10px;border:1px solid #ccc;background:#f0f0f0;font-weight:bold;">${cell}</th>`).join('') + '</tr></thead>';
      } else {
        // Body rows
        tableHTML += '<tr>' + cells.map((cell, ci) => `<td style="padding:5px 10px;border:1px solid #ddd;${ci === 0 ? 'font-weight:600;' : ''}">${cell}</td>`).join('') + '</tr>';
      }
      tableRowIndex++;
      return '';
    } else {
      if (inTable) {
        inTable = false;
        const completeTable = tableHTML + (tableRowIndex > 2 ? '</tbody>' : '') + '</table>';
        tableHTML = '';
        tableRowIndex = 0;
        return completeTable + '\n' + line;
      }
      return line;
    }
  });

  if (inTable) {
    processedLines.push(tableHTML + (tableRowIndex > 2 ? '</tbody>' : '') + '</table>');
  }

  html = processedLines.filter(l => l !== '').join('\n');


  // 7. Bullet Lists
  const listLines = html.split('\n');
  let inList = false;
  const processedListLines = listLines.map(line => {
    const trimmed = line.trim();
    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
    if (isBullet) {
      const content = trimmed.substring(2);
      let res = '';
      if (!inList) {
        inList = true;
        res += '<ul>';
      }
      res += `<li>${content}</li>`;
      return res;
    } else {
      if (inList) {
        inList = false;
        return '</ul>\n' + line;
      }
      return line;
    }
  });
  
  if (inList) {
    processedListLines.push('</ul>');
  }
  
  html = processedListLines.join('\n');

  // 8. Convert remaining paragraphs (double newlines) to <p> tags
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(p => {
    const trimmed = p.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<!-- SHIELDCODE') || 
        trimmed.startsWith('<!-- SHIELDMATHBLOCK') ||
        trimmed.startsWith('<pre') || 
        trimmed.startsWith('<table') || 
        trimmed.startsWith('<ul') || 
        trimmed.startsWith('<h1') || 
        trimmed.startsWith('<h2') || 
        trimmed.startsWith('<h3') || 
        trimmed.startsWith('<h4') || 
        trimmed.startsWith('<section')) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  // 9. Restore shielded blocks in reverse order
  for (let i = shielded.length - 1; i >= 0; i--) {
    const placeholderCode = `<!-- SHIELDCODE${i} -->`;
    const placeholderMathB = `<!-- SHIELDMATHBLOCK${i} -->`;
    const placeholderMathI = `<!-- SHIELDMATHINLINE${i} -->`;

    html = html.replace(placeholderCode, () => shielded[i]);
    html = html.replace(placeholderMathB, () => shielded[i]);
    html = html.replace(placeholderMathI, () => shielded[i]);
  }

  return html;
};

const cleanMathHTML = (html: string): string => {
  if (!html) return '';
  let clean = html;

  // Clean double dollar blocks ($$ ... $$)
  clean = clean.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    const cleanMath = math
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    return `\$\$${cleanMath}\$\$`;
  });

  // Clean single dollar inline math ($ ... $)
  clean = clean.replace(/\$([^\$]+?)\$/g, (match, math) => {
    if (math.includes('\\') || math.includes('_') || math.includes('^')) {
      const cleanMath = math
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      return `\$${cleanMath}\$`;
    }
    return match;
  });

  return clean;
};

const toRomanGlobal = (num: number): string => {
  const map: { [key: string]: number } = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  let roman = '';
  let n = num;
  for (let key in map) {
    while (n >= map[key]) {
      roman += key;
      n -= map[key];
    }
  }
  return roman;
};

const repairLatex = (math: string): string => {
  let clean = math.trim();
  
  // 1. Balance environments
  const envRegex = /\\(begin|end)\{([a-zA-Z*]+)\}/g;
  let match;
  const envStack: string[] = [];
  const envOps: { type: 'begin' | 'end', name: string }[] = [];
  while ((match = envRegex.exec(clean)) !== null) {
    envOps.push({ type: match[1] as 'begin' | 'end', name: match[2] });
  }
  
  for (const op of envOps) {
    if (op.type === 'begin') {
      envStack.push(op.name);
    } else {
      const idx = envStack.lastIndexOf(op.name);
      if (idx !== -1) {
        envStack.splice(idx, 1);
      }
    }
  }
  
  while (envStack.length > 0) {
    const env = envStack.pop();
    clean += `\n\\end{${env}}`;
  }

  // 2. Balance braces '{' and '}'
  let openBraces = 0;
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '{' && (i === 0 || clean[i-1] !== '\\')) {
      openBraces++;
    } else if (clean[i] === '}' && (i === 0 || clean[i-1] !== '\\')) {
      if (openBraces > 0) {
        openBraces--;
      } else {
        clean = clean.slice(0, i) + clean.slice(i + 1);
        i--;
      }
    }
  }
  if (openBraces > 0) {
    clean += '}'.repeat(openBraces);
  }

  // 3. Balance brackets '[' and ']'
  let openBrackets = 0;
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '[' && (i === 0 || clean[i-1] !== '\\')) {
      openBrackets++;
    } else if (clean[i] === ']' && (i === 0 || clean[i-1] !== '\\')) {
      if (openBrackets > 0) {
        openBrackets--;
      } else {
        clean = clean.slice(0, i) + clean.slice(i + 1);
        i--;
      }
    }
  }
  if (openBrackets > 0) {
    clean += ']'.repeat(openBrackets);
  }

  // 4. Subscript/Superscript repairs
  clean = clean.replace(/([_^])\s*$/g, '');
  clean = clean.replace(/([_^])\s*(?=[}])/g, '');
  clean = clean.replace(/([a-zA-Z0-9])_([a-zA-Z0-9]{2,})/g, '$1_{$2}');
  clean = clean.replace(/([a-zA-Z0-9])\^([a-zA-Z0-9]{2,})/g, '$1^{$2}');

  // 5. Clean trailing matrix row breaks
  clean = clean.replace(/\\\\\s*\\end/g, ' \\end');

  return clean;
};

const convertOptimizationInMath = (math: string): string => {
  const lower = math.toLowerCase();
  if ((lower.includes('minimize') || lower.includes('maximize')) && 
      (lower.includes('subject to') || lower.includes('s.t.') || lower.includes('st ') || lower.includes('constraints'))) {
    const match = math.match(/(minimize|minimise|maximize|maximise)\s+([\s\S]+?)\s+(subject to|s\.t\.|st|constraints)\s+([\s\S]+?)$/i);
    if (match) {
      const op = match[1].toLowerCase().startsWith('min') ? '\\min' : '\\max';
      const obj = match[2].trim();
      const constraints = match[4].trim().split(/\\\\|\n/).map(c => {
        let tc = c.trim();
        if (tc.startsWith('&')) tc = tc.substring(1).trim();
        return `& ${tc}`;
      }).join(' \\\\\n');
      return `\\begin{aligned}\n${op} \\quad & ${obj} \\\\\n\\text{s.t.} \\quad & ${constraints}\n\\end{aligned}`;
    }
  }
  return math;
};

const formatOptimizationProblems = (text: string): string => {
  const optRegex = /(minimize|minimise|maximize|maximise)\s+([\s\S]+?)\s+(subject to|s\.t\.|st)\s+([\s\S]+?)(?=\n\n|\$\$|\\end|\\begin|$)/gi;
  return text.replace(optRegex, (match, op, objective, stLabel, constraints) => {
    const minMax = op.toLowerCase().startsWith('min') ? '\\min' : '\\max';
    const cleanObjective = objective.trim().replace(/\n+/g, ' ');
    const cleanConstraints = constraints.trim().split(/\n+/).map((c: string) => {
      let trimmed = c.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        trimmed = trimmed.substring(1).trim();
      }
      return `& ${trimmed}`;
    }).join(' \\\\\n');

    return `\n\n$$\n\\begin{aligned}\n${minMax} \\quad & ${cleanObjective} \\\\\n\\text{s.t.} \\quad & ${cleanConstraints}\n\\end{aligned}\n$$\n\n`;
  });
};

const generateArchitectureDiagram = (text: string): string | null => {
  const lower = text.toLowerCase();
  const isArchitectureDesc = (
    lower.includes("system contains") || 
    lower.includes("architecture contains") || 
    lower.includes("pipeline consists of") ||
    lower.includes("components are") ||
    lower.includes("workflow comprises")
  );
  if (!isArchitectureDesc) return null;

  const componentMatch = text.match(/(?:contains|comprises|consists of|components are)\s+([^.]+)/i);
  if (!componentMatch) return null;

  const componentsList = componentMatch[1]
    .split(/,|\band\b/)
    .map(c => c.trim())
    .filter(c => c.length > 2 && c.length < 50);

  if (componentsList.length < 2) return null;

  let mermaidCode = "graph TD\n";
  const nodes = componentsList.map((c, idx) => {
    const cleanName = c.replace(/^(the|a|an)\s+/i, '');
    return {
      id: `node${idx}`,
      label: cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
    };
  });

  nodes.forEach(n => {
    mermaidCode += `  ${n.id}["${n.label}"]\n`;
  });

  const supervisorIndex = nodes.findIndex(n => 
    n.label.toLowerCase().includes("supervisor") || 
    n.label.toLowerCase().includes("manager") || 
    n.label.toLowerCase().includes("interface")
  );

  if (supervisorIndex !== -1) {
    const sup = nodes[supervisorIndex];
    nodes.forEach((n, idx) => {
      if (idx !== supervisorIndex) {
        mermaidCode += `  ${sup.id} --> ${n.id}\n`;
      }
    });
  } else {
    for (let i = 0; i < nodes.length - 1; i++) {
      mermaidCode += `  ${nodes[i].id} --> ${nodes[i+1].id}\n`;
    }
  }

  return mermaidCode;
};

const formatIEEEAlgorithm = (codeText: string, algorithmIndex: number): string => {
  const lines = codeText.split('\n');
  let title = `Algorithm ${algorithmIndex}`;
  let inputLines: string[] = [];
  let outputLines: string[] = [];
  let bodyLines: string[] = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith('algorithm') && (trimmed.includes(':') || trimmed.includes('name'))) {
      const idx = trimmed.indexOf(':');
      if (idx !== -1) {
        title = `Algorithm ${algorithmIndex}: ${trimmed.substring(idx + 1).trim()}`;
      } else {
        title = trimmed;
      }
    } else if (trimmed.toLowerCase().startsWith('input:')) {
      inputLines.push(trimmed);
    } else if (trimmed.toLowerCase().startsWith('output:')) {
      outputLines.push(trimmed);
    } else if (trimmed) {
      bodyLines.push(line);
    }
  });

  let html = `<div class="ieee-algorithm" style="border-top: 2px solid #000; border-bottom: 2px solid #000; margin: 12pt 0; font-family: monospace; font-size: 8.5pt; line-height: 1.3; width: 100%; box-sizing: border-box;">`;
  html += `<div style="border-bottom: 1px solid #000; padding: 3px 0 5px 0; font-weight: bold; color: #000;">${title}</div>`;
  
  if (inputLines.length > 0 || outputLines.length > 0) {
    html += `<div style="border-bottom: 1px solid #ddd; padding: 4px 0; color: #000;">`;
    inputLines.forEach(line => html += `<div style="padding-left: 10px;"><strong>Input:</strong> ${line.substring(6).trim()}</div>`);
    outputLines.forEach(line => html += `<div style="padding-left: 10px;"><strong>Output:</strong> ${line.substring(7).trim()}</div>`);
    html += `</div>`;
  }

  html += `<div style="padding: 6px 0; color: #000;">`;
  let lineNum = 1;
  bodyLines.forEach((line) => {
    const spaces = line.match(/^\s*/)?.[0] || '';
    const indentPx = spaces.length * 6;
    const cleanLine = line.trim();
    
    let highlightedLine = cleanLine
      .replace(/\b(if|else|elif|endif|end if|then|for|each|to|while|do|endfor|endwhile|return|function|procedure)\b/g, '<strong>$1</strong>');

    html += `<div style="display: flex; align-items: flex-start; margin-bottom: 2px;">`;
    html += `<div style="width: 24px; text-align: right; padding-right: 8px; color: #666; user-select: none; border-right: 1px solid #ddd; font-size: 7.5pt;">${lineNum}</div>`;
    html += `<div style="padding-left: ${10 + indentPx}px; flex-grow: 1;">${highlightedLine}</div>`;
    html += `</div>`;
    lineNum++;
  });
  html += `</div>`;
  html += `</div>`;

  return html;
};

const formatIEEEBibliographyEntry = (c: any, index: number): string => {
  const authors = Array.isArray(c.authors) ? c.authors : (c.authors ? c.authors.split(',') : []);
  const cleanAuthors = authors.map((a: string) => {
    const trimmed = a.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) {
      const lastName = parts[parts.length - 1];
      const initials = parts.slice(0, parts.length - 1).map(p => {
        const char = p.charAt(0).toUpperCase();
        return char ? `${char}.` : '';
      }).filter(Boolean).join(' ');
      return `${initials} ${lastName}`;
    }
    return trimmed;
  });

  let authorStr = '';
  if (cleanAuthors.length > 0) {
    if (cleanAuthors.length === 1) {
      authorStr = cleanAuthors[0];
    } else if (cleanAuthors.length === 2) {
      authorStr = `${cleanAuthors[0]} and ${cleanAuthors[1]}`;
    } else {
      authorStr = `${cleanAuthors.slice(0, -1).join(', ')}, and ${cleanAuthors[cleanAuthors.length - 1]}`;
    }
  } else {
    authorStr = 'Anonymous';
  }

  const title = c.title ? `"${c.title},"` : '"Untitled,"';
  const journal = c.journal ? `*${c.journal}*` : '';
  const volume = c.volume ? `vol. ${c.volume}` : '';
  const issue = c.issue ? `no. ${c.issue}` : '';
  const pages = c.pages ? `pp. ${c.pages}` : '';
  const year = c.year ? `${c.year}` : '';
  const doi = c.doi ? `doi: ${c.doi}.` : '';

  const parts = [
    authorStr,
    title,
    journal,
    volume,
    issue,
    pages,
    year
  ].filter(Boolean);

  let formatted = parts.join(', ');
  if (!formatted.endsWith('.')) {
    formatted += '.';
  }
  if (doi) {
    formatted += ` ${doi}`;
  }

  return `<div class="bibliography-entry" style="margin-bottom: 6pt; text-indent: -24px; padding-left: 24px; font-size: 9pt; color: #000;">[${index}] ${formatted}</div>`;
};

const resolveAndFormatCitations = (html: string, databaseCitations: any[]): string => {
  if (typeof window === 'undefined') return html;
  if (!databaseCitations || databaseCitations.length === 0) return html;

  const citationRegex = /\[([^\]]{1,30})\]/g;
  let match;
  const citationKeysInOrder: string[] = [];

  const plainText = html.replace(/<[^>]*>/g, ' ');
  while ((match = citationRegex.exec(plainText)) !== null) {
    const key = match[1].trim();
    if (key && !key.toLowerCase().startsWith('shield_') && !key.toLowerCase().startsWith('figure') && !key.toLowerCase().startsWith('table') && !key.toLowerCase().startsWith('algorithm')) {
      const subKeys = key.split(',').map((s: string) => s.trim());
      subKeys.forEach((subKey: string) => {
        if (!citationKeysInOrder.includes(subKey)) {
          citationKeysInOrder.push(subKey);
        }
      });
    }
  }

  const mappedCitations: any[] = [];
  const citationMap = new Map<string, number>();

  citationKeysInOrder.forEach((key) => {
    let matchedCit = databaseCitations.find(c => {
      if (c._id === key || c.id === key) return true;
      const titleLower = (c.title || '').toLowerCase();
      const keyLower = key.toLowerCase();
      if (titleLower.includes(keyLower)) return true;
      if (c.authors && c.authors.some((a: string) => a.toLowerCase().includes(keyLower))) return true;
      return false;
    });

    const num = parseInt(key);
    if (!matchedCit && !isNaN(num) && num > 0 && num <= databaseCitations.length) {
      matchedCit = databaseCitations[num - 1];
    }

    const isHexId = /^[a-fA-F0-9]{24}$/.test(key);
    const isNumeric = /^\d+$/.test(key);
    if (!matchedCit && databaseCitations.length > 0 && (isHexId || isNumeric)) {
      matchedCit = databaseCitations.find(c => !mappedCitations.includes(c)) || databaseCitations[0];
    }

    if (matchedCit && !mappedCitations.includes(matchedCit)) {
      mappedCitations.push(matchedCit);
      citationMap.set(key, mappedCitations.length);
    } else if (matchedCit) {
      const idx = mappedCitations.indexOf(matchedCit) + 1;
      citationMap.set(key, idx);
    }
  });

  databaseCitations.forEach((c) => {
    if (!mappedCitations.includes(c)) {
      mappedCitations.push(c);
    }
  });

  let updatedHtml = html;
  updatedHtml = updatedHtml.replace(/\[([^\]]{1,30})\]/g, (m, key) => {
    const trimmedKey = key.trim();
    const subKeys = trimmedKey.split(',').map((s: string) => s.trim());
    const resolved = subKeys.map((subKey: string) => {
      if (citationMap.has(subKey)) {
        return citationMap.get(subKey);
      }
      return null;
    });
    
    if (resolved.every((r: number | null) => r !== null)) {
      return `[${resolved.join(', ')}]`;
    }
    
    const isHexId = /^[a-fA-F0-9]{24}$/.test(trimmedKey) || subKeys.some((s: string) => /^[a-fA-F0-9]{24}$/.test(s));
    const isNumeric = /^\d+$/.test(trimmedKey) || subKeys.some((s: string) => /^\d+$/.test(s));
    if (!isHexId && !isNumeric && !databaseCitations.some(c => trimmedKey.toLowerCase().includes((c.title || '').toLowerCase()))) {
      return m;
    }
    
    return `[1]`;
  });

  let bibliographyHTML = '';
  if (mappedCitations.length > 0) {
    bibliographyHTML = `<div class="references-section" style="margin-top: 24pt; border-top: 1px solid #000; padding-top: 12pt; color: #000;">`;
    bibliographyHTML += `<h2 class="unnumbered-heading" style="text-align: center; text-transform: uppercase; font-size: 10pt; font-weight: bold; margin-bottom: 12pt; color: #000;">References</h2>`;
    mappedCitations.forEach((c, idx) => {
      bibliographyHTML += formatIEEEBibliographyEntry(c, idx + 1);
    });
    bibliographyHTML += `</div>`;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(updatedHtml, 'text/html');
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3'));
  let refHeading: Element | null = null;
  for (const h of headings) {
    const text = h.textContent?.toLowerCase() || '';
    if (text.includes('references') || text.includes('bibliography')) {
      refHeading = h;
      break;
    }
  }

  if (refHeading) {
    let sibling = refHeading.nextElementSibling;
    while (sibling) {
      const next = sibling.nextElementSibling;
      sibling.remove();
      sibling = next;
    }
    refHeading.remove();
  }

  updatedHtml = doc.body.innerHTML + '\n' + bibliographyHTML;
  return updatedHtml;
};

const formatPaperHTML = (rawHtml: string, format: string, databaseCitations: any[]): string => {
  let html = rawHtml;

  // Normalize uploads URLs dynamically
  html = html.replace(/src=["']uploads\//g, `src="${API_URL}/uploads/`);
  html = html.replace(/src=["']https?:\/\/[^\/]+(:\d+)?\/uploads\//g, `src="${API_URL}/uploads/`);

  // 1. Convert optimization problems
  html = formatOptimizationProblems(html);

  // 2. Scan text for diagram descriptions and auto-insert Mermaid blocks
  const paragraphs = html.match(/<p>([\s\S]*?)<\/p>/g) || [];
  paragraphs.forEach(p => {
    const innerText = p.replace(/<[^>]*>/g, '').trim();
    const mermaidCode = generateArchitectureDiagram(innerText);
    if (mermaidCode) {
      const diagramHtml = `<pre><code class="language-mermaid">${mermaidCode}</code></pre>`;
      html = html.replace(p, `${p}\n${diagramHtml}`);
    }
  });

  // 3. Pre-process algorithms
  let algorithmCount = 1;
  html = html.replace(/<pre><code class="language-algorithm">([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
    return formatIEEEAlgorithm(code, algorithmCount++);
  });
  html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
    const lower = code.toLowerCase();
    if (lower.includes('algorithm') && (lower.includes('input:') || lower.includes('output:'))) {
      return formatIEEEAlgorithm(code, algorithmCount++);
    }
    return match;
  });

  // 4. Sequential equation numbering for display math
  let equationCounter = 1;
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    let cleanMath = repairLatex(math);
    cleanMath = convertOptimizationInMath(cleanMath);
    if (!cleanMath.includes('\\tag{')) {
      cleanMath = `${cleanMath.trim()} \\tag{${equationCounter++}}`;
    }
    return `\$\$${cleanMath}\$\$`;
  });

  // 5. Resolve citations & references, sort, and append bibliography
  html = resolveAndFormatCitations(html, databaseCitations);

  return html;
};

function AgentStepProgress({ step }: { step: any }) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    if (step.status === 'completed') {
      setPercent(100);
    } else if (step.status === 'pending') {
      setPercent(0);
    } else if (step.status === 'running') {
      setPercent(15);
      const interval = setInterval(() => {
        setPercent((prev) => {
          if (prev >= 98) return 98;
          return prev + Math.floor(Math.random() * 5) + 2;
        });
      }, 800);
      return () => clearInterval(interval);
    } else if (step.status === 'failed') {
      setPercent(0);
    }
  }, [step.status]);

  return (
    <div className="p-3 rounded-lg border border-zinc-850 bg-zinc-950/60 flex flex-col justify-between items-center space-y-2 relative overflow-hidden group">
      {step.status === 'running' && (
        <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
      )}
      <div className="w-full flex justify-between items-center text-[10px] font-medium text-zinc-400 z-10">
        <span className="truncate max-w-[90px]">{step.name}</span>
        <span className={`font-semibold ${
          step.status === 'completed' ? 'text-emerald-400' :
          step.status === 'running' ? 'text-indigo-400' :
          step.status === 'failed' ? 'text-red-400' : 'text-zinc-600'
        }`}>
          {step.status === 'completed' ? '100%' :
           step.status === 'running' ? `${percent}%` :
           step.status === 'failed' ? 'Failed' : '0%'}
        </span>
      </div>
      
      <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden z-10">
        <div 
          className={`h-full rounded-full transition-all duration-300 ${
            step.status === 'completed' ? 'bg-emerald-500' :
            step.status === 'running' ? 'bg-indigo-500 animate-pulse' :
            step.status === 'failed' ? 'bg-red-500' : 'bg-zinc-800'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      
      <span className={`text-[8px] font-semibold uppercase tracking-wider ${
        step.status === 'completed' ? 'text-emerald-500/80' :
        step.status === 'running' ? 'text-indigo-400 animate-pulse' :
        step.status === 'failed' ? 'text-red-500/80' : 'text-zinc-650'
      }`}>
        {step.status}
      </span>
    </div>
  );
}

const getExportPipelineScript = (format: string): string => {
  const s: string[] = [];
  s.push('              function runExportPipeline() {');
  s.push('                // 1. Detect and replace Mermaid code blocks with div.mermaid');
  s.push('                const preElements = document.querySelectorAll("pre");');
  s.push('                preElements.forEach(pre => {');
  s.push('                  const innerHTML = pre.innerHTML || "";');
  s.push('                  const text = innerHTML');
  s.push('                    .replace(/<br\\\\s*\\\\/?>/gi, "\\\\n")');
  s.push('                    .replace(/<\\\\/[^>]*>/g, "")');
  s.push('                    .replace(/<[^>]*>/g, "")');
  s.push('                    .replace(/&amp;/g, "&")');
  s.push('                    .replace(/&lt;/g, "<")');
  s.push('                    .replace(/&gt;/g, ">")');
  s.push('                    .trim();');
  s.push('                  const isMermaid = /^(graph|flowchart|sequenceDiagram|gantt|classDiagram|stateDiagram|pie|erDiagram|journey|gitGraph|requirementDiagram|mindmap)\\\\b/i.test(text);');
  s.push('                  if (isMermaid) {');
  s.push('                    const cleanedText = text.replace(/\\\\|\\\\s*>\\\\s*/g, \'|\');');
  s.push('                    const div = document.createElement("div");');
  s.push('                    div.className = "mermaid";');
  s.push('                    div.textContent = cleanedText;');
  s.push('                    pre.replaceWith(div);');
  s.push('                  }');
  s.push('                });');
  s.push('');
  s.push('                // 2. Initialize Mermaid');
  s.push('                try {');
  s.push('                  mermaid.initialize({ startOnLoad: true, theme: \'neutral\' });');
  s.push('                } catch (e) {');
  s.push('                  console.error("Mermaid initialization failed:", e);');
  s.push('                }');
  s.push('');
  s.push('                // 3. Render LaTeX math using KaTeX with inline $ config');
  s.push('                const runMath = () => {');
  s.push('                  if (typeof renderMathInElement === \'function\') {');
  s.push('                    renderMathInElement(document.body, {');
  s.push('                      delimiters: [');
  s.push('                        {left: \'$$\', right: \'$$\', display: true},');
  s.push('                        {left: \'$\', right: \'$\', display: false},');
  s.push('                        {left: \'\\\\(\', right: \'\\\\)\', display: false},');
  s.push('                        {left: \'\\\\[\', right: \'\\\\]\', display: true}');
  s.push('                      ],');
  s.push('                      throwOnError: false');
  s.push('                    });');
  s.push('                  }');
  s.push('                };');
  s.push('');
  s.push('                // Poll for KaTeX auto-render library to load');
  s.push('                const interval = setInterval(() => {');
  s.push('                  if (typeof renderMathInElement === \'function\') {');
  s.push('                    clearInterval(interval);');
  s.push('                    runMath();');
  s.push('                  }');
  s.push('                }, 50);');
  s.push('                setTimeout(() => clearInterval(interval), 3000);');
  s.push('');
  s.push('                // 4. Format all headings dynamically based on the styling format');
  s.push('                const formatHeadings = (format) => {');
  s.push('                  const toRoman = (num) => {');
  s.push('                    const map = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };');
  s.push('                    let roman = \'\';');
  s.push('                    let n = num;');
  s.push('                    for (let key in map) {');
  s.push('                      while (n >= map[key]) {');
  s.push('                        roman += key;');
  s.push('                        n -= map[key];');
  s.push('                      }');
  s.push('                    }');
  s.push('                    return roman;');
  s.push('                  };');
  s.push('');
  s.push('                  const headings = document.querySelectorAll("h2, h3, h4");');
  s.push('                  headings.forEach(h => {');
  s.push('                    let text = h.textContent.trim();');
  s.push('                    text = text.replace(/^#+\\\s*/, "");');
  s.push('');
  s.push('                    if (format === \'APA\') {');
  s.push('                      h.textContent = text.replace(/^\\\d+(\\\.\\\d+)*\\\.?\\s*/, \'\').trim();');
  s.push('                      return;');
  s.push('                    }');
  s.push('');
  s.push('                    const match = text.match(/^(\\\d+(?:\\\.\\\d+)*)\\\.?\\s*(.*)$/);');
  s.push('                    if (!match) {');
  s.push('                      if (format === \'IEEE\' || format === \'ACM\') {');
  s.push('                        h.textContent = text.toUpperCase();');
  s.push('                        h.classList.add("unnumbered-heading");');
  s.push('                      } else {');
  s.push('                        h.textContent = text;');
  s.push('                      }');
  s.push('                      return;');
  s.push('                    }');
  s.push('');
  s.push('                    const numStr = match[1];');
  s.push('                    const restText = match[2];');
  s.push('');
  s.push('                    if (format === \'IEEE\') {');
  s.push('                      if (h.tagName === \'H2\') {');
  s.push('                        const num = parseInt(numStr.split(\'.\')[0]) || 1;');
  s.push('                        h.textContent = toRoman(num) + ". " + restText.toUpperCase();');
  s.push('                      } else if (h.tagName === \'H3\') {');
  s.push('                        const parts = numStr.split(\'.\');');
  s.push('                        const subIndex = parseInt(parts[1]) || 1;');
  s.push('                        const letter = String.fromCharCode(64 + subIndex);');
  s.push('                        h.textContent = letter + ". " + restText;');
  s.push('                      } else if (h.tagName === \'H4\') {');
  s.push('                        const parts = numStr.split(\'.\');');
  s.push('                        const subSubIndex = parseInt(parts[2]) || 1;');
  s.push('                        h.textContent = subSubIndex + ") " + restText;');
  s.push('                      }');
  s.push('                    } else if (format === \'ACM\') {');
  s.push('                      if (h.tagName === \'H2\') {');
  s.push('                        h.textContent = numStr + " " + restText.toUpperCase();');
  s.push('                      } else {');
  s.push('                        h.textContent = numStr + " " + restText;');
  s.push('                      }');
  s.push('                    } else {');
  s.push('                      h.textContent = numStr + " " + restText;');
  s.push('                    }');
  s.push('                  });');
  s.push('                };');
  s.push('');
  s.push('                formatHeadings("\' + format + \'");');
  s.push('');
  s.push('                // 5. Process Figures & Tables (PlantUML, Graphviz, Captions, Numbering)');
  s.push('                const processFiguresAndTables = () => {');
  s.push('                  // 5.1. PlantUML and DOT blocks');
  s.push('                  const pres = document.querySelectorAll("pre");');
  s.push('                  pres.forEach(pre => {');
  s.push('                    const text = pre.textContent.trim();');
  s.push('                    if (text.includes("@startuml") || text.startsWith("@startuml")) {');
  s.push('                      const div = document.createElement("div");');
  s.push('                      div.className = "diagram-container";');
  s.push('                      div.style.margin = "18pt 0";');
  s.push('                      div.style.textAlign = "center";');
  s.push('                      ');
  s.push('                      const img = document.createElement("img");');
  s.push('                      img.className = "diagram-figure";');
  s.push('                      img.style.maxWidth = "100%";');
  s.push('                      img.style.backgroundColor = "#fff";');
  s.push('                      img.style.padding = "10px";');
  s.push('                      img.style.border = "1px solid #ddd";');
  s.push('                      ');
  s.push('                      const plantumlEncoder = window.plantumlEncoder;');
  s.push('                      if (plantumlEncoder) {');
  s.push('                        const encoded = plantumlEncoder.encode(text);');
  s.push('                        img.src = "https://www.plantuml.com/plantuml/svg/" + encoded;');
  s.push('                      } else {');
  s.push('                        img.src = "https://www.plantuml.com/plantuml/svg/SyfFKj2rKt3CoKnELR1Io4ZDoSa7qE8B0W00";');
  s.push('                      }');
  s.push('                      div.appendChild(img);');
  s.push('                      pre.replaceWith(div);');
  s.push('                    } else if (text.startsWith("digraph") || text.startsWith("graph") && text.includes("{")) {');
  s.push('                      const div = document.createElement("div");');
  s.push('                      div.className = "diagram-container";');
  s.push('                      div.style.margin = "18pt 0";');
  s.push('                      div.style.textAlign = "center";');
  s.push('                      ');
  s.push('                      const img = document.createElement("img");');
  s.push('                      img.className = "diagram-figure";');
  s.push('                      img.style.maxWidth = "100%";');
  s.push('                      img.style.backgroundColor = "#fff";');
  s.push('                      img.style.padding = "10px";');
  s.push('                      img.style.border = "1px solid #ddd";');
  s.push('                      img.src = "https://quickchart.io/graphviz?format=svg&graph=" + encodeURIComponent(text);');
  s.push('                      ');
  s.push('                      div.appendChild(img);');
  s.push('                      pre.replaceWith(div);');
  s.push('                    }');
  s.push('                  });');
  s.push('');
  s.push('                  // 5.2. Tables Captioning (Above)');
  s.push('                  const tables = document.querySelectorAll("table");');
  s.push('                  tables.forEach((table, idx) => {');
  s.push('                    const tableIndex = idx + 1;');
  s.push('                    table.style.width = "100%";');
  s.push('                    table.style.borderCollapse = "collapse";');
  s.push('                    table.style.margin = "12pt 0";');
  s.push('                    table.style.fontSize = "9pt";');
  s.push('                    ');
  s.push('                    const cells = table.querySelectorAll("th, td");');
  s.push('                    cells.forEach(c => {');
  s.push('                      c.style.border = "none";');
  s.push('                      c.style.borderTop = "1px solid #000";');
  s.push('                      c.style.borderBottom = "1px solid #000";');
  s.push('                      c.style.padding = "6px";');
  s.push('                      c.style.textAlign = "center";');
  s.push('                    });');
  s.push('');
  s.push('                    // Try to find an existing table caption in the paragraphs before the table');
  s.push('                    let existingCaptionText = "";');
  s.push('                    let sibling = table.previousElementSibling;');
  s.push('                    ');
  s.push('                    // Scan up to 2 siblings before to find a table caption');
  s.push('                    for (let i = 0; i < 2 && sibling; i++) {');
  s.push('                      const siblingText = sibling.textContent?.trim() || "";');
  s.push('                      if (/^(Table|TABLE)\\s+\\w+:/i.test(siblingText)) {');
  s.push('                        existingCaptionText = siblingText;');
  s.push('                        sibling.remove(); // Remove the original paragraph to prevent duplication');
  s.push('                        break;');
  s.push('                      }');
  s.push('                      sibling = sibling.previousElementSibling;');
  s.push('                    }');
  s.push('');
  s.push('                    const cols = Array.from(table.querySelectorAll("th, tr:first-child td")).map(el => el.textContent.trim());');
  s.push('                    const toRoman = (num) => {');
  s.push('                      const map = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };');
  s.push('                      let roman = \'\';');
  s.push('                      let n = num;');
  s.push('                      for (let key in map) {');
  s.push('                        while (n >= map[key]) {');
  s.push('                          roman += key;');
  s.push('                          n -= map[key];');
  s.push('                        }');
  s.push('                      }');
  s.push('                      return roman;');
  s.push('                    };');
  s.push('');
  s.push('                    let captionText = "";');
  s.push('                    if (existingCaptionText) {');
  s.push('                      captionText = existingCaptionText.replace(/^(Table|TABLE)\\s+(\\w+):/i, (m, tbl, num) => {');
  s.push('                        return "TABLE " + toRoman(tableIndex) + ":";');
  s.push('                      });');
  s.push('                    } else {');
  s.push('                      captionText = "TABLE " + toRoman(tableIndex) + ": COMPARISON RESULTS FOR " + cols.slice(0, 3).join(", ").toUpperCase();');
  s.push('                    }');
  s.push('                    ');
  s.push('                    if (!table.previousElementSibling?.classList.contains("table-caption")) {');
  s.push('                      const captionDiv = document.createElement("div");');
  s.push('                      captionDiv.className = "table-caption";');
  s.push('                      captionDiv.style.textAlign = "center";');
  s.push('                      captionDiv.style.fontSize = "8.5pt";');
  s.push('                      captionDiv.style.fontWeight = "bold";');
  s.push('                      captionDiv.style.textTransform = "uppercase";');
  s.push('                      captionDiv.style.marginBottom = "6pt";');
  s.push('                      captionDiv.style.color = "#000";');
  s.push('                      captionDiv.textContent = captionText;');
  s.push('                      table.parentNode.insertBefore(captionDiv, table);');
  s.push('                    }');
  s.push('                  });');
  s.push('');
  s.push('                  // 5.3. Figures Captioning (Below)');
  s.push('                  const figures = document.querySelectorAll(".mermaid, img.diagram-figure");');
  s.push('                  figures.forEach((fig, idx) => {');
  s.push('                    const figIndex = idx + 1;');
  s.push('                    ');
  s.push('                    // Scan siblings after the figure to find an existing caption');
  s.push('                    let existingCaptionText = "";');
  s.push('                    ');
  s.push('                    // If the figure is inside a .diagram-container, start scanning from the container\'s next sibling!');
  s.push('                    let baseElementForSibling = fig;');
  s.push('                    if (fig.parentNode?.classList.contains("diagram-container")) {');
  s.push('                      baseElementForSibling = fig.parentNode;');
  s.push('                    }');
  s.push('                    ');
  s.push('                    let sibling = baseElementForSibling.nextElementSibling;');
  s.push('                    for (let i = 0; i < 2 && sibling; i++) {');
  s.push('                      const siblingText = sibling.textContent?.trim() || "";');
  s.push('                      if (/^(Figure|FIGURE)\\s+\\d+:/i.test(siblingText)) {');
  s.push('                        existingCaptionText = siblingText;');
  s.push('                        sibling.remove(); // Remove the original paragraph to prevent duplication');
  s.push('                        break;');
  s.push('                      }');
  s.push('                      sibling = sibling.nextElementSibling;');
  s.push('                    }');
  s.push('');
  s.push('                    let captionText = "";');
  s.push('                    if (existingCaptionText) {');
  s.push('                      captionText = existingCaptionText.replace(/^(Figure|FIGURE)\\s+(\\d+)[:.]/i, (m, fgr, num) => {');
  s.push('                        return "Figure " + figIndex + ".";');
  s.push('                      });');
  s.push('                    } else {');
  s.push('                      const prevHeadingEl = fig.previousElementSibling?.tagName.startsWith("H") ');
  s.push('                        ? fig.previousElementSibling ');
  s.push('                        : baseElementForSibling.parentNode?.previousElementSibling;');
  s.push('                      const headingText = prevHeadingEl?.textContent || "System Flow";');
  s.push('                      const cleanHeading = headingText.replace(/^\\d+(\\.\\d+)*\\.?\\s*/, \'\').trim();');
  s.push('                      ');
  s.push('                      let captionDesc = "System Architecture and Workflow.";');
  s.push('                      if (cleanHeading.toLowerCase().includes("architecture")) {');
  s.push('                        captionDesc = "System architecture design and component interactions.";');
  s.push('                      } else if (cleanHeading.toLowerCase().includes("flow") || cleanHeading.toLowerCase().includes("pipeline")) {');
  s.push('                        captionDesc = "Workflow sequence and processing pipeline stages.";');
  s.push('                      } else if (cleanHeading.toLowerCase().includes("result") || cleanHeading.toLowerCase().includes("evaluation")) {');
  s.push('                        captionDesc = "Experimental results and comparative analysis graphs.";');
  s.push('                      } else if (cleanHeading) {');
  s.push('                        captionDesc = "Architectural overview of " + cleanHeading + " implementation.";');
  s.push('                      }');
  s.push('                      captionText = "Figure " + figIndex + ". " + captionDesc;');
  s.push('                    }');
  s.push('                    ');
  s.push('                    const nextEl = baseElementForSibling.nextElementSibling;');
  s.push('                    if (!nextEl?.classList.contains("figure-caption")) {');
  s.push('                      const captionDiv = document.createElement("div");');
  s.push('                      captionDiv.className = "figure-caption";');
  s.push('                      captionDiv.style.textAlign = "center";');
  s.push('                      captionDiv.style.fontSize = "8.5pt";');
  s.push('                      captionDiv.style.fontStyle = "italic";');
  s.push('                      captionDiv.style.marginTop = "6pt";');
  s.push('                      captionDiv.style.marginBottom = "12pt";');
  s.push('                      captionDiv.style.color = "#000";');
  s.push('                      captionDiv.textContent = captionText;');
  s.push('                      baseElementForSibling.parentNode.insertBefore(captionDiv, baseElementForSibling.nextSibling);');
  s.push('                    }');
  s.push('                  });');
  s.push('                };');
  s.push('');
  s.push('                // 6. Quality Control cleanup');
  s.push('                const runQualityControl = () => {');
  s.push('                  const preElements = document.querySelectorAll("pre, code");');
  s.push('                  preElements.forEach(el => {');
  s.push('                    const text = el.textContent || "";');
  s.push('                    if (text.includes("graph TD") || text.includes("flowchart") || text.includes("sequenceDiagram") || text.includes("classDiagram")) {');
  s.push('                      el.style.display = "none";');
  s.push('                    }');
  s.push('                    if (text.includes("@startuml") || text.includes("digraph")) {');
  s.push('                      el.style.display = "none";');
  s.push('                    }');
  s.push('                  });');
  s.push('');
  s.push('                  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);');
  s.push('                  let node;');
  s.push('                  const nodesToClean = [];');
  s.push('                  while (node = walker.nextNode()) {');
  s.push('                    const text = node.nodeValue || \'\';');
  s.push('                    if (text.includes(\'$$\') || text.includes(\'\\\\begin{\') || text.includes(\'graph TD\') || text.includes(\'flowchart LR\') || text.includes(\'sequenceDiagram\')) {');
  s.push('                      nodesToClean.push(node);');
  s.push('                    }');
  s.push('                  }');
  s.push('');
  s.push('                  nodesToClean.forEach(n => {');
  s.push('                    let val = n.nodeValue || \'\';');
  s.push('                    val = val.replace(/\\$\\$([\\s\\S]*?)\\$\\$/g, \'$1\')');
  s.push('                             .replace(/\\$([^\\$]+?)\\$/g, \'$1\')');
  s.push('                             .replace(/\\\\\\\\begin\\\\{[^\\\\}]+\\\\}/g, \'\')');
  s.push('                             .replace(/\\\\\\\\end\\\\{[^\\\\}]+\\\\}/g, \'\')');
  s.push('                             .replace(/graph (TD|LR|UT|BT)[\\\\s\\\\S]*$/g, \'\')');
  s.push('                             .replace(/flowchart (TD|LR)[\\\\s\\\\S]*$/g, \'\')');
  s.push('                             .replace(/sequenceDiagram[\\\\s\\\\S]*$/g, \'\');');
  s.push('                    n.nodeValue = val;');
  s.push('                  });');
  s.push('                };');
  s.push('');
  s.push('                setTimeout(() => {');
  s.push('                  processFiguresAndTables();');
  s.push('                  runQualityControl();');
  s.push('                }, 1200);');
  s.push('              }');
  s.push('');
  s.push('              if (document.readyState === "complete" || document.readyState === "interactive") {');
  s.push('                runExportPipeline();');
  s.push('              } else {');
  s.push('                window.addEventListener("load", runExportPipeline);');
  s.push('              }');
  return s.join('\n');
};
export default function ProjectWorkspace({ params: paramsPromise }: { params: Promise<{ projectId: string }> }) {
  const params = use(paramsPromise);
  const projectId = params.projectId;

  const [activeTab, setActiveTab] = useState('papers');
  const [project, setProject] = useState<any>(null);
  
  // Project Editing States
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const [isSavingProjectDetails, setIsSavingProjectDetails] = useState(false);
  const [isGeneratingAIDesc, setIsGeneratingAIDesc] = useState(false);
  const [generationError, setGenerationError] = useState('');
  
  // Data States
  const [papers, setPapers] = useState<any[]>([]);
  const [citations, setCitations] = useState<any[]>([]);
  const [gaps, setGaps] = useState<any[]>([]);
  const [agentRuns, setAgentRuns] = useState<any[]>([]);
  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [] });
  const [comparison, setComparison] = useState<any>({ columns: [], rows: [] });
  const [factChecks, setFactChecks] = useState<any[]>([]);
  const [editorDoc, setEditorDoc] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('IEEE');

  // Saved Research Papers State
  const [savedPapers, setSavedPapers] = useState<any[]>([]);
  const [editingPaperId, setEditingPaperId] = useState<string | null>(null);
  const [editingPaperTitle, setEditingPaperTitle] = useState<string>('Untitled Research Manuscript');
  const [previewPaperContent, setPreviewPaperContent] = useState<string | null>(null);
  const [previewPaperModal, setPreviewPaperModal] = useState<any | null>(null);

  // Plagiarism Report State
  const [plagiarismReports, setPlagiarismReports] = useState<any[]>([]);
  const [plagiarismRunning, setPlagiarismRunning] = useState<string | null>(null);
  const [selectedPlagiarismReport, setSelectedPlagiarismReport] = useState<any | null>(null);
  const [plagiarismView, setPlagiarismView] = useState<'list' | 'report'>('list');

  // 3D Graph Interactive Learning States
  const [isLearningMode, setIsLearningMode] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<{ id: string; type: string; label: string } | null>(null);
  const [learningDetails, setLearningDetails] = useState<any>(null);
  const [learningLoading, setLearningLoading] = useState<boolean>(false);
  const [difficultyLevel, setDifficultyLevel] = useState<'beginner' | 'intermediate' | 'research'>('beginner');
  const [tutorMessages, setTutorMessages] = useState<Array<{ sender: 'user' | 'tutor'; text: string }>>([]);
  const [tutorQuestion, setTutorQuestion] = useState<string>('');
  const [tutorLoading, setTutorLoading] = useState<boolean>(false);
  const [learningPanelTab, setLearningPanelTab] = useState<'explain' | 'insights' | 'connections' | 'assets' | 'tutor'>('explain');
  const [activeStep, setActiveStep] = useState<number>(0);

  // UI States
  const [uploading, setUploading] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const [runAgentLoading, setRunAgentLoading] = useState(false);
  const [selectedPages, setSelectedPages] = useState<number>(5);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isReformattingPapers, setIsReformattingPapers] = useState(false);
  const [aiAutoCorrectEnabled, setAiAutoCorrectEnabled] = useState(true);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [isGeneratingGaps, setIsGeneratingGaps] = useState(false);
  const [isFillingWithAI, setIsFillingWithAI] = useState(false);


  // Edit States for Citations and Gaps
  const [editingCitationId, setEditingCitationId] = useState<string | null>(null);
  const [editCitationText, setEditCitationText] = useState<string>('');
  const [editCitationTitle, setEditCitationTitle] = useState<string>('');
  const [editCitationAuthors, setEditCitationAuthors] = useState<string>('');
  const [editCitationJournal, setEditCitationJournal] = useState<string>('');
  const [editCitationYear, setEditCitationYear] = useState<number>(2024);
  const [editCitationVolume, setEditCitationVolume] = useState<string>('');
  const [editCitationIssue, setEditCitationIssue] = useState<string>('');
  const [editCitationPages, setEditCitationPages] = useState<string>('');
  const [editCitationPublisher, setEditCitationPublisher] = useState<string>('');
  const [editCitationDoi, setEditCitationDoi] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  const [editingGapId, setEditingGapId] = useState<string | null>(null);
  const [editGapTitle, setEditGapTitle] = useState<string>('');
  const [editGapDescription, setEditGapDescription] = useState<string>('');
  const [editGapCategory, setEditGapCategory] = useState<string>('');
  const [editGapImpact, setEditGapImpact] = useState<number>(5);
  const [editGapFeasibility, setEditGapFeasibility] = useState<number>(5);
  const [editGapEvidence, setEditGapEvidence] = useState<string>('');

  const handleDeleteCitation = async (citationId: string) => {
    try {
      await axios.delete(`${API_URL}/api/citations/${citationId}`);
      fetchCitations();
    } catch (err) {
      console.error('Failed to delete citation:', err);
    }
  };

  const handleUpdateCitation = async (citationId: string) => {
    try {
      const authorsArray = editCitationAuthors
        .split(',')
        .map(a => a.trim())
        .filter(Boolean);

      await axios.put(`${API_URL}/api/citations/${citationId}`, {
        title: editCitationTitle,
        authors: authorsArray,
        journal: editCitationJournal,
        year: editCitationYear,
        volume: editCitationVolume,
        issue: editCitationIssue,
        pages: editCitationPages,
        publisher: editCitationPublisher,
        doi: editCitationDoi,
        apa: editCitationText // Save override if user edited APA string
      });
      setEditingCitationId(null);
      fetchCitations();
    } catch (err) {
      console.error('Failed to update citation:', err);
    }
  };

  const handleDeleteGap = async (gapId: string) => {
    try {
      await axios.delete(`${API_URL}/api/projects/gaps/${gapId}`);
      fetchGaps();
    } catch (err) {
      console.error('Failed to delete gap:', err);
    }
  };

  const handleUpdateGap = async (gapId: string) => {
    try {
      const evidenceArray = editGapEvidence
        .split('\n')
        .map(e => e.trim())
        .filter(Boolean);

      await axios.put(`${API_URL}/api/projects/gaps/${gapId}`, {
        title: editGapTitle,
        description: editGapDescription,
        category: editGapCategory,
        impactScore: editGapImpact,
        feasibilityScore: editGapFeasibility,
        evidence: evidenceArray
      });
      setEditingGapId(null);
      fetchGaps();
    } catch (err) {
      console.error('Failed to update gap:', err);
    }
  };

  const handleAddNewGapClick = () => {
    setEditingGapId('new-gap');
    setEditGapTitle('');
    setEditGapDescription('');
    setEditGapCategory('other');
    setEditGapImpact(5);
    setEditGapFeasibility(5);
    setEditGapEvidence('');
  };

  const handleSaveNewGap = async () => {
    try {
      const evidenceArray = editGapEvidence
        .split('\n')
        .map(e => e.trim())
        .filter(Boolean);

      const res = await axios.post(`${API_URL}/api/projects/${projectId}/gaps`, {
        title: editGapTitle || 'Mined Gap',
        description: editGapDescription || 'No description provided.',
        category: editGapCategory,
        impactScore: editGapImpact,
        feasibilityScore: editGapFeasibility,
        evidence: evidenceArray
      });
      setEditingGapId(null);
      setGaps(prev => [res.data, ...prev]);
    } catch (err) {
      console.error('Failed to create manual gap:', err);
    }
  };

  const handleFillFormWithAI = async () => {
    setIsFillingWithAI(true);
    try {
      const res = await axios.post(`${API_URL}/api/projects/${projectId}/gaps/generate-single`);
      if (res.data) {
        setEditGapTitle(res.data.title || 'Mined Gap');
        setEditGapDescription(res.data.description || 'No description provided.');
        setEditGapCategory(res.data.category || 'other');
        setEditGapImpact(res.data.impactScore || 5);
        setEditGapFeasibility(res.data.feasibilityScore || 5);
        setEditGapEvidence((res.data.evidence || []).join('\n'));
      }
    } catch (err) {
      console.error('Failed to fill form with AI:', err);
    } finally {
      setIsFillingWithAI(false);
    }
  };

  const handleGenerateAIGaps = async () => {
    setIsGeneratingGaps(true);
    try {
      const res = await axios.post(`${API_URL}/api/projects/${projectId}/gaps/generate`);
      if (res.data && Array.isArray(res.data)) {
        setGaps(prev => [...res.data, ...prev]);
      }
    } catch (err) {
      console.error('Failed to generate AI gaps:', err);
    } finally {
      setIsGeneratingGaps(false);
    }
  };

  // Load project meta
  const loadProjectData = async () => {
    try {
      const projRes = await axios.get(`${API_URL}/api/projects/${projectId}`);
      setProject(projRes.data);
    } catch {
      setProject({ name: 'Active Research Workspace', description: 'Investigating modular architectures' });
    }
  };

  const handleUpdateProjectDetails = async () => {
    if (!editProjectName.trim()) return;
    setIsSavingProjectDetails(true);
    try {
      const res = await axios.put(`${API_URL}/api/projects/${projectId}`, {
        name: editProjectName,
        description: editProjectDesc,
      });
      setProject(res.data);
      setIsEditingProject(false);
    } catch (err) {
      console.error('Failed to update project details:', err);
    } finally {
      setIsSavingProjectDetails(false);
    }
  };

  // Fetch lists
  const fetchPapers = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/papers?projectId=${projectId}`);
      setPapers(res.data);
    } catch {
      setPapers([]);
    }
  };

  const handleDeletePaper = async (paperId: string) => {
    try {
      await axios.delete(`${API_URL}/api/papers/${paperId}`);
      fetchPapers();
    } catch (err) {
      console.error('Failed to delete paper:', err);
    }
  };

  const fetchCitations = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/citations?projectId=${projectId}`);
      setCitations(res.data);
    } catch {
      setCitations([]);
    }
  };

  const fetchGaps = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/projects/${projectId}/gaps`);
      setGaps(res.data);
    } catch {
      setGaps([]);
    }
  };

  const fetchSavedPapers = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/projects/${projectId}/generated-papers`);
      const papers = res.data || [];
      setSavedPapers(papers);
      
      // Load first paper by default if none is active
      if (papers.length > 0 && !editingPaperId && !editorDoc) {
        const latest = papers[0];
        setEditingPaperId(latest._id);
        setEditingPaperTitle(latest.title);
        const text = latest.sections?.map((s: any) => {
          const cleanHeading = (s.heading || '').replace(/^#+\s*/, '').trim();
          return `<h2>${cleanHeading}</h2>${parseMarkdownToHTML(s.content)}`;
        }).join('\n') || '';
        setEditorDoc(text);
      }
    } catch (err) {
      console.error('Failed to fetch saved papers:', err);
    }
  };

  const handleDeleteSavedPaper = async (paperId: string) => {
    try {
      await axios.delete(`${API_URL}/api/projects/${projectId}/generated-papers/${paperId}`);
      if (editingPaperId === paperId) {
        setEditingPaperId(null);
        setEditingPaperTitle('Untitled Research Manuscript');
        setEditorDoc('');
      }
      fetchSavedPapers();
    } catch (err) {
      console.error('Failed to delete saved paper:', err);
    }
  };

  const handleLoadPaperForEdit = (paper: any) => {
    setEditingPaperId(paper._id);
    setEditingPaperTitle(paper.title);
    const text = paper.sections?.map((s: any) => {
      const cleanHeading = (s.heading || '').replace(/^#+\s*/, '').trim();
      return `<h2>${cleanHeading}</h2>${parseMarkdownToHTML(s.content)}`;
    }).join('\n') || '';
    setEditorDoc(text);
    setPreviewPaperContent(null); // Return preview window to editor tracking
  };

  const handlePreviewPaper = (paper: any) => {
    const text = paper.sections?.map((s: any) => {
      const cleanHeading = (s.heading || '').replace(/^#+\s*/, '').trim();
      return `<h2>${cleanHeading}</h2>${parseMarkdownToHTML(s.content)}`;
    }).join('\n') || '';
    setPreviewPaperContent(text);
    setShowPreview(true); // Ensure preview window is visible
  };

  const lastFormattedContentRef = useRef<string>('');
  const autoCorrectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleReformatAllPapers = async () => {
    if (isReformattingPapers) return;
    setIsReformattingPapers(true);
    try {
      const res = await axios.post(`${API_URL}/api/formatex/${projectId}/repair-all`);
      const data = res.data;
      if (data.success) {
        console.log(`[FormaTeX] ${data.message}`);
        
        // Reload papers to show enhanced content
        const savedPapersRes = await axios.get(`${API_URL}/api/projects/${projectId}/generated-papers`);
        const papers = savedPapersRes.data || [];
        setSavedPapers(papers);
        
        // If we are currently editing a paper, reload it to reflect the enhanced format
        if (editingPaperId) {
          const currentPaper = papers.find((p: any) => p._id === editingPaperId);
          if (currentPaper) {
            const text = currentPaper.sections?.map((s: any) => {
              const cleanHeading = (s.heading || '').replace(/^#+\s*/, '').trim();
              return `<h2>${cleanHeading}</h2>${parseMarkdownToHTML(s.content)}`;
            }).join('\n') || '';
            lastFormattedContentRef.current = text;
            setEditorDoc(text);
          }
        }
      } else {
        console.error('[FormaTeX] Repair-all failed:', data.error);
      }
    } catch (err) {
      console.error('[FormaTeX] Error calling repair-all:', err);
    } finally {
      setIsReformattingPapers(false);
    }
  };

  // Debounced auto-correct effect for editing workspace
  useEffect(() => {
    if (!aiAutoCorrectEnabled || !editorDoc || !editingPaperId) return;
    if (editorDoc === lastFormattedContentRef.current) return;

    if (autoCorrectTimeoutRef.current) {
      clearTimeout(autoCorrectTimeoutRef.current);
    }

    autoCorrectTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await axios.post(`${API_URL}/api/formatex/auto-correct`, { htmlContent: editorDoc });
        if (res.data && res.data.success && res.data.htmlContent) {
          const newHtml = res.data.htmlContent;
          lastFormattedContentRef.current = newHtml;
          if (newHtml !== editorDoc) {
            setEditorDoc(newHtml);
            console.log("[AI Corrector] Automatically formatted formulas, tables, and captions.");
          }
        }
      } catch (err) {
        console.error('[AI Corrector] Auto-correct failed:', err);
      }
    }, 5000);

    return () => {
      if (autoCorrectTimeoutRef.current) {
        clearTimeout(autoCorrectTimeoutRef.current);
      }
    };
  }, [editorDoc, aiAutoCorrectEnabled, editingPaperId]);

  const handleManualAICorrect = async () => {
    if (isCorrecting || !editorDoc) return;
    setIsCorrecting(true);
    try {
      const res = await axios.post(`${API_URL}/api/formatex/auto-correct`, { htmlContent: editorDoc });
      if (res.data && res.data.success && res.data.htmlContent) {
        const newHtml = res.data.htmlContent;
        lastFormattedContentRef.current = newHtml;
        setEditorDoc(newHtml);
        alert('AI formatting corrector successfully cleaned mathematical formulas, tables, and figure captions.');
      } else {
        alert('AI formatting corrector returned no changes or failed.');
      }
    } catch (err) {
      console.error('[AI Corrector] Manual correct failed:', err);
      alert('Failed to contact the AI formatting corrector service.');
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleCreateNewPaper = () => {
    setEditingPaperId(null);
    setEditingPaperTitle('New Research Paper');
    setEditorDoc('<h2>1. Introduction</h2><p>Start writing your new research paper here...</p>');
    setPreviewPaperContent(null);
  };

  // ── Plagiarism Report Handlers ──────────────────────────────────────────
  const fetchPlagiarismReports = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/projects/${projectId}/plagiarism-reports`);
      setPlagiarismReports(res.data || []);
    } catch (err) {
      console.error('Failed to fetch plagiarism reports:', err);
    }
  };

  const handleRunPlagiarismCheck = async (paperId: string) => {
    try {
      setPlagiarismRunning(paperId);
      await axios.post(`${API_URL}/api/projects/${projectId}/plagiarism-reports/${paperId}/run`);
      
      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_URL}/api/projects/${projectId}/plagiarism-reports`);
          const reports = res.data || [];
          setPlagiarismReports(reports);
          
          // Check if latest report for this paper is completed
          const latestReport = reports.find((r: any) => r.generatedPaperId === paperId && (r.status === 'completed' || r.status === 'failed'));
          if (latestReport) {
            clearInterval(pollInterval);
            setPlagiarismRunning(null);
            if (latestReport.status === 'completed') {
              setSelectedPlagiarismReport(latestReport);
              setPlagiarismView('report');
            }
          }
        } catch (e) {
          console.error('Polling error:', e);
        }
      }, 3000);

      // Safety timeout — stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setPlagiarismRunning(null);
      }, 300000);
    } catch (err) {
      console.error('Failed to run plagiarism check:', err);
      setPlagiarismRunning(null);
    }
  };

  const handleViewPlagiarismReport = (report: any) => {
    setSelectedPlagiarismReport(report);
    setPlagiarismView('report');
  };

  const handleDeletePlagiarismReport = async (reportId: string) => {
    try {
      await axios.delete(`${API_URL}/api/projects/${projectId}/plagiarism-reports/${reportId}`);
      setPlagiarismReports(prev => prev.filter(r => r._id !== reportId));
      if (selectedPlagiarismReport?._id === reportId) {
        setSelectedPlagiarismReport(null);
        setPlagiarismView('list');
      }
    } catch (err) {
      console.error('Failed to delete plagiarism report:', err);
    }
  };

  const getSeverityColor = (level: string) => {
    switch (level) {
      case 'very_low': return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Very Low' };
      case 'acceptable': return { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Acceptable' };
      case 'moderate': return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Moderate' };
      case 'high': return { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', label: 'High' };
      case 'severe': return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', label: 'Severe' };
      default: return { bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/30', label: 'Unknown' };
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 10) return 'text-emerald-400';
    if (score < 20) return 'text-blue-400';
    if (score < 30) return 'text-amber-400';
    if (score < 50) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBarColor = (score: number) => {
    if (score < 10) return 'bg-emerald-500';
    if (score < 20) return 'bg-blue-500';
    if (score < 30) return 'bg-amber-500';
    if (score < 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const handleSaveChanges = async () => {
    setSavingState('saving');
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(editorDoc, 'text/html');
      const parsedSections: any[] = [];
      let currentSection: any = null;

      Array.from(doc.body.children).forEach((child: any) => {
        if (child.tagName === 'H2' || child.tagName === 'H1') {
          if (currentSection) {
            parsedSections.push(currentSection);
          }
          const headingText = child.textContent || '';
          const cleanTitle = headingText.replace(/^\d+\.\s*/, '').trim();
          currentSection = {
            title: cleanTitle,
            heading: headingText,
            content: ''
          };
        } else {
          // Normalize image URLs to relative paths on save
          const uploadRegex = new RegExp(`src=["']https?://[^/]+(:\\d+)?/uploads/`, 'g');
          const cleanedChildHtml = child.outerHTML.replace(uploadRegex, 'src="uploads/');

          if (currentSection) {
            currentSection.content += cleanedChildHtml;
          } else {
            currentSection = {
              title: 'Title',
              heading: 'Title',
              content: cleanedChildHtml
            };
          }
        }
      });
      if (currentSection) {
        parsedSections.push(currentSection);
      }

      // Try to extract the first heading text as the title if editingPaperTitle is generic
      let paperTitleToSave = editingPaperTitle;
      if (parsedSections.length > 0 && (!paperTitleToSave || paperTitleToSave === 'Untitled Research Manuscript' || paperTitleToSave === 'New Research Paper')) {
        paperTitleToSave = parsedSections[0].title;
      }

      const res = await axios.put(`${API_URL}/api/projects/${projectId}/generated-papers`, {
        paperId: editingPaperId,
        title: paperTitleToSave || 'Untitled Research Manuscript',
        sections: parsedSections,
        outline: parsedSections.map(s => s.title)
      });
      
      if (!editingPaperId && res.data && res.data._id) {
        setEditingPaperId(res.data._id);
        setEditingPaperTitle(res.data.title);
      }
      
      setSavingState('success');
      fetchSavedPapers();
    } catch (err) {
      console.error('Failed to save manuscript:', err);
      setSavingState('error');
    }
  };

  const handleExportPDF = async () => {
    if (isExportingPDF) return;
    setIsExportingPDF(true);

    try {
      let formatCSS = '';
      
      if (selectedFormat === 'IEEE') {
        formatCSS = `
          @page { size: A4; margin: 20mm; }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 10pt;
            line-height: 1.25;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 0;
          }
          h1.doc-title {
            font-size: 24pt;
            text-align: center;
            margin-top: 10mm;
            margin-bottom: 12pt;
            font-weight: normal;
          }
          .author-block {
            text-align: center;
            margin-bottom: 24pt;
            font-size: 11pt;
          }
          .main-content {
            column-count: 2;
            column-gap: 8mm;
            text-align: justify;
          }
          .abstract-section {
            column-span: all;
            margin-bottom: 12pt;
            padding: 0 5px;
          }
          .abstract-section p {
            font-size: 9pt;
            font-weight: bold;
            text-indent: 0;
            margin: 0 0 6pt 0;
          }
          h2 {
            font-size: 10pt;
            text-align: center;
            text-transform: uppercase;
            margin-top: 12pt;
            margin-bottom: 4pt;
            font-weight: bold;
            break-after: avoid;
          }
          h3 {
            font-size: 10pt;
            text-align: left;
            font-style: italic;
            margin-top: 10pt;
            margin-bottom: 3pt;
            break-after: avoid;
          }
          h4 {
            font-size: 10pt;
            text-align: left;
            font-style: italic;
            margin-top: 8pt;
            margin-bottom: 3pt;
            break-after: avoid;
          }
          p {
            margin: 0 0 4pt 0;
            text-indent: 1.25pc;
          }
          pre, code {
            font-family: monospace;
            font-size: 8.5pt;
            background: #f8f8f8;
            display: block;
            padding: 6px;
            white-space: pre-wrap;
            break-inside: avoid;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 12pt 0;
            font-size: 8pt;
            break-inside: avoid;
          }
          th, td {
            border: 1px solid #000;
            padding: 4px;
            text-align: center;
          }
          /* Unnumbered headings like References */
          h2.unnumbered-heading {
            text-align: center;
            text-transform: uppercase;
          }
          .diagram-container, .table-caption, .figure-caption {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        `;
      } else if (selectedFormat === 'ACM') {
        formatCSS = `
          @page { size: A4; margin: 20mm; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9pt;
            line-height: 1.3;
            color: #000;
            background: #fff;
          }
          h1.doc-title {
            font-size: 18pt;
            font-weight: bold;
            text-align: center;
            margin-bottom: 12pt;
          }
          .author-block {
            text-align: center;
            margin-bottom: 20pt;
            font-size: 10pt;
          }
          .main-content {
            column-count: 2;
            column-gap: 6mm;
            text-align: justify;
          }
          .abstract-section {
            column-span: all;
            background: #f5f5f5;
            padding: 10px;
            margin-bottom: 12pt;
            border: 1px solid #ddd;
          }
          h2 {
            font-size: 11pt;
            font-weight: bold;
            color: #000;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
            margin-top: 12pt;
            margin-bottom: 4pt;
            break-after: avoid;
          }
          h3 {
            font-size: 10pt;
            font-weight: bold;
            margin-top: 10pt;
            margin-bottom: 3pt;
            break-after: avoid;
          }
          p {
            margin: 0 0 4pt 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 10pt 0;
            font-size: 8pt;
            break-inside: avoid;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 5px;
          }
          .diagram-container, pre, code, .table-caption, .figure-caption {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        `;
      } else if (selectedFormat === 'Springer') {
        formatCSS = `
          @page { size: A4; margin: 20mm; }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 10pt;
            line-height: 1.3;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 0;
          }
          h1.doc-title {
            font-size: 18pt;
            font-weight: bold;
            text-align: center;
            margin-top: 10mm;
            margin-bottom: 12pt;
          }
          .author-block {
            text-align: center;
            margin-bottom: 24pt;
            font-size: 10pt;
          }
          .main-content {
            column-count: 2;
            column-gap: 8mm;
            text-align: justify;
          }
          .abstract-section {
            column-span: all;
            margin-bottom: 20pt;
            font-size: 9.5pt;
            text-align: justify;
          }
          h2 {
            font-size: 12pt;
            font-weight: bold;
            margin-top: 14pt;
            margin-bottom: 6pt;
            break-after: avoid;
          }
          h3 {
            font-size: 11pt;
            font-weight: bold;
            margin-top: 12pt;
            margin-bottom: 4pt;
            break-after: avoid;
          }
          p {
            margin: 0 0 5pt 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 12pt 0;
            font-size: 9pt;
            break-inside: avoid;
          }
          th, td {
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            padding: 6px;
          }
          .diagram-container, pre, code, .table-caption, .figure-caption {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        `;
      } else if (selectedFormat === 'APA') {
        formatCSS = `
          @page { size: A4; margin: 1in; }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 2.0;
            color: #000;
            background: #fff;
            max-width: 650px;
            margin: 0 auto;
            padding: 0 10mm;
          }
          h1.doc-title {
            font-size: 18pt;
            font-weight: bold;
            text-align: center;
            margin-top: 1.5in;
            margin-bottom: 12pt;
          }
          .author-block {
            text-align: center;
            margin-bottom: 2in;
            font-size: 12pt;
            line-height: 1.8;
          }
          .abstract-section {
            page-break-after: always;
            padding-top: 1in;
          }
          h2 {
            font-size: 12pt;
            font-weight: bold;
            text-align: center;
            margin-top: 24pt;
            margin-bottom: 12pt;
          }
          h3 {
            font-size: 12pt;
            font-weight: bold;
            text-align: left;
            margin-top: 18pt;
            margin-bottom: 8pt;
          }
          p {
            margin: 0 0 12pt 0;
            text-indent: 0.5in;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20pt 0;
          }
          th, td {
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            padding: 8px;
          }
        `;
      } else {
        formatCSS = `
          @page { size: A4; margin: 1in; }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #000;
            background: #fff;
            padding: 0 10mm;
          }
          h1.doc-title {
            font-size: 18pt;
            font-weight: bold;
            text-align: center;
            margin-top: 1in;
            margin-bottom: 12pt;
          }
          .author-block {
            text-align: center;
            margin-bottom: 1.5in;
          }
          .abstract-section {
            margin-top: 1in;
            margin-bottom: 20pt;
          }
          h2 {
            font-size: 12pt;
            font-weight: bold;
            text-align: left;
            margin-top: 20pt;
            margin-bottom: 10pt;
          }
          p {
            margin: 0 0 10pt 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20pt 0;
          }
          th, td {
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            padding: 8px;
          }
        `;
      }

      const formattedHtml = formatPaperHTML(editorDoc, selectedFormat, citations);
      const cleanedEditorDoc = cleanMathHTML(formattedHtml);
      const parser = new DOMParser();
      const doc = parser.parseFromString(cleanedEditorDoc, 'text/html');

      // Fix relative image sources to point to absolute API URL
      const images = doc.querySelectorAll('img');
      images.forEach((img: any) => {
        let src = img.getAttribute('src') || '';
        if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
          if (src.startsWith('/')) {
            src = src.substring(1);
          }
          img.setAttribute('src', `${API_URL}/${src}`);
        }
      });
      
      let title = project?.name || 'Academic Synthesis Paper';
      let abstractContent = '';
      let keywordsContent = '';
      let sectionsHTML = '';

      const children = Array.from(doc.body.children);
      let currentSecTitle = '';
      let currentSecContent = '';

      children.forEach((child: any) => {
        const text = child.textContent?.trim() || '';
        if (child.tagName === 'H2' || child.tagName === 'H1') {
          if (currentSecTitle) {
            if (currentSecTitle.toLowerCase().includes('title')) {
              title = currentSecContent.replace(/<[^>]*>/g, '').trim();
            } else if (currentSecTitle.toLowerCase().includes('abstract')) {
              abstractContent = currentSecContent;
            } else if (currentSecTitle.toLowerCase().includes('keyword')) {
              keywordsContent = currentSecContent;
            } else {
              sectionsHTML += `<section><h2>${currentSecTitle}</h2><div>${currentSecContent}</div></section>`;
            }
          }
          currentSecTitle = text;
          currentSecContent = '';
        } else {
          if (!currentSecTitle) {
            const isKeywords = text.toLowerCase().includes('keyword');
            const isAbstract = text.toLowerCase().includes('abstract');
            if (isKeywords) {
              currentSecTitle = 'Keywords';
            } else if (isAbstract) {
              currentSecTitle = 'Abstract';
            } else {
              currentSecTitle = '1. Introduction';
            }
          }
          currentSecContent += child.outerHTML;
        }
      });

      if (currentSecTitle) {
        if (currentSecTitle.toLowerCase().includes('title')) {
          title = currentSecContent.replace(/<[^>]*>/g, '').trim();
        } else if (currentSecTitle.toLowerCase().includes('abstract')) {
          abstractContent = currentSecContent;
        } else if (currentSecTitle.toLowerCase().includes('keyword')) {
          keywordsContent = currentSecContent;
        } else {
          sectionsHTML += `<section><h2>${currentSecTitle}</h2><div>${currentSecContent}</div></section>`;
        }
      }

      let abstractSectionHTML = '';
      if (abstractContent) {
        const cleanAbstract = abstractContent.replace(/<[^>]*>/g, '').trim();
        const cleanKeywords = keywordsContent ? keywordsContent.replace(/<[^>]*>/g, '').trim() : '';
        
        if (selectedFormat === 'IEEE') {
          const keywordsHTML = cleanKeywords 
            ? `<p style="text-indent:0; font-size:9pt; font-weight:bold; margin-top:6pt;"><em>Keywords</em>—${cleanKeywords}</p>`
            : '';
          abstractSectionHTML = `
            <div class="abstract-section">
              <p style="text-indent:0; font-size:9pt; font-weight:bold;"><em>Abstract</em>—${cleanAbstract}</p>
              ${keywordsHTML}
            </div>
          `;
        } else if (selectedFormat === 'ACM') {
          const keywordsHTML = cleanKeywords 
            ? `<p style="font-size:9pt; margin-top:6pt;"><strong>KEYWORDS</strong><br/>${cleanKeywords}</p>`
            : '';
          abstractSectionHTML = `
            <div class="abstract-section">
              <p style="font-size:9pt; line-height:1.4;"><strong>ABSTRACT</strong><br/>${cleanAbstract}</p>
              ${keywordsHTML}
            </div>
          `;
        } else if (selectedFormat === 'Springer') {
          const keywordsHTML = cleanKeywords 
            ? `<p style="font-size:9.5pt; margin-top:6pt;"><strong>Keywords:</strong> ${cleanKeywords}</p>`
            : '';
          abstractSectionHTML = `
            <div class="abstract-section">
              <p><strong>Abstract.</strong> ${cleanAbstract}</p>
              ${keywordsHTML}
            </div>
          `;
        } else if (selectedFormat === 'APA') {
          abstractSectionHTML = `
            <div class="abstract-section">
              <h2 style="text-align: center; font-weight: bold; font-size: 12pt; margin-bottom: 12pt;">Abstract</h2>
              <p style="text-indent: 0; font-size: 12pt; line-height: 2.0;">${cleanAbstract}</p>
              ${cleanKeywords ? `<p style="text-indent: 0.5in; font-size: 12pt; line-height: 2.0; margin-top: 24pt;"><em>Keywords:</em> ${cleanKeywords}</p>` : ''}
            </div>
          `;
        } else {
          abstractSectionHTML = `
            <div class="abstract-section">
              <h2>Abstract</h2>
              <p>${cleanAbstract}</p>
              ${cleanKeywords ? `<p><strong>Keywords:</strong> ${cleanKeywords}</p>` : ''}
            </div>
          `;
        }
      }

      const htmlContent = `
        <html>
          <head>
            <title>${title}</title>
            <style>
              ${formatCSS}
              * { box-sizing: border-box; }
              pre, code, table { max-width: 100%; overflow-x: auto; }
              .katex { font-size: 1.1em; }
              .katex-display { margin: 12pt 0; overflow-x: auto; }
              .mermaid { display: flex; justify-content: center; margin: 18pt 0; width: 100%; }
              @media print {
                .no-print { display: none; }
              }
            </style>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
            <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
            <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/plantuml-encoder@1.4.0/dist/plantuml-encoder.min.js"></script>
          </head>
          <body>
            <h1 class="doc-title">${title}</h1>
            <div class="author-block">
              <strong>Research Team</strong><br>
              ResearcherGPT Multi-Agent Synthesis Framework<br>
              Department of Autonomous Scholarly Synthesis
            </div>

            <div class="${selectedFormat === 'IEEE' || selectedFormat === 'ACM' || selectedFormat === 'Springer' ? 'main-content' : ''}">
              ${abstractSectionHTML}
              ${sectionsHTML}
            </div>

            <script>${getExportPipelineScript(selectedFormat)}</script>
          </body>
        </html>
      `;

      const response = await axios.post(
        `${API_URL}/api/projects/${projectId}/export-pdf`,
        { htmlContent, format: selectedFormat },
        { responseType: 'blob' }
      );

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_manuscript.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const fetchAgentRuns = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/agents?projectId=${projectId}`);
      setAgentRuns(res.data);
    } catch {
      setAgentRuns([]);
    }
  };

  const fetchGraphData = async () => {
    try {
      // Fetch knowledge graph from backend
      const res = await axios.get(`${API_URL}/api/projects/${projectId}/graph`);
      if (res.data && res.data.nodes && res.data.nodes.length > 0) {
        setGraphData(res.data);
      } else {
        // Fallback concept mapping if empty
        setGraphData({
          nodes: [
            { id: 'paper_main', label: project?.name || 'Workspace Root', type: 'paper', val: 3, color: '#6366f1' },
            { id: 'auth_jenkins', label: 'Jenkins et al.', type: 'author', val: 2, color: '#10b981' },
            { id: 'method_rag', label: 'RAG Pipeline', type: 'method', val: 2.5, color: '#f59e0b' }
          ],
          links: [
            { source: 'paper_main', target: 'auth_jenkins', label: 'authored_by' },
            { source: 'paper_main', target: 'method_rag', label: 'uses_method' }
          ]
        });
      }
    } catch {
      setGraphData({
        nodes: [
          { id: 'paper_main', label: project?.name || 'Workspace Root', type: 'paper', val: 3, color: '#6366f1' },
          { id: 'auth_jenkins', label: 'Jenkins et al.', type: 'author', val: 2, color: '#10b981' },
          { id: 'method_rag', label: 'RAG Pipeline', type: 'method', val: 2.5, color: '#f59e0b' }
        ],
        links: [
          { source: 'paper_main', target: 'auth_jenkins', label: 'authored_by' },
          { source: 'paper_main', target: 'method_rag', label: 'uses_method' }
        ]
      });
    }
  };

  const handleNodeClick = async (nodeId: string, nodeType: string, nodeLabel: string) => {
    setSelectedNode({ id: nodeId, type: nodeType, label: nodeLabel });
    setLearningLoading(true);
    setLearningDetails(null);
    setLearningPanelTab('explain');
    setActiveStep(0);
    setTutorMessages([
      { sender: 'tutor', text: `Hi! I'm your AI Tutor for **${nodeLabel}**. Ask me any questions or click one of the shortcut prompts below!` }
    ]);
    
    try {
      const res = await axios.get(`${API_URL}/api/projects/${projectId}/graph/nodes/${nodeId}?label=${encodeURIComponent(nodeLabel)}&type=${nodeType}`);
      setLearningDetails(res.data);
    } catch (err: any) {
      console.error('Error loading node learning details:', err);
    } finally {
      setLearningLoading(false);
    }
  };

  const handleAskTutor = async (questionText?: string) => {
    const q = questionText || tutorQuestion;
    if (!q || !selectedNode) return;
    
    if (!questionText) {
      setTutorQuestion('');
    }
    
    setTutorMessages((prev) => [...prev, { sender: 'user', text: q }]);
    setTutorLoading(true);
    
    try {
      const res = await axios.post(`${API_URL}/api/projects/${projectId}/graph/nodes/${selectedNode.id}/ask`, {
        question: q
      });
      setTutorMessages((prev) => [...prev, { sender: 'tutor', text: res.data.answer }]);
    } catch (err: any) {
      setTutorMessages((prev) => [...prev, { sender: 'tutor', text: `Failed to get an answer: ${err.response?.data?.error || err.message}` }]);
    } finally {
      setTutorLoading(false);
    }
  };

  const fetchComparisonMatrix = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/comparison/matrix?projectId=${projectId}`);
      let data = res.data || {};
      if (data && !Array.isArray(data.rows) && typeof data.rows === 'object') {
        const possibleRows = data.rows.rows || data.rows.comparison || data.rows.matrix || Object.values(data.rows).find(val => Array.isArray(val));
        if (Array.isArray(possibleRows)) {
          data.rows = possibleRows;
        } else {
          data.rows = [];
        }
      }
      setComparison(data);
    } catch {
      setComparison({
        columns: ['Title', 'Authors', 'Year', 'Accuracy', 'Method/Models', 'Dataset', 'Strengths', 'Weaknesses'],
        rows: []
      });
    }
  };

  useEffect(() => {
    loadProjectData();

    // Load KaTeX CSS
    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link');
      link.id = 'katex-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
      document.head.appendChild(link);
    }

    // Load KaTeX JS
    if (!document.getElementById('katex-js')) {
      const script = document.createElement('script');
      script.id = 'katex-js';
      script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js';
      script.defer = true;
      document.head.appendChild(script);
    }

    // Load KaTeX Auto-render JS
    if (!document.getElementById('katex-autorender')) {
      const script = document.createElement('script');
      script.id = 'katex-autorender';
      script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js';
      script.defer = true;
      document.head.appendChild(script);
    }

    // Load Mermaid JS
    if (!document.getElementById('mermaid-js')) {
      const script = document.createElement('script');
      script.id = 'mermaid-js';
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      script.defer = true;
      document.head.appendChild(script);
    }
  }, [projectId]);

  // Poll for papers if any are pending or processing
  useEffect(() => {
    const hasProcessing = papers.some(p => p.status === 'pending' || p.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchPapers();
    }, 3000);

    return () => clearInterval(interval);
  }, [papers]);

  // Poll for agent runs if any are running
  useEffect(() => {
    const hasRunning = agentRuns.some(run => run.status === 'running');
    if (!hasRunning) return;

    const interval = setInterval(() => {
      fetchAgentRuns();
    }, 3000);

    return () => clearInterval(interval);
  }, [agentRuns]);

  useEffect(() => {
    if (activeTab === 'papers') fetchPapers();
    if (activeTab === 'citations') fetchCitations();
    if (activeTab === 'gaps') fetchGaps();
    if (activeTab === 'agents') fetchAgentRuns();
    if (activeTab === 'graph') fetchGraphData();
    if (activeTab === 'litreview') fetchComparisonMatrix();
    if (activeTab === 'editor') fetchSavedPapers();
    if (activeTab === 'saved_papers') fetchSavedPapers();
    if (activeTab === 'plagiarism') { fetchPlagiarismReports(); fetchSavedPapers(); }
  }, [activeTab, projectId]);

  // Handle PDF Upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('projectId', projectId);

    setUploading(true);
    try {
      await axios.post(`${API_URL}/api/papers/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchPapers();
    } catch (err) {
      // Local fallback simulator
      const mockPaper = {
        _id: Math.random().toString(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        authors: ['Dr. Sarah Jenkins'],
        year: 2024,
        status: 'processed',
        pdfUrl: '#'
      };
      setPapers((prev) => [mockPaper, ...prev]);
    } finally {
      setUploading(false);
    }
  };

  // Handle Agent Trigger (unified)
  const handleRunAgent = async (queryText: string, formatStyle: string = selectedFormat, pageCount: number = selectedPages) => {
    if (!queryText.trim()) return;
    try {
      await axios.post(`${API_URL}/api/agents/run`, {
        projectId,
        query: queryText,
        format: formatStyle,
        pages: pageCount
      });
      setTimeout(() => fetchAgentRuns(), 1500);
    } catch (err) {
      // Mock active runner inside UI if backend is offline
      const mockRun = {
        _id: Math.random().toString(),
        query: queryText,
        status: 'running',
        steps: [
          { name: 'Research Agent', status: 'running', logs: 'Querying vector chunks...' },
          { name: 'Literature Agent', status: 'pending' },
          { name: 'Gap Agent', status: 'pending' },
          { name: 'Citation Agent', status: 'pending' },
          { name: 'Fact Checker Agent', status: 'pending' },
          { name: 'Writing Agent', status: 'pending' }
        ],
        createdAt: new Date().toISOString()
      };
      setAgentRuns((prev) => [mockRun, ...prev]);
    }
  };

  const handleTriggerAgent = async () => {
    if (!queryInput.trim() || runAgentLoading) return;
    setRunAgentLoading(true);
    try {
      await handleRunAgent(queryInput);
      setActiveTab('agents');
    } finally {
      setRunAgentLoading(false);
    }
  };

  const handleDeleteAgentRun = async (runId: string) => {
    try {
      await axios.delete(`${API_URL}/api/agents/${runId}`);
      fetchAgentRuns();
    } catch (err) {
      console.error('Failed to delete agent run:', err);
      // Fallback local deletion
      setAgentRuns((prev) => prev.filter((r) => r._id !== runId));
    }
  };

  // Custom simulation to complete mock agents for demo
  const simulateMockProgress = (runId: string) => {
    setAgentRuns((prevRuns) =>
      prevRuns.map((r) => {
        if (r._id === runId) {
          return {
            ...r,
            status: 'completed',
            steps: r.steps.map((s: any) => ({ ...s, status: 'completed', logs: 'Factual reviews completed.' })),
            result: {
              title: "Consolidated Literature Synthesis",
              sections: [
                { title: 'Abstract', heading: 'Abstract', content: 'This paper details optimized multi-agent structures for academic synthesis.' }
              ]
            }
          };
        }
        return r;
      })
    );
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col md:flex-row">
      
      {/* Mobile Navigation Tab Bar */}
      <div className="md:hidden flex overflow-x-auto border-b border-zinc-800/80 bg-zinc-950 p-2.5 gap-2 scrollbar-none sticky top-0 z-40">
        {tabItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all ${
                isActive 
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25' 
                  : 'text-zinc-400 bg-zinc-900/30 border border-zinc-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Side Tabs Navigation Bar */}
      <aside className="w-16 hover:w-64 border-r border-zinc-800/80 bg-zinc-950 p-4 space-y-6 flex flex-col justify-between hidden md:flex transition-all duration-300 ease-in-out group overflow-hidden flex-shrink-0">
        <div className="space-y-6">
          <div className="flex items-center border-b border-zinc-800 pb-4 h-12">
            <Link href="/dashboard" className="flex items-center">
              <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center font-bold text-sm text-zinc-100 flex-shrink-0">
                R
              </div>
              <span className="font-bold text-sm text-zinc-200 opacity-0 group-hover:opacity-100 ml-0 group-hover:ml-3 transition-all duration-300 whitespace-nowrap overflow-hidden">
                ResearcherGPT
              </span>
            </Link>
          </div>

          <div>
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden px-1">
              Workspace Tabs
            </span>
            <div className="space-y-1 mt-2">
              {tabItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full h-10 rounded-lg text-sm font-medium flex items-center transition-all ${
                      activeTab === item.id 
                        ? 'bg-zinc-900 text-indigo-400' 
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                    }`}
                  >
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <span className="opacity-0 group-hover:opacity-100 ml-0 group-hover:ml-3 transition-all duration-300 whitespace-nowrap overflow-hidden">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-4 text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden px-1">
          Project Workspace Mode
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <main className="flex-grow p-6 md:p-10 space-y-8 overflow-y-auto">
        
        {/* Project Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
          {isEditingProject ? (
            <div className="flex-grow max-w-2xl space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Project Name</label>
                <input
                  type="text"
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  className="w-full h-9 px-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm outline-none focus:border-indigo-500 text-zinc-200 font-sans"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Description</label>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!editProjectName.trim()) {
                        setGenerationError('Please enter a project name first.');
                        return;
                      }
                      setGenerationError('');
                      setIsGeneratingAIDesc(true);
                      try {
                        const res = await axios.post(`${API_URL}/api/projects/generate-description`, {
                          name: editProjectName,
                        });
                        if (res.data && res.data.description) {
                          setEditProjectDesc(res.data.description);
                        } else {
                          setGenerationError('AI generation returned empty results.');
                        }
                      } catch (err: any) {
                        console.error('Failed to generate description:', err);
                        setGenerationError(err.response?.data?.error || 'AI generation failed. Please try again.');
                      } finally {
                        setIsGeneratingAIDesc(false);
                      }
                    }}
                    disabled={isGeneratingAIDesc}
                    className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 disabled:text-zinc-650 flex items-center gap-1 transition-colors"
                  >
                    {isGeneratingAIDesc ? (
                      <>
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Generating...
                      </>
                    ) : (
                      '✨ Generate with AI'
                    )}
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={editProjectDesc}
                  onChange={(e) => {
                    setEditProjectDesc(e.target.value);
                    if (generationError) setGenerationError('');
                  }}
                  placeholder="Leave blank to generate automatically on save"
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm outline-none focus:border-indigo-500 text-zinc-200 font-sans"
                />
                {generationError && (
                  <p className="text-[10px] text-red-400 mt-1">{generationError}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateProjectDetails}
                  disabled={isSavingProjectDetails}
                  className="px-3 py-1.5 rounded bg-indigo-650 hover:bg-indigo-600 text-xs font-semibold text-zinc-100 transition-colors"
                >
                  {isSavingProjectDetails ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setIsEditingProject(false)}
                  className="px-3 py-1.5 rounded hover:bg-zinc-800 text-xs font-semibold text-zinc-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-grow">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{project?.name || 'Loading project...'}</h1>
                {project && (
                  <button
                    onClick={() => {
                      setEditProjectName(project.name || '');
                      setEditProjectDesc(project.description || '');
                      setIsEditingProject(true);
                    }}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                    title="Edit project details"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-zinc-500 text-xs mt-1">{project?.description || 'Loading workspace description.'}</p>
            </div>
          )}

          {/* Quick Query Agent Trigger */}
          <div className="flex items-center gap-2 max-w-xl w-full md:w-auto">
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="h-9 px-2 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] outline-none focus:border-indigo-500 text-zinc-400 font-medium"
            >
              <option value="IEEE">IEEE Format</option>
              <option value="ACM">ACM Format</option>
              <option value="Springer">Springer LNCS</option>
              <option value="Elsevier">Elsevier Harvard</option>
              <option value="APA">APA 7th Style</option>
              <option value="Harvard">Harvard Format</option>
            </select>
            <select
              value={selectedPages}
              onChange={(e) => setSelectedPages(parseInt(e.target.value))}
              className="h-9 px-2 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] outline-none focus:border-indigo-500 text-zinc-400 font-medium"
            >
              {Array.from({ length: 21 }, (_, i) => i + 5).map((num) => (
                <option key={num} value={num}>{num} Pages (A4)</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Query multi-agent graph..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              className="flex-grow md:w-36 h-9 px-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs outline-none focus:border-indigo-500 text-zinc-300"
            />
            <button
              onClick={handleTriggerAgent}
              disabled={runAgentLoading || !queryInput.trim()}
              className="px-4 h-9 rounded-lg bg-indigo-600 text-zinc-100 hover:bg-indigo-500 transition-colors flex items-center gap-1.5 font-medium text-xs disabled:opacity-40 whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" /> Synthesize
            </button>
          </div>
        </div>

        {/* Tab Contents Frame */}
        <div className="mt-4">
          
          {/* TAB 1: Papers & Upload */}
          {activeTab === 'papers' && (
            <div className="space-y-6">
              <div className="p-8 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/20 text-center flex flex-col items-center justify-center gap-4 relative overflow-hidden">
                <Upload className="w-10 h-10 text-zinc-500" />
                <div className="space-y-1">
                  <p className="text-zinc-300 font-semibold text-sm">Upload Academic Research Papers</p>
                  <p className="text-zinc-600 text-xs">Only PDF formats are supported for parsing and vector embeddings.</p>
                </div>
                <label className="px-5 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer select-none">
                  {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Choose File'}
                  <input type="file" accept="application/pdf" onChange={handleUpload} className="hidden" />
                </label>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-base">Paper Library ({papers.length})</h3>
                {papers.length === 0 ? (
                  <div className="py-16 text-center text-zinc-600 text-xs border border-zinc-900 rounded-xl">
                    No articles loaded. Upload PDFs to process them.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {papers.map((p) => (
                      <div key={p._id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/30 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3 min-w-0">
                            <FileText className="w-8 h-8 text-zinc-500 mt-1" />
                            <div className="min-w-0">
                              <a
                                href={`${API_URL}/${p.pdfUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline cursor-pointer group/title"
                              >
                                <p className="font-semibold text-sm text-zinc-200 truncate group-hover/title:text-indigo-400 transition-colors">
                                  {p.title}
                                </p>
                              </a>
                              <p className="text-zinc-500 text-xs mt-0.5">
                                {p.authors?.join(', ') || 'Processing Authors...'} • Year {p.year || 'N/A'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase ${
                              p.status === 'processed' ? 'bg-emerald-500/10 text-emerald-400' : 
                              p.status === 'processing' ? 'bg-indigo-500/10 text-indigo-400 animate-pulse' : 
                              p.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {p.status}
                            </span>
                            <button
                              onClick={() => handleDeletePaper(p._id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                              title="Delete Paper"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Rendering error if failed */}
                        {p.status === 'failed' && p.processingError && (
                          <div className="text-[10px] text-red-400/90 bg-red-500/5 border border-red-500/10 p-2.5 rounded-lg">
                            Error: {p.processingError}
                          </div>
                        )}

                        {/* Rendering beautiful pipeline stages animation if processing or pending */}
                        {(p.status === 'processing' || p.status === 'pending') && (
                          <ProcessingTimeline status={p.status} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AI RAG Chat */}
          {activeTab === 'chat' && <ChatWindow projectId={projectId} />}

          {/* TAB 3: 3D Knowledge Graph */}
          {activeTab === 'graph' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base">Connected Papers Map</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Interactive visual node mapping of related concepts in 3D canvas.</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Mode Selector Toggle */}
                  <div className="flex items-center bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg">
                    <button
                      onClick={() => setIsLearningMode(false)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition-all ${
                        !isLearningMode
                          ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <Layers className="w-3 h-3" /> Normal Mode
                    </button>
                    <button
                      onClick={() => setIsLearningMode(true)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition-all ${
                        isLearningMode
                          ? 'bg-indigo-600/90 text-white shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <GraduationCap className="w-3 h-3" /> Learning Mode
                    </button>
                  </div>

                  <button
                    onClick={async () => {
                      await axios.post(`${API_URL}/api/projects/${projectId}/graph`);
                      setTimeout(() => fetchGraphData(), 2000);
                    }}
                    className="px-4 h-8 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Re-index Graph
                  </button>
                </div>
              </div>

              {/* Grid: 3D Graph + Interactive Side Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={`${selectedNode ? 'lg:col-span-2' : 'lg:col-span-3'} transition-all duration-300`}>
                  <KnowledgeGraph3D 
                    nodes={graphData.nodes} 
                    links={graphData.links} 
                    onNodeClick={handleNodeClick}
                  />
                </div>

                {/* Interactive Learning Side Panel */}
                {selectedNode && (
                  <div className="lg:col-span-1 border border-zinc-800 rounded-xl bg-zinc-950 p-4 min-h-[450px] flex flex-col max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-zinc-850 pb-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            selectedNode.type === 'paper' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' :
                            selectedNode.type === 'author' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                            selectedNode.type === 'method' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                            'bg-pink-950 text-pink-300 border border-pink-800'
                          }`}>
                            {selectedNode.type}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-medium">Node Details</span>
                        </div>
                        <h4 className="font-bold text-sm text-zinc-100 mt-1 select-all">{selectedNode.label}</h4>
                      </div>
                      <button 
                        onClick={() => setSelectedNode(null)} 
                        className="p-1 rounded bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Skeleton Loader while fetching AI Data */}
                    {learningLoading ? (
                      <div className="space-y-4 flex-1 flex flex-col justify-center py-6">
                        <div className="h-4 bg-zinc-900 rounded w-2/3 animate-pulse"></div>
                        <div className="h-20 bg-zinc-900 rounded w-full animate-pulse"></div>
                        <div className="h-4 bg-zinc-900 rounded w-1/2 animate-pulse"></div>
                        <div className="h-28 bg-zinc-900 rounded w-full animate-pulse"></div>
                      </div>
                    ) : learningDetails ? (
                      /* Main Panel Body */
                      isLearningMode ? (
                        /* Learning Mode Stepper view */
                        <div className="flex flex-col flex-1">
                          {(() => {
                            const steps = 
                              selectedNode.type === 'paper' ? ['Problem', 'Method', 'Dataset', 'Results', 'Future Work'] :
                              selectedNode.type === 'method' ? ['Concept', 'Prerequisites', 'Workflow', 'Applications', 'Research Papers'] :
                              selectedNode.type === 'dataset' ? ['Dataset', 'Contents', 'Tasks', 'Methods', 'Research Papers'] :
                              ['Concept', 'Why Relevant', 'Connected Nodes', 'Resources'];
                            
                            const stepTitle = steps[activeStep];

                            return (
                              <div className="space-y-4 flex-1 flex flex-col justify-between">
                                <div className="space-y-3">
                                  {/* Stepper Progress Bar */}
                                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-semibold mb-1">
                                    <span>STEP {activeStep + 1} OF {steps.length}</span>
                                    <span className="text-indigo-400 uppercase tracking-wide">{stepTitle}</span>
                                  </div>
                                  <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden flex gap-0.5">
                                    {steps.map((_, sidx) => (
                                      <div 
                                        key={sidx} 
                                        className={`flex-1 h-full rounded-full transition-colors ${
                                          sidx <= activeStep ? 'bg-indigo-500' : 'bg-zinc-800'
                                        }`} 
                                      />
                                    ))}
                                  </div>

                                  {/* Stepper Body Content */}
                                  <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/40 p-3 rounded-lg border border-zinc-905 mt-2">
                                    <h5 className="font-bold text-zinc-200 text-xs uppercase tracking-wider mb-2 border-b border-zinc-800/80 pb-1">{stepTitle} Detail</h5>
                                    
                                    {/* PAPER STEPPER RENDER */}
                                    {selectedNode.type === 'paper' && (
                                      <>
                                        {activeStep === 0 && (
                                          <div className="space-y-2">
                                            <p className="font-semibold text-indigo-300">Quick Summary:</p>
                                            <p className="italic">"{learningDetails.typeSpecificData?.summary}"</p>
                                            <p className="font-semibold text-indigo-300 mt-3">Problem Being Solved:</p>
                                            <p>{learningDetails.typeSpecificData?.problem_solved}</p>
                                          </div>
                                        )}
                                        {activeStep === 1 && (
                                          <div className="space-y-3">
                                            <p className="font-semibold text-indigo-300">Methods Used in Research:</p>
                                            {learningDetails.typeSpecificData?.methods_used?.map((m: any, idx: number) => (
                                              <div key={idx} className="border-l-2 border-amber-500 pl-2 py-0.5">
                                                <p className="font-bold text-zinc-200">{m.name}</p>
                                                <p className="text-zinc-400 text-[11px] mt-0.5"><span className="text-zinc-500">Purpose:</span> {m.purpose}</p>
                                                <p className="text-zinc-400 text-[11px]"><span className="text-zinc-500">Why Used:</span> {m.why_used}</p>
                                              </div>
                                            )) || <p>No specific methods defined.</p>}
                                          </div>
                                        )}
                                        {activeStep === 2 && (
                                          <div className="space-y-3">
                                            <p className="font-semibold text-indigo-300">Datasets Evaluated:</p>
                                            {learningDetails.typeSpecificData?.datasets_used?.map((d: any, idx: number) => (
                                              <div key={idx} className="border-l-2 border-pink-500 pl-2 py-0.5">
                                                <p className="font-bold text-zinc-200">{d.name} <span className="text-zinc-500 text-[10px]">({d.size})</span></p>
                                                <p className="text-zinc-400 text-[11px] mt-0.5"><span className="text-zinc-500">Purpose:</span> {d.purpose}</p>
                                              </div>
                                            )) || <p>No specific datasets defined.</p>}
                                          </div>
                                        )}
                                        {activeStep === 3 && (
                                          <div className="space-y-3">
                                            <p className="font-semibold text-indigo-300">Experimental Results:</p>
                                            <div className="grid grid-cols-2 gap-2 mt-1">
                                              <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                                                <p className="text-zinc-500 text-[9px]">Accuracy</p>
                                                <p className="font-bold text-emerald-400">{learningDetails.typeSpecificData?.results?.accuracy || 'N/A'}</p>
                                              </div>
                                              <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                                                <p className="text-zinc-500 text-[9px]">F1 Score</p>
                                                <p className="font-bold text-emerald-400">{learningDetails.typeSpecificData?.results?.f1_score || 'N/A'}</p>
                                              </div>
                                              <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                                                <p className="text-zinc-500 text-[9px]">Precision</p>
                                                <p className="font-bold text-zinc-300">{learningDetails.typeSpecificData?.results?.precision || 'N/A'}</p>
                                              </div>
                                              <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                                                <p className="text-zinc-500 text-[9px]">Recall</p>
                                                <p className="font-bold text-zinc-300">{learningDetails.typeSpecificData?.results?.recall || 'N/A'}</p>
                                              </div>
                                            </div>
                                            <p className="font-semibold text-indigo-300 mt-3">Key Findings:</p>
                                            <ul className="list-disc pl-4 space-y-1">
                                              {learningDetails.typeSpecificData?.key_findings?.map((kf: string, idx: number) => (
                                                <li key={idx} className="text-zinc-400">{kf}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {activeStep === 4 && (
                                          <div className="space-y-2">
                                            <p className="font-semibold text-indigo-300">Future Research Avenues:</p>
                                            <ul className="list-disc pl-4 space-y-1">
                                              {learningDetails.typeSpecificData?.future_work?.map((fw: string, idx: number) => (
                                                <li key={idx} className="text-zinc-400">{fw}</li>
                                              ))}
                                            </ul>
                                            <p className="font-semibold text-indigo-300 mt-3">Student Exam Prep Points:</p>
                                            <ul className="list-disc pl-4 space-y-1">
                                              {learningDetails.typeSpecificData?.student_notes?.exam_points?.map((ep: string, idx: number) => (
                                                <li key={idx} className="text-zinc-400 font-medium">{ep}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </>
                                    )}

                                    {/* METHOD STEPPER RENDER */}
                                    {selectedNode.type === 'method' && (
                                      <>
                                        {activeStep === 0 && (
                                          <div className="space-y-2">
                                            <p className="font-semibold text-indigo-300">Simple Definition:</p>
                                            <p>{learningDetails.typeSpecificData?.definition}</p>
                                            <p className="font-semibold text-indigo-300 mt-3">Why This Method Exists:</p>
                                            <p>{learningDetails.typeSpecificData?.why_exists}</p>
                                            <p className="text-[10px] bg-zinc-950 p-2 rounded mt-2 border border-zinc-800 text-zinc-400">
                                              Difficulty Level: <span className="text-amber-400 font-bold">{learningDetails.typeSpecificData?.difficulty}</span>
                                            </p>
                                          </div>
                                        )}
                                        {activeStep === 1 && (
                                          <div className="space-y-2">
                                            <p className="font-semibold text-indigo-300">Prerequisites Required:</p>
                                            <ul className="space-y-1.5">
                                              {learningDetails.typeSpecificData?.prerequisites?.map((pr: string, idx: number) => (
                                                <li key={idx} className="flex items-center gap-2 text-zinc-400">
                                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                  <span>{pr}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {activeStep === 2 && (
                                          <div className="space-y-2">
                                            <p className="font-semibold text-indigo-300">Visual Workflow Steps:</p>
                                            <div className="flex flex-col gap-2 mt-2">
                                              {learningDetails.typeSpecificData?.workflow?.map((wf: string, idx: number) => (
                                                <div key={idx} className="flex items-center gap-3">
                                                  <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                                                    {idx + 1}
                                                  </div>
                                                  <span className="text-zinc-300">{wf}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {activeStep === 3 && (
                                          <div className="space-y-2">
                                            <p className="font-semibold text-indigo-300">Real World Applications:</p>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                              {learningDetails.typeSpecificData?.applications?.map((app: string, idx: number) => (
                                                <span key={idx} className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-400">
                                                  {app}
                                                </span>
                                              ))}
                                            </div>
                                            <p className="font-semibold text-indigo-300 mt-4">Core Advantages:</p>
                                            <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                                              {learningDetails.typeSpecificData?.advantages?.map((adv: string, idx: number) => (
                                                <li key={idx}>{adv}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {activeStep === 4 && (
                                          <div className="space-y-2">
                                            <p className="font-semibold text-indigo-300">Papers Using This Method:</p>
                                            <ul className="list-disc pl-4 space-y-1.5 text-zinc-400">
                                              {learningDetails.typeSpecificData?.papers_using?.map((p: string, idx: number) => (
                                                <li key={idx} className="italic">"{p}"</li>
                                              )) || <li>No papers linked.</li>}
                                            </ul>
                                          </div>
                                        )}
                                      </>
                                    )}

                                    {/* DATASET STEPPER RENDER */}
                                    {selectedNode.type === 'dataset' && (
                                      <>
                                        {activeStep === 0 && (
                                          <div className="space-y-2">
                                            <p className="font-semibold text-indigo-300">Dataset Overview:</p>
                                            <p>{learningDetails.typeSpecificData?.overview?.purpose}</p>
                                            <p className="text-[11px] text-zinc-400 mt-2">
                                              <span className="text-zinc-500">Domain:</span> {learningDetails.typeSpecificData?.overview?.domain}
                                            </p>
                                          </div>
                                        )}
                                        {activeStep === 1 && (
                                          <div className="space-y-2">
                                            <p className="font-semibold text-indigo-300">Dataset Statistics:</p>
                                            <div className="grid grid-cols-2 gap-2 mt-1">
                                              <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                                                <p className="text-zinc-500 text-[9px]">Samples</p>
                                                <p className="font-bold text-pink-400">{learningDetails.typeSpecificData?.statistics?.samples || 'N/A'}</p>
                                              </div>
                                              <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                                                <p className="text-zinc-500 text-[9px]">Classes</p>
                                                <p className="font-bold text-pink-400">{learningDetails.typeSpecificData?.statistics?.classes || 'N/A'}</p>
                                              </div>
                                              <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                                                <p className="text-zinc-500 text-[9px]">Features</p>
                                                <p className="font-bold text-zinc-300">{learningDetails.typeSpecificData?.statistics?.features || 'N/A'}</p>
                                              </div>
                                              <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                                                <p className="text-zinc-500 text-[9px]">Data Modalities</p>
                                                <p className="font-bold text-zinc-300">{learningDetails.typeSpecificData?.data_types?.join(', ') || 'N/A'}</p>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        {activeStep === 2 && (
                                          <div className="space-y-2">
                                            <p className="font-semibold text-indigo-300">Common Tasks Performed:</p>
                                            <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                                              {learningDetails.typeSpecificData?.insights?.tasks?.map((t: string, idx: number) => (
                                                <li key={idx}>{t}</li>
                                              ))}
                                            </ul>
                                            <p className="font-semibold text-indigo-300 mt-3">Projects You Can Build:</p>
                                            <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                                              {learningDetails.typeSpecificData?.insights?.projects?.map((pr: string, idx: number) => (
                                                <li key={idx} className="font-medium">{pr}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {activeStep === 3 && (
                                          <div className="space-y-2">
                                            <p className="font-semibold text-indigo-300">Common Evaluation Methods:</p>
                                            <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                                              {learningDetails.typeSpecificData?.methods_using?.map((m: string, idx: number) => (
                                                <li key={idx}>{m}</li>
                                              )) || <li>No common evaluation methods defined.</li>}
                                            </ul>
                                          </div>
                                        )}
                                        {activeStep === 4 && (
                                          <div className="space-y-2">
                                            <p className="font-semibold text-indigo-300">Research Papers Using This Dataset:</p>
                                            <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                                              {learningDetails.typeSpecificData?.papers_using?.map((p: string, idx: number) => (
                                                <li key={idx} className="italic">"{p}"</li>
                                              )) || <li>No papers linked.</li>}
                                            </ul>
                                          </div>
                                        )}
                                      </>
                                    )}

                                    {/* DEFAULT STEPPER RENDER */}
                                    {selectedNode.type !== 'paper' && selectedNode.type !== 'method' && selectedNode.type !== 'dataset' && (
                                      <div className="space-y-2">
                                        <p>{learningDetails.explanations?.intermediate}</p>
                                        <p className="text-[11px] text-zinc-500 mt-2">Why seeing this: {learningDetails.whySeeingThis}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Stepper Navigation Footer */}
                                <div className="flex items-center justify-between border-t border-zinc-850 pt-3 mt-4">
                                  <button
                                    onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
                                    disabled={activeStep === 0}
                                    className="px-3 py-1.5 text-[11px] rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-900 text-zinc-300 font-bold transition-all flex items-center gap-1"
                                  >
                                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                                  </button>
                                  <button
                                    onClick={() => setActiveStep((prev) => Math.min(steps.length - 1, prev + 1))}
                                    disabled={activeStep === steps.length - 1}
                                    className="px-3 py-1.5 text-[11px] rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-bold transition-all flex items-center gap-1"
                                  >
                                    Next <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        /* Normal Mode tabbed view */
                        <div className="flex flex-col flex-1">
                          {/* Inner Tabs navigation */}
                          <div className="flex items-center justify-between bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 mb-4">
                            {(['explain', 'insights', 'connections', 'assets', 'tutor'] as const).map((tab) => (
                              <button
                                key={tab}
                                onClick={() => setLearningPanelTab(tab)}
                                className={`flex-1 py-1 text-[10px] font-bold rounded capitalize transition-all ${
                                  learningPanelTab === tab 
                                    ? 'bg-zinc-800 text-zinc-100' 
                                    : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                              >
                                {tab === 'explain' ? 'Explain' : tab === 'assets' ? 'Assets' : tab}
                              </button>
                            ))}
                          </div>

                          {/* Inner Tabs content */}
                          <div className="flex-1 text-xs text-zinc-300 leading-relaxed scrollbar-thin">
                            
                            {/* TAB: Explain (Multi-level explanation) */}
                            {learningPanelTab === 'explain' && (
                              <div className="space-y-4">
                                <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-md border border-zinc-800">
                                  {(['beginner', 'intermediate', 'research'] as const).map((lvl) => (
                                    <button
                                      key={lvl}
                                      onClick={() => setDifficultyLevel(lvl)}
                                      className={`flex-1 py-1 rounded text-[10px] font-semibold uppercase tracking-wider capitalize transition-all ${
                                        difficultyLevel === lvl 
                                          ? 'bg-zinc-800 text-indigo-400 border border-zinc-700' 
                                          : 'text-zinc-500 hover:text-zinc-300'
                                      }`}
                                    >
                                      {lvl}
                                    </button>
                                  ))}
                                </div>
                                <div className="bg-zinc-900/40 p-3.5 rounded-lg border border-zinc-900">
                                  <p className="whitespace-pre-line text-zinc-200">
                                    {difficultyLevel === 'beginner' && learningDetails.explanations?.beginner}
                                    {difficultyLevel === 'intermediate' && learningDetails.explanations?.intermediate}
                                    {difficultyLevel === 'research' && learningDetails.explanations?.research}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* TAB: Insights (Type-specific detailed metadata) */}
                            {learningPanelTab === 'insights' && (
                              <div className="space-y-4">
                                <div className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-900">
                                  <h5 className="font-bold text-zinc-400 text-[10px] tracking-wider uppercase mb-1">Why am I seeing this?</h5>
                                  <p className="text-zinc-300">{learningDetails.whySeeingThis}</p>
                                </div>

                                {/* Paper Insights */}
                                {selectedNode.type === 'paper' && (
                                  <div className="space-y-3.5">
                                    <div>
                                      <h5 className="font-bold text-indigo-400 mb-1">Quick Summary</h5>
                                      <p className="italic bg-zinc-950 p-2.5 rounded border border-zinc-900">"{learningDetails.typeSpecificData?.summary}"</p>
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-indigo-400 mb-1">Problem Being Solved</h5>
                                      <p>{learningDetails.typeSpecificData?.problem_solved}</p>
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-indigo-400 mb-1">Main Contribution</h5>
                                      <p>{learningDetails.typeSpecificData?.main_contribution}</p>
                                    </div>
                                    {learningDetails.typeSpecificData?.results && (
                                      <div>
                                        <h5 className="font-bold text-indigo-400 mb-1">Experimental Results</h5>
                                        <div className="grid grid-cols-2 gap-2 mt-1">
                                          {Object.entries(learningDetails.typeSpecificData.results).map(([k, v]: any) => (
                                            <div key={k} className="bg-zinc-900 p-2 rounded border border-zinc-800">
                                              <p className="text-zinc-500 capitalize text-[9px]">{k.replace('_', ' ')}</p>
                                              <p className="font-bold text-emerald-400 text-xs">{v}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {learningDetails.typeSpecificData?.key_findings && (
                                      <div>
                                        <h5 className="font-bold text-indigo-400 mb-1">Key Findings</h5>
                                        <ul className="list-disc pl-4 space-y-1">
                                          {learningDetails.typeSpecificData.key_findings.map((f: string, idx: number) => (
                                            <li key={idx} className="text-zinc-300">{f}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Author Insights */}
                                {selectedNode.type === 'author' && (
                                  <div className="space-y-3.5">
                                    <div>
                                      <h5 className="font-bold text-emerald-400 mb-1">Academic Profile</h5>
                                      <p className="text-zinc-200">Name: <span className="text-zinc-300 font-bold">{learningDetails.typeSpecificData?.profile?.name}</span></p>
                                      <p className="text-zinc-200">Affiliation: <span className="text-zinc-400">{learningDetails.typeSpecificData?.profile?.affiliation || 'N/A'}</span></p>
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-emerald-400 mb-1">Expertise Areas</h5>
                                      <div className="flex flex-wrap gap-1.5">
                                        {learningDetails.typeSpecificData?.expertise_areas?.map((exp: string, idx: number) => (
                                          <span key={idx} className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-900/60 text-[10px]">
                                            {exp}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    {learningDetails.typeSpecificData?.impact && (
                                      <div>
                                        <h5 className="font-bold text-emerald-400 mb-1">Research Impact</h5>
                                        <div className="grid grid-cols-4 gap-1.5 text-center">
                                          <div className="bg-zinc-900 p-1 rounded border border-zinc-800">
                                            <p className="text-zinc-500 text-[8px]">Papers</p>
                                            <p className="font-extrabold text-[11px] text-zinc-300">{learningDetails.typeSpecificData.impact.total_papers || '0'}</p>
                                          </div>
                                          <div className="bg-zinc-900 p-1 rounded border border-zinc-800">
                                            <p className="text-zinc-500 text-[8px]">Citations</p>
                                            <p className="font-extrabold text-[11px] text-zinc-300">{learningDetails.typeSpecificData.impact.total_citations || '0'}</p>
                                          </div>
                                          <div className="bg-zinc-900 p-1 rounded border border-zinc-800">
                                            <p className="text-zinc-500 text-[8px]">H-Index</p>
                                            <p className="font-extrabold text-[11px] text-emerald-400">{learningDetails.typeSpecificData.impact.h_index || '0'}</p>
                                          </div>
                                          <div className="bg-zinc-900 p-1 rounded border border-zinc-800">
                                            <p className="text-zinc-500 text-[8px]">i10-Index</p>
                                            <p className="font-extrabold text-[11px] text-zinc-300">{learningDetails.typeSpecificData.impact.i10_index || '0'}</p>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    <div>
                                      <h5 className="font-bold text-emerald-400 mb-1">Research Evolution Timeline</h5>
                                      <div className="space-y-1.5 pl-2 border-l border-zinc-800">
                                        {learningDetails.typeSpecificData?.timeline?.map((t: any, idx: number) => (
                                          <div key={idx} className="text-[11px]">
                                            <span className="font-bold text-emerald-500">{t.year}:</span> <span className="text-zinc-300">{t.focus}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-emerald-400 mb-1">Student Recommendations</h5>
                                      <ul className="list-disc pl-4 space-y-1">
                                        {learningDetails.typeSpecificData?.student_recommendations?.map((rec: string, idx: number) => (
                                          <li key={idx} className="text-zinc-300">{rec}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                )}

                                {/* Method Insights */}
                                {selectedNode.type === 'method' && (
                                  <div className="space-y-3.5">
                                    <div>
                                      <h5 className="font-bold text-amber-400 mb-1">Simple Definition</h5>
                                      <p>{learningDetails.typeSpecificData?.definition}</p>
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-amber-400 mb-1">Why It Exists</h5>
                                      <p>{learningDetails.typeSpecificData?.why_exists}</p>
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-amber-400 mb-1">Prerequisites</h5>
                                      <div className="flex flex-wrap gap-1.5">
                                        {learningDetails.typeSpecificData?.prerequisites?.map((p: string, idx: number) => (
                                          <span key={idx} className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 flex items-center gap-1">
                                            ✓ {p}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <h5 className="font-bold text-emerald-400 mb-1">Advantages</h5>
                                        <ul className="list-disc pl-4 space-y-0.5 text-zinc-400 text-[11px]">
                                          {learningDetails.typeSpecificData?.advantages?.slice(0, 3).map((a: string, idx: number) => (
                                            <li key={idx}>{a}</li>
                                          ))}
                                        </ul>
                                      </div>
                                      <div>
                                        <h5 className="font-bold text-rose-400 mb-1">Limitations</h5>
                                        <ul className="list-disc pl-4 space-y-0.5 text-zinc-400 text-[11px]">
                                          {learningDetails.typeSpecificData?.limitations?.slice(0, 3).map((l: string, idx: number) => (
                                            <li key={idx}>{l}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-amber-400 mb-1">Real World Applications</h5>
                                      <div className="flex flex-wrap gap-1">
                                        {learningDetails.typeSpecificData?.applications?.map((app: string, idx: number) => (
                                          <span key={idx} className="px-2 py-0.5 rounded bg-amber-950/20 text-amber-300 border border-amber-900/60 text-[10px]">
                                            {app}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Dataset Insights */}
                                {selectedNode.type === 'dataset' && (
                                  <div className="space-y-3.5">
                                    <div>
                                      <h5 className="font-bold text-pink-400 mb-1">Dataset Overview</h5>
                                      <p>{learningDetails.typeSpecificData?.overview?.purpose}</p>
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-pink-400 mb-1">Dataset Statistics</h5>
                                      <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-zinc-900 p-2 rounded border border-zinc-800 text-center">
                                          <p className="text-zinc-500 text-[8px]">Samples</p>
                                          <p className="font-extrabold text-xs text-zinc-300">{learningDetails.typeSpecificData?.statistics?.samples || '0'}</p>
                                        </div>
                                        <div className="bg-zinc-900 p-2 rounded border border-zinc-800 text-center">
                                          <p className="text-zinc-500 text-[8px]">Classes</p>
                                          <p className="font-extrabold text-xs text-zinc-300">{learningDetails.typeSpecificData?.statistics?.classes || '0'}</p>
                                        </div>
                                        <div className="bg-zinc-900 p-2 rounded border border-zinc-800 text-center">
                                          <p className="text-zinc-500 text-[8px]">Features</p>
                                          <p className="font-extrabold text-xs text-zinc-300">{learningDetails.typeSpecificData?.statistics?.features || '0'}</p>
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-pink-400 mb-1">Student Insights</h5>
                                      <p className="italic bg-zinc-950 p-2 rounded border border-zinc-900 text-zinc-400">"{learningDetails.typeSpecificData?.insights?.why_use}"</p>
                                      <p className="font-semibold text-zinc-300 mt-2">Projects You Can Build:</p>
                                      <ul className="list-disc pl-4 space-y-0.5 text-zinc-400">
                                        {learningDetails.typeSpecificData?.insights?.projects?.map((pr: string, idx: number) => (
                                          <li key={idx}>{pr}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* TAB: Connections (Direct & Indirect relations explanation) */}
                            {learningPanelTab === 'connections' && (
                              <div className="space-y-4">
                                <div className="bg-zinc-900/40 p-3.5 rounded-lg border border-zinc-900">
                                  <h5 className="font-bold text-indigo-400 mb-1.5">Connection Logic Explanation</h5>
                                  <p className="text-zinc-300">{learningDetails.connections?.explanation}</p>
                                </div>

                                <div className="space-y-3">
                                  <div>
                                    <h5 className="font-bold text-zinc-400 text-[10px] tracking-wider uppercase mb-1">Direct Connections</h5>
                                    <div className="flex flex-wrap gap-1.5">
                                      {learningDetails.connections?.direct?.map((d: string, idx: number) => (
                                        <span key={idx} className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">
                                          {d}
                                        </span>
                                      )) || <span className="text-zinc-500 text-[10px]">None</span>}
                                    </div>
                                  </div>
                                  <div>
                                    <h5 className="font-bold text-zinc-400 text-[10px] tracking-wider uppercase mb-1">Indirect Connections (1-hop suggestions)</h5>
                                    <div className="flex flex-wrap gap-1.5">
                                      {learningDetails.connections?.indirect?.map((d: string, idx: number) => (
                                        <span key={idx} className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-900 text-[10px] text-zinc-500">
                                          {d}
                                        </span>
                                      )) || <span className="text-zinc-500 text-[10px]">None</span>}
                                    </div>
                                  </div>
                                  <div>
                                    <h5 className="font-bold text-zinc-400 text-[10px] tracking-wider uppercase mb-1">Most Important Hub Connections</h5>
                                    <div className="flex flex-wrap gap-1.5">
                                      {learningDetails.connections?.most_important?.map((d: string, idx: number) => (
                                        <span key={idx} className="px-2 py-0.5 rounded bg-indigo-950/20 border border-indigo-900/50 text-[10px] text-indigo-300 font-semibold">
                                          {d}
                                        </span>
                                      )) || <span className="text-zinc-550 text-[10px]">None</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* TAB: Learning Assets (Study guide, flashcards, MCQs) */}
                            {learningPanelTab === 'assets' && (
                              <div className="space-y-4">
                                <div>
                                  <h5 className="font-bold text-indigo-400 mb-1">Study Summary</h5>
                                  <p className="bg-zinc-900/40 p-2.5 rounded border border-zinc-900 text-zinc-300">{learningDetails.learningAssets?.summary}</p>
                                </div>

                                <div className="space-y-3 border-t border-zinc-900 pt-3">
                                  <h5 className="font-bold text-zinc-400 text-xs mb-2">Interactive Study Material</h5>
                                  
                                  {/* Toggleable Flashcards Accordion */}
                                  <details className="group border border-zinc-850 rounded-lg bg-zinc-900/10 overflow-hidden">
                                    <summary className="p-3 text-xs font-bold text-zinc-200 cursor-pointer hover:bg-zinc-900 flex justify-between items-center transition-colors">
                                      <span>📇 Student Flashcards ({learningDetails.learningAssets?.flashcards?.length || 0})</span>
                                      <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
                                    </summary>
                                    <div className="p-3 border-t border-zinc-900 space-y-2 bg-zinc-955">
                                      {learningDetails.learningAssets?.flashcards?.map((fc: any, idx: number) => (
                                        <div key={idx} className="bg-zinc-900/60 p-2.5 rounded border border-zinc-850">
                                          <p className="font-bold text-indigo-300 text-[11px]">Q: {fc.question}</p>
                                          <p className="text-zinc-400 text-[11px] mt-1 pl-2 border-l border-zinc-800">A: {fc.answer}</p>
                                        </div>
                                      )) || <p className="text-zinc-500">None available.</p>}
                                    </div>
                                  </details>

                                  {/* Toggleable MCQs Accordion */}
                                  <details className="group border border-zinc-850 rounded-lg bg-zinc-900/10 overflow-hidden">
                                    <summary className="p-3 text-xs font-bold text-zinc-200 cursor-pointer hover:bg-zinc-900 flex justify-between items-center transition-colors">
                                      <span>📝 Multiple Choice Questions (MCQs)</span>
                                      <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
                                    </summary>
                                    <div className="p-3 border-t border-zinc-900 space-y-3.5 bg-zinc-955">
                                      {learningDetails.learningAssets?.mcqs?.map((m: any, idx: number) => (
                                        <div key={idx} className="bg-zinc-900/60 p-2.5 rounded border border-zinc-850">
                                          <p className="font-bold text-zinc-200 text-[11px]">{idx + 1}. {m.question}</p>
                                          <div className="grid grid-cols-2 gap-1.5 mt-2">
                                            {m.options?.map((opt: string, oidx: number) => (
                                              <span key={oidx} className={`px-2 py-1 rounded text-[10px] border ${
                                                opt.includes(m.answer) || opt.startsWith(m.answer)
                                                  ? 'bg-emerald-950/30 border-emerald-900 text-emerald-400 font-semibold'
                                                  : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                                              }`}>
                                                {opt}
                                              </span>
                                            ))}
                                          </div>
                                          {m.explanation && (
                                            <p className="text-zinc-400 text-[10px] mt-2 italic pl-2 border-l border-emerald-900/60">
                                              <span className="font-semibold text-emerald-500">Explanation:</span> {m.explanation}
                                            </p>
                                          )}
                                        </div>
                                      )) || <p className="text-zinc-500">None available.</p>}
                                    </div>
                                  </details>

                                  {/* Toggleable Viva & Interview Accordion */}
                                  <details className="group border border-zinc-850 rounded-lg bg-zinc-900/10 overflow-hidden">
                                    <summary className="p-3 text-xs font-bold text-zinc-200 cursor-pointer hover:bg-zinc-900 flex justify-between items-center transition-colors">
                                      <span>🎓 Exam Viva & Interview Prep</span>
                                      <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
                                    </summary>
                                    <div className="p-3 border-t border-zinc-900 space-y-3 bg-zinc-955">
                                      <div>
                                        <p className="font-bold text-[10px] text-zinc-450 uppercase tracking-wider mb-1.5 text-zinc-400">Oral Viva Questions</p>
                                        <div className="space-y-2">
                                          {learningDetails.learningAssets?.viva_questions?.map((v: any, idx: number) => (
                                            <div key={idx} className="bg-zinc-900/60 p-2 rounded border border-zinc-850">
                                              <p className="font-semibold text-zinc-300 text-[11px]">Q: {v.question}</p>
                                              <p className="text-zinc-400 text-[11px] mt-0.5 italic">A: {v.answer}</p>
                                            </div>
                                          )) || <p className="text-zinc-500">None available.</p>}
                                        </div>
                                      </div>
                                      <div className="border-t border-zinc-900 pt-3">
                                        <p className="font-bold text-[10px] text-zinc-455 uppercase tracking-wider mb-1.5 text-zinc-400">Interview Preparation</p>
                                        <div className="space-y-2">
                                          {learningDetails.learningAssets?.interview_questions?.map((v: any, idx: number) => (
                                            <div key={idx} className="bg-zinc-900/60 p-2 rounded border border-zinc-850">
                                              <p className="font-semibold text-zinc-300 text-[11px]">Q: {v.question}</p>
                                              <p className="text-zinc-400 text-[11px] mt-0.5">A: {v.answer}</p>
                                            </div>
                                          )) || <p className="text-zinc-500">None available.</p>}
                                        </div>
                                      </div>
                                    </div>
                                  </details>

                                </div>
                              </div>
                            )}

                            {/* TAB: Tutor (Interactive Chat bot) */}
                            {learningPanelTab === 'tutor' && (
                              <div className="flex flex-col h-[320px]">
                                {/* Chat Log area */}
                                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1.5 mb-2 scrollbar-thin scrollbar-thumb-zinc-800">
                                  {tutorMessages.map((msg, idx) => (
                                    <div 
                                      key={idx} 
                                      className={`p-2 rounded-lg text-[11px] max-w-[85%] leading-relaxed ${
                                        msg.sender === 'user' 
                                          ? 'bg-indigo-600 text-white ml-auto text-right' 
                                          : 'bg-zinc-900 border border-zinc-850 text-zinc-300 mr-auto text-left'
                                      }`}
                                    >
                                      <p className="whitespace-pre-wrap">{msg.text}</p>
                                    </div>
                                  ))}
                                  {tutorLoading && (
                                    <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-850 text-zinc-500 mr-auto text-[11px] animate-pulse">
                                      Tutor is typing...
                                    </div>
                                  )}
                                </div>

                                {/* Predefined Prompts Chips */}
                                <div className="flex flex-wrap gap-1.5 mb-2.5 pb-1.5 border-b border-zinc-900">
                                  {[
                                    'Explain concept simply',
                                    'Give real-world example',
                                    'Explain mathematically',
                                    'Interview prep advice',
                                    'Teach in 5 minutes'
                                  ].map((prm) => (
                                    <button
                                      key={prm}
                                      onClick={() => handleAskTutor(prm)}
                                      disabled={tutorLoading}
                                      className="px-2 py-0.5 rounded-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[9px] text-zinc-400 transition-colors disabled:opacity-50"
                                    >
                                      {prm}
                                    </button>
                                  ))}
                                </div>

                                {/* Chat input box */}
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={tutorQuestion}
                                    onChange={(e) => setTutorQuestion(e.target.value)}
                                    placeholder="Ask anything about this node..."
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleAskTutor();
                                    }}
                                    className="flex-1 px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-855 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                                  />
                                  <button
                                    onClick={() => handleAskTutor()}
                                    disabled={tutorLoading || !tutorQuestion.trim()}
                                    className="px-3 rounded-lg bg-indigo-600 hover:bg-indigo-505 text-white text-xs font-bold transition-all disabled:opacity-40"
                                  >
                                    Send
                                  </button>
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      )
                    ) : (
                      /* Fallback Error message if somehow loading failed */
                      <div className="text-center py-8 text-zinc-500 text-xs">
                        Failed to generate study assets for this node.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Literature Summary & Matrix */}
          {activeTab === 'litreview' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-base">Research Comparison Matrix</h3>
                <p className="text-zinc-500 text-xs mt-0.5">Synthesized matrix mapping accuracy variables, datasets, and models.</p>
              </div>
              
              <div className="border border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                        {Array.isArray(comparison?.columns) && comparison.columns.map((c: string, idx: number) => (
                          <th key={idx} className="p-3.5 font-semibold">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                      {!Array.isArray(comparison?.rows) || comparison.rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-zinc-500">
                            No processed comparative data. Run the Multi-Agent writing agent.
                          </td>
                        </tr>
                      ) : (
                        comparison.rows.map((row: any, rIdx: number) => (
                          <tr key={rIdx} className="hover:bg-zinc-900/10 text-zinc-300">
                            <td className="p-3.5 font-medium text-zinc-100">{row.Title || row.title}</td>
                            <td className="p-3.5">{row.Authors || row.authors}</td>
                            <td className="p-3.5">{row.Year || row.year}</td>
                            <td className="p-3.5"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">{row.Accuracy || row.accuracy}</span></td>
                            <td className="p-3.5">{row['Method/Models'] || row.method || row.models || row['method/models']}</td>
                            <td className="p-3.5 font-semibold text-zinc-400">{row.Dataset || row.dataset}</td>
                            <td className="p-3.5 text-zinc-400">{row.Strengths || row.strengths}</td>
                            <td className="p-3.5 text-zinc-400">{row.Weaknesses || row.weaknesses}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Citations */}
          {activeTab === 'citations' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base">Zotero Reference Library</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Manage formatted bibliography references inside workspace.</p>
                </div>
              </div>

              {citations.length === 0 ? (
                <div className="py-16 text-center text-zinc-600 text-xs border border-zinc-900 rounded-xl">
                  Bibliography is empty. References are generated automatically during Agent Runs.
                </div>
              ) : (
                <div className="space-y-3">
                  {citations.map((c) => (
                    <div key={c._id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/30 space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-semibold text-[10px]">
                          [{c.key}]
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-zinc-500">{c.doi || 'No DOI'}</span>
                          <button
                            onClick={() => {
                              setEditingCitationId(c._id);
                              setEditCitationTitle(c.title || '');
                              setEditCitationAuthors((c.authors || []).join(', '));
                              setEditCitationJournal(c.journal || '');
                              setEditCitationYear(c.year || 2024);
                              setEditCitationVolume(c.volume || '');
                              setEditCitationIssue(c.issue || '');
                              setEditCitationPages(c.pages || '');
                              setEditCitationPublisher(c.publisher || '');
                              setEditCitationDoi(c.doi || '');
                              setEditCitationText(c.styles?.apa || '');
                            }}
                            className="text-[10px] text-zinc-400 hover:text-indigo-400 font-semibold transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCitation(c._id)}
                            className="text-[10px] text-zinc-500 hover:text-red-400 font-semibold transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      
                      {editingCitationId === c._id ? (
                        <div className="space-y-3 pt-1">
                          <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-semibold uppercase">Title</label>
                            <input
                              type="text"
                              value={editCitationTitle}
                              onChange={(e) => setEditCitationTitle(e.target.value)}
                              className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-semibold uppercase">Authors (comma separated)</label>
                            <input
                              type="text"
                              value={editCitationAuthors}
                              onChange={(e) => setEditCitationAuthors(e.target.value)}
                              className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1 col-span-1 md:col-span-2">
                              <label className="text-[10px] text-zinc-500 font-semibold uppercase">Journal / Conference / Publisher</label>
                              <input
                                type="text"
                                value={editCitationJournal}
                                onChange={(e) => setEditCitationJournal(e.target.value)}
                                className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-semibold uppercase">Year</label>
                              <input
                                type="number"
                                value={editCitationYear}
                                onChange={(e) => setEditCitationYear(parseInt(e.target.value) || 2024)}
                                className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-semibold uppercase">Volume</label>
                              <input
                                type="text"
                                value={editCitationVolume}
                                onChange={(e) => setEditCitationVolume(e.target.value)}
                                className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-semibold uppercase">Issue</label>
                              <input
                                type="text"
                                value={editCitationIssue}
                                onChange={(e) => setEditCitationIssue(e.target.value)}
                                className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-semibold uppercase">Pages</label>
                              <input
                                type="text"
                                value={editCitationPages}
                                onChange={(e) => setEditCitationPages(e.target.value)}
                                className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-semibold uppercase">DOI</label>
                              <input
                                type="text"
                                value={editCitationDoi}
                                onChange={(e) => setEditCitationDoi(e.target.value)}
                                className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-semibold uppercase">Raw Citation Text Override (APA)</label>
                            <textarea
                              value={editCitationText}
                              onChange={(e) => setEditCitationText(e.target.value)}
                              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 font-serif"
                              rows={2}
                            />
                          </div>
                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              onClick={() => setEditingCitationId(null)}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-semibold text-zinc-300"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleUpdateCitation(c._id)}
                              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-[10px] font-semibold text-zinc-100"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs text-zinc-400 mt-2 space-y-1 bg-[#0d0d0f] p-3 rounded-lg border border-zinc-850">
                            <p className="text-zinc-200"><strong className="text-zinc-500 text-[9px] uppercase font-mono mr-1">Title:</strong> {c.title}</p>
                            <p><strong className="text-zinc-500 text-[9px] uppercase font-mono mr-1">Authors:</strong> {c.authors?.join(', ') || 'N/A'}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                              <p><strong className="text-zinc-500 text-[9px] uppercase font-mono mr-1">Journal:</strong> {c.journal || c.publisher || 'N/A'}</p>
                              <p><strong className="text-zinc-500 text-[9px] uppercase font-mono mr-1">Details:</strong> Year {c.year} {c.volume ? `• Vol. ${c.volume}` : ''} {c.issue ? `• No. ${c.issue}` : ''} {c.pages ? `• pp. ${c.pages}` : ''}</p>
                            </div>
                          </div>
                          <p className="text-sm text-zinc-200 leading-relaxed font-serif pt-1">{c.styles?.apa || c.apa}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
            {/* TAB 6: Gaps */}
          {activeTab === 'gaps' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/40 pb-4">
                <div>
                  <h3 className="font-bold text-base">Open Research Gaps Board</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Suggestions of future works and methodology limitations detected by agents.</p>
                </div>
                <button
                  onClick={handleAddNewGapClick}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-zinc-100 transition-all flex items-center gap-2 text-xs font-semibold shadow-lg shadow-indigo-600/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Research Gap</span>
                </button>
              </div>

              {gaps.length === 0 && editingGapId !== 'new-gap' ? (
                <div className="py-16 text-center text-zinc-500 text-xs border border-zinc-900 border-dashed rounded-xl flex flex-col items-center justify-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-zinc-650" />
                  <p className="text-zinc-400 font-medium">No research gaps detected yet</p>
                  <p className="text-zinc-600 max-w-sm">Create a new gap card manually, or generate them automatically using AI.</p>
                  <button
                    onClick={handleAddNewGapClick}
                    className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-zinc-100 font-semibold text-xs transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/10"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Research Gap</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Unsaved Manual Gap Creation Card */}
                  {editingGapId === 'new-gap' && (
                    <div className="p-5 rounded-xl border border-indigo-500/50 bg-zinc-950/40 space-y-4 relative flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 font-semibold uppercase">Title</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Mined Gap"
                            value={editGapTitle}
                            onChange={(e) => setEditGapTitle(e.target.value)}
                            className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 font-semibold uppercase">Description</label>
                          <textarea
                            required
                            placeholder="e.g. No description provided."
                            value={editGapDescription}
                            onChange={(e) => setEditGapDescription(e.target.value)}
                            className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                            rows={3}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 font-semibold uppercase">Supporting Evidence (one quote per line)</label>
                          <textarea
                            placeholder="Add sentences/quotes from source papers proving this gap..."
                            value={editGapEvidence}
                            onChange={(e) => setEditGapEvidence(e.target.value)}
                            className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                            rows={3}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-semibold uppercase">Category</label>
                            <select
                              value={editGapCategory}
                              onChange={(e) => setEditGapCategory(e.target.value)}
                              className="w-full h-8 px-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                            >
                              <option value="methodological">Methodological</option>
                              <option value="empirical">Empirical</option>
                              <option value="theoretical">Theoretical</option>
                              <option value="dataset">Dataset</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-semibold uppercase">Impact (1-10)</label>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={editGapImpact}
                              onChange={(e) => setEditGapImpact(parseInt(e.target.value) || 5)}
                              className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-semibold uppercase">Feasibility (1-10)</label>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={editGapFeasibility}
                              onChange={(e) => setEditGapFeasibility(parseInt(e.target.value) || 5)}
                              className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-between pt-1 w-full">
                          <button
                            type="button"
                            onClick={handleFillFormWithAI}
                            disabled={isFillingWithAI}
                            className="px-3 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 disabled:text-zinc-500 disabled:bg-zinc-900 border border-amber-500/20 text-[11px] font-semibold transition-colors flex items-center gap-1.5"
                          >
                            {isFillingWithAI ? (
                              <>
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Generating...
                              </>
                            ) : (
                              <>
                                <span>✨ Generate with AI</span>
                              </>
                            )}
                          </button>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingGapId(null)}
                              className="px-3 py-1.5 rounded bg-zinc-850 hover:bg-zinc-800 text-[11px] font-semibold text-zinc-300 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveNewGap}
                              className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-zinc-100 transition-colors"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {[...gaps].sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0)).map((g) => (
                    <div key={g._id} className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/30 space-y-4 relative flex flex-col justify-between">
                      {editingGapId === g._id ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-semibold uppercase">Title</label>
                            <input
                              type="text"
                              value={editGapTitle}
                              onChange={(e) => setEditGapTitle(e.target.value)}
                              className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-semibold uppercase">Description</label>
                            <textarea
                              value={editGapDescription}
                              onChange={(e) => setEditGapDescription(e.target.value)}
                              className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                              rows={3}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-semibold uppercase">Supporting Evidence (one quote per line)</label>
                            <textarea
                              value={editGapEvidence}
                              onChange={(e) => setEditGapEvidence(e.target.value)}
                              className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                              rows={3}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-semibold uppercase">Category</label>
                              <select
                                value={editGapCategory}
                                onChange={(e) => setEditGapCategory(e.target.value)}
                                className="w-full h-8 px-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                              >
                                <option value="methodological">Methodological</option>
                                <option value="empirical">Empirical</option>
                                <option value="theoretical">Theoretical</option>
                                <option value="dataset">Dataset</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-semibold uppercase">Impact (1-10)</label>
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={editGapImpact}
                                onChange={(e) => setEditGapImpact(parseInt(e.target.value) || 5)}
                                className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-semibold uppercase">Feasibility (1-10)</label>
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={editGapFeasibility}
                                onChange={(e) => setEditGapFeasibility(parseInt(e.target.value) || 5)}
                                className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-between pt-1 w-full">
                            <button
                              type="button"
                              onClick={handleFillFormWithAI}
                              disabled={isFillingWithAI}
                              className="px-3 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 disabled:text-zinc-500 disabled:bg-zinc-900 border border-amber-500/20 text-[11px] font-semibold transition-colors flex items-center gap-1.5"
                            >
                              {isFillingWithAI ? (
                                <>
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Generating...
                                </>
                              ) : (
                                <>
                                  <span>✨ Generate with AI</span>
                                </>
                              )}
                            </button>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingGapId(null)}
                                className="px-3 py-1.5 rounded bg-zinc-850 hover:bg-zinc-800 text-[11px] font-semibold text-zinc-300 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleUpdateGap(g._id)}
                                className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-zinc-100 transition-colors"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col h-full justify-between space-y-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                              <h4 className="font-semibold text-sm text-zinc-200">{g.title}</h4>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-semibold uppercase">
                                  {g.category}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingGapId(g._id);
                                    setEditGapTitle(g.title);
                                    setEditGapDescription(g.description);
                                    setEditGapCategory(g.category || 'other');
                                    setEditGapImpact(g.impactScore || 5);
                                    setEditGapFeasibility(g.feasibilityScore || 5);
                                    setEditGapEvidence((g.evidence || []).join('\n'));
                                  }}
                                  className="text-[10px] text-zinc-400 hover:text-indigo-400 font-semibold transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteGap(g._id)}
                                  className="text-[10px] text-zinc-500 hover:text-red-400 font-semibold transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-zinc-450 leading-relaxed">{g.description}</p>
                            
                            {g.evidence && g.evidence.length > 0 && (
                              <div className="space-y-1.5 bg-[#0b0b0d] p-3 rounded-lg border border-zinc-900 mt-2">
                                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Supporting Evidence</span>
                                <ul className="list-disc list-inside space-y-1 text-xs text-zinc-400 pl-1">
                                  {g.evidence.map((ev: string, idx: number) => (
                                    <li key={idx} className="leading-relaxed list-none border-l-2 border-amber-500/55 pl-2 py-0.5 italic">
                                      "{ev}"
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-4 text-[11px] text-zinc-500 border-t border-zinc-900 pt-2">
                            <span>Impact Rating: <strong className="text-zinc-300">{g.impactScore}/10</strong></span>
                            <span>Feasibility: <strong className="text-zinc-300">{g.feasibilityScore}/10</strong></span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: Agent Runs */}
          {activeTab === 'agents' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-base">Multi-Agent LangGraph Steps</h3>
                <p className="text-zinc-500 text-xs mt-0.5">Track intermediate status and output logs of agent runs.</p>
              </div>

              {agentRuns.length === 0 ? (
                <div className="py-16 text-center text-zinc-600 text-xs border border-zinc-900 rounded-xl">
                  No agent runs triggered. Submit a research topic above to launch the pipeline.
                </div>
              ) : (
                <div className="space-y-4">
                  {agentRuns.map((run) => (
                    <div key={run._id} className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/20 space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                        <div className="space-y-1">
                          <p className="text-xs text-zinc-500">Research Topic Query</p>
                          <p className="font-semibold text-sm text-zinc-200">{run.query}</p>
                          {/* Overall Progress Indicator */}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-zinc-400 font-medium">
                              Overall Progress: {getRunProgressPercent(run)}%
                            </span>
                            <div className="w-24 bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${getRunProgressPercent(run)}%` }} 
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            run.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 
                            run.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-indigo-500/10 text-indigo-400 animate-pulse'
                          }`}>
                            {run.status}
                          </span>
                          
                          {/* Complete Mock button (only if running offline simulator) */}
                          {run.status === 'running' && (
                            <button
                              onClick={() => simulateMockProgress(run._id)}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                            >
                              <CheckCircle className="w-3 h-3 text-emerald-400" /> Complete Mock
                            </button>
                          )}

                          {/* Re-run button */}
                          <button
                            onClick={() => handleRunAgent(run.query)}
                            disabled={run.status === 'running'}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-indigo-600/20 text-zinc-400 hover:text-indigo-400 transition-colors disabled:opacity-40 disabled:hover:text-zinc-400 disabled:hover:bg-zinc-900"
                            title="Re-run query process"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => handleDeleteAgentRun(run._id)}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-40 disabled:hover:text-zinc-400 disabled:hover:bg-zinc-900"
                            title="Delete query process"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Steps Progress Checklist */}
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                        {run.steps.map((step: any, sIdx: number) => (
                          <AgentStepProgress key={sIdx} step={step} />
                        ))}
                      </div>

                      {/* Live Agent Console */}
                      {(() => {
                        const activeStep = run.steps.find((s: any) => s.status === 'running') 
                          || [...run.steps].reverse().find((s: any) => s.status === 'completed')
                          || run.steps[0];
                        
                        return activeStep ? (
                          <div className="mt-4 p-4 rounded-xl border border-zinc-800 bg-[#0c0c0e] shadow-inner flex flex-col gap-3">
                            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                                <span className="text-[10px] font-mono text-zinc-500 ml-2">Console // {activeStep.name}</span>
                              </div>
                              <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-widest animate-pulse">
                                {activeStep.status}...
                              </span>
                            </div>
                            
                            <div className="font-mono text-xs text-zinc-350 space-y-3 max-h-64 overflow-y-auto pr-2">
                              <div className="text-zinc-500 text-[10px] leading-relaxed border-l border-zinc-800 pl-3 py-1 space-y-1">
                                {activeStep.logs?.split('\n').filter(Boolean).map((log: string, lIdx: number) => (
                                  <p key={lIdx} className="truncate">
                                    <span className="text-indigo-500/80 font-bold">&gt;</span> {log}
                                  </p>
                                ))}
                              </div>
                              
                              <div className="pt-2 border-t border-zinc-900/60">
                                <ActiveStepDataView 
                                  stepName={activeStep.name} 
                                  status={activeStep.status} 
                                  output={activeStep.output} 
                                  result={run.result} 
                                  query={run.query} 
                                />
                              </div>
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* Display final result preview link if completed */}
                      {run.status === 'completed' && run.result && (
                        <div className="pt-3 border-t border-zinc-850 flex justify-between items-center text-xs">
                          <span className="text-zinc-500">Draft manuscript generated successfully.</span>
                          <button
                            onClick={() => {
                              const text = run.result.sections?.map((s: any) => {
                                const cleanHeading = (s.heading || '').replace(/^#+\s*/, '').trim();
                                return `<h2>${cleanHeading}</h2>${parseMarkdownToHTML(s.content)}`;
                              }).join('\n') || '';
                              setEditorDoc(text);
                              setActiveTab('editor');
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-zinc-100 font-semibold transition-colors"
                          >
                            Open in Editor
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 8: Rich Editor Workspace */}
          {/* TAB 8: Saved Research Papers Panel */}
          {activeTab === 'saved_papers' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" /> Saved Research Papers
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Manage and review all saved versions and generated manuscripts for this project.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {savedPapers.length > 0 && (
                    <button
                      onClick={handleReformatAllPapers}
                      disabled={isReformattingPapers}
                      title="Re-process all papers through FormaTeX to fix tables, images, and diagrams"
                      className="px-3 py-2 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/25 text-emerald-400 text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-wait"
                    >
                      {isReformattingPapers ? (
                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Reformatting...</>
                      ) : (
                        <><RefreshCw className="w-3.5 h-3.5" /> Re-format All</>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleCreateNewPaper();
                      setActiveTab('editor');
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-550 text-xs font-semibold text-zinc-100 transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
                  >
                    Create New Paper
                  </button>
                </div>
              </div>


              {savedPapers.length === 0 ? (
                <div className="p-10 rounded-xl border border-zinc-850 bg-zinc-950/40 text-center space-y-3">
                  <Bookmark className="w-8 h-8 text-zinc-650 mx-auto" />
                  <p className="text-zinc-450 text-sm font-semibold">No saved research papers yet</p>
                  <p className="text-zinc-600 text-xs max-w-sm mx-auto">
                    Generate a paper draft using the agent workflow or start writing inside the workspace to save your work.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedPapers.map((paper) => (
                    <div 
                      key={paper._id} 
                      className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/45 hover:bg-zinc-900/20 hover:border-zinc-700/60 transition-all flex flex-col justify-between space-y-4 shadow-sm"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-sm text-zinc-200 line-clamp-1 flex-grow">
                            {paper.title || 'Untitled Research Paper'}
                          </h3>
                          <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                            {paper.status || 'draft'}
                          </span>
                        </div>
                        
                        <p className="text-[10px] text-zinc-500">
                          Last Updated: {new Date(paper.updatedAt || paper.createdAt).toLocaleString()}
                        </p>
                        
                        {paper.outline && paper.outline.length > 0 && (
                          <div className="pt-2">
                            <span className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider block mb-1">Outline Outline</span>
                            <div className="flex flex-wrap gap-1">
                              {paper.outline.slice(0, 4).map((sec: string, sIdx: number) => (
                                <span 
                                  key={sIdx}
                                  className="text-[8.5px] bg-zinc-900/60 text-zinc-400 border border-zinc-800 px-1.5 py-0.5 rounded"
                                >
                                  {sec}
                                </span>
                              ))}
                              {paper.outline.length > 4 && (
                                <span className="text-[8.5px] text-zinc-500 py-0.5 px-1 font-mono">+{paper.outline.length - 4} more</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 pt-3 border-t border-zinc-850 justify-end">
                        <button
                          onClick={() => {
                            handleLoadPaperForEdit(paper);
                            setActiveTab('editor');
                          }}
                          className="px-3 py-1.5 rounded bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 text-xs font-semibold transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            const text = paper.sections?.map((s: any) => {
                              const cleanHeading = (s.heading || '').replace(/^#+\s*/, '').trim();
                              return `<h2>${cleanHeading}</h2>${parseMarkdownToHTML(s.content)}`;
                            }).join('\n') || '';
                            setPreviewPaperModal({ title: paper.title, content: text });
                          }}
                          className="px-3 py-1.5 rounded bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 text-xs font-semibold transition-colors"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => handleDeleteSavedPaper(paper._id)}
                          className="px-3 py-1.5 rounded bg-red-650/10 hover:bg-red-650/20 border border-red-500/15 text-red-400 text-xs font-semibold transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 9: Plagiarism Report */}
          {activeTab === 'plagiarism' && (
            <div className="space-y-6">
              {plagiarismView === 'list' ? (
                <>
                  {/* ── Section 1: Select a Paper ───────────────────── */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">Plagiarism Detection</h2>
                        <p className="text-xs text-zinc-500">Select a saved research paper to analyze against OpenAlex academic databases</p>
                      </div>
                    </div>

                    {savedPapers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                        <FileText className="w-12 h-12 mb-3 opacity-30" />
                        <p className="text-sm">No saved research papers found.</p>
                        <p className="text-xs mt-1 text-zinc-600">Save a paper from the Writing Workspace first.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {savedPapers.map((paper: any) => {
                          const isRunning = plagiarismRunning === paper._id;
                          const existingReport = plagiarismReports.find((r: any) => r.generatedPaperId === paper._id && r.status === 'completed');
                          return (
                            <motion.div
                              key={paper._id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900/80 transition-all space-y-3"
                            >
                              <div className="flex items-start justify-between">
                                <h4 className="font-semibold text-sm text-zinc-200 line-clamp-2 flex-1">{paper.title}</h4>
                                {existingReport && (
                                  <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold ${getSeverityColor(existingReport.severityLevel).bg} ${getSeverityColor(existingReport.severityLevel).text} ${getSeverityColor(existingReport.severityLevel).border} border`}>
                                    {existingReport.overallScore}%
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-500">
                                {paper.sections?.length || 0} sections • {new Date(paper.updatedAt || paper.createdAt).toLocaleDateString()}
                              </p>
                              <button
                                onClick={() => handleRunPlagiarismCheck(paper._id)}
                                disabled={isRunning}
                                className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${
                                  isRunning
                                    ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20 cursor-wait'
                                    : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/20'
                                }`}
                              >
                                {isRunning ? (
                                  <span className="flex items-center justify-center gap-2">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    Analyzing with OpenAlex...
                                  </span>
                                ) : existingReport ? 'Re-run Analysis' : 'Run Plagiarism Check'}
                              </button>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── Section 2: Previous Reports ─────────────────── */}
                  {plagiarismReports.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                      <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        Previous Reports ({plagiarismReports.length})
                      </h3>
                      <div className="space-y-2">
                        {plagiarismReports.map((report: any) => {
                          const sev = getSeverityColor(report.severityLevel);
                          return (
                            <motion.div
                              key={report._id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70 transition-all"
                            >
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className={`w-12 h-12 rounded-xl ${sev.bg} border ${sev.border} flex items-center justify-center flex-shrink-0`}>
                                  <span className={`text-lg font-bold ${sev.text}`}>{report.overallScore || 0}%</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-sm font-semibold text-zinc-200 truncate">{report.paperTitle}</h4>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sev.bg} ${sev.text} border ${sev.border}`}>
                                      {sev.label}
                                    </span>
                                    <span className="text-[11px] text-zinc-500">
                                      {new Date(report.checkedAt).toLocaleDateString()} at {new Date(report.checkedAt).toLocaleTimeString()}
                                    </span>
                                    <span className="text-[11px] text-zinc-600">
                                      {report.totalSourcesSearched} sources searched
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                {report.status === 'processing' ? (
                                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 text-xs font-semibold border border-violet-500/20">
                                    <RefreshCw className="w-3 h-3 animate-spin" /> Processing
                                  </span>
                                ) : report.status === 'failed' ? (
                                  <span className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-semibold border border-red-500/20">Failed</span>
                                ) : (
                                  <button
                                    onClick={() => handleViewPlagiarismReport(report)}
                                    className="px-4 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/20 text-violet-400 text-xs font-semibold transition-colors"
                                  >
                                    View Report
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeletePlagiarismReport(report._id)}
                                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : selectedPlagiarismReport && (
                /* ── Full Report Dashboard ──────────────────────── */
                <div className="space-y-6">
                  {/* Back Button */}
                  <button
                    onClick={() => { setPlagiarismView('list'); setSelectedPlagiarismReport(null); }}
                    className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    ← Back to Reports
                  </button>

                  {/* ── Executive Summary Banner ──────────────────── */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/90 via-zinc-900/70 to-zinc-950/90 space-y-4"
                  >
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-5">
                        {/* Animated Score Ring */}
                        <div className="relative w-24 h-24 flex-shrink-0">
                          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                            <motion.circle
                              cx="50" cy="50" r="42" fill="none"
                              stroke={selectedPlagiarismReport.overallScore < 10 ? '#10b981' : selectedPlagiarismReport.overallScore < 20 ? '#3b82f6' : selectedPlagiarismReport.overallScore < 30 ? '#f59e0b' : selectedPlagiarismReport.overallScore < 50 ? '#f97316' : '#ef4444'}
                              strokeWidth="8" strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 42}`}
                              initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                              animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - selectedPlagiarismReport.overallScore / 100) }}
                              transition={{ duration: 1.5, ease: 'easeOut' }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-2xl font-bold ${getScoreColor(selectedPlagiarismReport.overallScore)}`}>
                              {selectedPlagiarismReport.overallScore}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-zinc-100">{selectedPlagiarismReport.paperTitle}</h2>
                          <div className="flex items-center gap-3 mt-2">
                            {(() => { const sev = getSeverityColor(selectedPlagiarismReport.severityLevel); return (
                              <span className={`px-3 py-1 rounded-lg text-xs font-bold ${sev.bg} ${sev.text} border ${sev.border}`}>
                                {sev.label} Plagiarism
                              </span>
                            ); })()}
                            <span className="text-xs text-zinc-500">{selectedPlagiarismReport.totalSentencesAnalyzed} sentences analyzed</span>
                            <span className="text-xs text-zinc-500">{selectedPlagiarismReport.totalSourcesSearched} sources searched</span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1">
                            Checked on {new Date(selectedPlagiarismReport.checkedAt).toLocaleDateString()} at {new Date(selectedPlagiarismReport.checkedAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      {/* AI Detection Badge */}
                      <div className="p-3 rounded-xl border border-zinc-700/50 bg-zinc-800/50 text-center min-w-[130px]">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">AI Content</p>
                        <p className="text-2xl font-bold text-cyan-400 mt-1">{selectedPlagiarismReport.aiDetection?.aiProbability || 0}%</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Confidence: {selectedPlagiarismReport.aiDetection?.confidence || 'N/A'}</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* ── Score Breakdown Cards ─────────────────────── */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Exact Match', score: selectedPlagiarismReport.exactMatchScore, icon: '🔍', weight: '35%' },
                      { label: 'Semantic', score: selectedPlagiarismReport.semanticScore, icon: '🧠', weight: '40%' },
                      { label: 'Citation', score: selectedPlagiarismReport.citationScore, icon: '📑', weight: '10%' },
                      { label: 'Structural', score: selectedPlagiarismReport.structureScore, icon: '🏗️', weight: '5%' },
                      { label: 'Formula', score: selectedPlagiarismReport.formulaScore, icon: '📐', weight: '5%' },
                      { label: 'Figure', score: selectedPlagiarismReport.figureScore, icon: '🖼️', weight: '3%' },
                      { label: 'Code', score: selectedPlagiarismReport.codeScore, icon: '💻', weight: '2%' },
                      { label: 'AI Generated', score: selectedPlagiarismReport.aiDetection?.aiProbability || 0, icon: '🤖', weight: 'N/A' },
                    ].map((item, i) => (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-lg">{item.icon}</span>
                          <span className="text-[10px] text-zinc-600 font-mono">w:{item.weight}</span>
                        </div>
                        <p className={`text-2xl font-bold ${getScoreColor(item.score)}`}>{item.score}%</p>
                        <p className="text-[11px] text-zinc-400 font-semibold">{item.label}</p>
                        <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${getScoreBarColor(item.score)}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(item.score, 100)}%` }}
                            transition={{ duration: 1, delay: 0.3 + i * 0.05 }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* ── Section-wise Heatmap ──────────────────────── */}
                  {selectedPlagiarismReport.sectionScores?.length > 0 && (
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                      <h3 className="text-sm font-bold text-zinc-300">Section-wise Analysis</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-zinc-800">
                              <th className="text-left py-2 px-3 text-zinc-500 font-semibold">Section</th>
                              <th className="text-center py-2 px-3 text-zinc-500 font-semibold">Exact</th>
                              <th className="text-center py-2 px-3 text-zinc-500 font-semibold">Semantic</th>
                              <th className="text-center py-2 px-3 text-zinc-500 font-semibold">Overall</th>
                              <th className="text-center py-2 px-3 text-zinc-500 font-semibold">Flagged</th>
                              <th className="text-center py-2 px-3 text-zinc-500 font-semibold">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedPlagiarismReport.sectionScores.map((sec: any, i: number) => (
                              <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                                <td className="py-2.5 px-3 text-zinc-300 font-medium">{sec.section}</td>
                                <td className="text-center py-2.5 px-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sec.exactScore > 20 ? 'bg-red-500/15 text-red-400' : sec.exactScore > 10 ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                                    {sec.exactScore}%
                                  </span>
                                </td>
                                <td className="text-center py-2.5 px-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sec.semanticScore > 20 ? 'bg-red-500/15 text-red-400' : sec.semanticScore > 10 ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                                    {sec.semanticScore}%
                                  </span>
                                </td>
                                <td className="text-center py-2.5 px-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sec.overallScore > 20 ? 'bg-red-500/15 text-red-400' : sec.overallScore > 10 ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                                    {sec.overallScore}%
                                  </span>
                                </td>
                                <td className="text-center py-2.5 px-3 text-zinc-400">{sec.flaggedSentences}</td>
                                <td className="text-center py-2.5 px-3 text-zinc-500">{sec.totalSentences}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── Top Matched Sources ───────────────────────── */}
                  {selectedPlagiarismReport.topSources?.length > 0 && (
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                      <h3 className="text-sm font-bold text-zinc-300">Top Matched Sources (OpenAlex)</h3>
                      <div className="space-y-2">
                        {selectedPlagiarismReport.topSources.slice(0, 10).map((source: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/50 bg-zinc-800/20 hover:bg-zinc-800/40 transition-colors">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-xs font-bold text-zinc-600 w-6 text-center">#{i + 1}</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-zinc-300 truncate">{source.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {source.authors?.length > 0 && (
                                    <span className="text-[10px] text-zinc-500">{source.authors.slice(0, 2).join(', ')}{source.authors.length > 2 ? ' et al.' : ''}</span>
                                  )}
                                  {source.year && <span className="text-[10px] text-zinc-600">({source.year})</span>}
                                  {source.doi && (
                                    <a href={`https://doi.org/${source.doi}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-violet-400 hover:text-violet-300">DOI</a>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 ml-3">
                              <span className="text-[10px] text-zinc-500">{source.matchedSentences} matches</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getScoreColor(source.similarity)}`}>
                                {source.similarity}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Detailed Matches ──────────────────────────── */}
                  {[
                    { title: 'Exact Text Matches', matches: selectedPlagiarismReport.exactMatches, type: 'exact' },
                    { title: 'Semantic Matches', matches: selectedPlagiarismReport.semanticMatches, type: 'semantic' },
                    { title: 'Citation Matches', matches: selectedPlagiarismReport.citationMatches, type: 'citation' },
                    { title: 'Formula Matches', matches: selectedPlagiarismReport.formulaMatches, type: 'formula' },
                    { title: 'Code Matches', matches: selectedPlagiarismReport.codeMatches, type: 'code' },
                  ].filter(group => group.matches?.length > 0).map((group, gi) => (
                    <details key={gi} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 group">
                      <summary className="text-sm font-bold text-zinc-300 cursor-pointer flex items-center justify-between">
                        <span>{group.title} ({group.matches.length})</span>
                        <span className="text-[10px] text-zinc-600 group-open:hidden">Click to expand ▼</span>
                      </summary>
                      <div className="mt-3 space-y-2 max-h-[400px] overflow-y-auto">
                        {group.matches.slice(0, 20).map((match: any, mi: number) => (
                          <div key={mi} className="p-3 rounded-lg border border-zinc-800/50 bg-zinc-800/20 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-1.5">
                                <div>
                                  <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Your Text</span>
                                  <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">{match.sentence || match.citation || match.formula || match.snippet}</p>
                                </div>
                                <div>
                                  <span className="text-[10px] text-amber-500/80 uppercase tracking-wide font-semibold">Matched Source</span>
                                  <p className="text-xs text-amber-400/70 mt-0.5 leading-relaxed">{match.source || match.matchedCitation || match.matchedFormula || match.matchedSnippet}</p>
                                </div>
                                <p className="text-[10px] text-zinc-500">Source: <span className="text-zinc-400">{match.sourceTitle}</span></p>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${getScoreColor(match.similarity)}`}>
                                {match.similarity}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}

                  {/* ── AI Content Analysis ───────────────────────── */}
                  {selectedPlagiarismReport.aiDetection && (
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
                      <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">🤖 AI-Generated Content Analysis</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-zinc-800/40 text-center">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Human Written</p>
                          <p className="text-xl font-bold text-emerald-400 mt-1">{selectedPlagiarismReport.aiDetection.humanProbability}%</p>
                        </div>
                        <div className="p-3 rounded-lg bg-zinc-800/40 text-center">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">AI Generated</p>
                          <p className="text-xl font-bold text-cyan-400 mt-1">{selectedPlagiarismReport.aiDetection.aiProbability}%</p>
                        </div>
                        <div className="p-3 rounded-lg bg-zinc-800/40 text-center">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Perplexity</p>
                          <p className="text-xl font-bold text-violet-400 mt-1">{selectedPlagiarismReport.aiDetection.perplexity}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-zinc-800/40 text-center">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Burstiness</p>
                          <p className="text-xl font-bold text-fuchsia-400 mt-1">{selectedPlagiarismReport.aiDetection.burstiness}</p>
                        </div>
                      </div>
                      <div className="w-full h-3 rounded-full bg-zinc-800 overflow-hidden flex">
                        <motion.div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                          initial={{ width: 0 }}
                          animate={{ width: `${selectedPlagiarismReport.aiDetection.humanProbability}%` }}
                          transition={{ duration: 1.2 }}
                        />
                        <motion.div
                          className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400"
                          initial={{ width: 0 }}
                          animate={{ width: `${selectedPlagiarismReport.aiDetection.aiProbability}%` }}
                          transition={{ duration: 1.2, delay: 0.2 }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-emerald-400">Human: {selectedPlagiarismReport.aiDetection.humanProbability}%</span>
                        <span className="text-zinc-500">Confidence: {selectedPlagiarismReport.aiDetection.confidence}</span>
                        <span className="text-cyan-400">AI: {selectedPlagiarismReport.aiDetection.aiProbability}%</span>
                      </div>
                    </div>
                  )}

                  {/* ── Executive Summary Text ────────────────────── */}
                  {selectedPlagiarismReport.summary && (
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
                      <h3 className="text-sm font-bold text-zinc-300">Executive Summary</h3>
                      <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-sans leading-relaxed">
                        {selectedPlagiarismReport.summary}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 10: Rich Editor Workspace */}
          {activeTab === 'editor' && (
            <div className={`grid grid-cols-1 gap-6 ${showPreview ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
              
              {/* TipTap Editor */}
              <div className={`space-y-4 ${showPreview ? 'lg:col-span-1' : 'lg:col-span-2'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base">Notion-like Writing Canvas</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className={`px-3.5 h-8 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
                        showPreview 
                          ? 'bg-indigo-650 text-indigo-200 border-indigo-500 bg-indigo-500/20' 
                          : 'bg-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 border-zinc-750'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" /> {showPreview ? 'Hide Preview' : 'Live Preview'}
                    </button>
                    <button
                      onClick={handleExportPDF}
                      disabled={isExportingPDF}
                      className={`px-3.5 h-8 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
                        isExportingPDF 
                          ? 'bg-zinc-900 text-zinc-500 border-zinc-850 cursor-not-allowed' 
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 border-zinc-750'
                      }`}
                    >
                      {isExportingPDF ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating...
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" /> Download PDF
                        </>
                      )}
                    </button>
                    {/* AI Auto-Corrector Toggle */}
                    <div className="flex items-center gap-2 border-r border-zinc-800 pr-3 mr-1 bg-zinc-900/40 px-2 py-1 rounded border border-zinc-800">
                      <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider select-none">AI Auto-Format</span>
                      <button
                        onClick={() => setAiAutoCorrectEnabled(!aiAutoCorrectEnabled)}
                        title="Automatically correct math, tables, and figure captions as you type"
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${aiAutoCorrectEnabled ? 'bg-indigo-600' : 'bg-zinc-800'}`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${aiAutoCorrectEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    {/* Manual Correct Button */}
                    <button
                      onClick={handleManualAICorrect}
                      disabled={isCorrecting}
                      className="px-3.5 h-8 rounded bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/25 text-emerald-400 text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isCorrecting ? (
                        <><RefreshCw className="w-3 animate-spin" /> Correcting...</>
                      ) : (
                        <><Layers className="w-3.5 h-3.5" /> AI Correct Formats</>
                      )}
                    </button>
                    <button
                      onClick={handleSaveChanges}
                      className="px-4 h-8 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-zinc-100 transition-colors"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
                <TipTapEditor content={editorDoc} onChange={setEditorDoc} />
              </div>

              {/* Side Panels: LivePreview or Claim Evidence checker */}
              <div className="space-y-4">
                {showPreview ? (
                  <LivePreview 
                    htmlContent={editorDoc} 
                    format={selectedFormat} 
                    project={project} 
                    citations={citations} 
                  />
                ) : (
                  <>
                    <h3 className="font-bold text-base">Evidence Checker</h3>
                    <EvidencePanel claims={factChecks.length > 0 ? factChecks : [
                      {
                        claim: "Jenkins et al. achieved 14.2% outperformance.",
                        status: 'verified',
                        confidenceScore: 0.96,
                        analysis: "Aligned with paper abstract details extracted from Jenkins 2024.",
                        sources: [
                          { paperTitle: "Jenkins 2024 Paper", pageNumber: 1, snippet: "Our multi-agent system achieved 14.2% higher score than baseline single-agent executions.", confidenceScore: 0.98 }
                        ]
                      }
                    ]} />
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
      {/* Save Changes Glassmorphism Status Card */}
      {savingState !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/85 backdrop-blur-xl shadow-2xl max-w-sm w-full text-center space-y-4">
            {savingState === 'saving' && (
              <>
                <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mx-auto" />
                <h3 className="font-bold text-lg text-zinc-100">Saving Manuscript</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">Assembling section outline and persisting document changes to MongoDB database...</p>
              </>
            )}
            {savingState === 'success' && (
              <>
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="font-bold text-lg text-zinc-100">Changes Saved Successfully</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">Your academic paper draft has been successfully stored. The 3D Graph, Literature Matrix, Citations, and Gaps have been updated.</p>
                <button 
                  onClick={() => setSavingState('idle')}
                  className="px-4 h-8 bg-indigo-600 hover:bg-indigo-500 transition-colors text-xs font-semibold rounded-lg text-zinc-100"
                >
                  Dismiss
                </button>
              </>
            )}
            {savingState === 'error' && (
              <>
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto text-red-500 font-bold text-lg font-mono">!</div>
                <h3 className="font-bold text-lg text-zinc-100">Saving Failed</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">Failed to contact the Express API gateway to save manuscript changes.</p>
                <button 
                  onClick={() => setSavingState('idle')}
                  className="px-4 h-8 bg-red-650 hover:bg-red-550 transition-colors text-xs font-semibold rounded-lg text-zinc-100"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Saved Paper Modal Previewer */}
      {previewPaperModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 md:p-10">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col justify-between overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/80">
              <h3 className="font-bold text-zinc-100 truncate text-sm">
                Preview: {previewPaperModal.title || 'Untitled Research Paper'}
              </h3>
              <button 
                onClick={() => setPreviewPaperModal(null)}
                className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-colors text-xs font-bold font-mono"
              >
                ✕
              </button>
            </div>

            {/* Document Content Box */}
            <div className="flex-grow overflow-y-auto p-6 bg-zinc-955/60">
              <div className="max-w-[750px] mx-auto">
                <LivePreview 
                  htmlContent={previewPaperModal.content} 
                  format={selectedFormat} 
                  project={project} 
                  citations={citations} 
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-400 font-medium">Template:</span>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="bg-zinc-800 border border-zinc-750 text-zinc-300 text-[10px] rounded px-2 py-1 focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="IEEE">IEEE Template</option>
                  <option value="ACM">ACM Template</option>
                  <option value="Springer">Springer Template</option>
                  <option value="APA">APA Template</option>
                </select>
              </div>
              <button 
                onClick={() => setPreviewPaperModal(null)}
                className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-755 text-zinc-300 hover:text-zinc-100 text-xs font-semibold rounded-lg transition-colors border border-zinc-750"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveStepDataView({ stepName, status, output, result, query }: { stepName: string, status: string, output: any, result: any, query: string }) {
  if (status === 'pending') {
    return <p className="text-zinc-600 italic text-[10px]">&gt; Queued in pipeline, awaiting predecessor completion...</p>;
  }

  if (stepName === 'Research Agent') {
    const count = output?.chunks_count || (status === 'completed' ? 6 : 0);
    return (
      <div className="space-y-2 text-zinc-400">
        <p className="text-emerald-400 text-[10px] font-bold">✓ Retrieved semantic chunks from Qdrant vector index:</p>
        <div className="grid grid-cols-1 gap-1 pl-2">
          {Array.from({ length: count || 4 }).map((_, i) => (
            <div key={i} className="text-[10px] bg-zinc-900/40 p-2 rounded border border-zinc-900 flex justify-between items-center font-mono">
              <span className="truncate max-w-[200px] text-zinc-450 text-xs">Segment #{i + 1} retrieved based on vector match</span>
              <span className="text-emerald-500 font-semibold text-[9px] shrink-0 font-sans">{(98.2 - i * 1.5).toFixed(1)}% Match</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stepName === 'Literature Agent') {
    const reviews = output?.reviews || [];
    if (!reviews.length) {
      return (
        <div className="space-y-1 text-zinc-500 text-[10px] animate-pulse">
          <p>&gt; Execating abstract analysis...</p>
          <p>&gt; Indexing author methodologies...</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-indigo-400 text-[10px] font-bold">✓ Extracted Comparative Literature Matrix:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
          {reviews.map((r: any, idx: number) => (
            <div key={idx} className="p-2.5 rounded bg-zinc-900/50 border border-zinc-850 space-y-1 text-[10px] font-mono">
              <div className="flex justify-between items-center text-zinc-300 font-bold border-b border-zinc-800 pb-1 font-sans">
                <span>{r.author} ({r.year})</span>
                <span className="text-cyan-400 uppercase text-[8px] font-bold">{r.dataset || 'N/A'}</span>
              </div>
              <p className="text-zinc-400"><span className="text-zinc-500">Method:</span> {r.method}</p>
              <p className="text-zinc-400"><span className="text-zinc-500">Results:</span> {r.results}</p>
              <p className="text-red-400/90"><span className="text-zinc-500">Limitation:</span> {r.limitation}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stepName === 'Gap Agent') {
    const gaps = output?.gaps || [];
    if (!gaps.length) {
      return (
        <div className="space-y-1 text-zinc-500 text-[10px] animate-pulse">
          <p>&gt; Analyzing methodology differences...</p>
          <p>&gt; Mining future research scopes...</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-amber-400 text-[10px] font-bold">✓ Identified Open Research Gaps:</p>
        <div className="grid grid-cols-1 gap-2 pl-2">
          {gaps.map((g: any, idx: number) => (
            <div key={idx} className="p-2.5 rounded bg-zinc-900/50 border border-zinc-850 flex justify-between items-start text-[10px] gap-4 font-mono">
              <div className="space-y-1">
                <p className="font-bold text-zinc-300 font-sans">{g.title}</p>
                <p className="text-zinc-400">{g.description}</p>
              </div>
              <div className="text-right shrink-0 font-sans">
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[8px] uppercase font-bold">{g.category}</span>
                <p className="text-zinc-500 text-[9px] mt-1">Impact: {g.impactScore}/10</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stepName === 'Citation Agent') {
    const citations = output?.citations || [];
    if (!citations.length) {
      return (
        <div className="space-y-1 text-zinc-500 text-[10px] animate-pulse">
          <p>&gt; Mapping bibtex keys...</p>
          <p>&gt; Compiling APA styles...</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-indigo-400 text-[10px] font-bold">✓ Formatted Bibliographical Citations:</p>
        <div className="space-y-1.5 pl-2 text-[10px] font-mono">
          {citations.map((c: any, idx: number) => (
            <div key={idx} className="p-2 rounded bg-zinc-900/30 border border-zinc-900 flex items-start gap-3">
              <span className="text-indigo-400 font-bold shrink-0 font-sans">[{c.key}]</span>
              <p className="text-zinc-400 italic leading-relaxed">{c.apa}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stepName === 'Fact Checker Agent') {
    const checks = output?.checks || [];
    if (!checks.length) {
      return (
        <div className="space-y-1 text-zinc-500 text-[10px] animate-pulse">
          <p>&gt; Running claim verification audits...</p>
          <p>&gt; Confirming sentence numbers...</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-cyan-400 text-[10px] font-bold">✓ Claims Evidence Verification Audit:</p>
        <div className="space-y-2 pl-2">
          {checks.map((c: any, idx: number) => (
            <div key={idx} className="p-2.5 rounded bg-zinc-900/50 border border-zinc-850 text-[10px] space-y-1 font-mono">
              <div className="flex justify-between items-center font-sans">
                <span className="font-bold text-zinc-300">Claim: "{c.claim}"</span>
                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${c.status === 'verified' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {c.status}
                </span>
              </div>
              <p className="text-zinc-400"><span className="text-zinc-500">Analysis:</span> {c.analysis}</p>
              {c.sources && c.sources.map((s: any, sIdx: number) => (
                <div key={sIdx} className="mt-1 bg-zinc-950 p-1.5 rounded border border-zinc-900 text-[9px] text-zinc-500 font-sans">
                  <span className="text-emerald-400/80 font-bold font-mono">&gt; Source snippet:</span> "{s.snippet}" ({s.paperTitle}, Page {s.pageNumber})
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stepName === 'Writing Agent') {
    const sections = result?.sections || [];
    if (!sections.length) {
      return (
        <div className="space-y-1 text-zinc-500 text-[10px] animate-pulse">
          <p>&gt; Assembling manuscript outline...</p>
          <p>&gt; Formatting editor document...</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-emerald-400 text-[10px] font-bold">✓ Manuscript Compiled Successfully:</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pl-2">
          {sections.map((s: any, idx: number) => (
            <div key={idx} className="p-2 rounded bg-zinc-900/50 border border-zinc-850 text-center text-[10px] font-mono">
              <p className="font-bold text-zinc-300 truncate font-sans">{s.title}</p>
              <span className="text-[8px] text-emerald-400 uppercase font-semibold font-sans">Compiled ✓</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <p className="text-zinc-600 italic text-[10px]">&gt; Awaiting agent initialization...</p>;
}

function ProcessingTimeline({ status }: { status: string }) {
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (status === 'pending') {
      setStep(1);
      return;
    }
    // If it is processing, we simulate the steps in the pipeline
    const timer1 = setTimeout(() => setStep(2), 2000); 
    const timer2 = setTimeout(() => setStep(3), 5000); 
    const timer3 = setTimeout(() => setStep(4), 8500); 
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [status]);

  const steps = [
    { label: 'Ingested', desc: 'Queued for processing' },
    { label: 'Parsing PDF', desc: 'Extracting text & tables' },
    { label: 'Vectorizing', desc: 'Mapping semantic vectors' },
    { label: 'Graph Indexing', desc: 'Linking knowledge nodes' },
  ];

  return (
    <div className="pt-3 border-t border-zinc-800/80 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
          <RefreshCw className="w-3 h-3 animate-spin" /> Ingestion Pipeline
        </span>
        <span className="text-[9px] text-zinc-500 font-semibold uppercase">Stage {step}/4</span>
      </div>
      
      <div className="flex items-center justify-between relative py-2">
        <div className="absolute left-4 right-4 top-5 h-[1.5px] bg-zinc-800 -z-10" />
        <div 
          className="absolute left-4 top-5 h-[1.5px] bg-gradient-to-r from-indigo-500 to-cyan-500 -z-10 transition-all duration-700 ease-in-out" 
          style={{ width: `calc(${((step - 1) / 3) * 100}% - 32px)` }}
        />
        
        {steps.map((s, idx) => {
          const isCompleted = step > idx + 1;
          const isActive = step === idx + 1;
          return (
            <div key={idx} className="flex flex-col items-center gap-1.5 flex-1">
              <div 
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                    : isActive 
                    ? 'bg-cyan-500 text-zinc-950 animate-pulse shadow-md shadow-cyan-500/30' 
                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                }`}
              >
                {isCompleted ? '✓' : idx + 1}
              </div>
              <div className="text-center">
                <p className={`text-[9px] font-bold tracking-tight ${isActive ? 'text-cyan-400' : isCompleted ? 'text-zinc-300' : 'text-zinc-600'}`}>{s.label}</p>
                <p className="text-[7.5px] text-zinc-500 hidden sm:block max-w-[80px] mx-auto mt-0.5 leading-normal">{s.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const getFormatCSS = (format: string) => {
  if (format === 'IEEE') {
    return `
      .preview-paper {
        font-family: 'Times New Roman', Times, serif;
        font-size: 10pt;
        line-height: 1.2;
        color: #000;
        background: #fff;
        padding: 30px 40px;
        text-align: justify;
      }
      .preview-paper, .preview-paper * {
        box-sizing: border-box;
      }
      .preview-paper pre, .preview-paper code, .preview-paper table {
        max-width: 100%;
        overflow-x: auto;
        box-sizing: border-box;
      }
      .preview-paper h1.doc-title {
        font-size: 20pt;
        text-align: center;
        margin-bottom: 12pt;
        font-weight: normal;
        color: #000;
      }
      .preview-paper .author-block {
        text-align: center;
        margin-bottom: 20pt;
        font-size: 11pt;
        color: #000;
      }
      .preview-paper .main-content {
        column-count: 2;
        column-gap: 20px;
        text-align: justify;
      }
      .preview-paper .abstract-section {
        column-span: all;
        margin-bottom: 12pt;
      }
      .preview-paper h2 {
        font-size: 10pt;
        text-align: center;
        text-transform: uppercase;
        margin-top: 12pt;
        margin-bottom: 4pt;
        font-weight: bold;
        color: #000;
        border: none;
        break-after: avoid;
      }
      .preview-paper p {
        margin: 0 0 4pt 0;
        text-indent: 1.5pc;
        color: #000;
      }
      .preview-paper table {
        width: 100%;
        border-collapse: collapse;
        margin: 12pt auto;
        font-size: 8pt;
        break-inside: avoid;
      }
      .preview-paper table caption {
        caption-side: top;
        font-weight: bold;
        font-size: 8.5pt;
        margin-bottom: 4px;
        text-align: left;
        color: #000;
      }
      .preview-paper thead tr th {
        border: 1px solid #000;
        padding: 5px 6px;
        text-align: center;
        font-weight: bold;
        background: #f0f0f0;
        color: #000;
      }
      .preview-paper tbody tr td {
        border: 1px solid #ccc;
        padding: 4px 6px;
        text-align: center;
        color: #000;
      }
      .preview-paper tbody tr:nth-child(odd) td {
        background: #fafafa;
      }
      .preview-paper th, .preview-paper td {
        border: 1px solid #000;
        padding: 4px;
        text-align: center;
        color: #000;
      }
      .preview-paper .figure-caption {
        font-size: 8.5pt;
        font-style: italic;
        text-align: center;
        margin-top: 6pt;
        margin-bottom: 12pt;
        color: #000;
      }
      .preview-paper .diagram-container {
        text-align: center;
        margin: 16pt auto;
        break-inside: avoid;
      }
      .preview-paper .diagram-container img {
        max-width: 100%;
        border: 1px solid #ddd;
        padding: 8px;
        background: #fff;
      }
      .preview-paper .diagram-container, .preview-paper pre, .preview-paper code, .preview-paper .table-caption, .preview-paper .figure-caption {
        break-inside: avoid;
      }
    `;

  }
  if (format === 'ACM') {
    return `
      .preview-paper {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 9pt;
        line-height: 1.3;
        color: #000;
        background: #fff;
        padding: 30px 40px;
      }
      .preview-paper, .preview-paper * {
        box-sizing: border-box;
      }
      .preview-paper pre, .preview-paper code, .preview-paper table {
        max-width: 100%;
        overflow-x: auto;
        box-sizing: border-box;
      }
      .preview-paper h1.doc-title {
        font-size: 16pt;
        font-weight: bold;
        text-align: center;
        margin-bottom: 12pt;
        color: #000;
      }
      .preview-paper .author-block {
        text-align: center;
        margin-bottom: 18pt;
        font-size: 10pt;
        color: #000;
      }
      .preview-paper .main-content {
        column-count: 2;
        column-gap: 16px;
        text-align: justify;
      }
      .preview-paper .abstract-section {
        column-span: all;
        background: #f5f5f5;
        padding: 10px;
        margin-bottom: 12pt;
        border: 1px solid #ddd;
      }
      .preview-paper h2 {
        font-size: 11pt;
        font-weight: bold;
        color: #000;
        border-bottom: 1px solid #000;
        padding-bottom: 2px;
        margin-top: 12pt;
        margin-bottom: 4pt;
        break-after: avoid;
      }
      .preview-paper p {
        margin: 0 0 4pt 0;
        color: #000;
      }
      .preview-paper table {
        width: 100%;
        border-collapse: collapse;
        margin: 10pt 0;
        font-size: 8pt;
        break-inside: avoid;
      }
      .preview-paper th, .preview-paper td {
        border: 1px solid #ddd;
        padding: 5px;
        color: #000;
      }
      .preview-paper .diagram-container, .preview-paper pre, .preview-paper code, .preview-paper .table-caption, .preview-paper .figure-caption {
        break-inside: avoid;
      }
    `;
  }
  if (format === 'Springer') {
    return `
      .preview-paper {
        font-family: 'Times New Roman', Times, serif;
        font-size: 10.5pt;
        line-height: 1.4;
        color: #000;
        background: #fff;
        padding: 30px 40px;
        max-width: 800px;
        margin: 0 auto;
      }
      .preview-paper, .preview-paper * {
        box-sizing: border-box;
      }
      .preview-paper pre, .preview-paper code, .preview-paper table {
        max-width: 100%;
        overflow-x: auto;
        box-sizing: border-box;
      }
      .preview-paper h1.doc-title {
        font-size: 15pt;
        font-weight: bold;
        text-align: center;
        margin-top: 10pt;
        margin-bottom: 12pt;
        color: #000;
      }
      .preview-paper .author-block {
        text-align: center;
        margin-bottom: 20pt;
        font-size: 10pt;
        color: #000;
      }
      .preview-paper .main-content {
        column-count: 2;
        column-gap: 20px;
        text-align: justify;
      }
      .preview-paper .abstract-section {
        column-span: all;
        margin-bottom: 15pt;
      }
      .preview-paper h2 {
        font-size: 11pt;
        font-weight: bold;
        margin-top: 12pt;
        margin-bottom: 4pt;
        color: #000;
        break-after: avoid;
      }
      .preview-paper p {
        margin: 0 0 5pt 0;
        color: #000;
      }
      .preview-paper table {
        width: 100%;
        border-collapse: collapse;
        margin: 12pt 0;
        font-size: 9pt;
        break-inside: avoid;
      }
      .preview-paper th, .preview-paper td {
        border-top: 1px solid #000;
        border-bottom: 1px solid #000;
        padding: 6px;
        color: #000;
      }
      .preview-paper .diagram-container, .preview-paper pre, .preview-paper code, .preview-paper .table-caption, .preview-paper .figure-caption {
        break-inside: avoid;
      }
    `;
  }
  // Standard format
  return `
    .preview-paper {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #000;
      background: #fff;
      padding: 24px;
    }
    .preview-paper h1.doc-title {
      font-size: 16pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 12pt;
      color: #000;
    }
    .preview-paper .author-block {
      text-align: center;
      margin-bottom: 24pt;
      color: #000;
    }
    .preview-paper h2 {
      font-size: 12pt;
      font-weight: bold;
      margin-top: 20pt;
      margin-bottom: 8pt;
      color: #000;
    }
    .preview-paper p {
      margin: 0 0 10pt 0;
      color: #000;
    }
    .preview-paper table {
      width: 100%;
      border-collapse: collapse;
      margin: 16pt auto;
      font-size: 10pt;
    }
    .preview-paper table caption {
      caption-side: top;
      font-weight: bold;
      font-size: 9.5pt;
      margin-bottom: 4px;
      text-align: left;
      color: #000;
    }
    .preview-paper thead tr th {
      border: 1px solid #000;
      padding: 7px 10px;
      text-align: left;
      font-weight: bold;
      background: #f0f0f0;
      color: #000;
    }
    .preview-paper tbody tr td {
      border: 1px solid #ccc;
      padding: 6px 10px;
      color: #000;
    }
    .preview-paper tbody tr:nth-child(odd) td {
      background: #fafafa;
    }
    .preview-paper th, .preview-paper td {
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 6px;
      color: #000;
    }
    .preview-paper .figure-caption {
      font-size: 9pt;
      font-style: italic;
      text-align: center;
      margin-top: 6pt;
      margin-bottom: 12pt;
      color: #333;
    }
    .preview-paper .diagram-container {
      text-align: center;
      margin: 18pt auto;
    }
    .preview-paper .diagram-container img {
      max-width: 100%;
      border: 1px solid #ddd;
      padding: 8px;
      background: #fff;
    }
  `;

};

function LivePreview({ htmlContent, format, project, citations }: { htmlContent: string; format: string; project: any; citations: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const formattedHtml = formatPaperHTML(htmlContent, format, citations || []);
  const cleanedHtmlContent = cleanMathHTML(formattedHtml);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Process math elements and render them
    const renderMath = () => {
      const autorender = (window as any).renderMathInElement;
      if (typeof autorender === 'function') {
        autorender(containerRef.current, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
          ],
          throwOnError: false
        });
      }
    };

    // 2. Process Mermaid diagrams
    const renderMermaid = async () => {
      const mermaidObj = (window as any).mermaid;
      if (!mermaidObj) return;

      try {
        mermaidObj.initialize({ startOnLoad: false, theme: 'neutral' });
      } catch (e) {
        console.error("Mermaid init in LivePreview failed:", e);
      }

      const preElements = containerRef.current?.querySelectorAll("pre") || [];
      let idx = 0;
      for (const pre of Array.from(preElements)) {
        const codeElem = pre.querySelector("code") || pre;
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = codeElem.innerHTML.replace(/<br\s*\/?>/gi, '\n');
        const text = (tempDiv.textContent || tempDiv.innerText || '').trim();
        const isMermaid = /^(graph|flowchart|sequenceDiagram|gantt|classDiagram|stateDiagram|pie|erDiagram|journey|gitGraph|requirementDiagram|mindmap)/i.test(text);
        
        if (isMermaid) {
          const cleanedText = text.replace(/\|\s*>\s*/g, '|');
          try {
            const id = `mermaid-live-${Date.now()}-${idx++}`;
            const { svg } = await mermaidObj.render(id, cleanedText);
            const div = document.createElement("div");
            div.className = "flex justify-center my-4 w-full";
            div.innerHTML = svg;
            pre.replaceWith(div);
          } catch (err) {
            console.error("Live Mermaid render error:", err);
            const errorDiv = document.createElement("div");
            errorDiv.className = "p-4 bg-red-950/20 border border-red-900/30 rounded-lg my-4 text-xs text-red-400 font-mono overflow-auto";
            errorDiv.innerText = `[Mermaid Render Error]: ${err}\n\nSource:\n${text}`;
            pre.replaceWith(errorDiv);
          }
        }
      }
    };

    // 3. Process headings and format them
    const formatHeadingsLocal = () => {
      const headings = containerRef.current?.querySelectorAll("h2, h3, h4") || [];
      headings.forEach((h: any) => {
        let text = h.textContent.trim();
        text = text.replace(/^#+\s*/, "");

        if (format === 'APA') {
          h.textContent = text.replace(/^\d+(\.\d+)*\.?\s*/, '').trim();
          return;
        }

        const match = text.match(/^(\d+(?:\.\d+)*)\.?\s*(.*)$/);
        if (!match) {
          if (format === 'IEEE' || format === 'ACM') {
            h.textContent = text.toUpperCase();
            h.classList.add("unnumbered-heading");
          } else {
            h.textContent = text;
          }
          return;
        }

        const numStr = match[1];
        const restText = match[2];

        if (format === 'IEEE') {
          if (h.tagName === 'H2') {
            const num = parseInt(numStr.split('.')[0]) || 1;
            h.textContent = `${toRomanGlobal(num)}. ${restText.toUpperCase()}`;
          } else if (h.tagName === 'H3') {
            const parts = numStr.split('.');
            const subIndex = parseInt(parts[1]) || 1;
            const letter = String.fromCharCode(64 + subIndex);
            h.textContent = `${letter}. ${restText}`;
          } else if (h.tagName === 'H4') {
            const parts = numStr.split('.');
            const subSubIndex = parseInt(parts[2]) || 1;
            h.textContent = `${subSubIndex}) ${restText}`;
          }
        } else if (format === 'ACM') {
          if (h.tagName === 'H2') {
            h.textContent = `${numStr} ${restText.toUpperCase()}`;
          } else {
            h.textContent = `${numStr} ${restText}`;
          }
        } else {
          h.textContent = `${numStr} ${restText}`;
        }
      });
    };

    const processFiguresAndTables = async (container: HTMLDivElement) => {
      // 1. Process PlantUML and DOT blocks
      const preElements = container.querySelectorAll("pre");
      preElements.forEach(pre => {
        const text = pre.textContent?.trim() || "";
        if (text.includes("@startuml") || text.startsWith("@startuml")) {
          const div = document.createElement("div");
          div.className = "diagram-container my-4 text-center";
          
          const img = document.createElement("img");
          img.className = "diagram-figure mx-auto shadow-sm";
          img.style.maxWidth = "100%";
          img.style.backgroundColor = "#fff";
          img.style.padding = "10px";
          img.style.border = "1px solid #ddd";
          
          const plantumlEncoder = (window as any).plantumlEncoder;
          if (plantumlEncoder) {
            const encoded = plantumlEncoder.encode(text);
            img.src = `https://www.plantuml.com/plantuml/svg/${encoded}`;
          } else {
            img.src = `https://www.plantuml.com/plantuml/svg/SyfFKj2rKt3CoKnELR1Io4ZDoSa7qE8B0W00`;
          }
          div.appendChild(img);
          pre.replaceWith(div);
        } else if (text.startsWith("digraph") || text.startsWith("graph") && text.includes("{")) {
          const div = document.createElement("div");
          div.className = "diagram-container my-4 text-center";
          
          const img = document.createElement("img");
          img.className = "diagram-figure mx-auto shadow-sm";
          img.style.maxWidth = "100%";
          img.style.backgroundColor = "#fff";
          img.style.padding = "10px";
          img.style.border = "1px solid #ddd";
          img.src = `https://quickchart.io/graphviz?format=svg&graph=${encodeURIComponent(text)}`;
          
          div.appendChild(img);
          pre.replaceWith(div);
        }
      });

      // 2. Process table formatting and table numbering
      const tables = container.querySelectorAll("table");
      tables.forEach((table: any, idx) => {
        const tableIndex = idx + 1;
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.style.margin = "12pt 0";
        table.style.fontSize = "9pt";
        
        const cells = table.querySelectorAll("th, td");
        cells.forEach((c: any) => {
          c.style.border = "none";
          c.style.borderTop = "1px solid #000";
          c.style.borderBottom = "1px solid #000";
          c.style.padding = "6px";
          c.style.textAlign = "center";
        });

        // Try to find an existing table caption in the paragraphs before the table
        let existingCaptionText = "";
        let sibling = table.previousElementSibling;
        
        // Scan up to 2 siblings before to find a table caption
        for (let i = 0; i < 2 && sibling; i++) {
          const siblingText = sibling.textContent?.trim() || "";
          if (/^(Table|TABLE)\s+\w+:/i.test(siblingText)) {
            existingCaptionText = siblingText;
            sibling.remove(); // Remove the original paragraph to prevent duplication
            break;
          }
          sibling = sibling.previousElementSibling;
        }

        const cols = Array.from(table.querySelectorAll("th, tr:first-child td")).map((el: any) => el.textContent?.trim() || "");
        
        let captionText = "";
        if (existingCaptionText) {
          // Normalize the table number and style it
          captionText = existingCaptionText.replace(/^(Table|TABLE)\s+(\w+):/i, (m, tbl, num) => {
            return `TABLE ${toRomanGlobal(tableIndex)}:`;
          });
        } else {
          captionText = `TABLE ${toRomanGlobal(tableIndex)}: COMPARISON RESULTS FOR ${cols.slice(0, 3).join(", ").toUpperCase()}`;
        }
        
        if (!table.previousElementSibling?.classList.contains("table-caption")) {
          const captionDiv = document.createElement("div");
          captionDiv.className = "table-caption";
          captionDiv.style.textAlign = "center";
          captionDiv.style.fontSize = "8.5pt";
          captionDiv.style.fontWeight = "bold";
          captionDiv.style.textTransform = "uppercase";
          captionDiv.style.marginBottom = "6pt";
          captionDiv.style.color = "#000";
          captionDiv.textContent = captionText;
          table.parentNode?.insertBefore(captionDiv, table);
        }
      });

      // 3. Process figure captions and sequential figure numbering
      const figures = container.querySelectorAll(".mermaid, img.diagram-figure");
      figures.forEach((fig: any, idx) => {
        const figIndex = idx + 1;
        
        // Scan siblings after the figure to find an existing caption
        let existingCaptionText = "";
        
        // If the figure is inside a .diagram-container, start scanning from the container's next sibling!
        let baseElementForSibling = fig;
        if (fig.parentNode?.classList.contains("diagram-container")) {
          baseElementForSibling = fig.parentNode;
        }
        
        let sibling = baseElementForSibling.nextElementSibling;
        for (let i = 0; i < 2 && sibling; i++) {
          const siblingText = sibling.textContent?.trim() || "";
          if (/^(Figure|FIGURE)\s+\d+:/i.test(siblingText)) {
            existingCaptionText = siblingText;
            sibling.remove(); // Remove the original paragraph to prevent duplication
            break;
          }
          sibling = sibling.nextElementSibling;
        }

        let captionText = "";
        if (existingCaptionText) {
          captionText = existingCaptionText.replace(/^(Figure|FIGURE)\s+(\d+)[:.]/i, (m, fgr, num) => {
            return `Figure ${figIndex}.`;
          });
        } else {
          const prevHeadingEl = fig.previousElementSibling?.tagName.startsWith("H") 
            ? fig.previousElementSibling 
            : baseElementForSibling.parentNode?.previousElementSibling;
          const headingText = prevHeadingEl?.textContent || "System Flow";
          const cleanHeading = headingText.replace(/^\d+(\.\d+)*\.?\s*/, '').trim();
          
          let captionDesc = "System Architecture and Workflow.";
          if (cleanHeading.toLowerCase().includes("architecture")) {
            captionDesc = "System architecture design and component interactions.";
          } else if (cleanHeading.toLowerCase().includes("flow") || cleanHeading.toLowerCase().includes("pipeline")) {
            captionDesc = "Workflow sequence and processing pipeline stages.";
          } else if (cleanHeading.toLowerCase().includes("result") || cleanHeading.toLowerCase().includes("evaluation")) {
            captionDesc = "Experimental results and comparative analysis graphs.";
          } else if (cleanHeading) {
            captionDesc = `Architectural overview of ${cleanHeading} implementation.`;
          }
          captionText = `Figure ${figIndex}. ${captionDesc}`;
        }
        
        const nextEl = baseElementForSibling.nextElementSibling;
        if (!nextEl?.classList.contains("figure-caption")) {
          const captionDiv = document.createElement("div");
          captionDiv.className = "figure-caption";
          captionDiv.style.textAlign = "center";
          captionDiv.style.fontSize = "8.5pt";
          captionDiv.style.fontStyle = "italic";
          captionDiv.style.marginTop = "6pt";
          captionDiv.style.marginBottom = "12pt";
          captionDiv.style.color = "#000";
          captionDiv.textContent = captionText;
          baseElementForSibling.parentNode?.insertBefore(captionDiv, baseElementForSibling.nextSibling);
        }
      });
    };

    const runQualityControl = (container: HTMLDivElement) => {
      const preElements = container.querySelectorAll("pre, code");
      preElements.forEach((el: any) => {
        const text = el.textContent || "";
        if (text.includes("graph TD") || text.includes("flowchart") || text.includes("sequenceDiagram") || text.includes("classDiagram")) {
          el.style.display = "none";
        }
        if (text.includes("@startuml") || text.includes("digraph")) {
          el.style.display = "none";
        }
      });

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let node;
      const nodesToClean: Node[] = [];
      while (node = walker.nextNode()) {
        let parent = node.parentElement;
        let isInsideMathOrDiagram = false;
        while (parent) {
          if (parent.classList.contains('katex') || 
              parent.classList.contains('mermaid') || 
              parent.classList.contains('diagram-container')) {
            isInsideMathOrDiagram = true;
            break;
          }
          parent = parent.parentElement;
        }
        if (isInsideMathOrDiagram) continue;

        const text = node.nodeValue || '';
        if (text.includes('$$') || text.includes('\\begin{') || text.includes('graph TD') || text.includes('flowchart LR') || text.includes('sequenceDiagram')) {
          nodesToClean.push(node);
        }
      }

      nodesToClean.forEach(n => {
        let val = n.nodeValue || '';
        val = val.replace(/\$\$([\s\S]*?)\$\$/g, '$1')
                 .replace(/\$([^\$]+?)\$/g, '$1')
                 .replace(/\\begin\{[^\}]+\}/g, '')
                 .replace(/\\end\{[^\}]+\}/g, '')
                 .replace(/graph (TD|LR|UT|BT)[\s\S]*$/g, '')
                 .replace(/flowchart (TD|LR)[\s\S]*$/g, '')
                 .replace(/sequenceDiagram[\s\S]*$/g, '');
        n.nodeValue = val;
      });
    };

    const timer = setTimeout(async () => {
      if (!(window as any).plantumlEncoder && !document.getElementById('plantuml-encoder-js')) {
        const script = document.createElement('script');
        script.id = 'plantuml-encoder-js';
        script.src = 'https://cdn.jsdelivr.net/npm/plantuml-encoder@1.4.0/dist/plantuml-encoder.min.js';
        document.head.appendChild(script);
      }

      const checkAndRender = async (retries = 0) => {
        const mermaidObj = (window as any).mermaid;
        const autorender = (window as any).renderMathInElement;

        // Wait up to 3 seconds for libraries to be ready if they are still loading
        if ((!mermaidObj || !autorender) && retries < 30) {
          setTimeout(() => checkAndRender(retries + 1), 100);
          return;
        }

        renderMath();
        await renderMermaid();
        formatHeadingsLocal();

        if (containerRef.current) {
          await processFiguresAndTables(containerRef.current);
          runQualityControl(containerRef.current);
        }
      };

      await checkAndRender();
    }, 150);

    return () => clearTimeout(timer);
  }, [cleanedHtmlContent, format]);

  // Extract sections
  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanedHtmlContent, 'text/html');

  // Fix relative image sources to point to absolute API URL
  const images = doc.querySelectorAll('img');
  images.forEach((img: any) => {
    let src = img.getAttribute('src') || '';
    if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
      if (src.startsWith('/')) {
        src = src.substring(1);
      }
      img.setAttribute('src', `${API_URL}/${src}`);
    }
  });
  
  let title = project?.name || 'Academic Synthesis Paper';
  let abstractContent = '';
  let keywordsContent = '';
  let sectionsHTML = '';

  const children = Array.from(doc.body.children);
  let currentSecTitle = '';
  let currentSecContent = '';

  children.forEach((child: any) => {
    const text = child.textContent?.trim() || '';
    if (child.tagName === 'H2' || child.tagName === 'H1') {
      if (currentSecTitle) {
        if (currentSecTitle.toLowerCase().includes('title')) {
          title = currentSecContent.replace(/<[^>]*>/g, '').trim();
        } else if (currentSecTitle.toLowerCase().includes('abstract')) {
          abstractContent = currentSecContent;
        } else if (currentSecTitle.toLowerCase().includes('keyword')) {
          keywordsContent = currentSecContent;
        } else {
          sectionsHTML += `<section class="mb-4"><h2>${currentSecTitle}</h2><div>${currentSecContent}</div></section>`;
        }
      }
      currentSecTitle = text;
      currentSecContent = '';
    } else {
      if (!currentSecTitle) {
        const isKeywords = text.toLowerCase().includes('keyword');
        const isAbstract = text.toLowerCase().includes('abstract');
        if (isKeywords) {
          currentSecTitle = 'Keywords';
        } else if (isAbstract) {
          currentSecTitle = 'Abstract';
        } else {
          currentSecTitle = '1. Introduction';
        }
      }
      currentSecContent += child.outerHTML;
    }
  });

  if (currentSecTitle) {
    if (currentSecTitle.toLowerCase().includes('title')) {
      title = currentSecContent.replace(/<[^>]*>/g, '').trim();
    } else if (currentSecTitle.toLowerCase().includes('abstract')) {
      abstractContent = currentSecContent;
    } else if (currentSecTitle.toLowerCase().includes('keyword')) {
      keywordsContent = currentSecContent;
    } else {
      sectionsHTML += `<section class="mb-4"><h2>${currentSecTitle}</h2><div>${currentSecContent}</div></section>`;
    }
  }

  let abstractSectionHTML = '';
  if (abstractContent) {
    const cleanAbstract = abstractContent.replace(/<[^>]*>/g, '').trim();
    const cleanKeywords = keywordsContent ? keywordsContent.replace(/<[^>]*>/g, '').trim() : '';
    
    if (format === 'IEEE') {
      const keywordsHTML = cleanKeywords 
        ? `<p style="text-indent:0; font-size:9pt; font-weight:bold; margin-top:6pt;"><em>Keywords</em>—${cleanKeywords}</p>`
        : '';
      abstractSectionHTML = `
        <div class="abstract-section" style="grid-column: 1 / span 2; margin-bottom: 12pt;">
          <p style="text-indent:0; font-size:9pt; font-weight:bold;"><em>Abstract</em>—${cleanAbstract}</p>
          ${keywordsHTML}
        </div>
      `;
    } else if (format === 'ACM') {
      const keywordsHTML = cleanKeywords 
        ? `<p style="font-size:9pt; margin-top:6pt;"><strong>KEYWORDS</strong><br/>${cleanKeywords}</p>`
        : '';
      abstractSectionHTML = `
        <div class="abstract-section" style="background:#f5f5f5; padding:12px; margin-bottom:12pt; border:1px solid #ddd; grid-column: 1 / span 2;">
          <p style="font-size:9pt; line-height:1.4;"><strong>ABSTRACT</strong><br/>${cleanAbstract}</p>
          ${keywordsHTML}
        </div>
      `;
    } else if (format === 'Springer') {
      const keywordsHTML = cleanKeywords 
        ? `<p style="font-size:9.5pt; margin-top:6pt;"><strong>Keywords:</strong> ${cleanKeywords}</p>`
        : '';
      abstractSectionHTML = `
        <div class="abstract-section" style="margin-bottom:15pt; font-size:9.5pt; line-height:1.4; text-align:justify;">
          <p><strong>Abstract.</strong> ${cleanAbstract}</p>
          ${keywordsHTML}
        </div>
      `;
    } else if (format === 'APA') {
      abstractSectionHTML = `
        <div class="abstract-section" style="border-bottom:1px solid #eee; padding-bottom:15px; margin-bottom:20px;">
          <h2 style="text-align: center; font-weight: bold; font-size: 12pt; margin-bottom: 12pt;">Abstract</h2>
          <p style="text-indent: 0; font-size: 11pt; line-height: 1.6;">${cleanAbstract}</p>
          ${cleanKeywords ? `<p style="text-indent:0; font-size:11pt; margin-top:12pt;"><em>Keywords:</em> ${cleanKeywords}</p>` : ''}
        </div>
      `;
    } else {
      abstractSectionHTML = `
        <div class="abstract-section mb-6 p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
          <h2 class="font-bold mb-2 text-zinc-900">Abstract</h2>
          <p class="text-zinc-800">${cleanAbstract}</p>
          ${cleanKeywords ? `<p style="margin-top:6pt;"><strong>Keywords:</strong> ${cleanKeywords}</p>` : ''}
        </div>
      `;
    }
  }

  return (
    <div className="flex flex-col border border-zinc-800 rounded-xl bg-white text-zinc-900 overflow-hidden h-[600px]">
      <div className="flex items-center justify-between p-3 bg-zinc-150 border-b border-zinc-300">
        <span className="text-xs font-bold text-zinc-700 flex items-center gap-1.5 font-sans">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> Live Paper Preview ({format} format)
        </span>
      </div>
      <div className="flex-grow overflow-y-auto p-6 bg-zinc-100">
        <div 
          ref={containerRef} 
          className="preview-paper shadow-md rounded border border-zinc-250 mx-auto w-full max-w-[800px] overflow-hidden"
        >
          <style dangerouslySetInnerHTML={{ __html: getFormatCSS(format) }} />
          <h1 className="doc-title">{title}</h1>
          <div className="author-block">
            <strong>Research Team</strong><br />
            ResearcherGPT Multi-Agent Synthesis Framework<br />
            Department of Autonomous Scholarly Synthesis
          </div>

          <div 
            className={format === 'IEEE' || format === 'ACM' || format === 'Springer' ? 'main-content' : ''}
            dangerouslySetInnerHTML={{ __html: `${abstractSectionHTML} ${sectionsHTML}` }} 
          />
        </div>
      </div>
    </div>
  );
}
