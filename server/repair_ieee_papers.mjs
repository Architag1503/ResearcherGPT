import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://architag1503:Archit1503@cluster0.nuqane7.mongodb.net/researcher_gpt?retryWrites=true&w=majority';

// Schema definitions
const PaperSectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  heading: { type: String },
  content: { type: String, required: true },
});

const GeneratedPaperSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true },
    outline: [{ type: String }],
    sections: [PaperSectionSchema],
    references: [{ type: String }],
    status: { type: String, enum: ['draft', 'finalizing', 'completed', 'failed'] },
  },
  { timestamps: true, collection: 'generatedpapers' }
);

const GeneratedPaper = mongoose.model('GeneratedPaper', GeneratedPaperSchema);

function toRoman(num) {
  const lookup = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  let roman = '';
  for (let i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman || 'I';
}

function convertMarkdownTableToIeeeHtml(mdTableText, tableIndex, customTitle = '') {
  const lines = mdTableText.trim().split('\n').filter(l => l.includes('|'));
  if (lines.length < 2) return mdTableText;

  const headerCells = lines[0].split('|').map(c => c.trim()).filter(Boolean);
  // Find separator line index
  let sepIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    const isSep = lines[i].split('|').map(c => c.trim()).filter(Boolean).every(c => /^:?-+:?$/.test(c));
    if (isSep) {
      sepIndex = i;
      break;
    }
  }

  const bodyLines = sepIndex !== -1 ? lines.slice(sepIndex + 1) : lines.slice(1);
  const romanNum = toRoman(tableIndex);
  const title = customTitle || `SYSTEM PERFORMANCE EVALUATION FOR ${headerCells.slice(0, 3).join(', ').toUpperCase()}`;

  let html = `\n<div class="table-container" style="margin:12pt 0; width:100%; break-inside:avoid; page-break-inside:avoid;">\n`;
  html += `  <div class="table-caption" style="text-align:center; font-size:8pt; margin-bottom:4pt; line-height:1.25; text-transform:uppercase;">\n`;
  html += `    <span class="table-num" style="display:block; font-weight:bold; font-size:8.5pt; letter-spacing:0.5px;">TABLE ${romanNum}</span>\n`;
  html += `    <span class="table-title" style="display:block; font-size:8pt; letter-spacing:0.5px;">${title}</span>\n`;
  html += `  </div>\n`;
  html += `  <table style="width:100%; border-collapse:collapse; margin:4pt 0 8pt 0; font-size:8pt; line-height:1.2; border-top:1.5pt solid #000; border-bottom:1.5pt solid #000; border-left:none; border-right:none;">\n`;
  html += `    <thead>\n      <tr>\n`;

  headerCells.forEach((h, idx) => {
    const align = idx === 0 ? 'left' : 'center';
    html += `        <th style="border:none; border-bottom:0.75pt solid #000; padding:4pt 6pt; text-align:${align}; font-weight:bold; font-size:8pt; background:transparent;">${h}</th>\n`;
  });
  html += `      </tr>\n    </thead>\n    <tbody>\n`;

  bodyLines.forEach(line => {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length > 0) {
      html += `      <tr>\n`;
      cells.forEach((c, idx) => {
        const align = idx === 0 ? 'left' : 'center';
        html += `        <td style="border:none; padding:3pt 6pt; font-size:8pt; text-align:${align}; background:transparent;">${c}</td>\n`;
      });
      html += `      </tr>\n`;
    }
  });

  html += `    </tbody>\n  </table>\n</div>\n`;
  return html;
}

