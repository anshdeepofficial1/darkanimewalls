import base64
import io
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lab

from PIL import Image


def png(width=864, height=1536, *, variant=0, flat=False):
    if flat:
        image = Image.new("RGB", (width, height), (15, 15, 15))
    else:
        image = Image.new("RGB", (width, height))
        px = image.load()
        for y in range(height):
            for x in range(width):
                px[x, y] = (
                    (x // 3 + variant * 13) % 256,
                    (y // 5 + variant * 17) % 256,
                    (x // 9 + y // 7 + variant * 19) % 256,
                )
    out = io.BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


class PlanTests(unittest.TestCase):
    def test_dimensions_are_exact(self):
        self.assertEqual(lab.DIMENSIONS["mobile"][0] * 16, lab.DIMENSIONS["mobile"][1] * 9)
        self.assertEqual(lab.DIMENSIONS["desktop"][0] * 9, lab.DIMENSIONS["desktop"][1] * 16)

    def test_pair_plan_and_budget(self):
        result = lab.plan("klein", 3)
        self.assertEqual(result["candidate_count"], 6)
        self.assertTrue(result["within_free_allowance_if_no_other_usage"])
        self.assertFalse(result["website_uploads_enabled"])
        self.assertFalse(result["instagram_publishing_enabled"])
        self.assertEqual([x["orientation"] for x in result["jobs"]][:2], ["mobile", "desktop"])
        self.assertTrue(result["jobs"][1]["reference_from_mobile"])
        self.assertIn("Gojo", result["jobs"][0]["prompt"])

    def test_20_image_plan(self):
        # Full daily batch in the future is 10 concepts, not presently in concept bank.
        with self.assertRaises(ValueError):
            lab.plan("klein", 10)

    def test_lucid_has_expensive_estimate(self):
        self.assertGreater(
            lab.estimate_neurons("lucid", 864, 1536),
            lab.estimate_neurons("klein", 864, 1536),
        )

    def test_unsupported_model(self):
        with self.assertRaises(ValueError):
            lab.estimate_neurons("paid_unknown_model", 864, 1536)

    def test_bad_counts(self):
        with self.assertRaises(ValueError):
            lab.plan("klein", 0)
        with self.assertRaises(ValueError):
            lab.plan("klein", 100)


class ImageValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.good = png()

    def test_valid_image(self):
        result = lab.inspect_image(self.good, (864, 1536))
        self.assertTrue(result["accepted"])
        self.assertFalse(result["manual_visual_approval"])

    def test_wrong_dimension(self):
        result = lab.inspect_image(self.good, (1536, 864))
        self.assertFalse(result["accepted"])
        self.assertIn("wrong_dimensions", result["reasons"])

    def test_near_duplicate(self):
        first = lab.inspect_image(self.good, (864, 1536))
        result = lab.inspect_image(self.good, (864, 1536), [int(first["dhash"], 16)])
        self.assertFalse(result["accepted"])
        self.assertIn("near_duplicate", result["reasons"])

    def test_blank_rejected(self):
        result = lab.inspect_image(png(flat=True), (864, 1536))
        self.assertIn("near_blank_or_flat", result["reasons"])

    def test_bad_bytes(self):
        result = lab.inspect_image(b"not an image", (864, 1536))
        self.assertFalse(result["accepted"])

    def test_review_never_claims_published(self):
        record = [{
            "concept": "test",
            "orientation": "mobile",
            "model": "test",
            "file": "test.png",
            "quality": {"accepted": True},
        }]
        with tempfile.TemporaryDirectory() as tmp:
            lab.make_review(record, Path(tmp))
            doc = (Path(tmp) / "review.html").read_text()
            self.assertIn("UNPUBLISHED", doc)
            self.assertIn("human review needed", doc)


class APITests(unittest.TestCase):
    def test_decode_cloudflare_base64(self):
        image = png(20, 20, variant=1)
        response = SimpleNamespace(
            headers={"content-type": "application/json"},
            json=lambda: {"success": True, "result": {"image": base64.b64encode(image).decode()}},
        )
        self.assertEqual(lab.extract_image(response), image)

    @mock.patch.object(lab.requests, "post")
    def test_klein_uses_multipart_reference(self, post):
        binary = b"\x89PNGTEST"
        post.return_value = SimpleNamespace(
            status_code=200,
            headers={"content-type": "image/png"},
            content=binary,
            raise_for_status=lambda: None,
        )
        job = lab.plan("klein", 1)["jobs"][1]
        result = lab.infer(job, "account", "token", reference_image=b"REF")
        self.assertEqual(result, binary)
        call = post.call_args
        self.assertIn("input_image_0", call.kwargs["files"])
        self.assertEqual(call.kwargs["files"]["input_image_0"][1], b"REF")
        self.assertNotIn("json", call.kwargs)

    @mock.patch.object(lab.requests, "post")
    def test_lucid_uses_json_and_never_implicit_fallback(self, post):
        post.return_value = SimpleNamespace(
            status_code=403, headers={}, raise_for_status=lambda: None
        )
        job = lab.plan("lucid", 1)["jobs"][0]
        with self.assertRaisesRegex(RuntimeError, "denied model access"):
            lab.infer(job, "account", "token")
        self.assertEqual(post.call_count, 1)

    @mock.patch.object(lab.requests, "post")
    def test_missing_secrets_fails_without_inference(self, post):
        args = SimpleNamespace(confirm_free_quota=True, model="klein", count=1,
                               mobile_only=True, max_neurons=900)
        with mock.patch.dict(lab.os.environ, {"CF_ACCOUNT_ID": "", "CF_API_TOKEN": ""}):
            with self.assertRaisesRegex(RuntimeError, "Missing CF_"):
                lab.run_generate(args)
        post.assert_not_called()

    @mock.patch.object(lab.requests, "post")
    def test_run_limit_blocks_calls(self, post):
        args = SimpleNamespace(confirm_free_quota=True, model="lucid", count=1,
                               mobile_only=True, max_neurons=25)
        with mock.patch.dict(lab.os.environ, {"CF_ACCOUNT_ID": "account", "CF_API_TOKEN": "token"}):
            with self.assertRaisesRegex(RuntimeError, "exceed"):
                lab.run_generate(args)
        post.assert_not_called()

    @mock.patch.object(lab.requests, "post")
    def test_requires_explicit_inference_confirmation(self, post):
        args = SimpleNamespace(confirm_free_quota=False)
        with self.assertRaisesRegex(RuntimeError, "confirm-free-quota"):
            lab.run_generate(args)
        post.assert_not_called()


if __name__ == "__main__":
    unittest.main()
