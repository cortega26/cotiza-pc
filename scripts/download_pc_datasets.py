#!/usr/bin/env python
import argparse
import json
import os
import shutil
import subprocess
import sys
import traceback
import site
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
BUILDCORES_DIR = RAW_DIR / "buildcores-open-db"
PCPART_DIR = RAW_DIR / "pc-part-dataset"
DBGPU_DIR = RAW_DIR / "dbgpu"
DBGPU_JSON = DBGPU_DIR / "dbgpu.json"
PROVENANCE_JSON = RAW_DIR / "provenance.json"

GIT_EXE = shutil.which("git") or "git"
IS_CI = (os.environ.get("CI", "").lower() in ("1", "true", "yes")) or (os.environ.get("GITHUB_ACTIONS", "").lower() in ("1", "true", "yes"))


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
        sha = subprocess.check_output([GIT_EXE, "rev-parse", "HEAD"], cwd=repo_dir).decode("utf-8").strip()
        remote = subprocess.check_output([GIT_EXE, "config", "--get", "remote.origin.url"], cwd=repo_dir).decode("utf-8").strip()
        return {"sha": sha, "remote": remote}
    except Exception as e:
        if IS_CI:
            print(f"[error] No se pudo obtener info git de {repo_dir}: {e}")
            sys.exit(1)
        print(f"[warn] No se pudo obtener info git de {repo_dir}: {e}")
        return None


def clone_or_update(repo_url, dest, force=False, skip=False):
    if skip:
        print(f"[skip] {dest.name}")
        return
    if not any(dest.iterdir()):
        print(f"Clonando {repo_url} en {dest}...")
        # git clone is picky about pre-existing dirs; remove empty placeholder if needed.
        if dest.exists():
            shutil.rmtree(dest)
        run([GIT_EXE, "clone", "--depth=1", repo_url, str(dest)])
        return
    if (dest / ".git").exists():
        try:
            print(f"Actualizando {dest}...")
            run([GIT_EXE, "fetch", "--depth=1"], cwd=dest)
            if force:
                run([GIT_EXE, "reset", "--hard", "origin/main"], cwd=dest)
            else:
                run([GIT_EXE, "pull", "--ff-only"], cwd=dest)
        except subprocess.CalledProcessError as e:
            if IS_CI:
                print(f"[error] No se pudo actualizar {dest}: {e}")
                sys.exit(1)
            print(f"[warn] No se pudo actualizar {dest}: {e}")
    else:
        if force:
            print(f"[force] Recreando {dest}...")
            shutil.rmtree(dest)
            run([GIT_EXE, "clone", "--depth=1", repo_url, str(dest)])
        else:
            msg = f"{dest} existe sin .git; se deja intacto (use --force para recrear)"
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
        # asegurar que el site-packages de usuario esté en sys.path
        try:
            site.addsitedir(site.getusersitepackages())
        except Exception:
            pass
        try:
            from dbgpu import GPUDatabase  # type: ignore
        except ImportError:
            print("Instalando dbgpu...")
            run([sys.executable, "-m", "pip", "install", "--user", "dbgpu"], check=True)
            try:
                site.addsitedir(site.getusersitepackages())
            except Exception:
                pass
            from dbgpu import GPUDatabase  # type: ignore
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
    except Exception as e:
        traceback.print_exc()
        if IS_CI:
            print(f"[error] Falló dbgpu en CI: {e}")
            sys.exit(1)
        if DBGPU_JSON.exists():
            print(f"[warn] Falló dbgpu ({e}); usando archivo existente {DBGPU_JSON}")
            try:
                return len(json.loads(DBGPU_JSON.read_text(encoding="utf-8")))
            except Exception:
                return 0
        else:
            print(f"[error] No se pudo obtener DBGPU y no existe {DBGPU_JSON}")
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Descarga/actualiza datasets de PC")
    parser.add_argument("--skip-buildcores", action="store_true")
    parser.add_argument("--skip-pcpart", action="store_true")
    parser.add_argument("--skip-dbgpu", action="store_true")
    parser.add_argument("--force", action="store_true", help="recrear repos si no tienen .git")
    args = parser.parse_args()

    ensure_dirs()
    clone_or_update("https://github.com/buildcores/buildcores-open-db.git", BUILDCORES_DIR, force=args.force, skip=args.skip_buildcores)
    clone_or_update("https://github.com/docyx/pc-part-dataset.git", PCPART_DIR, force=args.force, skip=args.skip_pcpart)
    dbgpu_count = export_dbgpu(force=args.force, skip=args.skip_dbgpu)

    # Provenance artifact (helps reproduce and audit scheduled runs).
    try:
        try:
            from importlib import metadata as importlib_metadata  # type: ignore
        except Exception:
            import importlib_metadata  # type: ignore

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
