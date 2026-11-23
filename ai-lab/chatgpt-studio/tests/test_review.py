import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import review


def make_image(path, size=(941,1672), variant=0, flat=False):
    im = Image.new("RGB", size, (30,30,30))
    if not flat:
        d = ImageDraw.Draw(im)
        w,h = size
        for j in range(0,w,16):
            color = ((j + 31 * variant) % 255, (j*2 + variant*18)%255, (100+j)%255)
            d.rectangle((j,0,min(j+15,w-1),h), fill=color)
        d.ellipse((w//5,h//4,4*w//5,3*h//4), fill=(180,220,255))
    im.save(path,"PNG")


def entry(filename="sample.png", eid="gojo-original"):
    return {
        "id":eid,
        "filename":filename,
        "format":"9:16",
        "concept":"Gojo cinematic rooftop fan art",
        "source":"chatgpt-images",
        "prompt":"A complete original Gojo cinematic wallpaper with an energetic rooftop scene",
        "identity_notes":"Spiky silver hair, black blindfold, dark high-collar uniform, two finger pose."
    }


class ChatGPTStudioTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.inbox=self.root/"inbox"
        self.inbox.mkdir()
        self.out=self.root/"out"
        self.manifest=self.root/"manifest.json"

    def write(self, images):
        self.manifest.write_text(json.dumps({"batch":"gojo-cinematic-01","images":images}))

    def run_review(self):
        return review.run(self.manifest,self.inbox,self.out)

    def test_empty_manifest_is_safe(self):
        self.write([])
        result=self.run_review()
        self.assertEqual(result["status"],"NO_ASSETS")
        self.assertEqual(result["technical_pass_count"],0)
        self.assertFalse(result["website_publishing_enabled"])
        self.assertFalse(result["instagram_publishing_enabled"])

    def test_chatgpt_image_passes_ratio_but_not_artistic_approval(self):
        make_image(self.inbox/"sample.png")
        self.write([entry()])
        result=self.run_review()
        self.assertEqual(result["technical_pass_count"],1)
        self.assertEqual(result["records"][0]["technical"]["width"],941)
        self.assertEqual(result["records"][0]["technical"]["height"],1672)
        self.assertFalse(result["records"][0]["technical"]["manual_identity_approved"])
        self.assertFalse(result["manual_artistic_approval"])
        self.assertTrue((self.out/"review.html").exists())
        self.assertTrue((self.out/"assets"/"sample.png").exists())

    def test_wrong_ratio_is_rejected(self):
        make_image(self.inbox/"sample.png",(1024,1024))
        self.write([entry()])
        result=self.run_review()
        self.assertEqual(result["technical_pass_count"],0)
        self.assertIn("wrong_aspect_ratio",result["records"][0]["technical"]["reasons"])

    def test_flat_image_is_rejected(self):
        make_image(self.inbox/"sample.png",flat=True)
        self.write([entry()])
        result=self.run_review()
        self.assertIn("near_blank",result["records"][0]["technical"]["reasons"])

    def test_duplicates_are_rejected(self):
        make_image(self.inbox/"sample.png")
        make_image(self.inbox/"sample2.png")
        self.write([entry(),entry("sample2.png",eid="gojo-original-two")])
        result=self.run_review()
        self.assertEqual(result["technical_pass_count"],1)
        self.assertIn("near_duplicate",result["records"][1]["technical"]["reasons"])

    def test_untrusted_upload_paths_are_rejected(self):
        for file_name in ("../outside.png","/tmp/foo.png","bad/dir.png","x.svg"):
            with self.subTest(file_name=file_name):
                with self.assertRaises(ValueError):
                    review.validate_entry(entry(file_name))

    def test_untrusted_image_providers_are_rejected(self):
        item=entry()
        item["source"]="third-party-upload"
        with self.assertRaises(ValueError):
            review.validate_entry(item)

    def test_missing_image_never_approved(self):
        self.write([entry()])
        result=self.run_review()
        self.assertEqual(result["technical_pass_count"],0)
        self.assertFalse(result["records"][0]["website_published"])
        self.assertFalse(result["records"][0]["instagram_published"])

    def test_invalid_manifest_rejected(self):
        self.write([entry(),entry()])
        with self.assertRaises(ValueError):
            review.read_manifest(self.manifest)


if __name__=="__main__":
    unittest.main()
