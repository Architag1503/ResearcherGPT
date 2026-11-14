import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  runPlagiarismDetection,
  detectExactPlagiarism,
  detectAIContent,
} from '../../server/dist/utils/plagiarismEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EVAL_DIR = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(EVAL_DIR, 'results');

function bootstrapMeanCI(values, nResamples = 2000) {
  const n = values.length;
  if (n === 0) return { mean: 0, std: 0, ci_low: 0, ci_high: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(n - 1, 1);
  const std = Math.sqrt(variance);
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const boots = [];
  for (let i = 0; i < nResamples; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += values[Math.floor(rand() * n)];
    boots.push(s / n);
  }
  boots.sort((a, b) => a - b);
  return {
    mean: Number(mean.toFixed(4)),
    std: Number(std.toFixed(4)),
    ci_low: Number(boots[Math.floor(0.025 * nResamples)].toFixed(4)),
    ci_high: Number(boots[Math.floor(0.975 * nResamples)].toFixed(4)),
  };
}

function buildControlledIntegrityDataset() {
  const baseTopics = [
    {
      title: 'Hybrid Retrieval for Scholarly Literature',
      sentA: 'Reciprocal rank fusion merges dense vector similarity rankings with full-corpus BM25 lexical statistics without requiring score normalization.',
      sentB: 'Knowledge graph entity linking identifies papers connected to technical methods mentioned in the user query to improve multi-hop retrieval.',
      paraSynA: 'Combining semantic vector search rankings and exact BM25 keyword ordering through reciprocal rank fusion avoids cross-scale calibration.',
      paraSynB: 'Connecting methodological entities in a structured knowledge graph surfaces relevant scholarly manuscripts during multi-step retrieval.',
      formula: '$$R(d) = \\sum_{m \\in M} \\frac{w_m}{k + \\text{rank}_m(d)}$$',
      code: '```python\ndef fuse_ranks(ranks, k=60):\n    return sum(1.0 / (k + r) for r in ranks)\n```',
      headings: ['Introduction', 'Hybrid Architecture', 'Evaluation'],
      refs: ['Robertson et al., The Probabilistic Relevance Framework BM25, 2009', 'Cormack et al., Reciprocal Rank Fusion Outperforms Condorcet, 2009'],
    },
    {
      title: 'Deterministic Fingerprinting for Academic Texts',
      sentA: 'Winnowing selects minimum hash values across sliding windows of overlapping five-word shingles to guarantee contiguous match detection.',
      sentB: 'MinHash sketches compress shingle sets into fixed-length signatures whose coordinate equality estimates Jaccard similarity reliably.',
      paraSynA: 'Sliding window minimum selection over five-token shingle hashes guarantees discovery of copied contiguous document spans.',
      paraSynB: 'Compact MinHash permutation signatures approximate set Jaccard similarity across large collections of token shingles.',
      formula: '$$J(A, B) = \\frac{|h(A) \\cap h(B)|}{|h(A) \\cup h(B)|}$$',
      code: '```ts\nfunction jaccard(a: number[], b: number[]): number {\n  let eq = 0;\n  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) eq++;\n  return eq / a.length;\n}\n```',
      headings: ['Background', 'Hashing Methodology', 'Benchmarks'],
      refs: ['Schleimer et al., Winnowing Local Algorithms for Document Fingerprinting, 2003', 'Broder, On the Resemblance and Containment of Documents, 1997'],
    },
  ];

  const cases = [];
  for (let i = 0; i < 5; i++) {
    for (let tIdx = 0; tIdx < baseTopics.length; tIdx++) {
      const t = baseTopics[tIdx];
      const tag = `variant ${i} study ${tIdx}`;
      const srcContent = [
        `# ${t.headings[0]}`,
        `${t.sentA} ${t.sentB}`,
        `# ${t.headings[1]}`,
        `${t.formula}`,
        `${t.code}`,
        `# ${t.headings[2]}`,
        `Empirical evaluation on corpus ${tag} verifies consistent detection bounds.`,
      ].join('\n\n');

      const localPapers = [{
        title: `${t.title} (${tag})`,
        content: srcContent,
        references: t.refs,
      }];

      // 1. Verbatim exact copy
      cases.push({
        case_id: `exact_${i}_${tIdx}`,
        category: 'verbatim_exact',
        expected_flagged: 1,
        targetTitle: `Draft Exact ${i}-${tIdx}`,
        sections: [{ title: '1. Intro', heading: 'Intro', content: `${t.sentA} ${t.sentB}` }],
        references: [],
        localPapers,
      });

      // 2. Patchwritten / localized exact 6-word window embedded inside extra commentary
      cases.push({
        case_id: `patch_${i}_${tIdx}`,
        category: 'localized_patchwrite',
        expected_flagged: 1,
        targetTitle: `Draft Patch ${i}-${tIdx}`,
        sections: [{
          title: '1. Intro',
          heading: 'Intro',
          content: `Recent surveys note that ${t.sentA.toLowerCase()} Furthermore additional observations confirm robustness across diverse benchmarks.`,
        }],
        references: [],
        localPapers,
      });

      // 3. Semantic high-token-overlap paraphrase (modified syntax, no long exact 5-gram chain)
      cases.push({
        case_id: `sem_${i}_${tIdx}`,
        category: 'semantic_paraphrase',
        expected_flagged: 1,
        targetTitle: `Draft Sem ${i}-${tIdx}`,
        sections: [{
          title: '1. Intro',
          heading: 'Intro',
          content: `${t.paraSynA} ${t.paraSynB}`,
        }],
        references: [],
        localPapers,
      });

      // 4. Structural + Formula + Code cloning (paraphrased text + copied structure/math/code)
      cases.push({
        case_id: `multimodal_${i}_${tIdx}`,
        category: 'structure_formula_code',
        expected_flagged: 1,
        targetTitle: `Draft StructMathCode ${i}-${tIdx}`,
        sections: [
          { title: `1. ${t.headings[0]}`, heading: t.headings[0], content: 'Original introductory framing for the technical evaluation.' },
          { title: `2. ${t.headings[1]}`, heading: t.headings[1], content: `${t.formula}\n\n${t.code}\n\nMathematical notation follows standard conventions.` },
          { title: `3. ${t.headings[2]}`, heading: t.headings[2], content: 'Results confirm baseline reproducibility under offline testing.' },
        ],
        references: [],
        localPapers,
      });

      // 5. Citation list overlap
      cases.push({
        case_id: `cit_${i}_${tIdx}`,
        category: 'citation_overlap',
        expected_flagged: 1,
        targetTitle: `Draft Citations ${i}-${tIdx}`,
        sections: [{ title: '1. Intro', heading: 'Intro', content: 'Independent synthesis discussing classical ranking frameworks in retrieval systems.' }],
        references: [...t.refs],
        localPapers,
      });

      // 6. Negative control (unrelated domain clean text, expected_flagged = 0)
      cases.push({
        case_id: `neg_${i}_${tIdx}`,
        category: 'clean_negative_control',
        expected_flagged: 0,
        targetTitle: `Draft Clean ${i}-${tIdx}`,
        sections: [{
          title: '1. Paleoclimate Observations',
          heading: 'Paleoclimate Observations',
          content: `Antarctic ice cores archive atmospheric methane concentrations across Holocene glacial transitions ${i} and ${tIdx}. Mass spectrometry calibrates isotopic deuterium ratios along stratified snow accumulation layers.`,
        }],
        references: ['Petit et al., Climate and atmospheric history of Vostok ice core, Nature, 1999'],
        localPapers,
      });
    }
  }
  return cases;
}

function buildAIProseDataset() {
  const aiSamples = [];
  const humanSamples = [];
  for (let i = 0; i < 15; i++) {
    // Low burstiness (uniform 14-word length), repetitive connectives
    aiSamples.push({
      id: `ai_${i}`,
      expected_ai: 1,
      sentences: [
        'Moreover, the proposed framework demonstrates consistent performance across complex research evaluation scenarios.',
        'Furthermore, the proposed system enhances computational reliability across complex academic synthesis tasks.',
        'Additionally, the proposed pipeline achieves strong consistency across diverse analytical document evaluations.',
        'Consequently, the proposed architecture delivers improved efficiency across automated scholarly generation workflows.',
        'Therefore, the proposed methodology supports reproducible verification across modern scientific writing environments.',
      ],
    });
    // High burstiness (varying 5 to 26 words), rich unigram vocabulary, minimal canned connectives
    humanSamples.push({
      id: `hum_${i}`,
      expected_ai: 0,
      sentences: [
        'We measured every failure.',
        'When the dense index drifted out of dimension alignment, half the query vectors crashed silent fallbacks and distorted cosine neighbors.',
        'Why did nobody notice?',
        `Logs hid the zero-padding inside helper ${i} while tables silently returned empty arrays across every single PDF page.`,
        'Fixing that one tokenization defect changed the outcome immediately.',
      ],
    });
  }
  return [...aiSamples, ...humanSamples];
}

async function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const cases = buildControlledIntegrityDataset();
  const rows = [];

  for (const c of cases) {
    const t0 = performance.now();
    const res = await runPlagiarismDetection(
      c.targetTitle,
      c.sections,
      c.references,
      c.localPapers,
      { skipExternalLookup: true }
    );
    const latencyMs = performance.now() - t0;

    // Flagged criteria per modality or composite score > 0 for multimodal clones
    const flaggedCompositeOrSignal =
      res.overallScore >= 5 ||
      res.exactMatchScore >= 20 ||
      res.semanticScore >= 20 ||
      res.citationScore >= 40 ||
      res.structureScore >= 40 ||
      res.formulaScore >= 40 ||
      res.codeScore >= 40
        ? 1
        : 0;

    // Pre-fix engine simulation: structureScore=0, formulaScore=0, codeScore=0 (empty sources in baseline)
    const preFixOverallScore = Math.round(
      0.35 * Math.min(100, res.exactMatchScore) +
      0.40 * Math.min(100, res.semanticScore) +
      0.10 * Math.min(100, res.citationScore) +
      0.03 * Math.min(100, res.figureScore)
    );
    const flaggedPreFix =
      preFixOverallScore >= 5 ||
      res.exactMatchScore >= 20 ||
      res.semanticScore >= 20 ||
      res.citationScore >= 40
        ? 1
        : 0;

    rows.push({
      case_id: c.case_id,
      category: c.category,
      expected_flagged: c.expected_flagged,
      flagged_postfix: flaggedCompositeOrSignal,
      flagged_prefix: flaggedPreFix,
      overallScore: res.overallScore,
      preFixOverallScore,
      exactMatchScore: res.exactMatchScore,
      semanticScore: res.semanticScore,
      citationScore: res.citationScore,
      structureScore: res.structureScore,
      formulaScore: res.formulaScore,
      codeScore: res.codeScore,
      latency_ms: Number(latencyMs.toFixed(3)),
    });
  }

  // Write per-case CSV
  const csvHeaders = Object.keys(rows[0]).join(',');
  const csvBody = rows.map(r => Object.values(r).join(',')).join('\n');
  fs.writeFileSync(path.join(RESULTS_DIR, 'integrity_per_case.csv'), `${csvHeaders}\n${csvBody}\n`, 'utf-8');

  // Evaluate AI prose detector
  const aiSamples = buildAIProseDataset();
  const aiRows = aiSamples.map(s => {
    const out = detectAIContent(s.sentences);
    return {
      id: s.id,
      expected_ai: s.expected_ai,
      pred_ai: out.aiProbability >= 50 ? 1 : 0,
      aiProbability: out.aiProbability,
      perplexity: out.perplexity,
      burstiness: out.burstiness,
      vocabularyRichness: out.vocabularyRichness,
    };
  });

  const calcCls = (arr, predKey, trueKey) => {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const r of arr) {
      if (r[trueKey] === 1 && r[predKey] === 1) tp++;
      else if (r[trueKey] === 0 && r[predKey] === 1) fp++;
      else if (r[trueKey] === 1 && r[predKey] === 0) fn++;
      else tn++;
    }
    const p = tp + fp > 0 ? tp / (tp + fp) : 0;
    const rec = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = p + rec > 0 ? (2 * p * rec) / (p + rec) : 0;
    const acc = (tp + tn) / arr.length;
    const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
    return {
      tp, fp, fn, tn,
      precision: Number(p.toFixed(4)),
      recall: Number(rec.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      accuracy: Number(acc.toFixed(4)),
      fpr: Number(fpr.toFixed(4)),
    };
  };

  const categories = [...new Set(rows.map(r => r.category))];
  const byCategory = {};
  for (const cat of categories) {
    const sub = rows.filter(r => r.category === cat);
    byCategory[cat] = {
      n: sub.length,
      postfix_rate: bootstrapMeanCI(sub.map(r => r.flagged_postfix)),
      prefix_rate: bootstrapMeanCI(sub.map(r => r.flagged_prefix)),
      mean_overall_score: bootstrapMeanCI(sub.map(r => r.overallScore)),
      mean_structure_score: bootstrapMeanCI(sub.map(r => r.structureScore)),
      mean_formula_score: bootstrapMeanCI(sub.map(r => r.formulaScore)),
      mean_code_score: bootstrapMeanCI(sub.map(r => r.codeScore)),
    };
  }

  const summary = {
    benchmark: 'plagiarism_and_ai_integrity_v1',
    num_cases: rows.length,
    postfix_overall: calcCls(rows, 'flagged_postfix', 'expected_flagged'),
    prefix_overall: calcCls(rows, 'flagged_prefix', 'expected_flagged'),
    by_category: byCategory,
    latency_ms: bootstrapMeanCI(rows.map(r => r.latency_ms)),
    ai_detector_benchmark: {
      num_samples: aiRows.length,
      classification: calcCls(aiRows, 'pred_ai', 'expected_ai'),
      mean_ai_prob_on_ai: bootstrapMeanCI(aiRows.filter(r => r.expected_ai === 1).map(r => r.aiProbability)),
      mean_ai_prob_on_human: bootstrapMeanCI(aiRows.filter(r => r.expected_ai === 0).map(r => r.aiProbability)),
    },
  };

  fs.writeFileSync(path.join(RESULTS_DIR, 'integrity_summary.json'), JSON.stringify(summary, null, 2), 'utf-8');
  console.log('Wrote integrity_per_case.csv and integrity_summary.json');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
