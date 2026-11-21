"""Bounded Release-entrypoint scan and lossless compiled-icon pixel evidence.

No archive, executable, profile or key is published. PNG decoding performs no
resize or color conversion; differing compiled pixels require visual review.
"""
import hashlib
import json
from pathlib import Path
import struct
import zlib


APPROVED_ICON_SHA256 = "4fd7beec45947a02d40c99159e19ee87f7c4fea6db32bf18db9224b23a1a1f73"
DEBUG_ONLY_MARKERS = {"DEBUG_SIMULATOR_CAMERA_FREE_SWITCH": "--landfall-lab-camera-free"}
ENCODINGS = ("utf-8", "utf-16-le", "utf-16-be")
ICON_RESOURCES = {"AppIcon60x60@2x.png": 120, "AppIcon76x76@2x~ipad.png": 152}
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


class ReleaseProofError(Exception):
    pass


def require(condition, label):
    if not condition:
        raise ReleaseProofError(label)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def read_member(directory, name, maximum):
    root = Path(directory).resolve(strict=True)
    member = root / name
    require(not member.is_symlink() and member.is_file(), "RELEASE_PROOF_MEMBER_REQUIRED")
    require(member.resolve(strict=True).parent == root, "RELEASE_PROOF_MEMBER_SCOPE_INVALID")
    require(0 < member.stat().st_size <= maximum, "RELEASE_PROOF_MEMBER_SIZE_INVALID")
    data = member.read_bytes()
    require(0 < len(data) <= maximum, "RELEASE_PROOF_MEMBER_SIZE_INVALID")
    return data


def decode_png(data):
    """Decode bounded 8-bit RGB/RGBA PNG/CgBI without changing pixel values."""
    require(len(data) <= 16 * 1024 * 1024 and data[:8] == PNG_SIGNATURE, "ICON_PNG_INVALID")
    position, header, cgbi, ended = 8, None, False, False
    compressed = bytearray()
    chunks = 0
    while position < len(data):
        require(position + 12 <= len(data), "ICON_PNG_CHUNK_INVALID")
        length, kind = struct.unpack_from(">I4s", data, position)
        require(length <= 16 * 1024 * 1024 and position + length + 12 <= len(data), "ICON_PNG_CHUNK_INVALID")
        payload = data[position + 8:position + 8 + length]
        checksum = struct.unpack_from(">I", data, position + 8 + length)[0]
        require(zlib.crc32(kind + payload) & 0xffffffff == checksum, "ICON_PNG_CRC_INVALID")
        position += length + 12
        chunks += 1
        require(chunks <= 1024, "ICON_PNG_CHUNK_LIMIT")
        if kind == b"CgBI":
            require(not cgbi and header is None and length == 4, "ICON_CGBI_INVALID")
            cgbi = True
        elif kind == b"IHDR":
            require(header is None and length == 13, "ICON_PNG_HEADER_INVALID")
            header = struct.unpack(">IIBBBBB", payload)
        elif kind == b"IDAT":
            require(header is not None, "ICON_PNG_HEADER_REQUIRED")
            compressed.extend(payload)
        elif kind == b"IEND":
            require(length == 0 and position == len(data), "ICON_PNG_END_INVALID")
            ended = True
            break
        else:
            require(kind[0] & 32, "ICON_PNG_UNSUPPORTED_CRITICAL_CHUNK")
    require(ended and header is not None and compressed, "ICON_PNG_INCOMPLETE")
    width, height, depth, color, compression, filtering, interlace = header
    require(0 < width <= 2048 and 0 < height <= 2048 and depth == 8 and color in (2, 6)
            and (compression, filtering, interlace) == (0, 0, 0), "ICON_PNG_FORMAT_UNSUPPORTED")
    channels = 3 if color == 2 else 4
    stride = width * channels
    expected = height * (stride + 1)
    try:
        inflater = zlib.decompressobj(-15 if cgbi else 15)
        raw = inflater.decompress(compressed, expected + 1)
        require(len(raw) == expected and inflater.eof and not inflater.unused_data and not inflater.unconsumed_tail,
                "ICON_PNG_DECOMPRESSION_INVALID")
    except zlib.error as error:
        raise ReleaseProofError("ICON_PNG_DECOMPRESSION_INVALID") from error
    previous = bytearray(stride)
    pixels = bytearray()
    for y in range(height):
        offset = y * (stride + 1)
        method = raw[offset]
        require(method <= 4, "ICON_PNG_FILTER_INVALID")
        row = bytearray(raw[offset + 1:offset + 1 + stride])
        for x in range(stride):
            left = row[x - channels] if x >= channels else 0
            above = previous[x]
            upper_left = previous[x - channels] if x >= channels else 0
            if method == 1:
                predictor = left
            elif method == 2:
                predictor = above
            elif method == 3:
                predictor = (left + above) // 2
            elif method == 4:
                p = left + above - upper_left
                distances = (abs(p - left), abs(p - above), abs(p - upper_left))
                predictor = (left, above, upper_left)[distances.index(min(distances))]
            else:
                predictor = 0
            row[x] = (row[x] + predictor) & 255
        for x in range(0, stride, channels):
            r, g, b = row[x:x + 3]
            if cgbi:
                r, b = b, r
            alpha = row[x + 3] if channels == 4 else 255
            # CgBI can contain premultiplied alpha. App icons must be opaque;
            # reject it rather than inventing an unpremultiplication transform.
            require(alpha == 255, "ICON_OPAQUE_PIXELS_REQUIRED")
            pixels.extend((r, g, b, alpha))
        previous = row
    return width, height, bytes(pixels), cgbi


