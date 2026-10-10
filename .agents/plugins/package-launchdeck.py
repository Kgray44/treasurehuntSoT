"""Validate and reproducibly export the repository-owned private plugin."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent / "project-launchdeck"


def validate():
    manifest = json.loads((ROOT / "plugin.json").read_text(encoding="utf-8"))
    assert manifest["name"] == ROOT.name
    assert re.fullmatch(r"\d+\.\d+\.\d+", manifest["version"])
    ui = manifest["extensions"]["com.openai"]["interface"]
    assert len(ui["shortDescription"]) <= 30
    assert ui["displayName"] == "Project Launchdeck"
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
    launch = (ROOT / "skills/launch-task/SKILL.md").read_text(encoding="utf-8")
    assert "references/surfaces.md" in launch
    assert "references/native-integration.md#direct-creation-contract" in launch
    assert "Do not ask to continue the source Chat in Work" in launch
    assert "AUTOMATIC CREATION UNAVAILABLE" in launch
    assert "references/executable-launch.md" in launch
    portable = json.loads((ROOT / "mcp.json").read_text(encoding="utf-8"))
    legacy = json.loads((ROOT / ".mcp.json").read_text(encoding="utf-8"))
    assert portable["mcpServers"] == legacy["mcpServers"]
    assert (ROOT / "server/launchdeck_mcp.py").is_file()
    for skill in sorted((ROOT / "skills").iterdir()):
        content = (skill / "SKILL.md").read_text(encoding="utf-8")
        front = re.match(r"^---\n(.*?)\n---\n", content, re.S)
        assert front and "name: " + skill.name in front.group(1)
        assert "description:" in front.group(1)
        for md in skill.rglob("*.md"):
            for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", md.read_text(encoding="utf-8")):
                if not re.match(r"https?:|#", target):
                    linked = (md.parent / target.split("#", 1)[0]).resolve()
                    assert linked.is_relative_to(ROOT.resolve()) and linked.is_file(), (md, target)
    return manifest


def package(output):
    manifest = validate()
    destination = Path(output).resolve()
    assert not destination.is_relative_to(ROOT.resolve()), "Archive must be outside plugin source"
    files = sorted(p for p in ROOT.rglob("*") if p.is_file())
    assert not any(p.is_symlink() for p in ROOT.rglob("*")), "No symlinks permitted"
    assert not any("__pycache__" in p.parts or p.suffix == ".pyc" for p in files)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for item in files:
            relative = Path(ROOT.name) / item.relative_to(ROOT)
            info = zipfile.ZipInfo(relative.as_posix(), date_time=(2026, 10, 10, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, item.read_bytes())
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert archive.namelist().count(ROOT.name + "/plugin.json") == 1
    return {"archive": str(destination), "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
            "files": len(files), "version": manifest["version"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    print(json.dumps(package(args.output), separators=(",", ":")))
