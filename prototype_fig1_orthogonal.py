import subprocess
import fitz

tex_code = r"""\documentclass[journal,compsoc]{IEEEtran}
\usepackage{amsmath,amssymb}
\usepackage{tikz}
\usetikzlibrary{arrows.meta,positioning,shapes.geometric,fit,calc,backgrounds}
\usepackage{xcolor}

\definecolor{tierclient}{RGB}{236,244,252}
\definecolor{tierclientborder}{RGB}{41,128,185}
\definecolor{tiergate}{RGB}{254,249,238}
\definecolor{tiergateborder}{RGB}{214,137,16}
\definecolor{tierfast}{RGB}{247,243,252}
\definecolor{tierfastborder}{RGB}{142,68,173}
\definecolor{tierdb}{RGB}{237,247,242}
\definecolor{tierdbborder}{RGB}{39,174,96}

\tikzset{
  cnode/.style={draw=#1, fill=white, rounded corners=3pt, line width=0.7pt, align=center},
  dnode/.style={draw=#1, cylinder, shape border rotate=90, aspect=0.25, fill=white, line width=0.7pt, align=center},
  arrow/.style={-{Stealth[length=2.2mm,width=1.5mm]}, line width=0.8pt, draw=black!75},
  darrow/.style={{Stealth[length=2mm,width=1.3mm]}-{Stealth[length=2mm,width=1.3mm]}, line width=0.8pt, draw=black!75},
  labeltext/.style={font=\tiny\bfseries, text=black!85}
}

\begin{document}

\begin{figure*}
\centering
\resizebox{0.96\textwidth}{!}{%
\begin{tikzpicture}[x=1mm, y=1mm]

% ==================== TIER 1: CLIENT PRESENTATION TIER ====================
\draw[rounded corners=4pt, fill=tierclient, draw=tierclientborder, line width=0.8pt] (-88, 55) rectangle (88, 69);
\node[anchor=west, font=\scriptsize\bfseries, text=tierclientborder!90!black] at (-85, 65) {CLIENT PRESENTATION TIER};

\node[cnode=tierclientborder, text width=130mm, minimum height=7.5mm] (client) at (0, 61) {
  \textbf{\scriptsize Next.js 15 / React 19 Client Interface} \hfill \tiny TipTap Canvas $\cdot$ Zustand Store $\cdot$ KaTeX Math Engine $\cdot$ Three.js 3D WebGL Graph
};

% ==================== TIER 2: GATEWAY & PERSISTENCE TIER ====================
\draw[rounded corners=4pt, fill=tiergate, draw=tiergateborder, line width=0.8pt] (-88, 30) rectangle (88, 48);
\node[anchor=west, font=\scriptsize\bfseries, text=tiergateborder!90!black] at (-85, 44.5) {GATEWAY \& PERSISTENCE TIER};

\node[cnode=tiergateborder, text width=42mm, minimum height=9.5mm] (redis) at (-56, 38) {
  \textbf{\scriptsize Redis 7.0 / BullMQ}\\[1pt]
  \tiny Distributed Mutex Locks $\cdot$ Priority Queue
};

\node[cnode=tiergateborder, text width=50mm, minimum height=9.5mm] (gateway) at (0, 38) {
  \textbf{\scriptsize Express.js TypeScript Gateway}\\[1pt]
  \tiny JWT Auth $\cdot$ Rate Limiter $\cdot$ SSE / WS Streaming
};

\node[dnode=tiergateborder, minimum width=24mm, minimum height=9.5mm, font=\tiny] (mongo) at (56, 38) {
  \textbf{\scriptsize MongoDB Atlas}\\
  Document Persistence\\
  Audit \& User State
};

% ==================== TIER 3: COGNITIVE AI ENGINE TIER ====================
\draw[rounded corners=4pt, fill=tierfast, draw=tierfastborder, line width=0.8pt] (-88, 8) rectangle (88, 23);
\node[anchor=west, font=\scriptsize\bfseries, text=tierfastborder!90!black] at (-85, 19.5) {COGNITIVE AI ORCHESTRATION TIER};

\node[cnode=tierfastborder, text width=132mm, minimum height=8mm] (fastapi) at (0, 15) {
  \textbf{\scriptsize FastAPI Cognitive Engine (Python 3.12)} \quad
  \tiny LangGraph Multi-Agent Orchestrator $\cdot$ Dynamic Model Fallback: Groq LLaMA $\to$ Gemini Flash $\to$ SambaNova $\to$ GPT-4o
};

% ==================== TIER 4: REASONING, STORAGE & VERIFICATION MESH ====================
\draw[rounded corners=4pt, fill=tierdb, draw=tierdbborder, line width=0.8pt] (-88, -31) rectangle (88, 1);
\node[anchor=west, font=\scriptsize\bfseries, text=tierdbborder!90!black] at (-85, -2.5) {EXECUTION, VECTOR STORAGE \& VERIFICATION MESH};

% Column 1: Ingest & Vector
\node[cnode=tierdbborder, text width=42mm, minimum height=9.5mm] (ingest) at (-56, -11) {
  \textbf{\scriptsize PyMuPDF / pdfplumber}\\[1pt]
  \tiny Layout-Aware Ingestion \& Math Extraction
};
\node[dnode=tierdbborder, minimum width=26mm, minimum height=9.5mm, font=\tiny] (qdrant) at (-56, -23.5) {
  \textbf{\scriptsize Qdrant Vector DB}\\
  Dense HNSW Cosine Index (3072-dim)
};

% Column 2: Agents & Knowledge Graph
\node[cnode=tierfastborder, text width=44mm, minimum height=9.5mm] (agents) at (0, -11) {
  \textbf{\scriptsize 13 Specialized Agents}\\[1pt]
  \tiny Planner, Researcher, Fact-Check, Reviewer...
};
\node[dnode=tierdbborder, minimum width=26mm, minimum height=9.5mm, font=\tiny] (neo4j) at (0, -23.5) {
  \textbf{\scriptsize Neo4j Graph DB}\\
  Entity-Relation Cypher Property Graph
};

% Column 3: FormaTeX & Integrity
\node[cnode=tierfastborder, text width=42mm, minimum height=9.5mm] (formatex) at (56, -11) {
  \textbf{\scriptsize FormaTeX Document Engine}\\[1pt]
  \tiny Automated LaTeX Synthesis \& PDF Engine
};
\node[cnode=tierfastborder, text width=42mm, minimum height=9.5mm] (integrity) at (56, -23.5) {
  \textbf{\scriptsize 11-Phase Integrity Engine}\\[1pt]
  \tiny Winnowing, MinHash, Formula AST TED
};

% ==================== ARROWS: 100% ORTHOGONAL ====================
% Tier 1 <-> Tier 2
\draw[darrow] (client.south) -- node[right, labeltext] {HTTPS / REST / Server-Sent Events} (gateway.north);

% Tier 2 Horizontal Connections
\draw[arrow] (gateway.west) -- node[above, labeltext] {Enqueue Job} (redis.east);
\draw[arrow] (gateway.east) -- node[above, labeltext] {Persist State} (mongo.west);

% Tier 2 -> Tier 3: Three parallel vertical arrows
\draw[arrow] (redis.south) -- node[left, labeltext] {Async Dispatch} (-56, 19);
\draw[darrow] (gateway.south) -- node[right, labeltext] {Task IPC / Streams} (0, 19);
\draw[darrow] (mongo.south) -- node[right, labeltext] {Checkpoints} (56, 19);

% Tier 3 -> Tier 4: Three parallel vertical arrows
\draw[arrow] (-56, 11) -- (ingest.north);
\draw[arrow] (0, 11) -- (agents.north);
\draw[arrow] (56, 11) -- (formatex.north);

% Tier 4 Vertical Connections
\draw[arrow] (ingest.south) -- (qdrant.north);
\draw[darrow] (agents.south) -- (neo4j.north);
\draw[arrow] (formatex.south) -- (integrity.north);

% Tier 4 Horizontal Mesh Connections
\draw[darrow] (agents.west) -- node[above, labeltext] {Vector RAG} (ingest.east);
\draw[arrow] (agents.east) -- node[above, labeltext] {Synthesize} (formatex.west);
\draw[darrow] (neo4j.west) -- node[above, labeltext] {RRF Boost} (qdrant.east);
\draw[darrow] (neo4j.east) -- node[above, labeltext] {Verify Mesh} (integrity.west);

\end{tikzpicture}}
\caption{Distributed architecture of ResearcherGPT across client, gateway, cognitive orchestration, and storage mesh tiers.}
\label{fig:architecture}
\end{figure*}

\end{document}
"""

with open('test_fig1_orthogonal.tex', 'w', encoding='utf-8') as f:
    f.write(tex_code)

res = subprocess.run(['tectonic_bin\\tectonic.exe', 'test_fig1_orthogonal.tex'], capture_output=True, text=True)
print('Tectonic exit:', res.returncode)
if res.returncode == 0:
    doc = fitz.open('test_fig1_orthogonal.pdf')
    pix = doc[0].get_pixmap(dpi=220)
    pix.save('test_fig1_orthogonal.png')
    print('test_fig1_orthogonal.png rendered!')
else:
    print('Error:\n', res.stderr)