def encode_preview(width, height, rgba):
    """Standard PNG viewing copy of exactly the decoded opaque RGBA values."""
    def chunk(kind, payload):
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xffffffff)
    stride = width * 4
    raw = b"".join(b"\x00" + rgba[y * stride:(y + 1) * stride] for y in range(height))
    return (PNG_SIGNATURE + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def scan_release_executable(data):
    require(0 < len(data) <= 128 * 1024 * 1024, "RELEASE_EXECUTABLE_SIZE_INVALID")
    require(data[:4] in (b"\xcf\xfa\xed\xfe", b"\xfe\xed\xfa\xcf", b"\xca\xfe\xba\xbe", b"\xbe\xba\xfe\xca"),
            "RELEASE_MACHO_REQUIRED")
    hits = [label for label, marker in DEBUG_ONLY_MARKERS.items()
            if any(marker.encode(encoding) in data for encoding in ENCODINGS)]
    require(not hits, "RELEASE_DEBUG_FIXTURE_ENTRYPOINT_PRESENT")
    return {"result": "PASS", "scope": "KNOWN_DEBUG_ONLY_ENABLEMENT_STRINGS_ABSENT",
            "executableSha256": sha256(data), "executableBytes": len(data),
            "markerLabels": list(DEBUG_ONLY_MARKERS), "encodings": list(ENCODINGS),
            "matchedMarkerCount": 0, "allFixtureCodeOrProtocolStringsAbsentClaimed": False}


def verify_release_app(root, app, executable_name, candidate, public):
    require(isinstance(candidate, str) and len(candidate) == 40 and all(c in "0123456789abcdef" for c in candidate),
            "RELEASE_PROOF_CANDIDATE_INVALID")
    require(executable_name == "LandfallCompanion", "RELEASE_EXECUTABLE_NAME_INVALID")
    root, app, public = Path(root), Path(app), Path(public)
    prepared_dir = root / "native/ios/LandfallCompanion/Assets.xcassets/AppIcon.appiconset"
    try:
        catalog = json.loads(read_member(prepared_dir, "Contents.json", 65536))
    except (ValueError, UnicodeError) as error:
        raise ReleaseProofError("APPROVED_ICON_CATALOG_INVALID") from error
    require(isinstance(catalog, dict) and catalog.get("images") == [
        {"filename": "AppIcon.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"}],
        "APPROVED_ICON_CATALOG_MAPPING_MISMATCH")
    prepared = read_member(prepared_dir, "AppIcon.png", 16 * 1024 * 1024)
    official = read_member(root / "native/ios/Branding", "VoyageWright-Logo.official.png", 16 * 1024 * 1024)
    require(sha256(prepared) == sha256(official) == APPROVED_ICON_SHA256, "APPROVED_ICON_SOURCE_MISMATCH")
    width, height, _, _ = decode_png(prepared)
    require((width, height) == (1024, 1024), "APPROVED_ICON_SOURCE_DIMENSIONS_INVALID")
    executable = read_member(app, executable_name, 128 * 1024 * 1024)
    scan = scan_release_executable(executable)
    captured = []
    outputs = []
    for name, side in ICON_RESOURCES.items():
        original = read_member(app, name, 16 * 1024 * 1024)
        width, height, pixels, cgbi = decode_png(original)
        require((width, height) == (side, side), "COMPILED_ICON_DIMENSIONS_MISMATCH")
        require(len(set(pixels[0::4])) > 1 or len(set(pixels[1::4])) > 1 or len(set(pixels[2::4])) > 1,
                "COMPILED_ICON_EMPTY_OR_SOLID")
        preview = encode_preview(width, height, pixels)
        require(decode_png(preview)[:3] == (width, height, pixels), "COMPILED_ICON_LOSSLESS_PREVIEW_MISMATCH")
        captured.append({"resource": name, "width": width, "height": height, "opaque": True,
                         "compiledPngSha256": sha256(original), "normalizedRgbaSha256": sha256(pixels),
                         "sourceEncoding": "CGBI" if cgbi else "PNG",
                         "preview": f"compiled-icons/{name}.preview.png", "previewSha256": sha256(preview),
                         "pixelTransform": "NONE_EXCEPT_OPAQUE_CGBI_BGR_CHANNEL_DECODE",
                         "resized": False, "colorManaged": False})
        outputs.append((name, original, preview))
    proof = {"schemaVersion": 1, "candidateSha": candidate,
             "evidenceClass": "ACTUAL_RELEASE_BINARY_SCAN_AND_COMPILED_ICON_PIXEL_CAPTURE",
             "result": "PASS", "verifierSha256": sha256(Path(__file__).read_bytes()),
             "approvedSourcePngSha256": APPROVED_ICON_SHA256, "preparedAndOfficialSourceBytesIdentical": True,
             "approvedCatalogFilenameMappingVerified": True,
             "releaseFixtureEntrypointScan": scan, "compiledIcons": captured,
             "compiledArtworkFidelity": "INDEPENDENT_VISUAL_REVIEW_REQUIRED",
             "automaticCrossResolutionOrColorToleranceClaimed": False,
             "physicalHomeScreenAppearanceProven": False,
             "proofExportsArchiveExecutableOrSigningMaterial": False}
    # Nothing is published before every bounded input/decoder/entrypoint check passes.
    directory = public / "compiled-icons"
    require(not directory.exists(), "COMPILED_ICON_OUTPUT_ALREADY_EXISTS")
    directory.mkdir(parents=True)
    for name, original, preview in outputs:
        (directory / name).write_bytes(original)
        (directory / f"{name}.preview.png").write_bytes(preview)
    (public / "release-proof.json").write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
    return proof
