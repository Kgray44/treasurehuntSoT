"""Actual retained compiled icon inputs; no credentials, network or Mac needed."""
import hashlib
import json
from pathlib import Path
import shutil
import struct
import tempfile
import unittest
import zlib

from release_proof import (APPROVED_ICON_SHA256, DEBUG_ONLY_MARKERS, ENCODINGS,
                           ICON_RESOURCES, ReleaseProofError, decode_png,
                           encode_preview, scan_release_executable, verify_release_app)


ROOT = Path(__file__).resolve().parents[3]
RETAINED = ROOT / "Development_Docs/Projects/Project_Parallax/evidence/ncl01-testflight-20261019/signed-39521997164/compiled-icons"
CANDIDATE = "5c79701f027a7e035a1a486f96db182e24f25942"
MACHO = b"\xcf\xfa\xed\xfe" + bytes(124)


class TestReleaseProof(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.app = self.root / "archive/Products/Applications/LandfallCompanion.app"
        self.app.mkdir(parents=True)
        self.public = self.root / "public"
        for relative in ("native/ios/Branding/VoyageWright-Logo.official.png",
                         "native/ios/LandfallCompanion/Assets.xcassets/AppIcon.appiconset/AppIcon.png",
                         "native/ios/LandfallCompanion/Assets.xcassets/AppIcon.appiconset/Contents.json"):
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, target)
        (self.app / "LandfallCompanion").write_bytes(MACHO)
        for name in ICON_RESOURCES:
            shutil.copyfile(RETAINED / name, self.app / name)

    def verify(self):
        return verify_release_app(self.root, self.app, "LandfallCompanion", CANDIDATE, self.public)

    def test_actual_approved_cgbi_resources_match_independent_retained_lossless_previews(self):
        for name, side in ICON_RESOURCES.items():
            original = (RETAINED / name).read_bytes()
            preview = (RETAINED / f"{name}.preview.png").read_bytes()
            decoded = decode_png(original)
            self.assertEqual(decoded[:2], (side, side))
            self.assertTrue(decoded[3])
            self.assertEqual(decoded[:3], decode_png(preview)[:3])

    def test_captures_actual_pixels_with_hashes_but_does_not_invent_artwork_approval(self):
        proof = self.verify()
        self.assertEqual(proof["candidateSha"], CANDIDATE)
        self.assertEqual(proof["approvedSourcePngSha256"], APPROVED_ICON_SHA256)
        self.assertEqual(proof["compiledArtworkFidelity"], "INDEPENDENT_VISUAL_REVIEW_REQUIRED")
        self.assertFalse(proof["automaticCrossResolutionOrColorToleranceClaimed"])
        self.assertFalse(proof["proofExportsArchiveExecutableOrSigningMaterial"])
        self.assertFalse((self.public / "LandfallCompanion").exists())
        for entry in proof["compiledIcons"]:
            captured = (self.public / entry["preview"]).read_bytes()
            self.assertEqual(hashlib.sha256(captured).hexdigest(), entry["previewSha256"])
            pixels = decode_png(captured)
            self.assertEqual(hashlib.sha256(pixels[2]).hexdigest(), entry["normalizedRgbaSha256"])
            self.assertEqual(pixels[:3], decode_png((self.app / entry["resource"]).read_bytes())[:3])

    def test_debug_enablement_in_any_scanned_encoding_fails_before_any_icon_publication(self):
        for encoding in ENCODINGS:
            for marker in DEBUG_ONLY_MARKERS.values():
                (self.app / "LandfallCompanion").write_bytes(MACHO + marker.encode(encoding))
                with self.assertRaisesRegex(ReleaseProofError, "RELEASE_DEBUG_FIXTURE_ENTRYPOINT_PRESENT"):
                    self.verify()
                self.assertFalse(self.public.exists())
        scan = scan_release_executable(MACHO + b"parallax-interaction\0softwareFixture")
        self.assertEqual(scan["matchedMarkerCount"], 0)
        self.assertFalse(scan["allFixtureCodeOrProtocolStringsAbsentClaimed"])

    def test_changed_approved_source_fails_even_with_retained_valid_compiled_icons(self):
        source = self.root / "native/ios/LandfallCompanion/Assets.xcassets/AppIcon.appiconset/AppIcon.png"
        source.write_bytes(b"different artwork")
        with self.assertRaisesRegex(ReleaseProofError, "APPROVED_ICON_SOURCE_MISMATCH"):
            self.verify()
        self.assertFalse(self.public.exists())

    def test_wrong_size_or_solid_compiled_icon_cannot_be_called_pixel_proof(self):
        name = next(iter(ICON_RESOURCES))
        (self.app / name).write_bytes(encode_preview(2, 2, bytes((10, 20, 30, 255)) * 4))
        with self.assertRaisesRegex(ReleaseProofError, "COMPILED_ICON_DIMENSIONS_MISMATCH"):
            self.verify()
        side = ICON_RESOURCES[name]
        (self.app / name).write_bytes(encode_preview(side, side, bytes((10, 20, 30, 255)) * side * side))
        with self.assertRaisesRegex(ReleaseProofError, "COMPILED_ICON_EMPTY_OR_SOLID"):
            self.verify()
        self.assertFalse(self.public.exists())

    def test_catalog_cannot_select_other_artwork_while_approved_file_remains_present(self):
        catalog = self.root / "native/ios/LandfallCompanion/Assets.xcassets/AppIcon.appiconset/Contents.json"
        changed = json.loads(catalog.read_text(encoding="utf-8"))
        changed["images"][0]["filename"] = "other-artwork.png"
        catalog.write_text(json.dumps(changed), encoding="utf-8")
        with self.assertRaisesRegex(ReleaseProofError, "APPROVED_ICON_CATALOG_MAPPING_MISMATCH"):
            self.verify()
        self.assertFalse(self.public.exists())

    def test_actual_changed_pixels_are_captured_without_source_hash_becoming_fidelity_approval(self):
        name = next(iter(ICON_RESOURCES))
        width, height, original, _ = decode_png((self.app / name).read_bytes())
        changed = bytearray(original)
        changed[0] ^= 255
        (self.app / name).write_bytes(encode_preview(width, height, changed))
        proof = self.verify()
        entry = next(item for item in proof["compiledIcons"] if item["resource"] == name)
        self.assertEqual(entry["normalizedRgbaSha256"], hashlib.sha256(changed).hexdigest())
        self.assertNotEqual(entry["normalizedRgbaSha256"], hashlib.sha256(original).hexdigest())
        self.assertEqual(proof["compiledArtworkFidelity"], "INDEPENDENT_VISUAL_REVIEW_REQUIRED")
        self.assertEqual(decode_png((self.public / entry["preview"]).read_bytes())[2], bytes(changed))

    def test_crc_transparency_and_decompression_bomb_are_rejected(self):
        name = next(iter(ICON_RESOURCES))
        original = bytearray((RETAINED / name).read_bytes())
        original[-1] ^= 1
        with self.assertRaisesRegex(ReleaseProofError, "ICON_PNG_CRC_INVALID"):
            decode_png(original)
        with self.assertRaisesRegex(ReleaseProofError, "ICON_OPAQUE_PIXELS_REQUIRED"):
            decode_png(encode_preview(1, 1, bytes((10, 20, 30, 0))))
        def chunk(kind, value):
            return struct.pack(">I", len(value)) + kind + value + struct.pack(">I", zlib.crc32(kind + value) & 0xffffffff)
        bomb = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(bytes(1024 * 1024))) + chunk(b"IEND", b""))
        with self.assertRaisesRegex(ReleaseProofError, "ICON_PNG_DECOMPRESSION_INVALID"):
            decode_png(bomb)

    def test_invalid_candidate_executable_and_reused_output_refuse_false_receipts(self):
        with self.assertRaisesRegex(ReleaseProofError, "RELEASE_PROOF_CANDIDATE_INVALID"):
            verify_release_app(self.root, self.app, "LandfallCompanion", "not-a-source", self.public)
        with self.assertRaisesRegex(ReleaseProofError, "RELEASE_EXECUTABLE_NAME_INVALID"):
            verify_release_app(self.root, self.app, "../other", CANDIDATE, self.public)
        self.verify()
        with self.assertRaisesRegex(ReleaseProofError, "COMPILED_ICON_OUTPUT_ALREADY_EXISTS"):
            self.verify()


if __name__ == "__main__":
    unittest.main()
