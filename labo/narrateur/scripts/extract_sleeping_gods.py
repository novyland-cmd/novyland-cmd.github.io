#!/usr/bin/env python3
"""Extraction fidèle et audit du livret FR fourni, sans dépendance à une interface."""

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re

import pdfplumber

IDENTIFIER = r"(?:D\.I\.\d+|D\d+(?:\.\d+)?|F\d+|\d+(?:\.\d+)?)"
HEADING = re.compile(rf"^({IDENTIFIER})(?:\s*[—–-]\s*(.+))?$")
REFERENCE = re.compile(
    rf"(?:\b(?:paragraphes?|chapitres?|sections?)\s+|"
    rf"\b(?:va|vas|aller|allez|retourne|retournez|retourner)\s+(?:à|a|au|aux)\s+"
    rf"(?:(?:la|le)\s+)?(?:(?:section|chapitre|paragraphe)s?\s+)?|"
    rf"(?:échec|succès)\s*:\s*|(?:→|➡️?)\s*)({IDENTIFIER})(?!\w|\.\d)", re.I
)
DECIMAL_REFERENCE = re.compile(r"(?<![\w.])(?:D\.I\.\d+|D\d+\.\d+|F\d+|\d+\.\d+)(?!\w)")


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def extract_lines(source):
    rows, cover, page_info = [], [], []
    with pdfplumber.open(source) as pdf:
        cover = (pdf.pages[0].extract_text() or "").splitlines()
        for page_number, page in enumerate(pdf.pages[1:], 2):
            # Le pied de page est identifié par sa position ET son texte,
            # avant le découpage : il traverse la séparation des colonnes.
            footers = [l for l in page.extract_text_lines()
                       if l["top"] > page.height * .9 and
                       l["text"].startswith("COPYRIGHT 2020 RED RAVEN GAMES")]
            if len(footers) != 1:
                raise ValueError(f"Pied de page inattendu, page {page_number}")
            bottom = footers[0]["top"] - 1
            # Les puces de la colonne droite débordent dans la gouttière :
            # le centre géométrique de la page couperait ces symboles en deux.
            midpoint = page.width / 2 - 9
            content_chars = [c for c in page.chars if c["text"].strip()
                             and c["bottom"] <= bottom]
            crossing = [c for c in content_chars if c["x0"] < midpoint < c["x1"]]
            if crossing:
                raise ValueError(f"Caractères à cheval sur les colonnes, page {page_number}")
            assigned_chars = 0
            for column, (left, right) in enumerate(((0, midpoint), (midpoint, page.width)), 1):
                for line in page.crop((left, 0, right, bottom)).extract_text_lines():
                    # pdfplumber répète la même référence de glyphe pour les
                    # caractères PDF à plusieurs points Unicode (fl, ⚔️…).
                    chars = list({id(c): c for c in line["chars"]}.values())
                    assigned_chars += sum(bool(c["text"].strip()) for c in chars)
                    spans = []
                    for char in chars:
                        font = char["fontname"].split("+")[-1]
                        if spans and spans[-1]["font"] == font:
                            spans[-1]["text"] += char["text"]
                        else:
                            spans.append({"text": char["text"], "font": font})
                    rows.append({
                        "index": len(rows), "page": page_number, "column": column,
                        "bbox": [round(line[k], 2) for k in ("x0", "top", "x1", "bottom")],
                        "text": line["text"], "spans": spans,
                    })
            if assigned_chars != len(content_chars):
                raise ValueError(f"Couverture des caractères incomplète, page {page_number}: "
                                 f"{assigned_chars}/{len(content_chars)}")
            page_info.append({"page": page_number, "content_characters": len(content_chars),
                              "assigned_characters": assigned_chars})
    return rows, cover, page_info


def is_display(line):
    return all(s["font"] == "Aptos Display" for s in line["spans"] if s["text"].strip())


def heading_match(line):
    match = HEADING.fullmatch(line["text"])
    # Deux titres du livret sont en gras Calibri, au lieu d'Aptos Display.
    # La condition typographique évite de découper les renvois dans le corps.
    bold = all(s["font"] == "Calibri-Bold" for s in line["spans"] if s["text"].strip())
    return match if match and (is_display(line) or (bold and match[2])) else None


def parse(rows):
    passages, sections, orphaned = [], [], []
    current = None
    section = None
    for line in rows:
        match = heading_match(line)
        if match:
            current = {"id": match[1], "title": match[2], "section": section,
                       "heading_lines": [line["index"]], "lines": []}
            passages.append(current)
        elif is_display(line):
            if line["text"].startswith(("Chapitre ", "Mort —", "Finale —")):
                section = len(sections)
                sections.append({"title": line["text"], "heading_lines": [line["index"]],
                                 "lines": []})
                current = None
            elif current is not None and not current["lines"]:
                current["title"] = " ".join(filter(None, (current["title"], line["text"])))
                current["heading_lines"].append(line["index"])
            elif current is None and section is not None and not sections[section]["lines"]:
                sections[section]["title"] += " " + line["text"]
                sections[section]["heading_lines"].append(line["index"])
            else:
                raise ValueError(f"Titre non classé: {line}")
        elif current is not None:
            current["lines"].append(line["index"])
        elif section is not None:
            sections[section]["lines"].append(line["index"])
        else:
            orphaned.append(line["index"])
    return passages, sections, orphaned


