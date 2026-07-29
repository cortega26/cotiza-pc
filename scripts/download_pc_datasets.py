#!/usr/bin/env python
"""
Download / update hardware datasets from upstream sources.

Upstream repositories are pinned to specific commit SHAs. To refresh pins:

  1. Find the desired SHA on the upstream default branch.
  2. Update PINNED_BUILDCORES_SHA and/or PINNED_PCPART_SHA below.
  3. Run:  python scripts/download_pc_datasets.py --print-pins
  4. Verify the printed provenance matches expectations.
  5. Commit the SHA change in a single reviewed pull request.

Python dependencies (dbgpu) are hash-locked in scripts/requirements.txt.
Regenerate with:

    python -m pip install pip-tools
    pip-compile --generate-hashes -o scripts/requirements.txt <<< "dbgpu==<version>"

Then update CI to use the new requirements.txt.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
BUILDCORES_DIR = RAW_DIR / "buildcores-open-db"
PCPART_DIR = RAW_DIR / "pc-part-dataset"
DBGPU_DIR = RAW_DIR / "dbgpu"
DBGPU_JSON = DBGPU_DIR / "dbgpu.json"
PROVENANCE_JSON = RAW_DIR / "provenance.json"

GIT_EXE = shutil.which("git") or "git"
IS_CI = (os.environ.get("CI", "").lower() in ("1", "true", "yes")) or (
    os.environ.get("GITHUB_ACTIONS", "").lower() in ("1", "true", "yes")
)

# ── Pinned upstream SHAs ──────────────────────────────────────────────
# Update these through a reviewed PR (see docstring above).
PINNED_BUILDCORES_SHA = "b4a2a3bd8d5d07d0640615e81e2f152f77a76301"
PINNED_PCPART_SHA = "c52a04ca9465c83997ed335f7767b09a2005dd26"


def run(cmd, cwd=None, check=True):
    print(f"$ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=cwd, check=check)


def ensure_dirs():
    for d in [RAW_DIR, BUILDCORES_DIR, PCPART_DIR, DBGPU_DIR]:
        d.mkdir(parents=True, exist_ok=True)


def git_info(repo_dir: Path):
    if not (repo_dir / ".git").exists():
        return None
    try:
        sha = (
            subprocess.check_output([GIT_EXE, "rev-parse", "HEAD"], cwd=repo_dir)
            .decode("utf-8")
            .strip()
        )
        remote = (
            subprocess.check_output(
                [GIT_EXE, "config", "--get", "remote.origin.url"], cwd=repo_dir
            )
            .decode("utf-8")
            .strip()
        )
        return {"sha": sha, "remote": remote}
    except Exception as e:
        if IS_CI:
            print(f"[error] No se pudo obtener info git de {repo_dir}: {e}")
            sys.exit(1)
        print(f"[warn] No se pudo obtener info git de {repo_dir}: {e}")
        return None


def clone_pinned(repo_url, dest, pinned_sha, skip=False):
    """Clone or update *dest* to *pinned_sha* and verify HEAD matches."""
    if skip:
        print(f"[skip] {dest.name}")
        return

    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)

    # Shallow fetch the target SHA only.
    run(
        [GIT_EXE, "init"],
        cwd=dest,
    )
    run(
        [GIT_EXE, "remote", "add", "origin", repo_url],
        cwd=dest,
    )
    run(
        [GIT_EXE, "fetch", "--depth=1", "origin", pinned_sha],
        cwd=dest,
    )
    run(
        [GIT_EXE, "checkout", pinned_sha],
        cwd=dest,
    )

    # Verify pinned SHA matches HEAD.
    head_sha = (
        subprocess.check_output([GIT_EXE, "rev-parse", "HEAD"], cwd=dest)
        .decode("utf-8")
        .strip()
    )
    if head_sha != pinned_sha:
        msg = (
            f"PIN MISMATCH: {dest.name} HEAD ({head_sha}) != "
            f"pinned SHA ({pinned_sha}). Update the PINNED_ constant."
        )
        if IS_CI:
            print(f"[error] {msg}")
            sys.exit(1)
        print(f"[warn] {msg}")


def export_dbgpu(force=False, skip=False):
    if skip:
        print("[skip] dbgpu")
        return 0
    DBGPU_DIR.mkdir(parents=True, exist_ok=True)
    try:
        from dbgpu import GPUDatabase  # type: ignore
    except ImportError:
        msg = (
            "dbgpu no está instalado. "
            "Cree un venv e instale:  pip install --require-hashes -r scripts/requirements.txt"
        )
        if IS_CI:
            print(f"[error] {msg}")
            sys.exit(1)
        print(f"[error] {msg}")
        sys.exit(1)

    db = GPUDatabase.default()
    items = []
    for gpu in getattr(db, "specs", []):
        g = vars(gpu).copy()
        rd = g.get("release_date")
        if rd:
            g["release_date"] = rd.isoformat()
        items.append(g)
    DBGPU_JSON.write_text(json.dumps(items, indent=2), encoding="utf-8")
    print(f"Exportado DBGPU a {DBGPU_JSON} ({len(items)} GPUs)")
    return len(items)


def main():
    parser = argparse.ArgumentParser(
        description="Descarga/actualiza datasets de PC"
    )
    parser.add_argument("--skip-buildcores", action="store_true")
    parser.add_argument("--skip-pcpart", action="store_true")
    parser.add_argument("--skip-dbgpu", action="store_true")
    parser.add_argument("--print-pins", action="store_true", help="mostrar SHAs y versiones actuales")
    parser.add_argument("--raw-dir", type=str, default=None,
                        help="directorio raíz para datos crudos (por defecto: data/raw/)")
    args = parser.parse_args()

    if args.raw_dir:
        global RAW_DIR, BUILDCORES_DIR, PCPART_DIR, DBGPU_DIR, DBGPU_JSON, PROVENANCE_JSON
        RAW_DIR = Path(args.raw_dir).resolve()
        BUILDCORES_DIR = RAW_DIR / "buildcores-open-db"
        PCPART_DIR = RAW_DIR / "pc-part-dataset"
        DBGPU_DIR = RAW_DIR / "dbgpu"
        DBGPU_JSON = DBGPU_DIR / "dbgpu.json"
        PROVENANCE_JSON = RAW_DIR / "provenance.json"

    if args.print_pins:
        print(f"PINNED_BUILDCORES_SHA = {PINNED_BUILDCORES_SHA}")
        print(f"PINNED_PCPART_SHA    = {PINNED_PCPART_SHA}")
        try:
            from importlib import metadata as importlib_metadata
        except Exception:
            import importlib_metadata
        try:
            print(f"dbgpu                 = {importlib_metadata.version('dbgpu')}")
        except Exception:
            print("dbgpu                 = (no instalado)")
        return

    ensure_dirs()

    clone_pinned(
        "https://github.com/buildcores/buildcores-open-db.git",
        BUILDCORES_DIR,
        PINNED_BUILDCORES_SHA,
        skip=args.skip_buildcores,
    )
    clone_pinned(
        "https://github.com/docyx/pc-part-dataset.git",
        PCPART_DIR,
        PINNED_PCPART_SHA,
        skip=args.skip_pcpart,
    )
    dbgpu_count = export_dbgpu(skip=args.skip_dbgpu)

    # Provenance artifact (helps reproduce and audit scheduled runs).
    try:
        try:
            from importlib import metadata as importlib_metadata
        except Exception:
            import importlib_metadata
        dbgpu_version = None
        try:
            dbgpu_version = importlib_metadata.version("dbgpu")
        except Exception:
            dbgpu_version = None
        import datetime as _dt

        provenance = {
            "generatedAt": _dt.datetime.now(_dt.timezone.utc).isoformat().replace("+00:00", "Z"),
            "ci": bool(IS_CI),
            "python": {"executable": sys.executable, "version": sys.version.split()[0]},
            "sources": {
                "buildcores": git_info(BUILDCORES_DIR),
                "pcpart": git_info(PCPART_DIR),
                "dbgpu": {"version": dbgpu_version, "items": int(dbgpu_count or 0)},
            },
        }
        PROVENANCE_JSON.write_text(json.dumps(provenance, indent=2), encoding="utf-8")
        print(f"Provenance escrito en {PROVENANCE_JSON}")
    except Exception as e:
        if IS_CI:
            print(f"[error] No se pudo escribir provenance en CI: {e}")
            sys.exit(1)
        print(f"[warn] No se pudo escribir provenance: {e}")

    print("Listo.")


if __name__ == "__main__":
    main()