#!/usr/bin/env python3
"""Bütün programların güncel indirme linklerini toplar.

Kaynaklar:
  1) Her deponun GitHub Releases'i: kurulum (setup) .exe/.msi ve .apk
  2) Depo içindeki dosyalar (ör. guncelleme/*.apk): raw.githubusercontent linki
Çıktı: indirme-linkleri/links.json ve INDIRME-LINKLERI.md (değişiklik varsa).
`gh` CLI ile çalışır (Actions'ta GH_TOKEN = github.token).
"""
import json, os, re, subprocess, sys
from datetime import datetime, timezone

OWNER = "departures-mil"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# Görünen adlar. Burada olmayan depolar link bulunursa depo adıyla eklenir.
NAMES = {
    "falcon-ofis": "Falcon Ofis", "kitaplik": "Kitaplık", "mahzen": "Mahzen",
    "bereket-defter": "Bereket Defter", "organizer": "Organizer",
    "aile-ajandasi": "Ajandam (Aile Ajandası)", "ofis-gunlugu": "Ofis Günlüğü",
    "sinav-hazirlama": "Sınav Hazırlama", "cv-maker": "CV Maker",
    "merkezi-servis": "Merkezi Servis", "baski-hesabi": "Baskı Hesabı",
    "comm-calc": "Comm-Calc", "kalori-hesaplayici": "Kalori Hesaplayıcı",
    "DesktopDuzenSabitleyici": "Desktop Düzen Sabitleyici",
    "pixhawk-log-analiz": "Pixhawk Log Analiz", "ajandam": "Ajandam (eski)",
    "3d-maliyet-arsiv": "3D Maliyet ve Arşiv",
}
# Program olmayan (içerik/altyapı) depolar: listede gösterilmez.
SKIP = {"duyurular", "ortak-cekirdek", "iha-mufredat-kaynak", "ing-mufredat-guncelleme",
        "iha-mufredat-guncelleme", "falcon-ofis-bulut"}
# Başka bir deponun içinde yaşayan programlar: (depo, klasör önü) -> ad
SUBAPPS = {("duyurular", "tv-bakim/"): "TV Bakım"}

SETUP_RE = re.compile(r"(setup|kurulum|installer)", re.I)
BAD_RE = re.compile(r"(patch|portable|tasinabilir|taşınabilir|\.bin$|\.idsig$|\.blockmap$)", re.I)


def gh(path):
    out = subprocess.run(["gh", "api", "-H", "Accept: application/vnd.github+json", path],
                         capture_output=True, text=True)
    if out.returncode != 0:
        print(f"uyarı: {path}: {out.stderr.strip()[:200]}", file=sys.stderr)
        return None
    return json.loads(out.stdout)


def vkey(s):
    return tuple(int(x) for x in re.findall(r"\d+", s))


def mb(n):
    return round(n / 1048576, 1) if n else None


REL_CACHE = {}
TREE_CACHE = {}


def releases(repo):
    if repo not in REL_CACHE:
        REL_CACHE[repo] = gh(f"repos/{OWNER}/{repo}/releases?per_page=50") or []
    return REL_CACHE[repo]


def tree(repo, branch):
    if (repo, branch) not in TREE_CACHE:
        TREE_CACHE[(repo, branch)] = gh(f"repos/{OWNER}/{repo}/git/trees/{branch}?recursive=1")
    return TREE_CACHE[(repo, branch)]


def from_releases(repo):
    rels = list(releases(repo))
    rels = [r for r in rels if not r.get("draft")]
    rels.sort(key=lambda r: r.get("published_at") or "", reverse=True)
    found = {}
    for r in rels:
        for a in r.get("assets", []):
            n = a["name"]
            if BAD_RE.search(n):
                continue
            kind = None
            if n.lower().endswith(".apk"):
                kind = "apk"
            elif n.lower().endswith((".exe", ".msi")):
                kind = "desktop" if SETUP_RE.search(n) else "desktop_exe"
            if kind and kind not in found:
                found[kind] = {"url": a["browser_download_url"], "file": n,
                               "version": r["tag_name"], "mb": mb(a.get("size")),
                               "date": r.get("published_at")}
    if "desktop" in found:
        found.pop("desktop_exe", None)
    elif "desktop_exe" in found:
        found["desktop"] = found.pop("desktop_exe")
    return found


