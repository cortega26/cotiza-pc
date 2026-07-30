"""Verify download_pc_datasets.py --help exposes pin-refresh procedure."""
import subprocess
import sys

def test_help_includes_pin_refresh():
    result = subprocess.run(
        [sys.executable, "scripts/download_pc_datasets.py", "--help"],
        capture_output=True, text=True, check=True,
    )
    assert "Para refrescar" in result.stdout, (
        "pin-refresh procedure missing from --help output"
    )
    assert "--print-pins" in result.stdout, (
        "--print-pins flag missing from --help output"
    )

if __name__ == "__main__":
    test_help_includes_pin_refresh()
    print("✅ downloader --help test passed")
