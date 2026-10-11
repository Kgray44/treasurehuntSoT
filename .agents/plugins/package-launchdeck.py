"""Export one canonical Skill; optional blocked adapter is excluded by default."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent / "project-launchdeck"
SKILL = ROOT.parents[1] / "skills/launchdeck"
OPTIONAL = {"mcp.json", ".mcp.json"}


def source_files(include_adapter=False):
    files = {}
    for item in sorted(ROOT.rglob("*")):
        assert not item.is_symlink(), "No symlinks permitted"
        if not item.is_file():
            continue
        relative = item.relative_to(ROOT).as_posix()
        if not include_adapter and (relative in OPTIONAL or relative.startswith("server/")):
            continue
        assert "__pycache__" not in item.parts and item.suffix != ".pyc"
        assert not relative.startswith("skills/launchdeck/"), "Do not maintain a second Skill source"
        files[relative] = item
    for item in sorted(SKILL.rglob("*")):
        assert not item.is_symlink(), "No symlinks permitted"
        if item.is_file():
            assert "__pycache__" not in item.parts and item.suffix != ".pyc"
            files["skills/launchdeck/" + item.relative_to(SKILL).as_posix()] = item
    return files


def validate(include_adapter=False):
    manifest = json.loads((ROOT / "plugin.json").read_text(encoding="utf-8"))
    assert manifest["name"] == ROOT.name
    assert re.fullmatch(r"\d+\.\d+\.\d+", manifest["version"])
    ui = manifest["extensions"]["com.openai"]["interface"]
    assert len(ui["shortDescription"]) <= 30 and ui["displayName"] == "Project Launchdeck"
    for key in ("logo", "logoDark", "composerIcon", "composerIconDark"):
        asset = ROOT / ui[key]
        assert asset.is_file() and asset.resolve().is_relative_to(ROOT.resolve())
        svg = ET.parse(asset).getroot()
        assert int(svg.attrib["width"]) >= 48 and int(svg.attrib["height"]) >= 48
    apps = json.loads((ROOT / ".app.json").read_text())
    assert apps["apps"]["github"]["id"] == "connector_76869538009648d5b282a4bb21c3d157"
    overlay = json.loads((ROOT / ".codex-plugin/plugin.json").read_text())
    assert overlay["interface"] == ui
    assert overlay["name"] == manifest["name"] and overlay["version"] == manifest["version"]
    assert manifest["extensions"]["com.openai"]["requires_local_executor"] is False
    assert overlay["requires_local_executor"] is False
    files = source_files(include_adapter)
    for path, item in files.items():
        if path.endswith("/SKILL.md"):
            content = item.read_text(encoding="utf-8")
            front = re.match(r"^---\n(.*?)\n---\n", content, re.S)
            assert front and "name: " + path.split("/")[-2] in front.group(1)
            assert "description:" in front.group(1)
        if path.endswith(".md"):
            for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", item.read_text(encoding="utf-8")):
                if not re.match(r"https?:|#", target):
                    import posixpath
                    linked = posixpath.normpath(posixpath.join(posixpath.dirname(path), target.split("#", 1)[0]))
                    assert linked in files, (path, target)
    if include_adapter:
        portable = json.loads((ROOT / "mcp.json").read_text())
        legacy = json.loads((ROOT / ".mcp.json").read_text())
        assert portable["mcpServers"] == legacy["mcpServers"]
        assert "server/launchdeck_mcp.py" in files
    else:
        assert not any(p in OPTIONAL or p.startswith("server/") for p in files)
    return manifest


def package(output, include_adapter=False):
    manifest = validate(include_adapter)
    destination = Path(output).resolve()
    assert not destination.is_relative_to(ROOT.resolve()) and not destination.is_relative_to(SKILL.resolve())
    files = source_files(include_adapter)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for relative, item in sorted(files.items()):
            info = zipfile.ZipInfo(ROOT.name + "/" + relative, date_time=(2026, 10, 10, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, item.read_bytes())
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert archive.namelist().count(ROOT.name + "/plugin.json") == 1
        for item in SKILL.rglob("*"):
            if item.is_file():
                name = ROOT.name + "/skills/launchdeck/" + item.relative_to(SKILL).as_posix()
                assert archive.read(name) == item.read_bytes(), "Canonical Skill bytes differ"
    return {"archive": str(destination), "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
            "files": len(files), "version": manifest["version"], "canonicalSkillEqual": True,
            "adapterIncluded": include_adapter}


def stage_local(archive_path, version):
    """Stage the validated Skill-only archive for the existing local marketplace."""
    destination = ROOT.parent / "generated" / version
    with zipfile.ZipFile(archive_path) as archive:
        assert not any(n.endswith("/mcp.json") or n.endswith("/.mcp.json") or "/server/" in n for n in archive.namelist())
        expected = {destination / name for name in archive.namelist()}
        existing = {p for p in destination.rglob("*") if p.is_file()} if destination.exists() else set()
        assert not existing - expected, "Unexpected staged files; do not reuse this directory"
        assert not any(p.is_symlink() for p in destination.rglob("*"))
        for name in archive.namelist():
            target = destination / name
            assert target.resolve().is_relative_to(destination.resolve())
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(name))
    return str(destination / ROOT.name)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("--include-adapter", action="store_true", help="Development export only; launcher remains blocked")
    parser.add_argument("--stage-local", action="store_true", help="Stage Skill-only output for the existing local marketplace")
    args = parser.parse_args()
    assert not (args.stage_local and args.include_adapter), "Do not install the unverified adapter"
    result = package(args.output, args.include_adapter)
    if args.stage_local:
        result["localSource"] = stage_local(result["archive"], result["version"])
    print(json.dumps(result, separators=(",", ":")))