// Map section raw names to authentic IEEE Roman numeral titles
const IEEE_SECTION_MAP = {
  'title': 'Title',
  'abstract': 'Abstract',
  'keywords': 'Keywords',
  'introduction': 'I. INTRODUCTION',
  '1. introduction': 'I. INTRODUCTION',
  'related work': 'II. RELATED WORK',
  '2. related work': 'II. RELATED WORK',
  'literature review': 'II. RELATED WORK',
  'research gap': 'III. RESEARCH GAP',
  '3. research gap': 'III. RESEARCH GAP',
  'objectives': 'IV. RESEARCH OBJECTIVES',
  '4. objectives': 'IV. RESEARCH OBJECTIVES',
  'proposed framework': 'V. PROPOSED FRAMEWORK',
  '5. proposed framework': 'V. PROPOSED FRAMEWORK',
  'system architecture': 'VI. SYSTEM ARCHITECTURE',
  '6. system architecture': 'VI. SYSTEM ARCHITECTURE',
  'methodology': 'VII. METHODOLOGY',
  '7. methodology': 'VII. METHODOLOGY',
  'implementation details': 'VIII. IMPLEMENTATION DETAILS',
  '8. implementation details': 'VIII. IMPLEMENTATION DETAILS',
  'experimental setup': 'IX. EXPERIMENTAL SETUP',
  '9. experimental setup': 'IX. EXPERIMENTAL SETUP',
  'results and evaluation': 'X. RESULTS AND EVALUATION',
  '10. results and evaluation': 'X. RESULTS AND EVALUATION',
  'discussion': 'XI. DISCUSSION',
  '11. discussion': 'XI. DISCUSSION',
  'limitations': 'XII. LIMITATIONS',
  '12. limitations': 'XII. LIMITATIONS',
  'future work': 'XIII. FUTURE WORK',
  '13. future work': 'XIII. FUTURE WORK',
  'conclusion': 'XIV. CONCLUSION',
  '14. conclusion': 'XIV. CONCLUSION',
  'references': 'REFERENCES',
  'appendix': 'APPENDIX',
};

