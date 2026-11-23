import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import live_run


class RequestTests(unittest.TestCase):
    def run_with(self, payload):
        with tempfile.TemporaryDirectory() as td:
            file = Path(td) / "request.json"
            file.write_text(json.dumps(payload), encoding="utf-8")
            return live_run.run_request(file)

    @mock.patch.object(live_run.lab, "run_generate")
    def test_default_disarmed(self, generate):
        result = self.run_with({
            "enabled": False, "model": "klein",
            "count": 1, "max_neurons": 900, "mobile_only": False,
        })
        self.assertEqual(result, 0)
        generate.assert_not_called()

    @mock.patch.object(live_run.lab, "run_generate", return_value=0)
    def test_explicit_armed_request(self, generate):
        result = self.run_with({
            "enabled": True, "model": "klein",
            "count": 1, "max_neurons": 800, "mobile_only": True,
        })
        self.assertEqual(result, 0)
        self.assertTrue(generate.call_args.args[0].confirm_free_quota)
        generate.assert_called_once()

    def test_extra_keys_rejected(self):
        with self.assertRaises(ValueError):
            self.run_with({
                "enabled": False, "model": "klein", "count": 1,
                "max_neurons": 900, "mobile_only": False,
                "publish_to_instagram": True,
            })

    def test_run_budget_capped(self):
        with self.assertRaises(ValueError):
            self.run_with({
                "enabled": True, "model": "klein", "count": 1,
                "max_neurons": 1200, "mobile_only": False,
            })

    def test_count_capped(self):
        with self.assertRaises(ValueError):
            self.run_with({
                "enabled": True, "model": "klein", "count": 12,
                "max_neurons": 900, "mobile_only": False,
            })


if __name__ == "__main__":
    unittest.main()
