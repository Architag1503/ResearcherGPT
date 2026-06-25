import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';

const MONGO_URI = 'mongodb://mongodb:27017/researcher_gpt';

// Schema definitions
const PaperSectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  heading: { type: String, required: true },
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

const CitationSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    key: { type: String, required: true },
    doi: { type: String },
    title: { type: String, required: true },
    authors: [{ type: String }],
    journal: { type: String },
    year: { type: Number },
    volume: { type: String },
    issue: { type: String },
    pages: { type: String },
    publisher: { type: String },
    styles: {
      apa: { type: String },
      mla: { type: String },
      ieee: { type: String },
      chicago: { type: String },
      harvard: { type: String },
    },
  },
  { timestamps: true, collection: 'citations' }
);

const GeneratedPaper = mongoose.model('GeneratedPaper', GeneratedPaperSchema);
const Citation = mongoose.model('Citation', CitationSchema);

// Roman numeral generator for tables
function toRoman(num) {
  const lookup = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  let roman = '';
  for (let i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman;
}

// Hardcoded verified citation metadata fallbacks to avoid 429 rate limit issues
const VERIFIED_CITATIONS = [
  {
    key: 'AbouAli2026',
    doi: '10.1007/s10462-025-11422-4',
    title: 'Agentic AI: a comprehensive survey of architectures, applications, and future directions',
    authors: ['Mohamed Abou Ali', 'Fadi Dornaika', 'Jinan Charafeddine'],
    journal: 'Artificial Intelligence Review',
    year: 2026,
    volume: '59',
    issue: '11',
    pages: '1-37',
    publisher: 'Springer Science and Business Media LLC',
    styles: {
      ieee: '[1] M. Abou Ali, F. Dornaika, and J. Charafeddine, "Agentic AI: a comprehensive survey of architectures, applications, and future directions," *Artificial Intelligence Review*, vol. 59, no. 11, pp. 1–37, 2026. doi: 10.1007/s10462-025-11422-4.',
      apa: 'Abou Ali, M., Dornaika, F., & Charafeddine, J. (2026). Agentic AI: a comprehensive survey of architectures, applications, and future directions. *Artificial Intelligence Review*, 59(11), 1–37.'
    }
  },
  {
    key: 'Kaelbling1998',
    doi: '10.1016/s0004-3702(98)00023-x',
    title: 'Planning and acting in partially observable stochastic domains',
    authors: ['Leslie Pack Kaelbling', 'Michael L. Littman', 'Anthony R. Cassandra'],
    journal: 'Artificial Intelligence',
    year: 1998,
    volume: '101',
    issue: '1-2',
    pages: '99-134',
    publisher: 'Elsevier BV',
    styles: {
      ieee: '[2] L. P. Kaelbling, M. L. Littman, and A. R. Cassandra, "Planning and acting in partially observable stochastic domains," *Artificial Intelligence*, vol. 101, no. 1-2, pp. 99-134, 1998. doi: 10.1016/s0004-3702(98)00023-x.',
      apa: 'Kaelbling, L. P., Littman, M. L., & Cassandra, A. R. (1998). Planning and acting in partially observable stochastic domains. *Artificial Intelligence*, 101(1-2), 99-134.'
    }
  },
  {
    key: 'Laird2012',
    doi: '10.7551/mitpress/9434.001.0001',
    title: 'The Soar Cognitive Architecture',
    authors: ['John E. Laird'],
    publisher: 'MIT Press',
    year: 2012,
    styles: {
      ieee: '[3] J. E. Laird, *The Soar Cognitive Architecture*. Cambridge, MA, USA: MIT Press, 2012. doi: 10.7551/mitpress/9434.001.0001.',
      apa: 'Laird, J. E. (2012). *The Soar Cognitive Architecture*. MIT Press.'
    }
  }
];

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB inside container');

    const papers = await GeneratedPaper.find({});
    console.log(`Found ${papers.length} papers to repair`);

    for (const paper of papers) {
      console.log(`\nProcessing Paper: "${paper.title}" (ID: ${paper._id})`);
      const projectId = paper.projectId;

      // 1. Register missing citations in database for this project
      const existingCits = await Citation.find({ projectId });
      const currentCitKeys = existingCits.map(c => c.key);

      for (const verifiedCit of VERIFIED_CITATIONS) {
        if (!currentCitKeys.includes(verifiedCit.key)) {
          const newCit = new Citation({
            projectId,
            key: verifiedCit.key,
            doi: verifiedCit.doi,
            title: verifiedCit.title,
            authors: verifiedCit.authors,
            journal: verifiedCit.journal,
            year: verifiedCit.year,
            volume: verifiedCit.volume,
            issue: verifiedCit.issue,
            pages: verifiedCit.pages,
            publisher: verifiedCit.publisher,
            styles: verifiedCit.styles
          });
          await newCit.save();
          console.log(`  Added missing citation "${verifiedCit.key}" to project ${projectId}`);
        }
      }

      // 2. Loop through sections and apply repairs
      let sectionUpdatedCount = 0;
      let paperTableCounter = 1;
      let paperEqCounter = 1;

      for (const sec of paper.sections || []) {
        let content = sec.content || '';
        let originalContent = content;

        // A. Strip reviewer critiques
        content = content.replace(/\[Reviewer critique\]/gi, '');

        // B. Re-join spelling patterns
        content = content.replace(/NeuroSymbolic/g, 'Neuro-Symbolic')
                         .replace(/DualParadigm/g, 'Dual-Paradigm')
                         .replace(/Dual Paradigm/g, 'Dual-Paradigm');

        // C. Normalize image URLs to relative paths
        content = content.replace(/src=["']https?:\/\/[^\/]+(:\d+)?\/uploads\/(napkin_[a-f0-9]+\.png)["']/gi, 'src="uploads/$2"');

        // D. Reconstruct corrupted tables (remove separator rows)
        if (content.includes('<table>')) {
          // Identify table tags
          content = content.replace(/<table>([\s\S]*?)<\/table>/gi, (match, tableBody) => {
            // Find rows
            const rows = tableBody.match(/<tr>[\s\S]*?<\/tr>/gi) || [];
            const cleanRows = [];
            
            rows.forEach((row) => {
              // Extract columns
              const cols = row.match(/<td>([\s\S]*?)<\/td>/gi) || [];
              const isSeparatorRow = cols.every(col => {
                const cellText = col.replace(/<\/?td>/g, '').trim();
                return /^:?-+:?$/.test(cellText);
              });

              if (!isSeparatorRow) {
                // Ensure proper IEEE style borderless cells with padding
                const styledRow = row.replace(/<td>/gi, '<td style="border:none; border-top:1px solid #000; border-bottom:1px solid #000; padding:6px; text-align:center;">')
                                     .replace(/<th>/gi, '<th style="border:none; border-top:1px solid #000; border-bottom:2px solid #000; padding:6px; text-align:center; font-weight:bold;">');
                cleanRows.push(styledRow);
              }
            });

            // Reconstruct the table body
            let cleanTableBody = cleanRows.join('\n');
            const romanNum = toRoman(paperTableCounter++);
            
            // Add a proper table caption on top
            const caption = `<div class="table-caption" style="text-align:center; font-size:8.5pt; font-weight:bold; text-transform:uppercase; margin-bottom:6pt; color:#000;">TABLE ${romanNum}: ACADEMIC EXPERIMENTAL EVALUATION</div>`;
            return `${caption}\n<table style="width:100%; border-collapse:collapse; margin:12pt 0; font-size:9pt; page-break-inside:avoid; break-inside:avoid;">${cleanTableBody}</table>`;
          });
        }

        // E. Repair equations (sequentially number KaTeX math blocks)
        if (content.includes('$$')) {
          content = content.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
            let cleanMath = math.trim();
            // Strip any existing custom tags to normalize
            cleanMath = cleanMath.replace(/\\tag\{[^}]+\}/g, '').trim();
            // Append sequential equation number
            return `$$\n${cleanMath} \\tag{${paperEqCounter++}}\n$$`;
          });
        }

        // F. Replace text references with dynamic citation bracket keys
        content = content.replace(/Kaelbling et al\.\s*\(1998\)/g, 'Kaelbling et al. [Kaelbling1998]')
                         .replace(/Laird\s*\(2022\)/g, 'Laird [Laird2012]')
                         .replace(/Laird\s*\(2012\)/g, 'Laird [Laird2012]')
                         .replace(/Abou Ali et al\.\s*\(2026\)/g, 'Abou Ali et al. [AbouAli2026]')
                         .replace(/Abou Ali et al\.\s*\(2025\)/g, 'Abou Ali et al. [AbouAli2026]')
                         .replace(/\[1\]/g, '[AbouAli2026]');

        if (content !== originalContent) {
          sec.content = content;
          sectionUpdatedCount++;
        }
      }

      // 3. Rebuild references list
      const bibliography = [
        'Abou Ali, M., Dornaika, F., & Charafeddine, J. (2026). Agentic AI: a comprehensive survey of architectures, applications, and future directions. *Artificial Intelligence Review*, 59(11), 1–37. https://doi.org/10.1007/s10462-025-11422-4',
        'Kaelbling, L. P., Littman, M. L., & Cassandra, A. R. (1998). Planning and acting in partially observable stochastic domains. *Artificial Intelligence*, 101(1-2), 99-134. https://doi.org/10.1016/s0004-3702(98)00023-x',
        'Laird, J. E. (2012). *The Soar Cognitive Architecture*. MIT Press. https://doi.org/10.7551/mitpress/9434.001.0001'
      ];
      paper.references = bibliography;

      await paper.save();
      console.log(`  Repaired ${sectionUpdatedCount} sections and successfully updated paper document.`);
    }

    await mongoose.disconnect();
    console.log('Successfully completed database repairs.');
  } catch (err) {
    console.error('Error executing database repair:', err);
  }
}

main();