def from_tree(repo, branch, prefix=""):
    t = tree(repo, branch)
    if not t:
        return {}
    best = {}
    for e in t.get("tree", []):
        p = e["path"]
        if e.get("type") != "blob" or not p.startswith(prefix):
            continue
        n = p.rsplit("/", 1)[-1]
        if BAD_RE.search(n) or p.startswith(("node_modules/", ".github/")):
            continue
        if n.lower().endswith(".apk"):
            kind = "apk"
        elif n.lower().endswith((".exe", ".msi")) and SETUP_RE.search(n):
            kind = "desktop"
        else:
            continue
        cur = best.get(kind)
        if cur is None or vkey(n) > vkey(cur["file"]):
            best[kind] = {"url": f"https://raw.githubusercontent.com/{OWNER}/{repo}/{branch}/{p}",
                          "file": n, "version": ("v" + ".".join(map(str, vkey(n)))) if vkey(n) else None,
                          "mb": mb(e.get("size")), "date": None}
    return best


def main():
    repos = gh(f"users/{OWNER}/repos?per_page=100&type=owner")
    if repos is None:  # yedek yol
        repos = (gh(f"search/repositories?q=user:{OWNER}&per_page=100") or {}).get("items", [])
    apps = []
    for r in sorted(repos, key=lambda x: x["name"].lower()):
        name = r["name"]
        if r.get("private") or r.get("archived") or r.get("fork"):
            continue
        branch = r.get("default_branch", "main")
        for (repo, pre), title in SUBAPPS.items():
            if repo == name:
                links = from_tree(name, branch, pre)
                # Alt programın kendi GitHub sürümleri (ör. TV Bakım → duyurular Releases, TV-Bakim-*.apk) öncelikli
                rel = {k: v for k, v in from_releases(name).items() if v["file"].lower().startswith(title.lower().replace(" ", "-").replace("ı", "i"))}
                links.update(rel)
                if links:
                    apps.append({"id": pre.strip("/"), "name": title, "repo": name, "links": links})
        if name in SKIP:
            continue
        rel = from_releases(name)
        tree = from_tree(name, branch)
        links = dict(tree)
        links.update(rel)  # Releases öncelikli
        if links or name in NAMES:
            apps.append({"id": name, "name": NAMES.get(name, name), "repo": name, "links": links})
    apps.sort(key=lambda a: a["name"].lower())
    try:
        import site_veri
        site_veri.yaz(apps, releases, tree, repos)
    except Exception as e:  # site verisi linkleri asla bozmasın
        print(f"uyarı: site verisi yazılamadı: {e}", file=sys.stderr)
    data = {"apps": apps}
    path = os.path.join(HERE, "links.json")
    old = None
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            old = json.load(f)
    if old and old.get("apps") == apps:
        print("değişiklik yok")
        return
    data["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    write_md(data)
    print("güncellendi")


def cell(l):
    if not l:
        return "—"
    s = f"[{l['file']}]({l['url']})"
    extra = " · ".join(x for x in [l.get("version"), f"{l['mb']} MB" if l.get("mb") else None] if x)
    return f"{s}<br><sub>{extra}</sub>" if extra else s


def write_md(data):
    lines = ["# İndirme Linkleri", "",
             "> 🌐 Aynı liste kartlı, üç dilli site olarak: **https://departures-mil.github.io/duyurular/**", "",
             "Bütün programların en son masaüstü kurulum (setup) ve Android APK dosyaları.",
             "Bu sayfa her 15 dakikada bir GitHub'daki yeni sürümlere göre kendiliğinden yenilenir.", "",
             f"Son yenileme: {data['updated']} (UTC)", "",
             "| Program | Masaüstü (Windows kurulum) | Android (APK) |", "|---|---|---|"]
    yok = []
    for a in data["apps"]:
        L = a["links"]
        if not L:
            yok.append(a["name"])
            continue
        lines.append(f"| **{a['name']}** | {cell(L.get('desktop'))} | {cell(L.get('apk'))} |")
    if yok:
        lines += ["", "Kurulum dosyası henüz doğrudan indirilebilir olarak yayında olmayanlar "
                  "(bunlar program içinden güncelleniyor): " + ", ".join(yok)]
    lines += ["", "🌐 **İndirme sitesi:** https://departures-mil.github.io/duyurular/ (Türkçe · English · العربية)", "",
              "Makine için: [links.json](indirme-linkleri/links.json)", ""]
    with open(os.path.join(ROOT, "INDIRME-LINKLERI.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    main()