def build(source, output):
    rows, cover, page_info = extract_lines(source)
    passages, sections, orphaned = parse(rows)
    counts = Counter(p["id"] for p in passages)
    index = defaultdict(list)
    for passage in passages:
        heading = rows[passage["heading_lines"][0]]
        passage["key"] = (passage["id"] if counts[passage["id"]] == 1 else
                          f'{passage["id"]}@p{heading["page"]}c{heading["column"]}')
        index[passage["id"]].append(passage["key"])
        passage["text"] = "\n".join(rows[i]["text"] for i in passage["lines"])
        passage["source_pages"] = sorted({rows[i]["page"] for i in
                                          passage["heading_lines"] + passage["lines"]})
        passage["source_segments"] = []
        for i in passage["heading_lines"] + passage["lines"]:
            line = rows[i]
            segments = passage["source_segments"]
            if not segments or (segments[-1]["page"], segments[-1]["column"]) != (line["page"], line["column"]):
                segments.append({"page": line["page"], "column": line["column"], "lines": []})
            segments[-1]["lines"].append(i)
        passage["validation"] = {"status": "automated_checks_only", "issues": []}
    # Alias de notation seulement : aucune invention de texte ni de destination.
    aliases = {"D1." + p["id"].split(".")[-1]: p["id"] for p in passages
               if p["id"].startswith("D.I.")}
    unresolved, ambiguous, reference_candidates = [], [], []
    for passage in passages:
        text = passage["text"]
        references = []
        seen = set()
        # Joindre les lignes pour reconnaître les renvois coupés après « paragraphe ».
        joined = text.replace("\n", " ")
        matches = [(m[1], m.start(1), "explicit") for m in REFERENCE.finditer(joined)]
        matches += [(m[0], m.start(), "identifier_in_text") for m in DECIMAL_REFERENCE.finditer(joined)]
        for raw, offset, detection in sorted(matches, key=lambda m: m[1]):
            if (raw, offset) in seen:
                continue
            seen.add((raw, offset))
            target = aliases.get(raw, raw)
            keys = index.get(target, [])
            status = "missing" if not keys else "ambiguous" if len(keys) > 1 else "resolved"
            reference = {"raw_id": raw, "target_id": target, "status": status,
                         "target_keys": keys, "detection": detection,
                         "text_offset": offset,
                         "source_line": passage["lines"][text[:offset].count("\n")],
                         "context": joined[max(0, offset - 65):offset + len(raw) + 65]}
            references.append(reference)
            issue = {"from": passage["key"], **reference}
            if status == "missing":
                unresolved.append(issue)
            elif status == "ambiguous":
                ambiguous.append(issue)
            if detection != "explicit":
                reference_candidates.append(issue)
        passage["references"] = references
        issues = passage["validation"]["issues"]
        if counts[passage["id"]] > 1:
            issues.append("duplicate_identifier")
        if any(r["status"] == "missing" for r in references):
            issues.append("missing_reference_target")
        if any(r["status"] == "ambiguous" for r in references):
            issues.append("ambiguous_reference_target")
        if issues:
            passage["validation"]["status"] = "review_required"

    gaps = []
    for base in range(1, 224):
        if str(base) not in index:
            gaps.append(str(base))
        children = [int(i.split(".")[1]) for i in index if re.fullmatch(rf"{base}\.\d+", i)]
        if children:
            gaps.extend(f"{base}.{n}" for n in range(1, max(children) + 1) if n not in children)
    finals = [int(i[1:]) for i in index if re.fullmatch(r"F\d+", i)]
    gaps.extend(f"F{n}" for n in range(1, max(finals) + 1) if f"F{n}" not in index)
    assigned = [i for p in passages for i in p["heading_lines"] + p["lines"]]
    assigned += [i for s in sections for i in s["heading_lines"] + s["lines"]]
    coverage = Counter(assigned)
    unassigned = [i for i in range(len(rows)) if not coverage[i]]
    multiply_assigned = [i for i, count in coverage.items() if count != 1]
    glyph_issues = [{"line": r["index"], "page": r["page"], "text": r["text"]}
                    for r in rows if "(cid:" in r["text"] or "\ufffd" in r["text"]
                    or any(0xe000 <= ord(c) <= 0xf8ff for c in r["text"])]
    report = {
        "summary": {"pdf_pages": len(page_info) + 1, "passages": len(passages),
                    "unique_ids": len(index), "sections": len(sections), "content_lines": len(rows),
                    "characters_checked": sum(p["content_characters"] for p in page_info),
                    "duplicate_ids": sum(c > 1 for c in counts.values()),
                    "missing_reference_ids": sorted({r["target_id"] for r in unresolved}),
                    "numbering_gaps": gaps, "unassigned_lines": len(unassigned),
                    "multiply_assigned_lines": len(multiply_assigned),
                    "glyph_issues": len(glyph_issues),
                    "missing_titles_in_source": sum(p["title"] is None for p in passages),
                    "cross_page_passages": sum(len(p["source_pages"]) > 1 for p in passages)},
        "duplicates": {i: keys for i, keys in index.items() if len(keys) > 1},
        "missing_references": unresolved, "ambiguous_references": ambiguous,
        "reference_candidates": reference_candidates, "glyph_issues": glyph_issues,
        "unassigned_lines": unassigned, "multiply_assigned_lines": multiply_assigned,
        "orphaned_lines": orphaned, "page_coverage": page_info,
        "limitations": ["Contrôles structurels automatiques, pas de relecture humaine exhaustive.",
                        "Un trou de numérotation ne prouve pas qu'un passage manque dans l'extraction.",
                        "Les identifiants en doublon restent ambigus ; aucun passage n'est écrasé.",
                        "Les candidats détectés sans verbe de renvoi doivent être interprétés avec prudence."],
    }
    library = {
        "schema_version": 1, "game_id": "sleeping-gods", "language": "fr",
        "source": {"filename": source.name, "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                   "pages": len(page_info) + 1, "page_numbering": "PDF, à partir de 1",
                   "cover_text": cover},
        "extraction": {"tool": "pdfplumber", "version": pdfplumber.__version__,
                       "reading_order": "page, colonne gauche puis droite, haut vers bas",
                       "text_policy": "Lignes, graphies et symboles conservés ; aucune correction éditoriale.",
                       "validation": "automated_checks_only"},
        "aliases": aliases, "lookup": dict(index), "passages": passages,
        "sections": sections, "source_lines": rows,
    }
    output.mkdir(parents=True, exist_ok=True)
    dump(output / "passages.json", library)
    dump(output / "validation.json", report)
    markdown = ["# Sleeping Gods FR — rapport de préparation", "",
                "Extraction locale du livret. Les numéros de page sont ceux du PDF (couverture = 1).", "",
                "## Résultats", ""]
    labels = {
        "pdf_pages": "Pages du PDF", "passages": "Passages extraits", "unique_ids": "Identifiants distincts",
        "sections": "Sections", "content_lines": "Lignes du corps du livret",
        "characters_checked": "Glyphes non blancs contrôlés", "duplicate_ids": "Identifiants en doublon",
        "missing_reference_ids": "Destinations introuvables", "numbering_gaps": "Trous de numérotation",
        "unassigned_lines": "Lignes non affectées", "multiply_assigned_lines": "Lignes affectées plusieurs fois",
        "glyph_issues": "Caractères non décodés détectés", "missing_titles_in_source": "Passages sans titre dans la source",
        "cross_page_passages": "Passages répartis sur plusieurs pages",
    }
    markdown += [f"- {labels[key]} : {', '.join(value) if isinstance(value, list) else value}"
                 for key, value in report["summary"].items()]
    markdown += ["", "## Identifiants répétés", ""]
    for identifier, keys in report["duplicates"].items():
        markdown.append(f"- `{identifier}` : " + ", ".join(f"`{k}`" for k in keys))
    if not report["duplicates"]:
        markdown.append("Aucun doublon de titre de paragraphe détecté.")
    markdown += ["", "## Renvois sans destination unique", "",
                 "Aucune correction automatique n'a été appliquée.", ""]
    for issue in unresolved + ambiguous:
        line = rows[issue["source_line"]]
        state = "introuvable" if issue["status"] == "missing" else "ambigu"
        markdown.append(f'- `{issue["from"]}` → `{issue["raw_id"]}` ({state}, page {line["page"]}, '
                        f'colonne {line["column"]}) : {issue["context"]}')
    markdown += ["", "## Limites", ""] + [f"- {s}" for s in report["limitations"]]
    (output / "rapport.md").write_text("\n".join(markdown) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    if unassigned or multiply_assigned or glyph_issues:
        raise SystemExit("Échec du contrôle de couverture ou de glyphes ; consulter validation.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Livret PDF FR")
    parser.add_argument("--output", type=Path,
                        default=Path(__file__).resolve().parents[1] / ".local" / "sleeping-gods-fr")
    args = parser.parse_args()
    build(args.source, args.output)
