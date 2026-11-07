import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location('transcript_guard', Path(__file__).parents[1]/'transcript_guard.py')
guard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(guard)


class GuardTests(unittest.TestCase):
    def test_adversarial_examples(self):
        fixtures = json.loads((Path(__file__).parent/'adversarial.json').read_text(encoding='utf-8'))
        for fixture in fixtures:
            with self.subTest(case=fixture['id']):
                self.assertEqual(guard.greeting_probe(fixture['text'], fixture['language'])['status'], fixture['expected'])

    def test_english_hi_uses_word_boundaries(self):
        self.assertEqual(guard.greeting_probe('This is John.', 'en')['status'], 'not_supported')
        self.assertEqual(guard.greeting_probe('Shipping. My name is John.', 'en')['status'], 'not_supported')

    def test_nested_export(self):
        self.assertEqual(guard.get_dialogs({'data': {'records': [{'id': 'a'}]}}), [{'id': 'a'}])

    def test_string_timestamps(self):
        for timestamps in [('01:01', '00:59'), ('2026-01-01T00:00:01Z', '2026-01-01T00:00:00Z')]:
            messages = [{'speaker': 'operator', 'text': 'ok', 'timestamp': t} for t in timestamps]
            self.assertIn('out_of_order_timestamp', [f['kind'] for f in guard.transcript_quality(messages)])

    def test_bot_and_customer_not_credited(self):
        data = [{'id': 'a', 'language': 'EN', 'transcript': [
            {'speaker': 'bot', 'text': 'Hello, my name is John.'},
            {'speaker': 'client', 'text': 'Hello, my name is John.'},
            {'speaker': 'operator', 'text': 'Open settings.'}]}]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'test.json'
            path.write_text(json.dumps(data), encoding='utf-8')
            report = guard.summarize_dataset(path)
        self.assertEqual(report['c01_probes'][0]['status'], 'not_supported')
        self.assertEqual(report['c01_probes'][0]['message_index'], 2)

    def test_low_confidence_requires_review(self):
        probe = guard.greeting_probe('Hello, my name is Emma.', 'EN', asr_uncertain=True)
        self.assertEqual(probe['status'], 'needs_review')

    def test_no_confirmed_asr_error_from_fuzzy_brand(self):
        self.assertEqual(guard.greeting_probe('Hello, my name is Emma, Freedom Brocker.', 'EN')['status'], 'supported')
        self.assertNotIn('asr_error', guard.brand_signal('Freedom Brocker'))

    def test_unhashable_export_is_rejected(self):
        with self.assertRaises(ValueError):
            guard.get_dialogs({'data': {'records': 'not an array'}})


if __name__ == '__main__':
    unittest.main()
