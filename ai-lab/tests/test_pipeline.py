"""Integration tests with deterministic local pixels; NEVER public wallpaper samples."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lab
from PIL import Image
from io import BytesIO


def patterned_png(width, height, flat=False):
    image = Image.new("RGB", (width, height), (6, 6, 6))
    if not flat:
        # Test fixture geometry, not artwork to be shown to the user.
        for x in range(0, width, 29):
            for y in range(0, height, 29):
                color = ((x * 3 + y) % 256, (y * 5 + x) % 256, (x * 7 + y * 3) % 256)
                for xx in range(x, min(x + 29, width)):
                    for yy in range(y, min(y + 29, height)):
                        image.putpixel((xx, yy), color)
    stream = BytesIO()
    image.save(stream, format="PNG")
    return stream.getvalue()


class LabPipelineTests(unittest.TestCase):
    def setUp(self):
        self.output_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.output_dir.cleanup)
        self.out = Path(self.output_dir.name)
        self.env = mock.patch.dict(
            lab.os.environ, {"CF_ACCOUNT_ID": "fake-test-account", "CF_API_TOKEN": "fixture-token"}
        )
        self.env.start()
        self.addCleanup(self.env.stop)
        self.out_patch = mock.patch.object(lab, "OUT", self.out)
        self.out_patch.start()
        self.addCleanup(self.out_patch.stop)
        self.args = SimpleNamespace(
            confirm_free_quota=True, model="klein", count=1,
            mobile_only=False, max_neurons=900,
        )

    def test_pair_creates_private_manifest_and_gallery(self):
        seen = []
        def fake_infer(job, account, token, *, reference_image=None):
            seen.append((job["orientation"], reference_image is not None))
            return patterned_png(job["width"], job["height"])
        with mock.patch.object(lab, "infer", side_effect=fake_infer):
            self.assertEqual(lab.run_generate(self.args), 0)
        self.assertEqual(seen, [("mobile", False), ("desktop", True)])
        self.assertTrue((self.out / "review.html").exists())
        report = json.loads((self.out / "manifest.json").read_text())
        self.assertEqual(report["status"], "UNREVIEWED")
        self.assertEqual(len(report["records"]), 2)
        self.assertTrue(all(not x["website_published"] for x in report["records"]))
        self.assertTrue(all(not x["instagram_published"] for x in report["records"]))
        self.assertTrue(all(not x["quality"]["manual_visual_approval"] for x in report["records"]))
        self.assertTrue(all(x["quality"]["accepted"] for x in report["records"]))

    def test_failed_mobile_blocks_desktop_model_call(self):
        with mock.patch.object(lab, "infer", return_value=patterned_png(864, 1536, flat=True)) as infer:
            with self.assertRaisesRegex(RuntimeError, "refusing to generate"):
                lab.run_generate(self.args)
        self.assertEqual(infer.call_count, 1)
        report = json.loads((self.out / "manifest.json").read_text())
        self.assertEqual(len(report["records"]), 1)
        self.assertFalse(report["records"][0]["quality"]["accepted"])


if __name__ == "__main__":
    unittest.main()
