import re
import subprocess
import pypdf

with open('test_no_fig5.tex', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's check what additions were in test_no_fig5.tex:
# 1. intro_addition:
# "In computational literature synthesis, researchers confront three distinct structural hurdles..."
intro_add = r"""In computational literature synthesis, researchers confront three distinct structural hurdles. First, scientific claims are inherently relational: an empirical finding is valid only in the context of specific benchmark datasets, hyperparameter configurations, evaluation splits, and baseline comparisons. Flattening a paper into isolated text snippets severs these dependencies. Second, scholarly prose relies heavily on precise symbolic terminology---including mathematical variable names, formal notations, and benchmark identifiers---that exhibit low frequency in general-domain pre-training corpora. Consequently, standard semantic search models frequently suffer from lexical mismatch or semantic drift. Third, multi-modal artifacts such as mathematical equations, algorithmic pseudocode, and comparative performance tables convey core technical contributions that cannot be adequately synthesized through plain-text representations."""

# 2. lit_addition:
lit_add = r"""Traditional sparse retrieval algorithms, such as Okapi BM25, calculate relevance strictly through exact term matches weighted by inverse document frequency. While exceptionally reliable for identifying specific model names, dataset abbreviations, and parameter symbols, BM25 cannot capture semantic equivalences or conceptual paraphrasing. Conversely, dense bi-encoder models map queries and passages into continuous embedding geometries where cosine distance reflects latent topical alignment. However, dual encoders compress passage context into a single vector, often failing to preserve fine-grained numerical claims and conditional clauses. Graph-based retrieval structures, such as knowledge graphs, introduce an orthogonal structural prior by explicitly representing entity-relation-entity triples. In academic domains, this allows retrieval to follow ontological paths---such as tracing an architecture to its training loss function and benchmark results---even when textual descriptions share minimal lexical overlap with the query."""

# 3. method_addition:
method_add = r"""In Equation~(\ref{eq:bm25}), parameter $k_1$ regulates term-frequency saturation, ensuring that repeated occurrences of a technical term yield diminishing marginal relevance gains, while parameter $b$ penalizes excessively long chunks that might match terms by chance. In Equation~(\ref{eq:rrf}), the smoothing constant $k=60$ plays a critical role in stabilizing fusion scores: it prevents chunks that rank exceptionally high in one list from dominating candidates that demonstrate consistent, balanced relevance across both dense and sparse rankings. The topological boost $\beta=1.30$ acts as a Bayesian prior, prioritizing chunks whose parent publications are structurally connected to query entities in the project knowledge mesh."""

# 4. arch_addition:
arch_add = r"""The FormaTeX layout engine processes PDF coordinate data through a multi-stage geometric pipeline. Horizontal and vertical vector drawing paths are first clustered using density-based spatial thresholding to identify table bounding boxes. Text fragments within each bounding box are projected onto horizontal and vertical axes to reconstruct the underlying row and column matrix. Spanning cells and multi-level headers are resolved by analyzing whitespace gaps and font weight variations. During \LaTeX\ translation, column alignment specifiers are automatically assigned based on content type: numeric columns receive right-aligned or decimal-aligned formatting, while descriptive text columns utilize proportional wrapping widths. Mathematical expressions are checked against a formal grammar specification to ensure that delimiter pairs match and subscripts are properly formatted."""

# 5. results_addition:
results_add = r"""The experimental results demonstrate that the three retrieval channels exhibit highly complementary error distributions. Dense HNSW search achieves strong topical recall on broad conceptual queries but demonstrates poor precision on fine-grained parameter searches (such as learning rate schedules or specific benchmark subsets). Okapi BM25 excels at recovering exact hyperparameter mentions but fails when authors describe methods using alternate terminology. The Tri-Hybrid RRF engine overcomes these individual limitations, boosting Recall@5 from 0.724 (dense alone) and 0.691 (BM25 alone) to 0.927. Furthermore, the 96.4\% attribution accuracy achieved in Table~\ref{tab:citation} confirms that active sentence-level claim verification is essential for automated scholarly synthesis: by cross-examining candidate claims against retrieved primary passages, the Fact Verification Agent eliminates 97.7\% of the citation confabulations present in monolithic RAG baselines."""

# Let's remove these 5 injected blocks
for block in [intro_add, lit_add, method_add, arch_add, results_add]:
    # Clean whitespace matches
    pat = re.escape(block.strip())
    text = re.sub(pat, '', text)

# Clean any double newlines
text = re.sub(r'\n{3,}', '\n\n', text)

with open('test_calibrated.tex', 'w', encoding='utf-8') as f:
    f.write(text)

print('Wrote test_calibrated.tex without filler blocks.')
