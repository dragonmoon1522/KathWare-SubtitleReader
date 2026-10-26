#!/usr/bin/env python3
"""Empaqueta la misma extensión para Chrome y otros Chromium, sin publicarla.

No necesita dependencias externas. La versión y el estado beta se toman del
manifest de Extension; este script nunca convierte una beta en estable.
"""

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import zipfile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Extension"
TARGETS = ("chrome", "chromium")


def referenced_files(manifest):
    """Recursos que el navegador necesita para cargar esta extensión."""
    yield from manifest.get("icons", {}).values()
    background = manifest.get("background", {})
    if background.get("service_worker"):
        yield background["service_worker"]
    yield from background.get("scripts", [])
    for script in manifest.get("content_scripts", []):
        yield from script.get("js", [])
        yield from script.get("css", [])
    action = manifest.get("action", {})
    if action.get("default_popup"):
        yield action["default_popup"]
    icons = action.get("default_icon", {})
    yield from icons.values() if isinstance(icons, dict) else [icons]


def validate_manifest(manifest):
    if manifest.get("manifest_version") != 3:
        raise ValueError("Se esperaba un manifest V3.")
    version = manifest.get("version", "")
    if not re.fullmatch(r"(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,3}", version):
        raise ValueError("La versión numérica del manifest no es válida.")
    if any(int(part) > 65535 for part in version.split(".")):
        raise ValueError("Un componente de la versión supera 65535.")
    if not any(int(part) for part in version.split(".")):
        raise ValueError("La versión no puede ser cero.")
    label = manifest.get("version_name", version)
    if not re.fullmatch(r"[A-Za-z0-9._+-]+", label):
        raise ValueError("version_name no puede usarse como nombre de archivo.")
    for name in referenced_files(manifest):
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts or "\\" in name:
            raise ValueError(f"Ruta de recurso no válida: {name}")
        source_path = SOURCE.joinpath(*path.parts)
        if not source_path.is_file() or not source_path.resolve().is_relative_to(SOURCE.resolve()):
            raise ValueError(f"Falta un recurso dentro de Extension: {name}")


def write_entry(archive, name, content):
    # Fecha y permisos fijos: el mismo código produce el mismo ZIP.
    info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
    info.create_system = 3
    info.external_attr = 0o100644 << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    archive.writestr(info, content)


def build(target, output_dir):
    manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    if target == "chromium":
        # Cada tienda administra su identidad y sus actualizaciones.
        manifest.pop("update_url", None)
        manifest.pop("key", None)
    validate_manifest(manifest)
    label = manifest.get("version_name", manifest["version"])
    if output_dir.resolve().is_relative_to(SOURCE.resolve()):
        raise ValueError("La salida debe estar fuera de Extension.")
    output_dir.mkdir(parents=True, exist_ok=True)
    package = output_dir / f"kathware-subtitlereader-{label}-{target}.zip"
    with zipfile.ZipFile(package, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(SOURCE.rglob("*")):
            relative = path.relative_to(SOURCE)
            if any(part.startswith(".") or part in {"node_modules", "__pycache__"} for part in relative.parts):
                continue
            if path.is_symlink():
                raise ValueError(f"No se empaquetan enlaces simbólicos: {relative}")
            if not path.is_file():
                continue
            content = path.read_bytes()
            if relative.as_posix() == "manifest.json":
                content = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
            write_entry(archive, relative.as_posix(), content)
        write_entry(archive, "LICENSE.md", (ROOT / "LICENSE.md").read_bytes())
    with zipfile.ZipFile(package) as archive:
        if archive.testzip() is not None or "manifest.json" not in archive.namelist():
            raise ValueError("El ZIP generado no pasó la verificación.")
    return {"target": target, "path": str(package), "version": label,
            "sha256": hashlib.sha256(package.read_bytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", choices=(*TARGETS, "all"), default="all")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    targets = TARGETS if args.target == "all" else (args.target,)
    try:
        packages = [build(target, args.output_dir) for target in targets]
    except (OSError, ValueError, zipfile.BadZipFile) as error:
        parser.exit(1, f"No se pudo generar el paquete: {error}\n")
    print(json.dumps({"packages": packages}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
