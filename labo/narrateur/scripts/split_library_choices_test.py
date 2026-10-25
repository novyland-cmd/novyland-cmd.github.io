import unittest

from split_library_choices import split_choices


class SplitChoicesTest(unittest.TestCase):
    def test_unicode_results_and_nested_reference(self):
        text = "🪵 Choisissez A ou B.\n\nA. Recevez 1 bois.\n\nB. Lisez l’option A."
        start_a = text.index("A.")
        start_b = text.index("\n\nB.") + 2
        source = {"schema_version": 1, "game_id": "test", "conversion": {"notes": []}, "passages": [{
            "id": "12.2", "key": "12.2", "title": None, "text": text, "source_pages": [1],
            "choices": [
                {"key": "1-A", "label": "A", "scope": "1", "start_offset": start_a, "end_offset": start_b},
                {"key": "1-B", "label": "B", "scope": "1", "start_offset": start_b, "end_offset": len(text)},
            ],
            "choice_references": [
                {"raw_label": "A", "target_key": "1-A", "text_offset": text.index("A ou")},
                {"raw_label": "B", "target_key": "1-B", "text_offset": text.index("B.")},
                {"raw_label": "A", "target_key": "1-A", "text_offset": text.rindex("A")},
            ],
        }]}
        result = split_choices(source)
        passages = {p["id"]: p for p in result["passages"]}
        self.assertEqual(passages["12.2"]["text"], "🪵 Choisissez A ou B.")
        self.assertEqual(passages["12.2A"]["text"], "Recevez 1 bois.")
        self.assertEqual(passages["12.2B"]["text"], "Lisez l’option A.")
        self.assertEqual(passages["12.2B"]["references"][0]["target_id"], "12.2A")
        self.assertEqual(passages["12.2B"]["references"][0]["text_offset"], 15)
        self.assertEqual(passages["12.2A"]["source_pages"], [1])
        self.assertEqual(source["passages"][0]["text"], text)
        with self.assertRaises(ValueError):
            split_choices(result)


if __name__ == "__main__":
    unittest.main()
