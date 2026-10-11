"""Compatibility path; execute the canonical Launchdeck planner without copied logic."""
from pathlib import Path
import runpy

root = Path(__file__).resolve().parents[3]
skill = root / "skills/launchdeck"
if not skill.exists():
    skill = root.parents[1] / "skills/launchdeck"
runpy.run_path(str(skill / "scripts/launchdeck.py"), run_name="__main__")
