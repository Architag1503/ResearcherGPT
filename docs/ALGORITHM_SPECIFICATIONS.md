# Algorithm Specifications (Verified Against Source Code)

Every equation and procedure below directly reflects the active implementation after Phase 1/2 fixes.

---

## 1. Full-Corpus Hybrid Retrieval with Knowledge Graph Fusion

Implemented in [`retrieve_hybrid`](file:///a:/Antigravity/ResearcherGPT/ai-service/rag/hybrid_retriever.py) and [`qdrant_service`](file:///a:/Antigravity/ResearcherGPT/ai-service/services/qdrant_service.py):

1. **Dense Vector Channel ($\mathcal{R}_{\text{vec}}$)**: Encodes query $q$ using either `gemini-embedding-001` ($d=3072$), local `all-MiniLM-L6-v2` ($d=384$), or deterministic feature-hashing bag-of-ngrams ($d \in \{384, 3072\}$) with strict vector-space isolation, returning top-$m$ chunks ordered by cosine similarity.
2. **Full-Corpus Okapi BM25 Channel ($\mathcal{R}_{\text{bm25}}$)**: Scrolls all chunks $\mathcal{C}_p$ belonging to project $p$ (`scroll_project_chunks`), tokenizes with lowercase alphanumeric regex `[a-z0-9]+` (filtering length $\le 1$), computes token-set document frequency $\text{df}(t)$, and ranks chunks with $\text{BM25}(c, q) > 0$ using parameters $k_1 = 1.5$, $b = 0.75$, and $\text{avgdl}$.
3. **Knowledge Graph Paper Lookup & Candidate Channel ($\mathcal{P}_{\text{KG}}, \mathcal{R}_{\text{kg}}$)**: Extracts query terms ($|w| > 3$) and queries Neo4j (or `in_memory_graphs` fallback) for paper nodes linked to matching non-paper entities, ordering chunks from $\mathcal{P}_{\text{KG}}$ by BM25 score.
4. **Weighted Reciprocal Rank Fusion**:
   $$S_{\text{RRF}}(c) = \sum_{L \in \{\mathcal{R}_{\text{vec}}, \mathcal{R}_{\text{bm25}}, \mathcal{R}_{\text{kg}}\}} \mathbf{1}[c \in L] \cdot \frac{w_L \cdot m_{\text{KG}}(c)}{k_{\text{RRF}} + \text{rank}_L(c)}$$
   where $k_{\text{RRF}} = 60$, $w_{\text{vec}} = 1.0$, $w_{\text{bm25}} = 1.0$, optional $w_{\text{kg}} \ge 0$, and $m_{\text{KG}}(c) = \beta$ ($\beta = 1.3$ default) if $\text{paper\_id}(c) \in \mathcal{P}_{\text{KG}}$, else $1.0$.

---

## 2. Deterministic Zero-RAM Feature-Hashing Fallback Embedding

Implemented in [`get_fast_fallback_embedding`](file:///a:/Antigravity/ResearcherGPT/ai-service/services/qdrant_service.py):
- Extracts unigrams $u_i$ (weight $1.0$) and adjacent bigrams $u_i\_u_{i+1}$ (weight $0.7$).
- Projects each feature via 8-byte `blake2b` into bucket $\text{digest}_{0..3} \bmod d$ with signed hash $+1 / -1$ determined by bit 0 of $\text{digest}_4$, followed by $L_2$ normalization.

---

## 3. Multi-Scale Academic Integrity Engine (`server/src/utils/plagiarismEngine.ts`)

1. **Exact Match Detection (MinHash + Winnowing)**:
   - Lowercase alphanumeric word shingles of length $k = 5$.
   - 128-permutation MinHash signatures using 32-bit additive string hash (`((h << 5) - h) + char`) and Jaccard coordinate agreement $\hat{J}_{\text{MH}}(s, t)$.
   - Sliding-window Winnowing ($w = 4$) selecting minimum shingle hash per window (`winnowingFingerprint`), computing fingerprint Jaccard $\hat{J}_{\text{Win}}(s, t)$ and taking $\max(\hat{J}_{\text{MH}}, \hat{J}_{\text{Win}}) > 0.60$.
2. **Semantic Overlap**: Sparse TF-IDF vector cosine similarity (`detectSemanticPlagiarism`) flagged above moderate ($0.70$) and high ($0.85$) thresholds.
3. **Structural Heading Similarity**: Normalized heading Longest Common Subsequence ratio $\frac{2 \cdot \text{LCS}(H_1, H_2)}{|H_1| + |H_2|}$ (`detectStructuralPlagiarism`).
4. **Formula & Code Overlap**: Macro stripping and delimiter-split token-set Jaccard ($>0.6$ for formulas, $>0.5$ for comment/literal-normalized code blocks) evaluated across local reference texts parsed via shared `extractStructuralElementsFromText`.
5. **AI Style Heuristics**: Unigram word-frequency entropy $2^{H_{\text{unigram}}}$ (labeled `perplexity`), sentence-length coefficient of variation (`burstiness`), type-token ratio, sentence-start diversity, and academic connective frequency.
6. **Composite Score**:
   $$S_{\text{overall}} = \text{round}\big(0.35 S_{\text{exact}} + 0.40 S_{\text{sem}} + 0.10 S_{\text{cit}} + 0.05 S_{\text{struct}} + 0.05 S_{\text{form}} + 0.03 S_{\text{fig}} + 0.02 S_{\text{code}}\big)$$

---

## 4. Post-Draft Claim Grounding & Citation Auditing

Implemented in [`claim_verifier.py`](file:///a:/Antigravity/ResearcherGPT/ai-service/agents/verification/claim_verifier.py):
- Extracts non-stopword tokens, adjacent bigrams, and numeric values/percentages from each generated sentence $c$ and context passage $e$.
- Evaluates lexical token recall $r_{\text{tok}}$, bigram recall $r_{\text{bi}}$, numeric consistency $r_{\text{num}}$ ($\ge 0.5$), and optional MiniLM cosine similarity $\cos(\mathbf{v}_c, \mathbf{v}_e)$.
- Classifies claims as `verified` ($\text{score} \ge \tau$ and numeric consistent), `refuted` (numeric mismatch with $r_{\text{tok}} \ge 0.40$), or `unverified`, and checks bracketed references `[n]` against $1 \le n \le |\text{citations}|$.
