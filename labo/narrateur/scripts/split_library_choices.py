"""Convertit les choix intégrés en passages autonomes avec des renvois ordinaires.

Usage : python3 split_library_choices.py source.json destination.json
Les positions source et celles des renvois comptent les points Unicode.
"""
import argparse
import copy
import json
import re
from pathlib import Path


def split_choices(data):
    if data.get("conversion", {}).get("choice_storage") == "separate-passages":
        raise ValueError("Cette bibliothèque contient déjà des choix séparés.")
    source = copy.deepcopy(data)
    destinations = {}
    used = {p["id"] for p in source["passages"]}
    for passage in source["passages"]:
        choices = passage.get("choices", [])
        grouped = len({c["scope"] for c in choices}) > 1
        for choice in choices:
            label = choice["label"]
            if re.fullmatch(r"[A-Z]", label):
                suffix = label
            elif label in ("Oui", "Non"):
                suffix = label.upper()
            elif "nourriture" in label:
                suffix = "N" + label.split()[0]
            else:
                suffix = "R" + label.upper().replace(" OU PLUS", "PLUS").replace(" À ", "A")
            if grouped:
                suffix = "G" + choice["scope"] + suffix
            identifier = passage["id"] + suffix
            if not re.fullmatch(r"\d+(?:\.\d+)?[A-Z][A-Z0-9]*", identifier) or identifier in used:
                raise ValueError(f"Identifiant de choix incompatible ou répété : {identifier}")
            used.add(identifier)
            destinations[(passage["id"], choice["key"])] = identifier

    output = []
    for original in source["passages"]:
        text = original["text"]
        choices = original.get("choices", [])
        previous_end = 0
        for choice in choices:
            start, end = choice["start_offset"], choice["end_offset"]
            if not (previous_end <= start < end <= len(text)):
                raise ValueError(f"Découpage invalide : {original['id']}")
            previous_end = end

        references = copy.deepcopy(original.get("references", []))
        for ref in original.get("choice_references", []):
            parent = ref.get("target_passage", original["id"])
            target = destinations[(parent, ref["target_key"])]
            references.append({"raw_id": ref["raw_label"], "target_id": target,
                               "status": "resolved", "target_keys": [target],
                               "detection": "explicit", "text_offset": ref["text_offset"]})

        def make_entry(identifier, ranges, choice=None):
            entry = {k: copy.deepcopy(v) for k, v in original.items()
                     if k not in ("choices", "choice_references", "references", "text", "id", "key")}
            entry.update(id=identifier, key=identifier)
            sections = []
            mapped = []
            length = 0
            for start, end in ranges:
                sections.append(text[start:end])
                mapped.append((start, end, length))
                length += end - start
            assembled = "".join(sections)
            leading = len(assembled) - len(assembled.lstrip())
            entry["text"] = assembled.strip()
            if not entry["text"]:
                raise ValueError(f"Passage vide : {identifier}")
            entry["references"] = []
            for ref in references:
                position = ref["text_offset"]
                for start, end, offset in mapped:
                    if start <= position and position + len(ref["raw_id"]) <= end:
                        updated = copy.deepcopy(ref)
                        updated["text_offset"] = position - start + offset - leading
                        if 0 <= updated["text_offset"] <= len(entry["text"]) - len(ref["raw_id"]):
                            entry["references"].append(updated)
                        break
            entry["references"].sort(key=lambda r: r["text_offset"])
            if choice:
                entry.update(parent_id=original["id"], choice_label=choice["label"],
                             source_choice_key=choice["key"],
                             source_text_range=[choice["start_offset"], choice["end_offset"]])
                entry["title"] = f"Choix {choice['label']}"
            return entry

        cursor = 0
        intro = []
        for choice in choices:
            intro.append((cursor, choice["start_offset"]))
            cursor = choice["end_offset"]
        intro.append((cursor, len(text)))
        output.append(make_entry(original["id"], intro))
        for choice in choices:
            start, end = choice["start_offset"], choice["end_offset"]
            prefix = re.match(r"(?:[A-Z]\. |• .+? : )", text[start:end])
            if not prefix:
                raise ValueError(f"Libellé de résultat non reconnu : {original['id']} {choice['key']}")
            output.append(make_entry(destinations[(original["id"], choice["key"])],
                                     [(start + prefix.end(), end)], choice))

    by_id = {p["id"]: p for p in output}
    if len(by_id) != len(output):
        raise ValueError("Doublon après conversion")
    for passage in output:
        for ref in passage["references"]:
            if ref["target_id"] not in by_id:
                raise ValueError(f"Renvoi absent : {ref['target_id']}")
            offset = ref["text_offset"]
            if passage["text"][offset:offset + len(ref["raw_id"])] != ref["raw_id"]:
                raise ValueError(f"Position de renvoi invalide : {passage['id']}")
    source["passages"] = output
    source["conversion"]["choice_storage"] = "separate-passages"
    source["conversion"]["original_passage_count"] = len(data["passages"])
    source["conversion"]["choice_passage_count"] = len(destinations)
    source["conversion"]["notes"] = [n for n in source["conversion"]["notes"]
                                      if "Narration et consignes" not in n]
    source["conversion"]["notes"].append(
        "Les résultats sont des entrées autonomes : suffixe A/B/C/D, OUI/NON, N0/N1/N2/N3 ou R pour un résultat de dé. "
        "Dans 7.2, G1/G2/G4 distingue les groupes qui réutilisent les mêmes lettres. "
        "Le texte d’une entrée de résultat ne répète pas la question du passage parent.")
    return source


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    data = split_choices(json.loads(args.source.read_text()))
    args.destination.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(f"{len(data['passages'])} entrées dont {data['conversion']['choice_passage_count']} résultats de choix.")
