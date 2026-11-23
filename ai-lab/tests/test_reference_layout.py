"""No-network unit tests for exact-character layout prototype."""
import io
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import reference_layout as rl


class ExactCharacterLayoutTests(unittest.TestCase):
    @staticmethod
    def synthetic_character():
        im = Image.new("RGBA", (280, 540), (0, 0, 0, 0))
        draw = ImageDraw.Draw(im)
        draw.rounded_rectangle((65, 40, 215, 520), 30, fill=(65, 72, 111, 255))
        draw.ellipse((85, 0, 195, 145), fill=(232, 235, 242, 255))
        return im

    def test_vertical(self):
        out = rl.compose_character(self.synthetic_character(), "mobile")
        self.assertEqual(out.size, (864, 1536))
        self.assertEqual(out.mode, "RGB")

    def test_horizontal(self):
        out = rl.compose_character(self.synthetic_character(), "desktop")
        self.assertEqual(out.size, (1536, 864))

    def test_unknown_orientation(self):
        with self.assertRaises(ValueError):
            rl.compose_character(self.synthetic_character(), "square")

    @mock.patch.object(rl.requests, "get")
    def test_source_requires_real_transparency(self, getter):
        im = Image.new("RGB", (280, 540), (15, 15, 15))
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        getter.return_value = SimpleNamespace(
            status_code=200, headers={"Content-Type": "image/png"}, content=buf.getvalue()
        )
        with self.assertRaisesRegex(RuntimeError, "lacks transparency"):
            rl.load_full_body()
        self.assertFalse(getter.call_args.kwargs["allow_redirects"])

    def test_default_request_is_disabled(self):
        self.assertEqual(
            {"enabled": False, "pack": "gojo-adult-s1"},
            __import__("json").loads(
                (rl.ROOT/"reference-character"/"layout-request.json").read_text()
            )
        )


if __name__ == "__main__":
    unittest.main()
