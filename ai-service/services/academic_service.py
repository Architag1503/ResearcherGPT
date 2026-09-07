import os
import re
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional
import requests

OPENALEX_API_KEY = os.getenv("OPENALEX_API_KEY", "")
USER_AGENT = "ResearcherGPT/1.0 (mailto:support@researchergpt.io)"
HEADERS = {"User-Agent": USER_AGENT}


def _clean_text(text: Optional[str]) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def _reconstruct_openalex_abstract(inverted_index: Optional[Dict[str, List[int]]]) -> str:
    if not inverted_index:
        return ""
    words_with_pos = []
    for word, positions in inverted_index.items():
        for pos in positions:
            words_with_pos.append((pos, word))
    words_with_pos.sort(key=lambda x: x[0])
    return " ".join([w[1] for w in words_with_pos])


def search_openalex(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    """
    Search OpenAlex for real peer-reviewed papers and preprints.
    """
    url = f"https://api.openalex.org/works?search={requests.utils.quote(query)}&per_page={limit}"
    if OPENALEX_API_KEY:
        url += f"&api_key={OPENALEX_API_KEY}"

    try:
        resp = requests.get(url, headers=HEADERS, timeout=12)
        if resp.status_code != 200:
            print(f"[academic_service] OpenAlex returned status {resp.status_code}")
            return []

        data = resp.json()
        results = []
        for item in data.get("results", []):
            title = _clean_text(item.get("title"))
            if not title:
                continue

            # Extract authors
            authors = []
            for a in item.get("authorships", []):
                name = a.get("author", {}).get("display_name")
                if name and name.strip():
                    authors.append(name.strip())

            # Publication details
            pub_date = item.get("publication_date") or ""
            pub_year = item.get("publication_year")
            if not pub_year and pub_date:
                try:
                    pub_year = int(pub_date.split("-")[0])
                except Exception:
                    pub_year = 2024
            elif not pub_year:
                pub_year = 2024

            # Journal / Venue / Source
            primary_loc = item.get("primary_location") or {}
            source = primary_loc.get("source") or {}
            journal = source.get("display_name") or ""
            publisher = source.get("host_organization_name") or item.get("publisher") or ""

            # Biblio details
            biblio = item.get("biblio") or {}
            volume = str(biblio.get("volume") or "")
            issue = str(biblio.get("issue") or "")
            first_page = str(biblio.get("first_page") or "")
            last_page = str(biblio.get("last_page") or "")
            pages = f"{first_page}-{last_page}" if first_page and last_page and first_page != last_page else first_page

            # DOI and landing URL
            raw_doi = item.get("doi") or ""
            doi_clean = raw_doi.replace("https://doi.org/", "").strip() if raw_doi else ""
            paper_url = raw_doi or primary_loc.get("landing_page_url") or item.get("open_access", {}).get("oa_url") or ""

            abstract = _reconstruct_openalex_abstract(item.get("abstract_inverted_index"))

            results.append({
                "title": title,
                "authors": authors,
                "year": int(pub_year),
                "publish_date": pub_date,
                "journal": journal,
                "publisher": publisher,
                "volume": volume,
                "issue": issue,
                "pages": pages,
                "doi": doi_clean,
                "url": paper_url,
                "abstract": abstract,
                "source": "OpenAlex"
            })
        return results
    except Exception as e:
        print(f"[academic_service] OpenAlex search error: {e}")
        return []


def search_arxiv(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    """
    Search arXiv for verified research papers and preprints.
    """
    clean_q = re.sub(r"[^\w\s-]", " ", query).strip()
    url = f"https://export.arxiv.org/api/query?search_query=all:{requests.utils.quote(clean_q)}&start=0&max_results={limit}"

    try:
        resp = requests.get(url, headers=HEADERS, timeout=12)
        if resp.status_code != 200:
            print(f"[academic_service] arXiv returned status {resp.status_code}")
            return []

        root = ET.fromstring(resp.text)
        ns = {
            "atom": "http://www.w3.org/2005/Atom",
            "arxiv": "http://arxiv.org/schemas/atom"
        }

        results = []
        for entry in root.findall("atom:entry", ns):
            title_elem = entry.find("atom:title", ns)
            if title_elem is None:
                continue
            title = _clean_text(title_elem.text)

            authors = []
            for author_elem in entry.findall("atom:author", ns):
                name_elem = author_elem.find("atom:name", ns)
                if name_elem is not None and name_elem.text:
                    authors.append(name_elem.text.strip())

            published_elem = entry.find("atom:published", ns)
            pub_date_str = published_elem.text.strip() if published_elem is not None else ""
            pub_date = pub_date_str.split("T")[0] if "T" in pub_date_str else pub_date_str
            pub_year = 2024
            if pub_date:
                try:
                    pub_year = int(pub_date.split("-")[0])
                except Exception:
                    pub_year = 2024

            id_elem = entry.find("atom:id", ns)
            arxiv_url = id_elem.text.strip() if id_elem is not None else ""
            arxiv_id = arxiv_url.split("/abs/")[-1] if "/abs/" in arxiv_url else ""

            doi_elem = entry.find("arxiv:doi", ns)
            doi = doi_elem.text.strip() if doi_elem is not None else (f"arXiv:{arxiv_id}" if arxiv_id else "")

            journal_elem = entry.find("arxiv:journal_ref", ns)
            journal = journal_elem.text.strip() if journal_elem is not None else "arXiv preprint"

            summary_elem = entry.find("atom:summary", ns)
            abstract = _clean_text(summary_elem.text) if summary_elem is not None else ""

            results.append({
                "title": title,
                "authors": authors,
                "year": pub_year,
                "publish_date": pub_date,
                "journal": journal,
                "publisher": "arXiv",
                "volume": f"arXiv:{arxiv_id}" if arxiv_id else "",
                "issue": "",
                "pages": "",
                "doi": doi,
                "url": arxiv_url,
                "abstract": abstract,
                "source": "arXiv"
            })
        return results
    except Exception as e:
        print(f"[academic_service] arXiv search error: {e}")
        return []


def search_crossref(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Search CrossRef for verified scholarly works and DOIs.
    """
    url = f"https://api.crossref.org/works?query={requests.utils.quote(query)}&rows={limit}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=12)
        if resp.status_code != 200:
            return []

        items = resp.json().get("message", {}).get("items", [])
        results = []
        for item in items:
            title_list = item.get("title", [])
            title = _clean_text(title_list[0]) if title_list else ""
            if not title:
                continue

            authors = []
            for a in item.get("author", []):
                given = a.get("given", "").strip()
                family = a.get("family", "").strip()
                name = f"{given} {family}".strip()
                if name:
                    authors.append(name)

            issued = item.get("issued", {}).get("date-parts", [[]])[0]
            pub_year = issued[0] if len(issued) > 0 else 2024
            pub_month = f"{issued[1]:02d}" if len(issued) > 1 else "01"
            pub_day = f"{issued[2]:02d}" if len(issued) > 2 else "01"
            pub_date = f"{pub_year}-{pub_month}-{pub_day}"

            container = item.get("container-title", [])
            journal = container[0] if container else ""
            publisher = item.get("publisher") or ""
            doi = item.get("DOI") or ""
            url_link = f"https://doi.org/{doi}" if doi else ""

            results.append({
                "title": title,
                "authors": authors,
                "year": int(pub_year),
                "publish_date": pub_date,
                "journal": journal,
                "publisher": publisher,
                "volume": str(item.get("volume") or ""),
                "issue": str(item.get("issue") or ""),
                "pages": str(item.get("page") or ""),
                "doi": doi,
                "url": url_link,
                "abstract": _clean_text(item.get("abstract", "")),
                "source": "CrossRef"
            })
        return results
    except Exception as e:
        print(f"[academic_service] CrossRef search error: {e}")
        return []


def generate_citation_styles(citation_data: Dict[str, Any], index: int = 1) -> Dict[str, str]:
    """
    Generate authentic APA, MLA, IEEE, Chicago, Harvard formatted text from verified paper metadata.
    """
    authors = citation_data.get("authors") or []
    year = citation_data.get("year") or 2024
    pub_date = citation_data.get("publish_date") or ""
    title = citation_data.get("title") or "Untitled Work"
    journal = citation_data.get("journal") or ""
    volume = citation_data.get("volume") or ""
    issue = citation_data.get("issue") or ""
    pages = citation_data.get("pages") or ""
    doi = citation_data.get("doi") or ""
    url = citation_data.get("url") or (f"https://doi.org/{doi}" if doi else "")

    # Format author lists for APA / IEEE / MLA
    if not authors:
        authors_apa = "Unknown Author"
        authors_ieee = "Unknown Author"
        authors_mla = "Unknown Author"
    elif len(authors) == 1:
        authors_apa = authors[0]
        authors_ieee = authors[0]
        authors_mla = authors[0]
    elif len(authors) == 2:
        authors_apa = f"{authors[0]}, & {authors[1]}"
        authors_ieee = f"{authors[0]} and {authors[1]}"
        authors_mla = f"{authors[0]}, and {authors[1]}"
    else:
        authors_apa = f"{authors[0]} et al."
        authors_ieee = f"{authors[0]} et al."
        authors_mla = f"{authors[0]}, et al."

    # Venue / Journal fragment
    venue_str = journal if journal else "Academic Press"
    vol_iss_page = ""
    if volume and issue:
        vol_iss_page = f", {volume}({issue})"
    elif volume:
        vol_iss_page = f", {volume}"
    if pages:
        vol_iss_page += f", pp. {pages}"

    doi_str = f" https://doi.org/{doi}" if doi and not doi.startswith("arXiv") else (f" {url}" if url else "")

    # APA 7th
    apa = f"{authors_apa} ({year}). {title}. *{venue_str}*{vol_iss_page}.{doi_str}".strip()

    # MLA 9th
    mla = f'{authors_mla}. "{title}." *{venue_str}*{vol_iss_page}, {year}.{doi_str}'.strip()

    # IEEE
    ieee = f'[{index}] {authors_ieee}, "{title}," *{venue_str}*{vol_iss_page}, {year}.{doi_str}'.strip()

    # Chicago
    chicago = f'{authors_mla} {year}. "{title}." *{venue_str}*{vol_iss_page}.{doi_str}'.strip()

    # Harvard
    harvard = f"{authors_apa} {year}, '{title}', *{venue_str}*{vol_iss_page}.{doi_str}".strip()

    return {
        "apa": apa,
        "mla": mla,
        "ieee": ieee,
        "chicago": chicago,
        "harvard": harvard
    }


def search_academic_papers(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    """
    Unified academic paper retrieval:
    Queries OpenAlex and arXiv, deduplicates results, and constructs rich verified citation objects.
    """
    seen_titles = set()
    combined_papers = []

    # 1. Search OpenAlex
    openalex_papers = search_openalex(query, limit=limit)
    for p in openalex_papers:
        norm_title = re.sub(r"[^\w]", "", p["title"].lower())
        if norm_title and norm_title not in seen_titles:
            seen_titles.add(norm_title)
            combined_papers.append(p)

    # 2. Search arXiv if needed to ensure broad coverage
    if len(combined_papers) < limit:
        arxiv_papers = search_arxiv(query, limit=limit)
        for p in arxiv_papers:
            norm_title = re.sub(r"[^\w]", "", p["title"].lower())
            if norm_title and norm_title not in seen_titles:
                seen_titles.add(norm_title)
                combined_papers.append(p)

    # 3. CrossRef fallback if still sparse
    if len(combined_papers) < limit:
        crossref_papers = search_crossref(query, limit=limit)
        for p in crossref_papers:
            norm_title = re.sub(r"[^\w]", "", p["title"].lower())
            if norm_title and norm_title not in seen_titles:
                seen_titles.add(norm_title)
                combined_papers.append(p)

    # Format citations for all collected papers
    formatted_results = []
    for idx, p in enumerate(combined_papers[:limit]):
        author_last = "Author"
        if p.get("authors"):
            first_author = p["authors"][0]
            author_last = first_author.split(" ")[-1] if " " in first_author else first_author
        author_last = re.sub(r"[^\w]", "", author_last) or "Ref"

        key = f"{author_last}{p['year']}"
        styles = generate_citation_styles(p, index=idx + 1)

        formatted_results.append({
            "key": key,
            "title": p["title"],
            "authors": p["authors"],
            "year": p["year"],
            "publish_date": p.get("publish_date") or str(p["year"]),
            "journal": p.get("journal") or "",
            "volume": p.get("volume") or "",
            "issue": p.get("issue") or "",
            "pages": p.get("pages") or "",
            "publisher": p.get("publisher") or "",
            "doi": p.get("doi") or "",
            "url": p.get("url") or "",
            "abstract": p.get("abstract") or "",
            "apa": styles["apa"],
            "ieee": styles["ieee"],
            "styles": styles
        })

    return formatted_results
