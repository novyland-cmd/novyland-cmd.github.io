#!/usr/bin/env python3
"""Vérifications indépendantes du contrat de bibliothèque et des frontières."""

import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path


def validate(path):
    library = json.loads(path.read_text(encoding="utf-8"))
    rows = library["source_lines"]
    index = defaultdict(list)
    keys = set()
    used = []
    for passage in library["passages"]:
        assert isinstance(passage["id"], str), "Identifiant converti en nombre"
        assert passage["key"] not in keys, "Clé de passage répétée"
        keys.add(passage["key"])
        index[passage["id"]].append(passage["key"])
        assert passage["lines"], f'Passage vide : {passage["key"]}'
        assert passage["text"] == "\n".join(rows[i]["text"] for i in passage["lines"])
        source_ids = passage["heading_lines"] + passage["lines"]
        assert source_ids == list(range(source_ids[0], source_ids[-1] + 1)), "Frontière discontinue"
        assert passage["source_pages"] == sorted({rows[i]["page"] for i in source_ids})
        assert source_ids == [i for s in passage["source_segments"] for i in s["lines"]]
        for segment in passage["source_segments"]:
            assert all((rows[i]["page"], rows[i]["column"]) == (segment["page"], segment["column"])
                       for i in segment["lines"])
        for ref in passage["references"]:
            offset = ref["text_offset"]
            assert passage["text"][offset:offset + len(ref["raw_id"])] == ref["raw_id"]
            assert ref["source_line"] == passage["lines"][passage["text"][:offset].count("\n")]
            expected = library["lookup"].get(ref["target_id"], [])
            assert ref["target_keys"] == expected
            assert ref["status"] == ("missing" if not expected else "ambiguous" if len(expected) > 1 else "resolved")
        used.extend(source_ids)
    assert dict(index) == library["lookup"], "Index incohérent"
    for section in library["sections"]:
        used.extend(section["heading_lines"] + section["lines"])
    assert Counter(used) == Counter(range(len(rows))), "Ligne perdue ou répétée"
    assert all(target in index for target in library["aliases"].values())
    assert all("COPYRIGHT 2020 RED RAVEN GAMES" not in p["text"] for p in library["passages"])
    assert [(r["page"], r["column"], r["bbox"][1]) for r in rows] == sorted(
        (r["page"], r["column"], r["bbox"][1]) for r in rows), "Ordre de lecture incohérent"
    # Régressions propres au livret fourni : titres atypiques, identifiants
    # à deux chiffres après le point, passages sur deux pages et épilogue final.
    passages = {p["key"]: p for p in library["passages"]}
    assert len(passages) == 1000
    assert "30.1" in index and "30.10" in index and "30.12" in index
    assert passages["9.2"]["source_pages"] == [7]
    assert passages["9.3"]["source_pages"] == [7, 8]
    assert passages["F20"]["source_pages"] == [153, 154]
    assert passages["14"]["title"] is None
    assert passages["76.2"]["title"] and passages["156.6"]["title"]
    assert library["aliases"]["D1.7"] == "D.I.7"
    assert not any(i in index for i in ("159", "70.8", "F13"))
    assert all(rows[i]["page"] != 1 for p in passages.values() for i in p["lines"])
    print(f'Bibliothèque vérifiée : {len(passages)} passages, {len(rows)} lignes, index et frontières cohérents.')


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("library", type=Path)
    validate(parser.parse_args().library)
