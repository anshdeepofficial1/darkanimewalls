"""Tests for ephemeral official Gojo source ingestion; no network or inference."""
import io
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import reference_character as rc


class OfficialReferencesTests(unittest.TestCase):
    def test_two_verified_source_packs(self):
        s1 = rc.load_pack("gojo-adult-s1")
        s2 = rc.load_pack("gojo-young-s2")
        self.assertEqual(len(s1["references"]), 2)
        self.assertEqual(len(s2["references"]), 2)
        self.assertIn("blindfold", " ".join(s1["identity_anchors"]))
        self.assertIn("sunglasses", " ".join(s2["identity_anchors"]))

    def test_source_allowlist_rejects_host_and_redirects(self):
        for url in (
            "http://jujutsukaisen.jp/images/chara_detail4.png",
            "https://malicious.site/images/chara_detail4.png",
            "https://jujutsukaisen.jp.evil.com/images/chara_detail4.png",
            "https://jujutsukaisen.jp/anything.png",
            "https://jujutsukaisen.jp/images/chara_detail4.svg",
            "https://jujutsukaisen.jp/images/chara_detail4.png?x=1",
        ):
            with self.subTest(url=url), self.assertRaises(ValueError):
                rc.validate_url(url)

    def test_unknown_pack_not_allowed(self):
        with self.assertRaises(ValueError):
            rc.load_pack("random-unsourced-image-pack")

    def test_reference_is_private_512_png(self):
        source = Image.new("RGBA", (720, 940), (30, 44, 88, 180))
        data = io.BytesIO()
        source.save(data, "PNG")
        reference = rc.prepare_reference(data.getvalue())
        result = Image.open(io.BytesIO(reference))
        self.assertEqual(result.size, (512, 512))
        self.assertEqual(result.format, "PNG")

    def test_missing_or_tiny_image_rejected(self):
        with self.assertRaises(RuntimeError):
            rc.prepare_reference(b"not an image")
        tiny = Image.new("RGB", (32, 32), "white")
        out = io.BytesIO()
        tiny.save(out, "PNG")
        with self.assertRaises(RuntimeError):
            rc.prepare_reference(out.getvalue())

    @mock.patch.object(rc.requests, "get")
    def test_fetch_never_persists_sources(self, getter):
        src = Image.new("RGB", (200, 200), (80, 40, 30))
        buff = io.BytesIO()
        src.save(buff, "PNG")
        getter.return_value = SimpleNamespace(
            status_code=200,
            content=buff.getvalue(),
            headers={"Content-Type": "image/png"}
        )
        refs = rc.fetch_reference_images(rc.load_pack("gojo-adult-s1"))
        self.assertEqual(len(refs), 2)
        self.assertEqual(getter.call_count, 2)
        self.assertFalse(any(Path(rc.ROOT).glob("official*.png")))
        for call in getter.call_args_list:
            self.assertEqual(call.kwargs["allow_redirects"], False)

    def test_prompt_is_identity_specific_not_mixed(self):
        s1 = rc.identity_prompt(rc.load_pack("gojo-adult-s1"), "mobile")
        s2 = rc.identity_prompt(rc.load_pack("gojo-young-s2"), "desktop")
        self.assertIn("black blindfold", s1)
        self.assertNotIn("round indigo-blue sunglasses", s1)
        self.assertIn("round indigo-blue sunglasses", s2)
        self.assertIn("new composition", s2.lower())
        self.assertIn("one character", s1)


if __name__ == "__main__":
    unittest.main()