async function repairAllPapers() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB successfully.');

    const papers = await GeneratedPaper.find({});
    console.log(`Found ${papers.length} papers in generatedpapers collection.`);

    for (const paper of papers) {
      console.log(`\n======================================================`);
      console.log(`Processing Paper ID: ${paper._id}`);
      console.log(`Original Title: "${paper.title}"`);

      let tableCounter = 1;
      let figureCounter = 1;
      let newSections = [];
      let newOutline = [];

      for (const sec of paper.sections || []) {
        const rawTitle = (sec.title || '').replace(/^#+\s*/, '').trim();
        const lowerTitle = rawTitle.toLowerCase();
        
        let ieeeTitle = IEEE_SECTION_MAP[lowerTitle];
        if (!ieeeTitle) {
          // If title has a number e.g. "1. Introduction" or "10. Results"
          const numMatch = rawTitle.match(/^(\d+)\.?\s*(.*)$/);
          if (numMatch) {
            const num = parseInt(numMatch[1]);
            const roman = toRoman(num);
            ieeeTitle = `${roman}. ${numMatch[2].trim().toUpperCase()}`;
          } else {
            ieeeTitle = rawTitle.toUpperCase();
          }
        }

        let content = sec.content || '';

        // 1. Clean repetitive synthetic filler paragraph in Paper 2
        // Match sentences starting with "In addition, mathematical modeling of the A Self-Verifying..."
        const repetitiveFillerRegex = /<br\s*\/?>\s*In addition, mathematical modeling of the A Self-Verifying[\s\S]*?ensuring publication-grade output\./gi;
        content = content.replace(repetitiveFillerRegex, '');
        const repetitiveFillerRegex2 = /In addition, mathematical modeling of the A Self-Verifying[\s\S]*?ensuring publication-grade output\./gi;
        content = content.replace(repetitiveFillerRegex2, '');

        // 2. Format Abstract in authentic IEEE inline style
        if (ieeeTitle === 'Abstract') {
          let cleanText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          cleanText = cleanText.replace(/^Abstract\s*[:.—-]?\s*/i, '');
          content = `<p style="text-indent:0; font-size:9pt; font-weight:bold; text-align:justify; margin:0 0 6pt 0;"><em>Abstract</em>—${cleanText}</p>`;
        }

        // 3. Format Keywords in authentic IEEE inline style
        if (ieeeTitle === 'Keywords') {
          let cleanText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          cleanText = cleanText.replace(/^Keywords\s*[:.—-]?\s*/i, '');
          content = `<p style="text-indent:0; font-size:9pt; font-weight:bold; text-align:justify; margin:0 0 6pt 0;"><em>Keywords</em>—${cleanText}</p>`;
        }

        // 4. Convert Markdown tables to IEEE Booktabs HTML tables
        if (content.includes('| ---') || content.includes('|:---') || content.includes('|---')) {
          const lines = content.split('\n');
          let inTable = false;
          let tableLines = [];
          let newContentLines = [];

          for (let line of lines) {
            if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
              inTable = true;
              tableLines.push(line);
            } else {
              if (inTable && tableLines.length > 1) {
                const customTitle = ieeeTitle.includes('RELATED') 
                  ? 'SURVEY OF MULTI-AGENT ORCHESTRATION FRAMEWORKS' 
                  : (ieeeTitle.includes('RESULTS') ? 'QUANTITATIVE SYSTEM PERFORMANCE COMPARISON' : '');
                const htmlTbl = convertMarkdownTableToIeeeHtml(tableLines.join('\n'), tableCounter++, customTitle);
                newContentLines.push(htmlTbl);
                tableLines = [];
                inTable = false;
              }
              newContentLines.push(line);
            }
          }
          if (inTable && tableLines.length > 1) {
            const htmlTbl = convertMarkdownTableToIeeeHtml(tableLines.join('\n'), tableCounter++);
            newContentLines.push(htmlTbl);
          }
          content = newContentLines.join('\n');
        }

        // 4.5. Convert ASCII art blocks in PROPOSED FRAMEWORK to clean Mermaid figures
        if (content.includes('+---------------+') || content.includes('ASCII diagram') || content.includes('Meta-Programming')) {
          const asciiRegex = /(?:The proposed framework can be represented using the following ASCII diagram:)?\s*```[\s\S]*?```/gi;
          const mermaidFig = `The proposed framework architectural flow is illustrated in Fig. 1.

<figure class="paper-figure" style="text-align:center; margin:12pt auto; width:100%; box-sizing:border-box; break-inside:avoid; page-break-inside:avoid;">
  <pre><code class="language-mermaid">
graph TD
  A["Meta-Programming Module"] --> B["Agent Workflow Optimization"]
  B --> C["Web Search Agent Module"]
  C --> D["Execution & Evaluation"]
  </code></pre>
  <figcaption class="figure-caption" style="font-size:8pt; color:#000; margin-top:5pt; margin-bottom:6pt; text-align:justify; line-height:1.25;"><strong>Fig. 1.</strong>  Architectural hierarchy of the meta-programming and multi-agent workflow optimization pipeline.</figcaption>
</figure>`;
          content = content.replace(asciiRegex, mermaidFig);
        }

        // 5. Clean and format existing HTML tables
        content = content.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
          // If not already converted by our script
          if (match.includes('border-top:1.5pt')) return match;
          
          let cleaned = match.replace(/style="[^"]*"/gi, '');
          cleaned = cleaned.replace(/<table/i, `<table style="width:100%; border-collapse:collapse; margin:8pt 0 12pt 0; font-size:8pt; line-height:1.2; border-top:1.5pt solid #000; border-bottom:1.5pt solid #000; border-left:none; border-right:none;"`);
          cleaned = cleaned.replace(/<th/gi, `<th style="border:none; border-bottom:0.75pt solid #000; padding:4pt 6pt; text-align:center; font-weight:bold; font-size:8pt; background:transparent;"`);
          cleaned = cleaned.replace(/<td/gi, `<td style="border:none; padding:3pt 6pt; font-size:8pt; text-align:center; background:transparent;"`);
          return cleaned;
        });

        // 6. Fix Corrupted / Concatenated Table Captions (e.g. TABLE IACADEMIC EXPERIMENTAL EVALUATION)
        content = content.replace(
          /(<figcaption[^>]*class=["'][^"']*table-caption[^"']*["'][^>]*>|<figcaption[^>]*>)([\s\S]*?)(<\/figcaption>)/gi,
          (match, openTag, textContent, closeTag) => {
            const cleanText = textContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            
            // Check if it was mistakenly a figure
            if (/^(?:Figure|FIGURE|Fig|FIG)\.?\s*\d+/i.test(cleanText)) {
              const figMatch = cleanText.match(/^(?:Figure|FIGURE|Fig|FIG)\.?\s*(\d+)[:.\s-]+(.*)$/i);
              if (figMatch) {
                return `<figcaption class="figure-caption" style="font-size:8pt; color:#000; margin-top:5pt; margin-bottom:6pt; text-align:justify; line-height:1.25;"><strong>Fig. ${figMatch[1]}.</strong>  ${figMatch[2].trim()}</figcaption>`;
              }
            }

            // Match concatenated TABLE IACADEMIC...
            const concatMatch = cleanText.match(/^(?:TABLE|Table)\s*([IVXLCDM\d]+)\s*([A-Z\s].*)$/i);
            if (concatMatch) {
              const num = concatMatch[1].toUpperCase();
              const title = concatMatch[2].trim().toUpperCase();
              return `<figcaption class="table-caption" style="font-size:8pt; color:#000; margin-bottom:4pt; text-align:center; text-transform:uppercase; letter-spacing:0.5px; line-height:1.25;"><span class="table-num" style="display:block; font-weight:bold; font-size:8.5pt;">TABLE ${num}</span><span class="table-title" style="display:block; font-size:8pt;">${title}</span></figcaption>`;
            }

            const normalMatch = cleanText.match(/^(?:TABLE|Table)\s+([IVXLCDM\d]+)[:.\s-]+(.*)$/i);
            if (normalMatch) {
              const num = normalMatch[1].toUpperCase();
              const title = normalMatch[2].trim().toUpperCase();
              return `<figcaption class="table-caption" style="font-size:8pt; color:#000; margin-bottom:4pt; text-align:center; text-transform:uppercase; letter-spacing:0.5px; line-height:1.25;"><span class="table-num" style="display:block; font-weight:bold; font-size:8.5pt;">TABLE ${num}</span><span class="table-title" style="display:block; font-size:8pt;">${title}</span></figcaption>`;
            }

            return match;
          }
        );

        // 7. Fix Figures and Captions (ensure Fig. X. format and placement below visual)
        content = content.replace(/<figure([\s\S]*?)<\/figure>/gi, (figureMatch, figureInner) => {
          // If it's a table figure, keep it as table
          if (figureMatch.includes('custom-replaced-table') || figureMatch.includes('paper-table')) {
            return figureMatch;
          }

          const figNum = figureCounter++;
          let captionText = '';
          
          if (figureMatch.includes('FIG. 1') || figureMatch.includes('Fig. 1') || ieeeTitle.includes('PROPOSED FRAMEWORK')) {
            captionText = 'System architecture workflow of the Graph-State Synchronization (GSS) framework.';
          } else if (figureMatch.includes('FIG. 2') || figureMatch.includes('Fig. 2') || ieeeTitle.includes('ARCHITECTURE')) {
            captionText = 'Component interactions and state transition pipelines in the agentic network.';
          } else if (ieeeTitle.includes('METHODOLOGY')) {
            captionText = figNum === 3 
              ? 'Execution trace of the neuro-symbolic verification loop.'
              : 'Decision boundary analysis across multi-step verification stages.';
          } else {
            captionText = `Workflow sequence and operational model of ${ieeeTitle.replace(/^[IVXLCDM]+\.\s*/, '')}.`;
          }

          const figcaptionRegex = /<figcaption[\s\S]*?<\/figcaption>/gi;
          let cleanInner = figureInner.replace(figcaptionRegex, '');

          // Ensure img has clean styling
          cleanInner = cleanInner.replace(/style="[^"]*"/gi, '');
          cleanInner = cleanInner.replace(/<img/i, `<img class="diagram-figure mx-auto" style="max-width:100%; height:auto; display:block; margin:0 auto; background:#fff;"`);

          const newFigcaption = `<figcaption class="figure-caption" style="font-size:8pt; color:#000; margin-top:5pt; margin-bottom:6pt; text-align:justify; line-height:1.25;"><strong>Fig. ${figNum}.</strong>  ${captionText}</figcaption>`;

          return `<figure class="paper-figure custom-replaced-visual" style="text-align:center; margin:12pt auto; width:100%; box-sizing:border-box; break-inside:avoid; page-break-inside:avoid;">\n  ${cleanInner.trim()}\n  ${newFigcaption}\n</figure>`;
        });

        // 8. Fix math display blocks and numbering
        let eqCounter = 1;
        content = content.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
          let trimmedMath = math.replace(/<[^>]*>/g, '').trim();
          if (!trimmedMath.includes('\\tag{')) {
            trimmedMath = `${trimmedMath} \\tag{${eqCounter++}}`;
          }
          return `\n$$\n${trimmedMath}\n$$\n`;
        });

        // 9. Format Paragraphs with first-line indent
        content = content.replace(/<p>/gi, '<p style="margin:0; text-indent:1.25pc; text-align:justify; line-height:1.2;">');

        newSections.push({
          title: ieeeTitle,
          heading: ieeeTitle,
          content: content
        });

        newOutline.push(ieeeTitle);
      }

      // Format references array in authentic IEEE style
      let updatedRefs = (paper.references || []).map((ref, idx) => {
        let cleanRef = ref.replace(/^\[\d+\]\s*/, '').trim();
        return `[${idx + 1}] ${cleanRef}`;
      });

      // Update paper in MongoDB
      paper.sections = newSections;
      paper.outline = newOutline;
      paper.references = updatedRefs;

      await paper.save();
      console.log(` Successfully updated Paper ID: ${paper._id} to authentic IEEE standard.`);
      console.log(` Updated ${newSections.length} sections.`);
    }

    console.log('\nAll papers successfully repaired and saved to MongoDB.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  }
}

repairAllPapers();
