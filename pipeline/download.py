"""Download registered sources, validate signatures, and retain byte provenance."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def signature(data, fmt):
    return (fmt == "pdf" and data.startswith(b"%PDF-")) or (fmt == "xls" and data.startswith(bytes.fromhex("d0cf11e0a1b11ae1"))) or (fmt == "html" and b"<html" in data[:3000].lower())


def download(refresh=False):
    registry = json.loads((ROOT / "data/sources.json").read_text())
    manifest_path = ROOT / "data/data-manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"schemaVersion": 1, "files": [], "attempts": []}
    cached = {x["id"]: x for x in manifest["files"]}
    failures = []
    for source in registry["files"]:
        path = ROOT / source["path"]
        previous = cached.get(source["id"])
        if previous and path.exists() and not refresh:
            if previous["url"] != source["url"] or previous["path"] != source["path"]:
                raise ValueError("Registry changed; use --refresh: " + source["id"])
            if digest(path) != previous["sha256"]:
                raise ValueError(f"Cached source changed: {path}")
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "download"
            result = subprocess.run(["curl.exe" if __import__('os').name == 'nt' else "curl", "--location", "--fail", "--silent", "--show-error", "--retry", "2", "--max-time", "60", "--output", str(target), "--write-out", "%{content_type}|%{url_effective}", source["url"]], capture_output=True, text=True)
            now = datetime.now(timezone.utc).isoformat()
            ok = result.returncode == 0 and target.exists() and signature(target.read_bytes(), source["format"])
            manifest["attempts"].append({"id": source["id"], "at": now, "ok": ok, "error": None if ok else result.stderr.strip() or "Unexpected file signature (possibly an HTML error page)"})
            if not ok:
                failures.append(source["id"])
                continue
            data = target.read_bytes()
            sha = hashlib.sha256(data).hexdigest()
            if previous and previous["sha256"] != sha:
                archive = ROOT / "data/raw/archive" / (previous["sha256"] + path.suffix)
                archive.parent.mkdir(parents=True, exist_ok=True)
                if path.exists():
                    archive.write_bytes(path.read_bytes())
                    manifest.setdefault("versions", []).append({**previous, "archivePath": str(archive.relative_to(ROOT)).replace('\\','/')})
            path.write_bytes(data)
            mime, resolved = result.stdout.strip().split('|', 1)
            cached[source["id"]] = {**source, "retrievedAt": now, "sha256": sha, "sizeBytes": len(data), "mimeType": mime, "resolvedUrl": resolved, "status": "downloaded", "parserVersion": "1.0.0", "datasetVersion": sha[:12]}
            print("Downloaded", source["id"], len(data), "bytes")
    manifest["files"] = list(cached.values())
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    if failures:
        raise RuntimeError("Failed downloads: " + ", ".join(failures))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--refresh", action="store_true")
    download(p.parse_args().refresh)
