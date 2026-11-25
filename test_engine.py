import dotenv
dotenv.load_dotenv('.env')
import os
import requests

api_key = os.getenv("FORMATEX_API_KEY", "")
base_url = os.getenv("FORMATEX_BASE_URL", "https://api.formatex.io/api/v1")
headers = {"X-API-Key": api_key, "Content-Type": "application/json"}

# Test compile with minimal latex with labels and refs
test_latex = r"""
\documentclass{article}
\begin{document}
\section{First Section}\label{sec:first}
See Section~\ref{sec:first} and Equation~(\ref{eq:one}).
\begin{equation}
E = mc^2 \label{eq:one}
\end{equation}
\end{document}
"""

for ep in ['compile', 'compile/smart']:
    for eng in ['pdflatex', 'latexmk']:
        res = requests.post(f"{base_url}/{ep}", headers=headers, json={"latex": test_latex, "engine": eng}, timeout=20)
        print(f"Endpoint: {ep}, Engine: {eng} -> Status: {res.status_code}, Length: {len(res.content) if res.ok else res.text}")
