import assert from 'node:assert/strict';
import {
  parseDocument,
  winnowingFingerprint,
  detectExactPlagiarism,
  runPlagiarismDetection,
  detectAIContent,
} from '../utils/plagiarismEngine.js';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { extractPdfFallback } from '../utils/pdfFallback.js';
import { isPrimaryOwner, getUserApiKeys } from '../utils/userKeys.js';
import fs from 'fs';
import path from 'path';

async function runTests() {
  // 1. Winnowing fingerprint produces non-empty hashes even for 5-token sentences
  const fpShort = winnowingFingerprint('distributed cognitive agents synthesize literature');
  assert.ok(fpShort.length >= 1, 'Short 5-token sentence should produce winnowing fingerprint');

  // 2. Exact plagiarism detection catches copied sentences via Winnowing + MinHash
  const exactMatches = detectExactPlagiarism(
    ['Autonomous distributed multi-agent cognitive architectures synthesize academic papers reliably.'],
    [
      {
        sentence: 'Autonomous distributed multi-agent cognitive architectures synthesize academic papers reliably.',
        title: 'Reference Paper A',
      },
    ]
  );
  assert.equal(exactMatches.length, 1, 'Expected 1 exact match');
  assert.ok(exactMatches[0].similarity >= 90, `Expected high similarity, got ${exactMatches[0].similarity}`);

  // 3. Structural, Formula, and Code scores evaluate > 0 when localPapers share headings/formulas/code
  const paperSections = [
    {
      title: '1. Methodology',
      heading: 'Methodology',
      content: [
        'This section introduces the retrieval scoring objective.',
        '$$\\text{RRF}(d) = \\sum_{r \\in R} \\frac{1}{k + \\text{rank}_r(d)}$$',
        '```python\ndef score(rank, k=60):\n    return 1.0 / (k + rank)\n```',
        'Our retrieval scoring objective balances semantic similarity and exact term matching reliably.',
      ].join('\n\n'),
    },
    {
      title: '2. Evaluation',
      heading: 'Evaluation',
      content: 'Empirical results demonstrate consistent improvements over single-channel baselines.',
    },
  ];

  const localPaperContent = [
    '# Methodology',
    'This section introduces the retrieval scoring objective.',
    '$$\\text{RRF}(d) = \\sum_{r \\in R} \\frac{1}{k + \\text{rank}_r(d)}$$',
    '```python\ndef score(rank, k=60):\n    return 1.0 / (k + rank)\n```',
    '# Evaluation',
    'Empirical results demonstrate consistent improvements over single-channel baselines.',
  ].join('\n\n');

  const result = await runPlagiarismDetection(
    'Hybrid Synthesis Study',
    paperSections,
    ['Vaswani et al., Attention Is All You Need, 2017'],
    [
      {
        title: 'Source Study',
        content: localPaperContent,
        references: ['Vaswani et al., Attention Is All You Need, 2017'],
      },
    ],
    { skipExternalLookup: true }
  );

  assert.ok(result.structureScore > 0, `Expected structureScore > 0, got ${result.structureScore}`);
  assert.ok(result.formulaScore > 0, `Expected formulaScore > 0, got ${result.formulaScore}`);
  assert.ok(result.codeScore > 0, `Expected codeScore > 0, got ${result.codeScore}`);
  assert.ok(result.citationScore > 0, `Expected citationScore > 0, got ${result.citationScore}`);

  // 4. AI detector returns valid bounded metrics
  const aiRes = detectAIContent([
    'Furthermore, the proposed framework demonstrates substantial efficiency improvements.',
    'Moreover, this scalable methodology enhances overall reliability in complex systems.',
  ]);
  assert.ok(aiRes.aiProbability >= 0 && aiRes.aiProbability <= 100);
  assert.equal(aiRes.humanProbability + aiRes.aiProbability, 100);

  // 5. Auth middleware rejects unauthenticated requests when NODE_ENV=production
  const prevEnv = process.env.NODE_ENV;
  const prevBypass = process.env.ALLOW_DEV_MOCK_AUTH;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEV_MOCK_AUTH;

    let statusCode = 200;
    let calledNext = false;
    const req = { headers: {} } as AuthenticatedRequest;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(_body: unknown) {
        return this;
      },
    } as any;

    authMiddleware(req, res, () => {
      calledNext = true;
    });
    assert.equal(statusCode, 401, 'Production mode without Authorization must return 401');
    assert.equal(calledNext, false);

    // Development fallback still preserves compatibility when NODE_ENV=development
    process.env.NODE_ENV = 'development';
    let devNext = false;
    const devReq = { headers: {} } as AuthenticatedRequest;
    authMiddleware(devReq, res, () => {
      devNext = true;
    });
    assert.equal(devNext, true);
    assert.ok(devReq.user?.id);
  } finally {
    if (prevEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevEnv;
    if (prevBypass === undefined) delete process.env.ALLOW_DEV_MOCK_AUTH;
    else process.env.ALLOW_DEV_MOCK_AUTH = prevBypass;
  }

  // 6. Strict user-only API key enforcement (never unlock .env owner bypass or emit boolean flags)
  assert.equal(isPrimaryOwner({ id: '666a7b29d5b51a0211a7c501', email: 'archit@test.edu' }), false);
  const extractedKeys = await getUserApiKeys('', {
    headers: { 'x-gemini-api-key': 'user_gemini_test_key' },
  } as any);
  assert.equal(extractedKeys.gemini, 'user_gemini_test_key');
  assert.equal('is_owner' in extractedKeys, false);

  // 7. Local Node PDF fallback parses real PDFs without calling external AI providers
  const samplePdfPath = path.resolve(process.cwd(), '../Inference_Scaled_GraphRAG.pdf');
  if (fs.existsSync(samplePdfPath)) {
    const pdfBuf = fs.readFileSync(samplePdfPath);
    const parsedFallback = await extractPdfFallback(pdfBuf, 'Fallback Title');
    assert.ok(parsedFallback.chunks.length >= 1, 'Fallback parser should produce at least 1 chunk');
    assert.ok(parsedFallback.chunks[0].text_content.length > 50, 'Fallback chunk should contain extracted PDF text');
  }

  console.log('ALL SERVER PHASE 1 UNIT TESTS PASSED');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
