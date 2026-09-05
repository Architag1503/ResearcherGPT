'use client';

import React, { useState, useMemo } from 'react';
import axios from 'axios';
import {
  Image as ImageIcon,
  Table as TableIcon,
  Sigma,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Check,
  AlertCircle,
  FileImage,
  Layers,
  X,
  RotateCcw
} from 'lucide-react';
import { getApiUrl } from '../utils/apiUrl';

export interface VisualElement {
  id: string;
  type: 'diagram' | 'table' | 'formula';
  name: string;
  caption: string;
  sectionTitle?: string;
  currentHtml: string;
  currentSrc?: string;
  rawContent?: string;
  originalRawHtml?: string;
  isReplaced: boolean;
  replacedImageUrl?: string;
  recommendedResolution: {
    width: number;
    height: number;
    aspectRatio: string;
    description: string;
  };
}

interface VisualElementReplacerProps {
  htmlContent: string;
  onUpdateHtml: (newHtml: string) => void;
  format?: string;
  onClose?: () => void;
}

export default function VisualElementReplacer({
  htmlContent,
  onUpdateHtml,
  format = 'IEEE',
  onClose,
}: VisualElementReplacerProps) {
  const API_URL = getApiUrl();
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'diagram' | 'table' | 'formula'>('all');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadSuccessId, setUploadSuccessId] = useState<string | null>(null);
  const [spanModes, setSpanModes] = useState<{ [id: string]: 'column' | 'wide' }>({});
  const [stagedFiles, setStagedFiles] = useState<{
    [id: string]: {
      file: File;
      previewUrl: string;
      dimensions?: { width: number; height: number };
    };
  }>({});

  // Parse htmlContent to extract diagrams, tables, and formulas
  const elements = useMemo<VisualElement[]>(() => {
    if (!htmlContent) return [];

    const list: VisualElement[] = [];
    let figCount = 0;
    let tableCount = 0;
    let formulaCount = 0;

    // Helper: convert integer to Roman numeral
    const toRoman = (num: number): string => {
      const lookup: { [key: string]: number } = {
        M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1
      };
      let roman = '';
      for (const i in lookup) {
        while (num >= lookup[i]) {
          roman += i;
          num -= lookup[i];
        }
      }
      return roman || 'I';
    };

    // 1. EXTRACT DIAGRAMS & FIGURES
    // Match <div class="diagram-container"...>...</div> or custom-replaced-visual
    const diagramContainerRegex = /<div[^>]*class=["'][^"']*diagram-container[^"']*["'][^>]*>[\s\S]*?<\/div>/gi;
    let match: RegExpExecArray | null;

    while ((match = diagramContainerRegex.exec(htmlContent)) !== null) {
      const fullMatch = match[0];

      // Check if it was already marked as a replaced table
      if (fullMatch.includes('custom-replaced-table')) {
        continue;
      }

      figCount++;
      const isReplaced = fullMatch.includes('custom-replaced-visual');
      const imgSrcMatch = fullMatch.match(/<img[^>]+src=["']([^"']+)["']/i);
      const currentSrc = imgSrcMatch ? imgSrcMatch[1] : undefined;

      const origHtmlMatch = fullMatch.match(/data-original-html=["']([^"']+)["']/i);
      let originalRawHtml: string | undefined = undefined;
      if (origHtmlMatch && origHtmlMatch[1]) {
        try { originalRawHtml = decodeURIComponent(origHtmlMatch[1]); } catch (e) {}
      }

      // Extract figure caption or alt text
      let caption = '';
      const captionMatch = fullMatch.match(/<p[^>]*class=["'][^"']*figure-caption[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
      if (captionMatch) {
        caption = captionMatch[1].replace(/<[^>]*>/g, '').trim();
      } else {
        const altMatch = fullMatch.match(/alt=["']([^"']*)["']/i);
        if (altMatch && altMatch[1]) {
          caption = altMatch[1].trim();
        }
      }

      const cleanName = caption
        ? (caption.toLowerCase().startsWith('fig') ? caption : `Fig ${figCount}: ${caption}`)
        : `Fig ${figCount}: System Architecture Workflow`;

      list.push({
        id: `diagram-${figCount}`,
        type: 'diagram',
        name: cleanName,
        caption: caption || `System Architecture Workflow`,
        currentHtml: fullMatch,
        currentSrc,
        originalRawHtml,
        isReplaced,
        replacedImageUrl: isReplaced ? currentSrc : undefined,
        recommendedResolution: {
          width: 800,
          height: 500,
          aspectRatio: '16:10',
          description: 'Single-column academic figure. 300 DPI, PNG or SVG format, high-contrast on transparent or white background.',
        },
      });
    }

    // Also check for standalone <img> that are NOT already in diagram containers
    const imgRegex = /<img\s+(?!class=["'][^"']*diagram-figure[^"']*["'])[^>]*src=["']([^"']+)["'][^>]*>/gi;
    while ((match = imgRegex.exec(htmlContent)) !== null) {
      const fullMatch = match[0];
      // If it's already inside one of our captured diagram containers, skip
      if (list.some(d => d.currentHtml.includes(fullMatch))) continue;

      figCount++;
      const currentSrc = match[1];
      const altMatch = fullMatch.match(/alt=["']([^"']*)["']/i);
      const alt = altMatch ? altMatch[1].trim() : 'Diagram Visual';
      const name = `Fig ${figCount}: ${alt}`;

      list.push({
        id: `diagram-img-${figCount}`,
        type: 'diagram',
        name,
        caption: alt,
        currentHtml: fullMatch,
        currentSrc,
        isReplaced: false,
        recommendedResolution: {
          width: 800,
          height: 500,
          aspectRatio: '16:10',
          description: 'Single-column diagram. 300 DPI, PNG or SVG recommended.',
        },
      });
    }

    // Also check for Markdown image syntax: ![alt](url)
    const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    while ((match = mdImgRegex.exec(htmlContent)) !== null) {
      const fullMatch = match[0];
      if (list.some(d => d.currentHtml.includes(fullMatch))) continue;

      figCount++;
      const alt = match[1]?.trim() || 'Diagram Visual';
      const currentSrc = match[2]?.trim();
      const name = alt.toLowerCase().startsWith('fig') ? alt : `Fig ${figCount}: ${alt}`;

      list.push({
        id: `diagram-md-${figCount}`,
        type: 'diagram',
        name,
        caption: alt,
        currentHtml: fullMatch,
        currentSrc,
        isReplaced: false,
        recommendedResolution: {
          width: 800,
          height: 500,
          aspectRatio: '16:10',
          description: 'Single-column diagram. 300 DPI, PNG or SVG recommended.',
        },
      });
    }

    // 2. EXTRACT TABLES
    // Check for replaced table containers first
    const replacedTableRegex = /<div[^>]*class=["'][^"']*custom-replaced-table[^"']*["'][^>]*>[\s\S]*?<\/div>/gi;
    while ((match = replacedTableRegex.exec(htmlContent)) !== null) {
      const fullMatch = match[0];
      tableCount++;
      const imgSrcMatch = fullMatch.match(/<img[^>]+src=["']([^"']+)["']/i);
      const currentSrc = imgSrcMatch ? imgSrcMatch[1] : undefined;

      const origHtmlMatch = fullMatch.match(/data-original-html=["']([^"']+)["']/i);
      let originalRawHtml: string | undefined = undefined;
      if (origHtmlMatch && origHtmlMatch[1]) {
        try { originalRawHtml = decodeURIComponent(origHtmlMatch[1]); } catch (e) {}
      }

      let caption = '';
      const captionMatch = fullMatch.match(/<div[^>]*class=["'][^"']*table-caption[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      if (captionMatch) {
        caption = captionMatch[1].replace(/<[^>]*>/g, '').trim();
      }

      list.push({
        id: `table-replaced-${tableCount}`,
        type: 'table',
        name: caption || `Table ${toRoman(tableCount)}: Experiment Evaluation`,
        caption: caption || `Table ${toRoman(tableCount)}: Experiment Evaluation`,
        currentHtml: fullMatch,
        currentSrc,
        originalRawHtml,
        isReplaced: true,
        replacedImageUrl: currentSrc,
        recommendedResolution: {
          width: 1200,
          height: 600,
          aspectRatio: '2:1',
          description: 'Academic table graphic. 300 DPI, pure white background, high-contrast dark text and borders.',
        },
      });
    }

    // Normal HTML Tables (with optional preceding table-caption)
    const tableWithCaptionRegex = /(?:<div[^>]*class=["'][^"']*table-caption[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*)?<table[^>]*>([\s\S]*?)<\/table>/gi;
    while ((match = tableWithCaptionRegex.exec(htmlContent)) !== null) {
      const fullMatch = match[0];
      // Skip if it's already accounted for
      if (list.some(t => t.currentHtml.includes(fullMatch))) continue;

      tableCount++;
      const captionFound = match[1] ? match[1].replace(/<[^>]*>/g, '').trim() : '';
      const romanNum = toRoman(tableCount);
      const tableName = captionFound || `Table ${romanNum}: Experiment Evaluation`;

      list.push({
        id: `table-${tableCount}`,
        type: 'table',
        name: tableName,
        caption: tableName,
        currentHtml: fullMatch,
        rawContent: fullMatch,
        isReplaced: false,
        recommendedResolution: {
          width: 1200,
          height: 600,
          aspectRatio: '2:1',
          description: 'Publication table graphic. 300 DPI, white background, crisp typography, clean horizontal rules.',
        },
      });
    }

    // Markdown tables: matching consecutive lines starting with '|'
    const mdTableRegex = /(?:^|\n)(\|[^\n]+\|\n\|[-: |]+\|\n(?:\|[^\n]+\|\n?)+)/g;
    while ((match = mdTableRegex.exec(htmlContent)) !== null) {
      const fullMatch = match[1].trim();
      if (list.some(t => t.currentHtml.includes(fullMatch))) continue;
      tableCount++;
      const romanNum = toRoman(tableCount);
      const tableName = `Table ${romanNum}: Experiment Evaluation`;

      list.push({
        id: `table-md-${tableCount}`,
        type: 'table',
        name: tableName,
        caption: tableName,
        currentHtml: fullMatch,
        rawContent: fullMatch,
        isReplaced: false,
        recommendedResolution: {
          width: 1200,
          height: 600,
          aspectRatio: '2:1',
          description: 'Publication table graphic. 300 DPI, white background, crisp typography, clean horizontal rules.',
        },
      });
    }

    // 3. EXTRACT MATHEMATICAL FORMULAS
    // First, check for replaced formula blocks
    const replacedFormulaRegex = /<div[^>]*class=["'][^"']*custom-replaced-formula[^"']*["'][^>]*>[\s\S]*?<\/div>/gi;
    while ((match = replacedFormulaRegex.exec(htmlContent)) !== null) {
      const fullMatch = match[0];
      formulaCount++;
      const imgSrcMatch = fullMatch.match(/<img[^>]+src=["']([^"']+)["']/i);
      const currentSrc = imgSrcMatch ? imgSrcMatch[1] : undefined;
      const eqNumMatch = fullMatch.match(/<span[^>]*class=["'][^"']*equation-num[^"']*["'][^>]*>\(([^)]+)\)<\/span>/i);
      const eqNum = eqNumMatch ? eqNumMatch[1] : `${formulaCount}`;

      const origHtmlMatch = fullMatch.match(/data-original-html=["']([^"']+)["']/i);
      let originalRawHtml: string | undefined = undefined;
      if (origHtmlMatch && origHtmlMatch[1]) {
        try { originalRawHtml = decodeURIComponent(origHtmlMatch[1]); } catch (e) {}
      }

      list.push({
        id: `formula-replaced-${formulaCount}`,
        type: 'formula',
        name: `Equation (${eqNum}): Mathematical Formulation`,
        caption: `Equation (${eqNum})`,
        currentHtml: fullMatch,
        currentSrc,
        originalRawHtml,
        isReplaced: true,
        replacedImageUrl: currentSrc,
        recommendedResolution: {
          width: 900,
          height: 200,
          aspectRatio: '4.5:1',
          description: 'Single-line mathematical formula. 300 DPI, transparent or pure white background, centered formula symbols.',
        },
      });
    }

    // Double dollar LaTeX math blocks: $$ ... $$
    const mathBlockRegex = /\$\$([\s\S]*?)\$\$/g;
    while ((match = mathBlockRegex.exec(htmlContent)) !== null) {
      const fullMatch = match[0];
      const innerMath = match[1].trim();

      formulaCount++;
      // Check if formula has \tag{N}
      const tagMatch = innerMath.match(/\\tag\{([^}]+)\}/);
      const eqNum = tagMatch ? tagMatch[1] : `${formulaCount}`;

      list.push({
        id: `formula-${formulaCount}`,
        type: 'formula',
        name: `Equation (${eqNum}): Mathematical Formulation`,
        caption: `Equation (${eqNum})`,
        currentHtml: fullMatch,
        rawContent: innerMath,
        isReplaced: false,
        recommendedResolution: {
          width: 900,
          height: 200,
          aspectRatio: '4.5:1',
          description: 'Mathematical derivation graphic. 300 DPI, transparent or pure white background, centered symbols.',
        },
      });
    }

    // Standard LaTeX display math: \[ ... \]
    const latexDisplayRegex = /\\\[([\s\S]*?)\\\]/g;
    while ((match = latexDisplayRegex.exec(htmlContent)) !== null) {
      const fullMatch = match[0];
      if (list.some(el => el.currentHtml.includes(fullMatch))) continue;
      formulaCount++;
      const innerMath = match[1].trim();
      const tagMatch = innerMath.match(/\\tag\{([^}]+)\}/);
      const eqNum = tagMatch ? tagMatch[1] : `${formulaCount}`;

      list.push({
        id: `formula-disp-${formulaCount}`,
        type: 'formula',
        name: `Equation (${eqNum}): Mathematical Formulation`,
        caption: `Equation (${eqNum})`,
        currentHtml: fullMatch,
        rawContent: innerMath,
        isReplaced: false,
        recommendedResolution: {
          width: 900,
          height: 200,
          aspectRatio: '4.5:1',
          description: 'Mathematical derivation graphic. 300 DPI, transparent or pure white background, centered symbols.',
        },
      });
    }

    // LaTeX equation / align / gather environments: \begin{equation}...\end{equation}
    const envRegex = /\\begin\{(equation\*?|align\*?|gather\*?)\}([\s\S]*?)\\end\{\1\}/g;
    while ((match = envRegex.exec(htmlContent)) !== null) {
      const fullMatch = match[0];
      if (list.some(el => el.currentHtml.includes(fullMatch))) continue;
      formulaCount++;
      const innerMath = match[2].trim();
      const tagMatch = innerMath.match(/\\tag\{([^}]+)\}/);
      const eqNum = tagMatch ? tagMatch[1] : `${formulaCount}`;

      list.push({
        id: `formula-env-${formulaCount}`,
        type: 'formula',
        name: `Equation (${eqNum}): Mathematical Formulation`,
        caption: `Equation (${eqNum})`,
        currentHtml: fullMatch,
        rawContent: innerMath,
        isReplaced: false,
        recommendedResolution: {
          width: 900,
          height: 200,
          aspectRatio: '4.5:1',
          description: 'Mathematical derivation graphic. 300 DPI, transparent or pure white background, centered symbols.',
        },
      });
    }

    return list;
  }, [htmlContent]);

  // Filter elements by category tab
  const filteredElements = useMemo(() => {
    if (selectedCategory === 'all') return elements;
    return elements.filter(el => el.type === selectedCategory);
  }, [elements, selectedCategory]);

  const counts = useMemo(() => {
    return {
      all: elements.length,
      diagram: elements.filter(e => e.type === 'diagram').length,
      table: elements.filter(e => e.type === 'table').length,
      formula: elements.filter(e => e.type === 'formula').length,
    };
  }, [elements]);

  // Handle local file selection and inspect image dimensions
  const handleFileSelect = (elementId: string, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setStagedFiles(prev => ({
        ...prev,
        [elementId]: {
          file,
          previewUrl,
          dimensions: { width: img.naturalWidth, height: img.naturalHeight },
        },
      }));
    };
    img.src = previewUrl;
  };

  // Perform Image Replacement
  const handleReplaceElement = async (item: VisualElement) => {
    const staged = stagedFiles[item.id];
    if (!staged) return;

    setUploadingId(item.id);
    try {
      let finalImageUrl = staged.previewUrl;

      // Try uploading to server endpoint
      try {
        const formData = new FormData();
        formData.append('image', staged.file);
        const res = await axios.post(`${API_URL}/api/papers/upload-image`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data?.url) {
          finalImageUrl = res.data.url;
          // Normalize leading slash
          if (!finalImageUrl.startsWith('/') && !finalImageUrl.startsWith('http')) {
            finalImageUrl = `/${finalImageUrl}`;
          }
        }
      } catch (uploadErr) {
        console.warn('Server upload failed, converting to embedded DataURL fallback:', uploadErr);
        // Fallback: convert file to Base64 data URL so replacement always works locally
        finalImageUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(staged.file);
        });
      }

      // Generate replacement HTML based on element type
      let replacementHtml = '';
      const cleanCaption = item.caption || item.name;
      const spanMode = spanModes[item.id] || 'column';
      const spanStyle = spanMode === 'wide' ? 'column-span:all;-webkit-column-span:all;' : '';
      const originalToPreserve = item.originalRawHtml || item.currentHtml;
      const encodedOriginal = encodeURIComponent(originalToPreserve);

      if (item.type === 'diagram') {
        replacementHtml = `
<div class="diagram-container custom-replaced-visual" data-replaced-id="${item.id}" data-original-name="${item.name}" data-span-mode="${spanMode}" data-original-html="${encodedOriginal}" style="text-align:center;margin:18pt auto;width:100%;max-width:100%;box-sizing:border-box;break-inside:avoid;${spanStyle}">
  <img src="${finalImageUrl}" alt="${cleanCaption}" class="diagram-figure mx-auto shadow-sm" style="max-width:100%;height:auto;display:block;margin:0 auto;border:1px solid #ddd;padding:8px;background:#fff;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.1);" />
  <p class="figure-caption" style="font-size:8.5pt;color:#333;margin-top:6pt;margin-bottom:12pt;text-align:center;font-style:italic;">${cleanCaption}</p>
</div>`;
      } else if (item.type === 'table') {
        replacementHtml = `
<div class="diagram-container custom-replaced-table" data-replaced-id="${item.id}" data-original-name="${item.name}" data-span-mode="${spanMode}" data-original-html="${encodedOriginal}" style="text-align:center;margin:18pt auto;width:100%;max-width:100%;box-sizing:border-box;break-inside:avoid;${spanStyle}">
  <div class="table-caption" style="font-size:8.5pt;color:#000;margin-bottom:6pt;text-align:center;font-weight:bold;text-transform:uppercase;">${cleanCaption}</div>
  <img src="${finalImageUrl}" alt="${cleanCaption}" class="table-figure mx-auto shadow-sm" style="max-width:100%;height:auto;display:block;margin:0 auto;border:1px solid #ddd;padding:6px;background:#fff;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.1);" />
</div>`;
      } else if (item.type === 'formula') {
        const eqNum = item.caption.replace(/[^0-9]/g, '') || '1';
        replacementHtml = `
<div class="custom-replaced-formula" data-replaced-id="${item.id}" data-original-name="${item.name}" data-original-html="${encodedOriginal}" style="text-align:center;margin:14pt auto;width:100%;max-width:100%;display:flex;align-items:center;justify-content:center;position:relative;break-inside:avoid;box-sizing:border-box;padding:6px 0;">
  <img src="${finalImageUrl}" alt="${cleanCaption}" class="formula-figure" style="max-width:85%;max-height:120px;height:auto;object-fit:contain;display:inline-block;padding:4px;background:transparent;" />
  <span class="equation-num" style="position:absolute;right:12px;font-size:9pt;font-family:'Times New Roman',serif;color:#333;font-style:normal;font-weight:normal;">(${eqNum})</span>
</div>`;
      }

      // Replace occurrence in htmlContent
      if (htmlContent.includes(item.currentHtml)) {
        const updatedHtml = htmlContent.replace(item.currentHtml, replacementHtml.trim());
        onUpdateHtml(updatedHtml);
      } else {
        // Safe regex replace in case formatting shifted slightly
        const escaped = item.currentHtml.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const updatedHtml = htmlContent.replace(new RegExp(escaped, 'i'), replacementHtml.trim());
        onUpdateHtml(updatedHtml);
      }

      setUploadSuccessId(item.id);
      setTimeout(() => setUploadSuccessId(null), 4000);
    } catch (err) {
      console.error('Failed to replace visual element:', err);
    } finally {
      setUploadingId(null);
    }
  };

  const handleRevertElement = (item: VisualElement) => {
    if (!item.originalRawHtml) return;
    const updatedHtml = htmlContent.replace(item.currentHtml, item.originalRawHtml);
    onUpdateHtml(updatedHtml);
    setStagedFiles(prev => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  };

  // Render individual element box
  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header matching Writing Workspace dark theme */}
      <div className="p-4 md:p-5 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                Replace Visual Elements
                <span className="text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 px-2 py-0.5 rounded-full">
                  {elements.length} Found
                </span>
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Upload custom high-res images to replace diagrams, tables, or math formulas that did not generate properly.
            </p>
          </div>
        </div>

        {/* Action Controls & Close */}
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-800/80 bg-zinc-950/60 text-xs font-medium overflow-x-auto">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            selectedCategory === 'all'
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> All Assets ({counts.all})
        </button>
        <button
          onClick={() => setSelectedCategory('diagram')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            selectedCategory === 'diagram'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5 text-indigo-400" /> Diagrams & Figures ({counts.diagram})
        </button>
        <button
          onClick={() => setSelectedCategory('table')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            selectedCategory === 'table'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <TableIcon className="w-3.5 h-3.5 text-emerald-400" /> Tables ({counts.table})
        </button>
        <button
          onClick={() => setSelectedCategory('formula')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            selectedCategory === 'formula'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Sigma className="w-3.5 h-3.5 text-amber-400" /> Math Formulas ({counts.formula})
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow overflow-y-auto p-5 space-y-6">
        {filteredElements.length === 0 ? (
          <div className="text-center py-16 px-4 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
            <Layers className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h4 className="font-semibold text-sm text-zinc-300">No {selectedCategory === 'all' ? 'visual elements' : selectedCategory} found</h4>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
              Once your research paper includes diagrams, tables, or equations, they will appear here ready to be replaced.
            </p>
          </div>
        ) : (
          filteredElements.map((item) => {
            const staged = stagedFiles[item.id];
            const isUploading = uploadingId === item.id;
            const isSuccess = uploadSuccessId === item.id;

            // Check if uploaded resolution matches recommendation
            let matchQuality = 'none';
            if (staged?.dimensions) {
              const diffW = Math.abs(staged.dimensions.width - item.recommendedResolution.width);
              const diffH = Math.abs(staged.dimensions.height - item.recommendedResolution.height);
              if (diffW <= 40 && diffH <= 40) {
                matchQuality = 'exact';
              } else if (staged.dimensions.width >= item.recommendedResolution.width) {
                matchQuality = 'high-res';
              } else {
                matchQuality = 'lower-res';
              }
            }

            return (
              <div
                key={item.id}
                className={`p-5 rounded-2xl border transition-all duration-200 bg-zinc-900/40 hover:bg-zinc-900/60 ${
                  item.isReplaced
                    ? 'border-emerald-500/30 shadow-lg shadow-emerald-950/10'
                    : 'border-zinc-800 hover:border-zinc-700/80'
                }`}
              >
                {/* Element Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
                  <div className="flex items-center gap-2.5">
                    {item.type === 'diagram' && (
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
                        <ImageIcon className="w-3 h-3" /> Figure / Diagram
                      </span>
                    )}
                    {item.type === 'table' && (
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                        <TableIcon className="w-3 h-3" /> Academic Table
                      </span>
                    )}
                    {item.type === 'formula' && (
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                        <Sigma className="w-3 h-3" /> Math Formula
                      </span>
                    )}
                    <h3 className="font-bold text-sm text-zinc-100">{item.name}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.isReplaced && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Replaced with Custom Image
                      </span>
                    )}
                  </div>
                </div>

                {/* Body: Left (Current Preview) vs Right (Upload & Resolution) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
                  {/* Left Column: Current in Paper */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                      <span>Current Preview in Paper:</span>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {item.isReplaced ? 'Custom Image Active' : 'Generated Version'}
                      </span>
                    </div>

                    <div className="h-48 rounded-xl border border-zinc-800 bg-white/95 p-3 flex flex-col items-center justify-center overflow-hidden relative shadow-inner text-zinc-900">
                      {item.currentSrc ? (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                          <img
                            src={
                              item.currentSrc.startsWith('http') || item.currentSrc.startsWith('data:')
                                ? item.currentSrc
                                : `${API_URL}/${item.currentSrc.replace(/^\//, '')}`
                            }
                            alt={item.caption}
                            className="max-h-36 max-w-full object-contain rounded"
                          />
                          <p className="text-[10px] text-zinc-500 italic mt-1 truncate max-w-full text-center">
                            {item.caption}
                          </p>
                        </div>
                      ) : item.type === 'table' ? (
                        <div className="w-full h-full overflow-auto text-xs p-1">
                          <div dangerouslySetInnerHTML={{ __html: item.currentHtml }} />
                        </div>
                      ) : item.type === 'formula' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                          <div className="font-mono text-sm bg-zinc-100 p-2.5 rounded border border-zinc-300 max-w-full overflow-x-auto text-zinc-800">
                            $${item.rawContent || item.caption}$$
                          </div>
                          <span className="text-[10px] text-zinc-400 mt-2 font-serif">{item.caption}</span>
                        </div>
                      ) : (
                        <div className="text-zinc-400 text-xs flex flex-col items-center gap-2">
                          <FileImage className="w-8 h-8 opacity-40" />
                          <span>Diagram Placeholder</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Upload Box & Recommended Resolution */}
                  <div className="space-y-3">
                    {/* Recommended Resolution Box */}
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Recommended Resolution
                        </span>
                        <span className="font-mono font-bold text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded">
                          {(spanModes[item.id] === 'wide' && item.type !== 'formula')
                            ? '1600 × 900 px'
                            : `${item.recommendedResolution.width} × ${item.recommendedResolution.height} px`}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {(spanModes[item.id] === 'wide' && item.type !== 'formula')
                          ? 'Wide format spanning across both page columns. 300 DPI, PNG or SVG format, high-contrast on clean background.'
                          : item.recommendedResolution.description}
                      </p>
                      <div className="text-[10px] text-zinc-500 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-800/80">
                        <div className="flex items-center gap-3">
                          <span>Aspect: <strong className="text-zinc-300 font-mono">{(spanModes[item.id] === 'wide' && item.type !== 'formula') ? '16:9' : item.recommendedResolution.aspectRatio}</strong></span>
                          <span>•</span>
                          <span>Fit: <strong className="text-emerald-400 font-sans">{(spanModes[item.id] === 'wide' && item.type !== 'formula') ? 'Span 2 Columns' : 'Single Column'}</strong></span>
                        </div>
                        {item.type !== 'formula' && (
                          <div className="flex items-center gap-1 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                            <button
                              type="button"
                              onClick={() => setSpanModes(prev => ({ ...prev, [item.id]: 'column' }))}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                                (spanModes[item.id] || 'column') === 'column'
                                  ? 'bg-zinc-800 text-indigo-300 border border-zinc-700'
                                  : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              Column
                            </button>
                            <button
                              type="button"
                              onClick={() => setSpanModes(prev => ({ ...prev, [item.id]: 'wide' }))}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                                spanModes[item.id] === 'wide'
                                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                                  : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              Wide Span
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Image Upload Area */}
                    <div className="space-y-2">
                      <label
                        htmlFor={`file-upload-${item.id}`}
                        className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 text-center ${
                          staged
                            ? 'border-indigo-500/50 bg-indigo-500/5'
                            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-950/70'
                        }`}
                      >
                        <input
                          id={`file-upload-${item.id}`}
                          type="file"
                          accept="image/png, image/jpeg, image/webp, image/svg+xml"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileSelect(item.id, e.target.files[0]);
                            }
                          }}
                        />

                        {staged ? (
                          <div className="w-full flex items-center justify-between gap-3 text-left">
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={staged.previewUrl}
                                alt="preview"
                                className="w-12 h-12 object-cover rounded-lg border border-zinc-700 bg-white"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-zinc-200 truncate max-w-[180px]">
                                  {staged.file.name}
                                </p>
                                <p className="text-[11px] font-mono text-zinc-400">
                                  {staged.dimensions ? (
                                    <span>
                                      {staged.dimensions.width} × {staged.dimensions.height} px
                                    </span>
                                  ) : (
                                    'Inspecting...'
                                  )}
                                </p>
                              </div>
                            </div>

                            {/* Match Quality Badge */}
                            <div>
                              {matchQuality === 'exact' && (
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Exact Fit
                                </span>
                              )}
                              {matchQuality === 'high-res' && (
                                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/15 border border-indigo-500/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" /> High Quality
                                </span>
                              )}
                              {matchQuality === 'lower-res' && (
                                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> Scaling Up
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            <UploadCloud className="w-6 h-6 text-zinc-500" />
                            <div>
                              <p className="text-xs font-semibold text-zinc-300">
                                Click or drag & drop replacement image
                              </p>
                              <p className="text-[10px] text-zinc-500 mt-0.5">
                                PNG, SVG, JPG, WebP (Max 25MB)
                              </p>
                            </div>
                          </>
                        )}
                      </label>

                      {/* Action Buttons: Replace & Revert */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleReplaceElement(item)}
                          disabled={!staged || isUploading}
                          className={`flex-grow h-9 px-4 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm ${
                            !staged || isUploading
                              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/30'
                          }`}
                        >
                          {isUploading ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Replacing...
                            </>
                          ) : isSuccess ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Replaced Successfully!
                            </>
                          ) : (
                            <>
                              <ArrowRight className="w-3.5 h-3.5" /> Replace in Research Paper
                            </>
                          )}
                        </button>

                        {item.isReplaced && item.originalRawHtml && (
                          <button
                            type="button"
                            onClick={() => handleRevertElement(item)}
                            className="h-9 px-3 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-750"
                            title="Revert back to original manuscript version"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-zinc-400" /> Revert
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
