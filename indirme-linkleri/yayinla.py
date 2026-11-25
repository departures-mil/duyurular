#!/usr/bin/env python3
"""İndirme sitesini (site/ + site-veri.json) _site/ klasörüne hazırlar ve yayına gerek olup olmadığını söyler.

Yayın gerekir: site dosyaları ya da sürüm/link/not verisi değiştiyse; yalnız indirme sayıları değiştiyse saatte bir.
Çıktı: GITHUB_OUTPUT'a yayinla=true|false
"""
import hashlib, json, os, shutil, sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "_site")
ESKI = sys.argv[1] if len(sys.argv) > 1 else ""  # yayındaki sürümün klasörü (gh-pages)


def ozet(veri, sayac=False):
    v = json.loads(json.dumps(veri))
    v.pop("guncellendi", None)
    for p in v.get("programlar", []):
        for l in p.get("links", {}).values():
            if not sayac:
                l.pop("indirme", None)
    return v


def site_hash(d):
    h = hashlib.sha256()
    for base, _, files in sorted(os.walk(d)):
        for f in sorted(files):
            if f in ("veri.json", ".nojekyll", "site-hash.txt"):
                continue
            p = os.path.join(base, f)
            h.update(os.path.relpath(p, d).encode())
            h.update(open(p, "rb").read())
    return h.hexdigest()


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    shutil.copytree(os.path.join(ROOT, "site"), OUT)
    veri = json.load(open(os.path.join(ROOT, "indirme-linkleri", "site-veri.json"), encoding="utf-8"))
    sh = site_hash(OUT)
    open(os.path.join(OUT, ".nojekyll"), "w").close()
    open(os.path.join(OUT, "site-hash.txt"), "w").write(sh)

    yayinla, neden = True, "ilk yayın"
    eski_veri = os.path.join(ESKI, "veri.json")
    if ESKI and os.path.exists(eski_veri):
        eski = json.load(open(eski_veri, encoding="utf-8"))
        eski_sh = open(os.path.join(ESKI, "site-hash.txt")).read().strip() if os.path.exists(os.path.join(ESKI, "site-hash.txt")) else ""
        if eski_sh != sh:
            neden = "site dosyaları değişti"
        elif ozet(eski) != ozet(veri):
            neden = "sürüm/link değişti"
        elif ozet(eski, True) != ozet(veri, True) and datetime.now(timezone.utc).minute < 15:
            neden = "indirme sayıları (saatlik)"
            veri["guncellendi"] = eski.get("guncellendi", veri["guncellendi"])
        else:
            yayinla, neden = False, "değişiklik yok"
            veri["guncellendi"] = eski.get("guncellendi", veri["guncellendi"])
    json.dump(veri, open(os.path.join(OUT, "veri.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"yayın: {yayinla} ({neden})")
    go = os.environ.get("GITHUB_OUTPUT")
    if go:
        with open(go, "a") as f:
            f.write(f"yayinla={'true' if yayinla else 'false'}\n")


if __name__ == "__main__":
    main()
