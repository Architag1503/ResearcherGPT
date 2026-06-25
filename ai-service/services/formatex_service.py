import os
import re
import time
import requests
from typing import Dict, Any, List, Tuple, Optional

# Base URL and API Key
BASE_URL = "https://api.formatex.io/api/v1"
API_KEY = os.getenv("FORMATEX_API_KEY") or "fex_164debc960d90958825678cd389c9c5296a57fbb91e34957a8ba855ac54b8711"

class FormaTeXService:
    @staticmethod
    def _get_headers() -> Dict[str, str]:
        return {
            "X-API-Key": API_KEY,
            "Content-Type": "application/json"
        }

    @classmethod
    def _call_api(cls, endpoint: str, payload: Dict[str, Any], retries: int = 3, is_binary: bool = False) -> Tuple[Optional[Any], Optional[str]]:
        """
        Executes API calls to FormaTeX.io with automatic retries and failover handling.
        """
        url = f"{BASE_URL}/{endpoint}"
        headers = cls._get_headers()
        
        delay = 1.0
        last_error = None

        for attempt in range(retries):
            try:
                # Timeout of 20 seconds for compilation
                res = requests.post(url, headers=headers, json=payload, timeout=20)
                if res.status_code in (200, 201):
                    if is_binary:
                        return res.content, None
                    return res.json(), None
                else:
                    last_error = f"API returned status {res.status_code}: {res.text}"
            except Exception as e:
                last_error = str(e)
            
            print(f"[FormaTeXService] Attempt {attempt+1} failed: {last_error}. Retrying in {delay}s...")
            time.sleep(delay)
            delay *= 2

        return None, last_error

    @classmethod
    def _compile_project(cls, latex_code: str, engine: str = "pdflatex", smart: bool = False) -> Tuple[Optional[bytes], Optional[str]]:
        import base64
        
        # 1. Start with the main.tex (base64 encoded to avoid payload decode failures)
        main_b64 = base64.b64encode(latex_code.encode("utf-8")).decode("utf-8")
        files = [{
            "path": "main.tex", 
            "data": main_b64,
            "encoding": "base64"
        }]
        
        # 2. Scan for image paths
        # Match e.g. \includegraphics[width=0.85\linewidth]{uploads/napkin_xxx.png} or \includegraphics{uploads/napkin_xxx}
        img_matches = re.findall(r'\\includegraphics(?:\[[^\]]*\])?\{([^\}]+)\}', latex_code)
        
        # We want to keep unique image names to avoid double embedding
        embedded_paths = set()
        
        for img_path in img_matches:
            img_path_clean = img_path.strip()
            if img_path_clean in embedded_paths:
                continue
            
            # Search for local image file
            possible_paths = [
                img_path_clean,
                os.path.join("/usr/src/app", img_path_clean),
                os.path.join(os.getcwd(), img_path_clean)
            ]
            
            # If path has no extension, try common extensions
            _, ext = os.path.splitext(img_path_clean)
            if not ext:
                for candidate_ext in ['.png', '.jpg', '.jpeg', '.pdf']:
                    possible_paths.append(img_path_clean + candidate_ext)
                    possible_paths.append(os.path.join("/usr/src/app", img_path_clean + candidate_ext))
                    possible_paths.append(os.path.join(os.getcwd(), img_path_clean + candidate_ext))
            
            resolved_file = None
            for p in possible_paths:
                if os.path.exists(p) and os.path.isfile(p):
                    resolved_file = p
                    break
            
            if resolved_file:
                try:
                    with open(resolved_file, "rb") as f:
                        b64_content = base64.b64encode(f.read()).decode("utf-8")
                    
                    # Virtual path name inside the LaTeX project compilation
                    virtual_path = img_path_clean
                    if not ext:
                        virtual_path = img_path_clean + os.path.splitext(resolved_file)[1]
                        
                    files.append({
                        "path": virtual_path,
                        "data": b64_content,
                        "encoding": "base64"
                    })
                    embedded_paths.add(img_path_clean)
                    print(f"[FormaTeXService] Successfully embedded image asset: {virtual_path} from {resolved_file}")
                except Exception as ex:
                    print(f"[FormaTeXService] Failed to read/encode asset {img_path_clean}: {ex}")
            else:
                print(f"[FormaTeXService] Asset not resolved locally: {img_path_clean}")

        # Construct payload
        endpoint = "compile/smart" if smart else "compile"
        payload = {
            "latex": latex_code,
            "engine": engine
        }
        if len(files) > 1:
            payload["files"] = files
            payload["main"] = "main.tex"
        
        return cls._call_api(endpoint, payload, is_binary=True)

    @classmethod
    def compile_latex(cls, latex_code: str, engine: str = "pdflatex") -> Tuple[Optional[bytes], List[str]]:
        """
        Compiles LaTeX code into a PDF buffer using FormaTeX API.
        Fails over to a local warning representation if compilation is offline.
        """
        print("[FormaTeXService] Sending compilation request with assets...")
        pdf_bytes, err = cls._compile_project(latex_code, engine, smart=False)
        
        if err:
            print(f"[FormaTeXService] Standard compilation failed: {err}. Trying smart failover...")
            pdf_bytes, err_smart = cls._compile_project(latex_code, engine, smart=True)
            if err_smart:
                print(f"[FormaTeXService] Smart compilation also failed: {err_smart}. Triggering local fallback...")
                return None, [err, err_smart]
        
        return pdf_bytes, []

    @classmethod
    def generate_pdf(cls, latex_code: str) -> Tuple[Optional[bytes], List[str]]:
        """
        Alias method matching interface. Uses smart compile for auto-handling engine selection.
        """
        print("[FormaTeXService] Generating PDF via smart endpoint with assets...")
        pdf_bytes, err = cls._compile_project(latex_code, smart=True)
        if err:
            return None, [err]
        return pdf_bytes, []

    @classmethod
    def validate_formatting(cls, latex_code: str) -> Dict[str, Any]:
        """
        Validates LaTeX formatting structure using the FormaTeX compile check and lint endpoints.
        """
        check_result, check_err = cls._call_api("compile/check", {"latex": latex_code})
        lint_result, lint_err = cls._call_api("lint", {"latex": latex_code})
        
        errors = []
        warnings = []
        is_valid = True

        if check_err:
            warnings.append(f"Validation check failed: {check_err}")
        elif check_result:
            is_valid = check_result.get("valid", True)
            if not is_valid:
                errors.append(check_result.get("error", "Syntax check failed"))

        if lint_err:
            warnings.append(f"Lint analysis failed: {lint_err}")
        elif lint_result:
            lint_items = lint_result.get("warnings", [])
            for item in lint_items:
                warnings.append(f"Line {item.get('line', '?')}: {item.get('message', '')}")

        return {
            "isValid": is_valid and len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "engine": "pdflatex"
        }

    @classmethod
    def generate_compliance_report(cls, latex_code: str, style: str) -> Dict[str, Any]:
        """
        Validates target style document layout parameters, structure, and package imports.
        """
        validation = cls.validate_formatting(latex_code)
        
        # Style specific heuristic checks
        style_rules = {
            "IEEE": {"class": "IEEEtran", "max_authors": 6, "has_keywords": True},
            "Springer": {"class": "sn-jnl", "max_authors": 99, "has_keywords": True},
            "ACM": {"class": "acmart", "max_authors": 10, "has_keywords": True},
            "Elsevier": {"class": "elsarticle", "max_authors": 99, "has_keywords": False},
            "Harvard": {"class": "article", "max_authors": 99, "has_keywords": False},
            "APA": {"class": "article", "max_authors": 99, "has_keywords": False}
        }
        
        rules = style_rules.get(style, style_rules["IEEE"])
        compliance_errors = []
        compliance_warnings = []
        
        # Check document class
        class_match = re.search(r"\\documentclass(?:\[[^\]]*\])?\{([a-zA-Z0-9_-]+)\}", latex_code)
        if class_match:
            detected_class = class_match.group(1)
            if detected_class != rules["class"]:
                compliance_warnings.append(f"Expected document class '{rules['class']}' for style {style}, but detected '{detected_class}'.")
        else:
            compliance_errors.append("Missing \\documentclass definition in LaTeX source.")

        # Check references environment
        if "\\begin{thebibliography}" not in latex_code and "\\bibliography" not in latex_code:
            compliance_errors.append("Missing bibliography environment (thebibliography or external .bib).")

        # Check figures positioning (IEEE/Springer prefer [htbp])
        if "\\begin{figure}" in latex_code and "\\begin{figure}[htbp]" not in latex_code and "\\begin{figure}[h]" not in latex_code:
            compliance_warnings.append("Figures should ideally use explicit positioning qualifiers like [htbp] for optimal formatting.")

        # Compute readiness score
        readiness_score = 100 - (len(validation["errors"]) * 15) - (len(compliance_errors) * 10) - (len(compliance_warnings) * 4) - (len(validation["warnings"]) * 2)
        readiness_score = max(0, min(100, readiness_score))

        return {
            "style": style,
            "readinessScore": readiness_score,
            "isValid": len(compliance_errors) == 0 and validation["isValid"],
            "errors": validation["errors"] + compliance_errors,
            "warnings": validation["warnings"] + compliance_warnings,
            "metrics": {
                "mathEnvironments": latex_code.count("$$") // 2 + latex_code.count("$") // 2,
                "tableEnvironments": latex_code.count("\\begin{table}"),
                "figureEnvironments": latex_code.count("\\begin{figure}")
            }
        }

    # Formatting engines
    @classmethod
    def _parse_manuscript(cls, manuscript: Any) -> Tuple[str, List[Dict[str, str]], List[str]]:
        """
        Parses the input manuscript (JSON dict or raw text/markdown) into standard fields.
        """
        if isinstance(manuscript, dict):
            title = manuscript.get("title", "Untitled Manuscript")
            sections = manuscript.get("sections", [])
            references = manuscript.get("references", [])
            # Map sections
            parsed_sections = []
            for s in sections:
                parsed_sections.append({
                    "title": s.get("title", "Section"),
                    "content": s.get("content", "")
                })
            return title, parsed_sections, references
        
        # If it's a raw string, we treat it as markdown/HTML content
        title = "Untitled Research Paper"
        sections = [{"title": "Content", "content": str(manuscript)}]
        return title, sections, []

    @classmethod
    def _mermaid_to_tikz(cls, mermaid_code: str) -> str:
        """
        Converts Mermaid graph/flowchart syntax to native LaTeX TikZ code.
        """
        import re
        
        # 1. Clean code
        lines = [line.strip() for line in mermaid_code.split('\n') if line.strip()]
        if not lines:
            return ""
            
        # Parse direction
        direction = "LR"
        for line in lines:
            if "graph" in line or "flowchart" in line:
                m_dir = re.search(r'\b(LR|TD|TB|BT|RL)\b', line, re.IGNORECASE)
                if m_dir:
                    direction = m_dir.group(1).upper()
                break
                
        # Parse nodes and labels
        nodes = {}
        connections = []
        
        node_decl_pattern = re.compile(
            r'([a-zA-Z0-9_-]+)\s*(?:\[\"?|\(\[\"?|\(\"?|\{\"?)\s*(.*?)\s*(?:\"?\]\]|\"?\]|\]|\"?\)?\)?|\"?\})'
        )
        
        for line in lines:
            if line.startswith("graph") or line.startswith("flowchart") or line.startswith("style"):
                continue
            # Find all node declarations in this line
            for match in node_decl_pattern.finditer(line):
                node_id, label = match.groups()
                label = label.strip().strip('"\'')
                # Determine shape based on brackets
                shape = "box"
                if "(" in line[match.start():match.end()]:
                    shape = "round"
                nodes[node_id] = {"label": label, "shape": shape}
                
        # 2. Parse connections
        clean_lines = []
        for line in lines:
            if line.startswith("graph") or line.startswith("flowchart") or line.startswith("style"):
                clean_lines.append(line)
                continue
            cleaned = node_decl_pattern.sub(r'\1', line)
            clean_lines.append(cleaned)
            
        conn_pattern = re.compile(
            r'([a-zA-Z0-9_-]+)\s*(?:-->|->|–>|─>)\s*(?:\|([^|]+)\|>?\s*)?\s*([a-zA-Z0-9_-]+)'
        )
        
        for line in clean_lines:
            if line.startswith("graph") or line.startswith("flowchart") or line.startswith("style"):
                continue
            for match in conn_pattern.finditer(line):
                u, lbl, v = match.groups()
                lbl = lbl.strip() if lbl else ""
                connections.append((u, v, lbl))
                # Ensure nodes exist
                if u not in nodes:
                    nodes[u] = {"label": u, "shape": "box"}
                if v not in nodes:
                    nodes[v] = {"label": v, "shape": "box"}
                    
        if not nodes:
            return ""
            
        # 3. Layout Coordinate Assignment (Layering using Topological propagation)
        layer = {nid: 0 for nid in nodes}
        # Run layering propagation (Bellman-Ford style)
        for _ in range(5):
            for u, v, _ in connections:
                # Cycle prevention: propagate layer forward if not feedback loop
                if layer[v] <= layer[u]:
                    layer[v] = layer[u] + 1
                    
        # Shift layers so minimum layer is 0
        if layer:
            min_layer = min(layer.values())
            layer = {nid: lay - min_layer for nid, lay in layer.items()}
            
        # Group nodes by layer
        layer_groups = {}
        for nid, lay in layer.items():
            layer_groups.setdefault(lay, []).append(nid)
            
        # Scale & compute positions
        positions = {}
        for lay, nids in layer_groups.items():
            k = len(nids)
            for i, nid in enumerate(nids):
                # X coordinate based on layer
                x = lay * 3.3
                # Y coordinate spaced vertically
                y = 0.0
                if k > 1:
                    y = (i - (k - 1) / 2.0) * 1.6
                positions[nid] = (x, y)
                
        # 4. Generate TikZ output
        tikz = []
        tikz.append(r"\begin{tikzpicture}[")
        tikz.append(r"  box/.style={draw, fill=indigobg, rectangle, rounded corners, minimum width=2.0cm, minimum height=0.7cm, align=center, text=zinctext, font=\scriptsize, draw=indigostroke, thick},")
        tikz.append(r"  round/.style={draw, fill=purplebg, ellipse, minimum width=2.0cm, minimum height=0.7cm, align=center, text=zinctext, font=\scriptsize, draw=purplestroke, thick},")
        tikz.append(r"  arrow/.style={thick, ->, >=stealth, draw=zincstroke}")
        tikz.append(r"]")
        
        # Colors definition matching Tailwind theme
        tikz.append(r"\definecolor{indigobg}{HTML}{E0E7FF}")
        tikz.append(r"\definecolor{indigostroke}{HTML}{818CF8}")
        tikz.append(r"\definecolor{purplebg}{HTML}{F3E8FF}")
        tikz.append(r"\definecolor{purplestroke}{HTML}{C084FC}")
        tikz.append(r"\definecolor{zincstroke}{HTML}{3F3F46}")
        tikz.append(r"\definecolor{zinctext}{HTML}{18181B}")
        
        # Node placements
        for nid, (x, y) in positions.items():
            node_info = nodes[nid]
            shape = node_info["shape"]
            lbl = node_info["label"]
            # Escape LaTeX characters in label
            lbl = lbl.replace("_", "\\_").replace("&", "\\&").replace("%", "\\%")
            # Replace double backslashes or newlines for multi-line formatting in nodes
            lbl = lbl.replace("\\n", "\\\\ ").replace("\n", "\\\\ ")
            tikz.append(f"\\node ({nid}) [{shape}] at ({x:.2f}, {y:.2f}) {{{lbl}}};")
            
        # Draw connections
        drawn = set()
        for u, v, lbl in connections:
            conn_key = (u, v)
            if conn_key in drawn:
                continue
            drawn.add(conn_key)
            
            lbl_clean = lbl.replace("_", "\\_").replace("&", "\\&").replace("%", "\\%")
            edge_lbl = ""
            if lbl_clean:
                edge_lbl = f"node[above, font=\\tiny, text=zincstroke!80] {{{lbl_clean}}}"
                
            lu = layer[u]
            lv = layer[v]
            
            if lu < lv:
                tikz.append(f"\\draw [arrow] ({u}) -- {edge_lbl} ({v});")
            elif lu == lv:
                tikz.append(f"\\draw [arrow] ({u}) to[bend left=20] {edge_lbl} ({v});")
            else:
                tikz.append(f"\\draw [arrow] ({u}) to[bend right=30] {edge_lbl} ({v});")
                
        tikz.append(r"\end{tikzpicture}")
        return "\n".join(tikz)

    @classmethod
    def _ascii_to_tikz(cls, ascii_text: str) -> str:
        """
        Converts an ASCII flowchart/schematic grid to native TikZ code.
        """
        import re
        lines = [line for line in ascii_text.split('\n') if line.strip()]
        if not lines:
            return ""
            
        # Parse nodes and coordinates
        nodes = []
        node_id_counter = 0
        for r_idx, line in enumerate(lines):
            for match in re.finditer(r'\[([^\]]+)\]', line):
                label = match.group(1).strip()
                label = re.sub(r'[^a-zA-Z0-9\s&\-\(\)]', '', label).strip()
                start, end = match.start(), match.end()
                node_id = f"n{node_id_counter}"
                node_id_counter += 1
                nodes.append({
                    "id": node_id,
                    "label": label,
                    "row": r_idx,
                    "start": start,
                    "end": end
                })
                
        if not nodes:
            return ""
            
        connections = set()
        
        # 1. Horizontal connections
        for r_idx in range(len(lines)):
            line_nodes = [n for n in nodes if n["row"] == r_idx]
            line_nodes.sort(key=lambda x: x["start"])
            
            for i in range(len(line_nodes) - 1):
                n1 = line_nodes[i]
                n2 = line_nodes[i+1]
                mid_text = lines[r_idx][n1["end"]:n2["start"]]
                
                if any(arr in mid_text for arr in ["➔", "-->", "->", "—>", "──>", "►"]):
                    connections.add((n1["id"], n2["id"]))
                elif any(arr in mid_text for arr in ["🠜", "◄", "<--", "<-", "🠜"]):
                    connections.add((n2["id"], n1["id"]))
                    
        # 2. Vertical connections
        vertical_elements = []
        for r_idx, line in enumerate(lines):
            for c_idx, char in enumerate(line):
                if char in ["│", "▼", "|", "v", "V"]:
                    inside_node = False
                    for n in nodes:
                        if n["row"] == r_idx and n["start"] <= c_idx < n["end"]:
                            inside_node = True
                            break
                    if not inside_node:
                        vertical_elements.append((r_idx, c_idx, char))
                        
        node_rows = sorted(list(set(n["row"] for n in nodes)))
        for i in range(len(node_rows) - 1):
            r1 = node_rows[i]
            r2 = node_rows[i+1]
            
            nodes1 = [n for n in nodes if n["row"] == r1]
            nodes2 = [n for n in nodes if n["row"] == r2]
            
            for r in range(r1 + 1, r2):
                elements_in_row = [ve for ve in vertical_elements if ve[0] == r]
                for ve_r, ve_c, ve_char in elements_in_row:
                    closest_n1 = None
                    min_dist1 = 999
                    for n1 in nodes1:
                        dist = min(abs(ve_c - n1["start"]), abs(ve_c - n1["end"]), abs(ve_c - (n1["start"] + n1["end"])/2))
                        if dist < min_dist1:
                            min_dist1 = dist
                            closest_n1 = n1
                            
                    closest_n2 = None
                    min_dist2 = 999
                    for n2 in nodes2:
                        dist = min(abs(ve_c - n2["start"]), abs(ve_c - n2["end"]), abs(ve_c - (n2["start"] + n2["end"])/2))
                        if dist < min_dist2:
                            min_dist2 = dist
                            closest_n2 = n2
                            
                    if closest_n1 and closest_n2 and min_dist1 <= 8 and min_dist2 <= 8:
                        connections.add((closest_n1["id"], closest_n2["id"]))
                        
        # 3. Generate TikZ code
        tikz = []
        tikz.append(r"\begin{tikzpicture}[")
        tikz.append(r"  box/.style={draw, fill=indigobg, rectangle, rounded corners, minimum width=2.0cm, minimum height=0.7cm, align=center, text=zinctext, font=\scriptsize, draw=indigostroke, thick},")
        tikz.append(r"  arrow/.style={thick, ->, >=stealth, draw=zincstroke}")
        tikz.append(r"]")
        
        # Colors definition
        tikz.append(r"\definecolor{indigobg}{HTML}{E0E7FF}")
        tikz.append(r"\definecolor{indigostroke}{HTML}{818CF8}")
        tikz.append(r"\definecolor{zincstroke}{HTML}{3F3F46}")
        tikz.append(r"\definecolor{zinctext}{HTML}{18181B}")
        
        # Layout positions
        for n in nodes:
            x = n["start"] * 0.12
            y = -n["row"] * 0.6
            lbl = n["label"]
            lbl = lbl.replace("_", "\\_").replace("&", "\\&").replace("%", "\\%")
            tikz.append(f"\\node ({n['id']}) [box] at ({x:.2f}, {y:.2f}) {{{lbl}}};")
            
        # Draw arrows
        for u, v in sorted(connections):
            tikz.append(f"\\draw [arrow] ({u}) -- ({v});")
                
        tikz.append(r"\end{tikzpicture}")
        return "\n".join(tikz)

        # 4. Handle ASCII box-drawing or schematic grids in <pre> or <div> blocks (e.g. Methodology Pipeline)
        def replace_ascii_schematic(match):
            block_text = match.group(2).strip()
            clean_text = re.sub(r'<[^>]*>', '\n', block_text)
            clean_text = "\n".join([line.strip() for line in clean_text.split('\n') if line.strip()])
            
            # Check if it has diagram-like elements
            has_schematic = any(c in clean_text for c in ["┌", "─", "┐", "│", "└", "┘", "➔", "──>", "➔", "—>", "➔", "🠜", "🠞", "▼", "◄"])
            if has_schematic:
                # Parse bracketed nodes sequentially
                nodes = re.findall(r'\[([^\]]+)\]', clean_text)
                if len(nodes) >= 2:
                    tikz_code = cls._ascii_to_tikz(clean_text)
                    if tikz_code:
                        fig_env = "figure*" if len(nodes) > 4 else "figure"
                        return f"\n\\begin{{{fig_env}}}[htbp]\n\\centering\n{tikz_code}\n\\caption{{AI Methodology Pipeline Schematic.}}\n\\end{{{fig_env}}}\n"
            
            return f"\n\\begin{{verbatim}}\n{clean_text}\n\\end{{verbatim}}\n"

        content = re.sub(
            r'<(pre|div)[^>]*(?:class=["\'][^"\']*(?:font-mono|leading-relaxed|diagram)[^"\']*["\'])[^>]*>([\s\S]*?)<\/\1>',
            replace_ascii_schematic,
            content,
            flags=re.IGNORECASE
        )

        # 5. Search for any general paragraph containing raw mermaid graph syntax (e.g. starts with graph LR / TD)
        lines = content.split('\n')
        new_lines = []
        in_mermaid = False
        mermaid_lines = []
        
        for line in lines:
            line_strip = line.strip()
            # Clean verbatim strings if any survived
            line_strip = line_strip.replace('\\begin{verbatim}', '').replace('\\end{verbatim}', '').strip()
            
            is_start = re.match(r'^\s*(?:graph\s+(?:TD|LR|TB|BT|RL)|flowchart\s+(?:TD|LR|TB|BT|RL)|sequenceDiagram|classDiagram|stateDiagram)', line_strip, re.IGNORECASE)
            
            if is_start:
                in_mermaid = True
                mermaid_lines.append(line_strip)
            elif in_mermaid:
                has_mermaid_chars = any(c in line_strip for c in ["-->", "->", "–>", "─>", "🠜", "🠞", "[", "]", "(", ")", "{", "}", "|", ":", ";"])
                is_short = len(line_strip) < 120
                if line_strip == "":
                    mermaid_lines.append(line_strip)
                elif has_mermaid_chars or is_short:
                    mermaid_lines.append(line_strip)
                else:
                    in_mermaid = False
                    mermaid_code = "\n".join(mermaid_lines).strip()
                    tikz_code = cls._mermaid_to_tikz(mermaid_code)
                    if tikz_code:
                        nodes_count = len(re.findall(r'([a-zA-Z0-9_-]+)(?:\[|\(|\{)', mermaid_code))
                        fig_env = "figure*" if nodes_count > 4 else "figure"
                        new_lines.append(f"\n\\begin{{{fig_env}}}[htbp]\n\\centering\n{tikz_code}\n\\caption{{System architecture diagram.}}\n\\end{{{fig_env}}}\n")
                    else:
                        new_lines.append(f"\n\\begin{{verbatim}}\n{mermaid_code}\n\\end{{verbatim}}\n")
                    mermaid_lines = []
                    new_lines.append(line)
            else:
                new_lines.append(line)
                
        if mermaid_lines:
            mermaid_code = "\n".join(mermaid_lines).strip()
            tikz_code = cls._mermaid_to_tikz(mermaid_code)
            if tikz_code:
                nodes_count = len(re.findall(r'([a-zA-Z0-9_-]+)(?:\[|\(|\{)', mermaid_code))
                fig_env = "figure*" if nodes_count > 4 else "figure"
                new_lines.append(f"\n\\begin{{{fig_env}}}[htbp]\n\\centering\n{tikz_code}\n\\caption{{System architecture diagram.}}\n\\end{{{fig_env}}}\n")
            else:
                new_lines.append(f"\n\\begin{{verbatim}}\n{mermaid_code}\n\\end{{verbatim}}\n")
                
        content = "\n".join(new_lines)
        return content

    @classmethod
    def _to_clean_latex_text(cls, text: str, style: str = "IEEE") -> str:
        """
        Strips HTML styling tags, parses tables and images with captions, 
        resolves ampersand conflicts, and formats elements cleanly for LaTeX body.
        """
        import html
        
        # Preprocess diagrams, mermaid blocks, and ascii schematics to generate TikZ code
        p = cls._preprocess_diagrams_and_media(text)
        
        # Mask tikz figures to prevent any HTML cleanups or ampersand changes inside them
        tikz_figures = []
        def mask_tikz_fig(m):
            tikz_figures.append(m.group(0))
            return f"TIKZ_FIG_PLACEHOLDER_{len(tikz_figures)-1}"
        
        p = re.sub(r'\\begin\{figure\*?\}(?:\[[^\]]*\])?[\s\S]*?\\end\{figure\*?\}', mask_tikz_fig, p)
        
        # 1. Decode HTML entities and replace less-than/greater-than signs
        p = p.replace('&lt;', '<').replace('&gt;', '>')
        
        # 2. Temporarily mask math blocks to isolate them from plain text ampersand escaping
        math_blocks = []
        def mask_math(m):
            math_blocks.append(m.group(0))
            return f"MATH_BLOCK_PLACEHOLDER_{len(math_blocks)-1}"
        
        p = re.sub(r'\$\$([\s\S]*?)\$\$', mask_math, p)
        p = re.sub(r'\\\[([\s\S]*?)\\\]', mask_math, p)
        
        # 3. Replace all remaining ampersands (&amp; or raw &) in plain text with LaTeX escaped ampersand \&
        p = p.replace('&amp;', r'\&')
        p = p.replace(r'\&', 'TEMP_ESCAPED_AMP')
        p = p.replace('&', r'\&')
        p = p.replace('TEMP_ESCAPED_AMP', r'\&')
        
        # 3b. Restore and clean math blocks (retaining unescaped alignment ampersands)
        for idx, block in enumerate(math_blocks):
            clean_block = block.replace('&amp;', '&').replace(r'\&', '&')
            p = p.replace(f"MATH_BLOCK_PLACEHOLDER_{idx}", clean_block)

        # 4. Replace common inline text formatting tags
        p = p.replace("<br>", " \\\\ ").replace("<br/>", " \\\\ ").replace("<br />", " \\\\ ")
        p = p.replace("<strong>", "\\textbf{").replace("</strong>", "}")
        p = p.replace("<b>", "\\textbf{").replace("</b>", "}")
        p = p.replace("<em>", "\\textit{").replace("</em>", "}")
        p = p.replace("<i>", "\\textit{").replace("</i>", "}")
        p = p.replace("<code>", "\\texttt{").replace("</code>", "}")
        
        # 5. Handle diagram container images with figure captions
        def repl_figure_with_caption(m):
            img_tag = m.group(1)
            caption_html = m.group(2)
            
            caption_text = re.sub(r'</?[a-zA-Z][^>]*>', '', caption_html).strip()
            caption_text = re.sub(r'^Fig\.\s+\d+[:\.]\s*|^Figure\s+\d+[:\.]\s*', '', caption_text, flags=re.IGNORECASE)
            
            src = ""
            src_m = re.search(r'src=["\']([^"\']+)["\']', img_tag, re.IGNORECASE)
            if src_m:
                src = os.path.basename(src_m.group(1))
            
            if not src:
                return ""
            
            tex_fig = []
            tex_fig.append(r"\begin{figure}[htbp]")
            tex_fig.append(r"\centering")
            tex_fig.append(f"\\includegraphics[width=0.85\\linewidth]{{uploads/{src}}}")
            if caption_text:
                tex_fig.append(f"\\caption{{{caption_text}}}")
            tex_fig.append(r"\end{figure}")
            return "\n" + "\n".join(tex_fig) + "\n"

        p = re.sub(
            r'<div[^>]*class=["\']diagram-container[^"\']*["\'][^>]*>\s*(<img[^>]*>)\s*<p[^>]*class=["\']figure-caption["\'][^>]*>([\s\S]*?)<\/p>\s*<\/div>',
            repl_figure_with_caption,
            p,
            flags=re.IGNORECASE
        )

        # 6. Fallback inline images conversion
        def repl_img_fallback(m):
            img_tag = m.group(0)
            alt = "Figure"
            src = ""
            src_m = re.search(r'src=["\']([^"\']+)["\']', img_tag, re.IGNORECASE)
            alt_m = re.search(r'alt=["\']([^"\']+)["\']', img_tag, re.IGNORECASE)
            if src_m:
                src = os.path.basename(src_m.group(1))
            if alt_m:
                alt = alt_m.group(1)
            
            if not src:
                return ""
            return f"\n\\begin{{figure}}[htbp]\n\\centering\n\\includegraphics[width=0.85\\linewidth]{{uploads/{src}}}\n\\caption{{{alt}}}\n\\end{{figure}}\n"
        
        p = re.sub(r'<img[^>]*>', repl_img_fallback, p, flags=re.IGNORECASE)

        # 7. Clean duplicate consecutive table captions
        def clean_duplicate_captions(m):
            captions = re.findall(r'<div[^>]*class=["\']table-caption["\'][^>]*>[\s\S]*?<\/div>', m.group(0), re.IGNORECASE)
            return captions[0] if captions else ""
        p = re.sub(r'(?:<div[^>]*class=["\']table-caption["\'][^>]*>[\s\S]*?<\/div>\s*){2,}', clean_duplicate_captions, p, flags=re.IGNORECASE)

        # 8. Tables conversion with caption grouping
        def repl_table_with_caption(m):
            caption_html = m.group(1)
            tbody = m.group(2)
            
            caption_text = re.sub(r'</?[a-zA-Z][^>]*>', '', caption_html).strip()
            caption_text = re.sub(r'^TABLE\s+[IVXLCDM\d]+[:\.]\s*', '', caption_text, flags=re.IGNORECASE)
            
            rows = re.findall(r'<tr[^>]*>([\s\S]*?)<\/tr>', tbody, re.IGNORECASE)
            if not rows:
                return ""
            
            first_row_cells = re.findall(r'<t[dh][^>]*>([\s\S]*?)<\/t[dh]>', rows[0], re.IGNORECASE)
            col_count = len(first_row_cells)
            align = "c" * col_count
            
            use_star = (col_count > 3) and (style.upper() in ("IEEE", "SPRINGER", "ACM", "ELSEVIER"))
            table_env = "table*" if use_star else "table"
            width_limit = r"\textwidth" if use_star else r"\linewidth"
            
            tex_table = []
            tex_table.append(f"\\begin{{{table_env}}}[htbp]")
            tex_table.append(r"\centering")
            if caption_text:
                tex_table.append(f"\\caption{{{caption_text}}}")
            tex_table.append(f"\\resizebox{{{width_limit}}}{{!}}{{")
            tex_table.append(f"\\begin{{tabular}}{{{align}}}")
            tex_table.append(r"\toprule")
            
            for ri, r in enumerate(rows):
                cells = re.findall(r'<t[dh][^>]*>([\s\S]*?)<\/t[dh]>', r, re.IGNORECASE)
                cleaned_cells = [re.sub(r'</?[a-zA-Z][^>]*>', '', c).strip() for c in cells]
                cleaned_cells = [c.replace('&amp;', r'\&').replace('&', r'\&') for c in cleaned_cells]
                
                if len(cleaned_cells) < col_count:
                    cleaned_cells += [""] * (col_count - len(cleaned_cells))
                
                row_line = " & ".join(cleaned_cells[:col_count]) + r" \\"
                tex_table.append(row_line)
                if ri == 0:
                    tex_table.append(r"\midrule")
                    
            tex_table.append(r"\bottomrule")
            tex_table.append(r"\end{tabular}")
            tex_table.append(r"}")
            tex_table.append(f"\\end{{{table_env}}}")
            return "\n" + "\n".join(tex_table) + "\n"

        p = re.sub(
            r'<div[^>]*class=["\']table-caption["\'][^>]*>([\s\S]*?)<\/div>\s*<table[^>]*>([\s\S]*?)<\/table>',
            repl_table_with_caption,
            p,
            flags=re.IGNORECASE
        )

        # 9. Fallback table conversion for uncaptioned tables
        def repl_table_no_caption(m):
            tbody = m.group(1)
            rows = re.findall(r'<tr[^>]*>([\s\S]*?)<\/tr>', tbody, re.IGNORECASE)
            if not rows:
                return ""
            
            first_row_cells = re.findall(r'<t[dh][^>]*>([\s\S]*?)<\/t[dh]>', rows[0], re.IGNORECASE)
            col_count = len(first_row_cells)
            align = "c" * col_count
            
            use_star = (col_count > 3) and (style.upper() in ("IEEE", "SPRINGER", "ACM", "ELSEVIER"))
            table_env = "table*" if use_star else "table"
            width_limit = r"\textwidth" if use_star else r"\linewidth"
            
            tex_table = []
            tex_table.append(f"\\begin{{{table_env}}}[htbp]")
            tex_table.append(r"\centering")
            tex_table.append(f"\\resizebox{{{width_limit}}}{{!}}{{")
            tex_table.append(f"\\begin{{tabular}}{{{align}}}")
            tex_table.append(r"\toprule")
            
            for ri, r in enumerate(rows):
                cells = re.findall(r'<t[dh][^>]*>([\s\S]*?)<\/t[dh]>', r, re.IGNORECASE)
                cleaned_cells = [re.sub(r'</?[a-zA-Z][^>]*>', '', c).strip() for c in cells]
                cleaned_cells = [c.replace('&amp;', r'\&').replace('&', r'\&') for c in cleaned_cells]
                
                if len(cleaned_cells) < col_count:
                    cleaned_cells += [""] * (col_count - len(cleaned_cells))
                
                row_line = " & ".join(cleaned_cells[:col_count]) + r" \\"
                tex_table.append(row_line)
                if ri == 0:
                    tex_table.append(r"\midrule")
                    
            tex_table.append(r"\bottomrule")
            tex_table.append(r"\end{tabular}")
            tex_table.append(r"}")
            tex_table.append(f"\\end{{{table_env}}}")
            return "\n" + "\n".join(tex_table) + "\n"

        p = re.sub(r'<table[^>]*>([\s\S]*?)<\/table>', repl_table_no_caption, p, flags=re.IGNORECASE)

        # 10. Clean up math double-dollars inside paragraph tags
        p = p.replace("<p>$$", "$$").replace("$$</p>", "$$")
        p = p.replace("<p>\$\$", "$$").replace("\$\$</p>", "$$")

        # 11. Clean up ALL remaining HTML tags safely (to avoid leaving raw div/p tags in final LaTeX)
        p = re.sub(r'</?[a-zA-Z][^>]*>', '', p)
        
        # Restore tikz figures exactly as they were preprocessed
        for idx, block in enumerate(tikz_figures):
            p = p.replace(f"TIKZ_FIG_PLACEHOLDER_{idx}", block)
            
        return p

    @classmethod
    def _build_latex_document(cls, class_header: str, title: str, sections: List[Dict[str, str]], references: List[str], bib_style: str = "", style: str = "IEEE") -> str:
        """
        Assembles sections into a single standard LaTeX string.
        """
        style_upper = style.upper()
        doc = []
        
        abstract_text = ""
        keywords_text = ""

        # Pre-process abstract / keywords if they exist
        for s in sections:
            t = s["title"].strip()
            c = s["content"].strip()
            if t.lower() == 'abstract':
                abstract_text = re.sub(r'<[^>]*>', '', c).strip()
            elif t.lower() in ('keywords', 'key words'):
                keywords_text = re.sub(r'<[^>]*>', '', c).strip()

        # Enforce exact layout headers based on style
        if style_upper == "IEEE":
            doc.append(r"\documentclass[conference]{IEEEtran}")
            doc.append(r"\IEEEoverridecommandlockouts")
            doc.append(r"\usepackage{cite}")
            doc.append(r"\usepackage{amsmath,amssymb,amsfonts}")
            doc.append(r"\usepackage{algorithmic}")
            doc.append(r"\usepackage{graphicx}")
            doc.append(r"\usepackage{textcomp}")
            doc.append(r"\usepackage{xcolor}")
            doc.append(r"\def\BibTeX{{\rm B\kern-.05em{\sc i\kern-.025em b}\kern-.08em T\kern-.1667em\lower.7ex\hbox{E}\kern-.125emX}}")
            # Float layout settings to prevent overlaps
            doc.append(r"\renewcommand{\topfraction}{0.9}")
            doc.append(r"\renewcommand{\bottomfraction}{0.8}")
            doc.append(r"\renewcommand{\textfraction}{0.07}")
            doc.append(r"\renewcommand{\floatpagefraction}{0.7}")
            doc.append(r"\begin{document}")
            doc.append(f"\\title{{{title}}}")
            doc.append(r"\author{")
            doc.append(r"Vishal Srivastav, Archit Gupta, Palak Sharma\\")
            doc.append(r"\textit{Department of Computer Science}\\")
            doc.append(r"\textit{Department of Computer Science, Vivekananda Institute of Professional Studies and Technical Campus}\\")
            doc.append(r"Pitampura, New Delhi, India\\")
            doc.append(r"\{vishal.srivastav, archit.gupta, palak.sharma\}@vips.edu")
            doc.append(r"}")
            doc.append(r"\maketitle")
            if abstract_text:
                doc.append(f"\\begin{{abstract}}\n{abstract_text}\n\\end{{abstract}}")
            if keywords_text:
                doc.append(f"\\begin{{IEEEkeywords}}\n{keywords_text}\n\\end{{IEEEkeywords}}")
 
        elif style_upper == "SPRINGER":
            doc.append(r"\documentclass[pdflatex,sn-mathphys-num]{sn-jnl}")
            doc.append(r"\usepackage{graphicx}")
            doc.append(r"\usepackage{multirow}")
            doc.append(r"\usepackage{amsmath,amssymb,amsfonts}")
            doc.append(r"\usepackage{amsthm}")
            doc.append(r"\usepackage{mathrsfs}")
            doc.append(r"\usepackage[title]{appendix}")
            doc.append(r"\usepackage{xcolor}")
            doc.append(r"\usepackage{textcomp}")
            doc.append(r"\usepackage{manyfoot}")
            doc.append(r"\usepackage{booktabs}")
            doc.append(r"\usepackage{algorithm}")
            doc.append(r"\usepackage{algorithmicx}")
            doc.append(r"\usepackage{algpseudocode}")
            doc.append(r"\usepackage{listings}")
            # Float layout settings to prevent overlaps
            doc.append(r"\renewcommand{\topfraction}{0.9}")
            doc.append(r"\renewcommand{\bottomfraction}{0.8}")
            doc.append(r"\renewcommand{\textfraction}{0.07}")
            doc.append(r"\renewcommand{\floatpagefraction}{0.7}")
            doc.append(r"\begin{document}")
            doc.append(f"\\title[{title}]{{{title}}}")
            doc.append(r"\author*[1]{\fnm{Vishal} \sur{Srivastav}}\email{vishal.srivastav@vips.edu}")
            doc.append(r"\author[1]{\fnm{Archit} \sur{Gupta}}\email{archit.gupta@vips.edu}")
            doc.append(r"\author[1]{\fnm{Palak} \sur{Sharma}}\email{palak.sharma@vips.edu}")
            doc.append(r"\affil*[1]{\orgdiv{Department of Computer Science}, \orgname{Vivekananda Institute of Professional Studies and Technical Campus}, \orgaddress{\street{Pitampura}, \city{New Delhi}, \state{Delhi}, \country{India}}}")
            if abstract_text:
                doc.append(f"\\abstract{{{abstract_text}}}")
            if keywords_text:
                doc.append(f"\\keywords{{{keywords_text}}}")
            doc.append(r"\maketitle")
 
        elif style_upper == "ACM":
            doc.append(r"\documentclass[sigconf]{acmart}")
            doc.append(r"\usepackage{booktabs}")
            doc.append(r"\usepackage{graphicx}")
            doc.append(r"\usepackage{amsmath,amssymb,amsfonts}")
            # Float layout settings to prevent overlaps
            doc.append(r"\renewcommand{\topfraction}{0.9}")
            doc.append(r"\renewcommand{\bottomfraction}{0.8}")
            doc.append(r"\renewcommand{\textfraction}{0.07}")
            doc.append(r"\renewcommand{\floatpagefraction}{0.7}")
            doc.append(r"\begin{document}")
            doc.append(f"\\title{{{title}}}")
            authors_data = [
                ("Vishal Srivastav", "vishal.srivastav@vips.edu"),
                ("Archit Gupta", "archit.gupta@vips.edu"),
                ("Palak Sharma", "palak.sharma@vips.edu")
            ]
            for name, email in authors_data:
                doc.append(f"\\author{{{name}}}")
                doc.append(f"\\email{{{email}}}")
                doc.append(r"\affiliation{%")
                doc.append(r"  \institution{Vivekananda Institute of Professional Studies and Technical Campus}")
                doc.append(r"  \department{Department of Computer Science}")
                doc.append(r"  \city{New Delhi}")
                doc.append(r"  \country{India}")
                doc.append(r"}")
            if abstract_text:
                doc.append(f"\\begin{{abstract}}\n{abstract_text}\n\\end{{abstract}}")
            if keywords_text:
                doc.append(f"\\keywords{{{keywords_text}}}")
            doc.append(r"\maketitle")
 
        elif style_upper == "ELSEVIER":
            doc.append(r"\documentclass[review,3p,times]{elsarticle}")
            doc.append(r"\usepackage{amsmath,amssymb,amsfonts}")
            doc.append(r"\usepackage{graphicx}")
            doc.append(r"\usepackage{booktabs}")
            doc.append(r"\usepackage{hyperref}")
            # Float layout settings to prevent overlaps
            doc.append(r"\renewcommand{\topfraction}{0.9}")
            doc.append(r"\renewcommand{\bottomfraction}{0.8}")
            doc.append(r"\renewcommand{\textfraction}{0.07}")
            doc.append(r"\renewcommand{\floatpagefraction}{0.7}")
            doc.append(r"\begin{document}")
            doc.append(r"\begin{frontmatter}")
            doc.append(f"\\title{{{title}}}")
            doc.append(r"\author[1]{Vishal Srivastav\corref{cor1}}")
            doc.append(r"\ead{vishal.srivastav@vips.edu}")
            doc.append(r"\author[1]{Archit Gupta}")
            doc.append(r"\ead{archit.gupta@vips.edu}")
            doc.append(r"\author[1]{Palak Sharma}")
            doc.append(r"\ead{palak.sharma@vips.edu}")
            doc.append(r"\cortext[cor1]{Corresponding author}")
            doc.append(r"\address[1]{Department of Computer Science, Vivekananda Institute of Professional Studies and Technical Campus, New Delhi, India}")
            if abstract_text:
                doc.append(f"\\begin{{abstract}}\n{abstract_text}\n\\end{{abstract}}")
            if keywords_text:
                doc.append(f"\\begin{{keyword}}\n{keywords_text}\n\\end{{keyword}}")
            doc.append(r"\end{frontmatter}")
 
        elif style_upper == "HARVARD":
            doc.append(r"\documentclass[11pt,a4paper]{article}")
            doc.append(r"\usepackage[margin=1in]{geometry}")  # Standard 1-inch margins
            doc.append(r"\usepackage{natbib}")
            doc.append(r"\usepackage{amsmath,amssymb,amsfonts}")
            doc.append(r"\usepackage{graphicx}")
            doc.append(r"\usepackage{booktabs}")
            doc.append(r"\usepackage{hyperref}")
            doc.append(r"\bibliographystyle{harvard}")
            # Float layout settings to prevent overlaps
            doc.append(r"\renewcommand{\topfraction}{0.9}")
            doc.append(r"\renewcommand{\bottomfraction}{0.8}")
            doc.append(r"\renewcommand{\textfraction}{0.07}")
            doc.append(r"\renewcommand{\floatpagefraction}{0.7}")
            doc.append(r"\begin{document}")
            doc.append(f"\\title{{{title}}}")
            doc.append(r"\author{Vishal Srivastav \and Archit Gupta \and Palak Sharma \\ \small Department of Computer Science \\ \small Vivekananda Institute of Professional Studies and Technical Campus, New Delhi, India \\ \small \texttt{\{vishal.srivastav, archit.gupta, palak.sharma\}@vips.edu}}")
            doc.append(r"\date{}")
            doc.append(r"\maketitle")
            if abstract_text:
                doc.append(f"\\begin{{abstract}}\n{abstract_text}\n\\end{{abstract}}")
            if keywords_text:
                doc.append(f"\n\\noindent \\textbf{{Keywords:}} {keywords_text}\n")
 
        elif style_upper == "APA":
            doc.append(r"\documentclass[12pt,a4paper]{article}")
            doc.append(r"\usepackage[margin=1in]{geometry}")  # Standard 1-inch margins
            doc.append(r"\usepackage{setspace}")
            doc.append(r"\usepackage{amsmath,amssymb,amsfonts}")
            doc.append(r"\usepackage{graphicx}")
            doc.append(r"\usepackage{booktabs}")
            doc.append(r"\usepackage{hyperref}")
            doc.append(r"\doublespacing")
            doc.append(r"\bibliographystyle{apalike}")
            # Float layout settings to prevent overlaps
            doc.append(r"\renewcommand{\topfraction}{0.9}")
            doc.append(r"\renewcommand{\bottomfraction}{0.8}")
            doc.append(r"\renewcommand{\textfraction}{0.07}")
            doc.append(r"\renewcommand{\floatpagefraction}{0.7}")
            doc.append(r"\begin{document}")
            doc.append(f"\\title{{{title}}}")
            doc.append(r"\author{Vishal Srivastav \and Archit Gupta \and Palak Sharma \\ \small Department of Computer Science \\ \small Vivekananda Institute of Professional Studies and Technical Campus, New Delhi, India \\ \small \texttt{\{vishal.srivastav, archit.gupta, palak.sharma\}@vips.edu}}")
            doc.append(r"\date{}")
            doc.append(r"\maketitle")
            if abstract_text:
                doc.append(f"\\begin{{abstract}}\n{abstract_text}\n\\end{{abstract}}")
            if keywords_text:
                doc.append(f"\n\\noindent \\textbf{{Keywords:}} {keywords_text}\n")
 
        else:
            doc.append(class_header)
            doc.append(r"\usepackage[margin=1in]{geometry}")  # Standard 1-inch margins
            doc.append(r"\usepackage{cite}")
            doc.append(r"\usepackage{amsmath,amssymb,amsfonts}")
            doc.append(r"\usepackage{graphicx}")
            doc.append(r"\usepackage{booktabs}")
            doc.append(r"\usepackage{hyperref}")
            # Float layout settings to prevent overlaps
            doc.append(r"\renewcommand{\topfraction}{0.9}")
            doc.append(r"\renewcommand{\bottomfraction}{0.8}")
            doc.append(r"\renewcommand{\textfraction}{0.07}")
            doc.append(r"\renewcommand{\floatpagefraction}{0.7}")
            doc.append(r"\begin{document}")
            doc.append(f"\\title{{{title}}}")
            doc.append(r"\author{Anonymous Authors}")
            doc.append(r"\maketitle")
            if abstract_text:
                doc.append(f"\\begin{{abstract}}\n{abstract_text}\n\\end{{abstract}}")
            if keywords_text:
                doc.append(f"\n\\noindent \\textbf{{Keywords:}} {keywords_text}\n")

        # Inject tikz package and libraries into the preamble
        bg_idx = -1
        for idx, line in enumerate(doc):
            if r"\begin{document}" in line:
                bg_idx = idx
                break
        if bg_idx != -1:
            doc.insert(bg_idx, r"\usepackage{tikz}")
            doc.insert(bg_idx + 1, r"\usetikzlibrary{shapes,arrows,positioning,calc,shapes.geometric,curves}")

        for s in sections:
            t = s["title"].strip()
            c = s["content"].strip()
            if t.lower() in ('title', 'abstract', 'keywords', 'key words', 'references'):
                continue
            
            clean_t = re.sub(r'<[^>]*>', '', t).strip()
            doc.append(f"\n\\section{{{clean_t}}}")
            doc.append(cls._to_clean_latex_text(c, style=style))

        if references:
            doc.append(r"\begin{thebibliography}{99}")
            for r in references:
                clean_ref = re.sub(r'<[^>]*>', '', r).replace('&amp;', '&').strip()
                clean_ref = re.sub(r'^\[\d+\]\s*', '', clean_ref)
                doc.append(f"\\bibitem{{{re.sub(r'[^a-zA-Z0-9]', '', clean_ref[:10])}}}")
                doc.append(clean_ref)
            doc.append(r"\end{thebibliography}")
        elif bib_style and style_upper not in ("HARVARD", "APA"):
            doc.append(f"\\bibliographystyle{{{bib_style}}}")

        doc.append(r"\end{document}")
        return "\n".join(doc)

    @classmethod
    def formatIEEE(cls, manuscript: Any) -> str:
        title, sections, references = cls._parse_manuscript(manuscript)
        header = r"\documentclass[conference]{IEEEtran}"
        return cls._build_latex_document(header, title, sections, references, bib_style="IEEEtran", style="IEEE")

    @classmethod
    def formatSpringer(cls, manuscript: Any) -> str:
        title, sections, references = cls._parse_manuscript(manuscript)
        header = r"\documentclass[sn-mathphys,iicol]{sn-jnl}"
        return cls._build_latex_document(header, title, sections, references, bib_style="sn-mathphys", style="Springer")

    @classmethod
    def formatACM(cls, manuscript: Any) -> str:
        title, sections, references = cls._parse_manuscript(manuscript)
        header = r"\documentclass[sigconf]{acmart}"
        return cls._build_latex_document(header, title, sections, references, bib_style="ACM-Reference-Format", style="ACM")

    @classmethod
    def formatElsevier(cls, manuscript: Any) -> str:
        title, sections, references = cls._parse_manuscript(manuscript)
        header = r"\documentclass[review,3p,times]{elsarticle}"
        return cls._build_latex_document(header, title, sections, references, bib_style="elsarticle-num", style="Elsevier")

    @classmethod
    def formatHarvard(cls, manuscript: Any) -> str:
        title, sections, references = cls._parse_manuscript(manuscript)
        header = r"\documentclass[11pt,a4paper]{article}"
        return cls._build_latex_document(header, title, sections, references, style="Harvard")

    @classmethod
    def formatAPA(cls, manuscript: Any) -> str:
        title, sections, references = cls._parse_manuscript(manuscript)
        header = r"\documentclass[12pt,a4paper]{article}"
        return cls._build_latex_document(header, title, sections, references, style="APA")
