"""İndirme sitesinin (GitHub Pages) verisini üretir: indirme-linkleri/site-veri.json

topla.py'nin bulduğu linklere şunları ekler (hepsi GitHub'dan, elle bir şey girilmez):
  - SHA-256 (release dosyasının GitHub'daki özeti), indirme sayısı
  - son sürümlerin "Yenilikler" notları (## Türkçe / ## English / ## العربية başlıklarına göre bölünür)
  - program simgesi ve (varsa) ekran görüntüleri: deponun dosya ağacından raw linkleri
Bu dosya depoya yazılmaz (.gitignore); iş akışı onu sitenin veri.json'u olarak yayınlar.
"""
import json, os, re
from datetime import datetime, timezone

OWNER = "departures-mil"
HERE = os.path.dirname(os.path.abspath(__file__))
BAD_RE = re.compile(r"(patch|portable|tasinabilir|taşınabilir|\.bin$|\.idsig$|\.blockmap$)", re.I)
SETUP_RE = re.compile(r"(setup|kurulum|installer)", re.I)
IMG_RE = re.compile(r"\.(png|jpe?g|webp|svg)$", re.I)
SKIP_PATH = re.compile(r"(^|/)(node_modules|\.github|test|tests|cekirdek|fccore|vendor|third_party|dist-electron)/", re.I)
SHOT_RE = re.compile(r"(ekran[-_ ]?(goruntu|görüntü|resim)|ekranlar/|screenshots?/|screens/|docs/(img|images|ekran)/|tanitim/)", re.I)
LANG_HEAD = re.compile(r"^\s{0,3}#{1,4}\s*(türkçe|turkce|tr|english|ingilizce|en|العربية|arabic|arapça|arapca|عربي|ar)\s*$",
                       re.I | re.M)
LANG_MAP = {"türkçe": "tr", "turkce": "tr", "tr": "tr", "english": "en", "ingilizce": "en", "en": "en",
            "العربية": "ar", "arabic": "ar", "arapça": "ar", "arapca": "ar", "عربي": "ar", "ar": "ar"}


def kind_of(name):
    n = name.lower()
    if BAD_RE.search(n):
        return None
    if n.endswith(".apk"):
        return "apk"
    if n.endswith((".exe", ".msi")):
        return "desktop"
    return None


def split_notes(body):
    body = re.sub(r"</?(div|span|p|br)[^>]*>", "", (body or "").replace("\r\n", "\n")).strip()
    if not body:
        return None
    parts = list(LANG_HEAD.finditer(body))
    if not parts:
        return {"*": body[:2500]}
    out = {}
    for i, m in enumerate(parts):
        end = parts[i + 1].start() if i + 1 < len(parts) else len(body)
        txt = body[m.end():end].strip()
        # yayın aracının eklediği teknik satırları (SHA, yama listesi) gösterme
        txt = re.split(r"\n\s*(?:---|#{1,4}\s*(?:dosyalar|files|sha|yamalar|patches))", txt, flags=re.I)[0].strip()
        if txt:
            out[LANG_MAP[m.group(1).lower()]] = txt[:2500]
    return out or {"*": body[:2500]}


def raw(repo, branch, path):
    from urllib.parse import quote
    return f"https://raw.githubusercontent.com/{OWNER}/{repo}/{branch}/{quote(path)}"


def find_images(tree, repo, branch, prefix=""):
    if not tree:
        return None, []
    icons, shots = [], []
    for e in tree.get("tree", []):
        p = e["path"]
        if e.get("type") != "blob" or not p.startswith(prefix) or not IMG_RE.search(p) or SKIP_PATH.search(p):
            continue
        size = e.get("size") or 0
        n = p.rsplit("/", 1)[-1].lower()
        if re.match(r"(icon|logo|app[-_]?icon|ic_launcher|ic|simge)([-_.][^/]*)?\.(png|svg)$", n) and (n.endswith(".svg") or 400 < size < 600000):
            score = 0
            if n in ("icon.png", "icon.svg", "logo.png", "logo.svg", "simge.png", "ic.png", "app-icon.png", "ic_launcher.png"):
                score += 50
            if "xxxhdpi" in p:
                score += 40
            if re.search(r"(^|/)(build|assets|www|web|src|kaynak|resources|img|images)/", p):
                score += 10
            if "foreground" in n or "round" in n or "notification" in n or "splash" in p.lower():
                score -= 60
            score += min(size, 200000) / 20000
            icons.append((score, p))
        elif SHOT_RE.search(p) and 15000 < size < 3000000 and not re.search(r"(icon|logo|ic_launcher)", n):
            shots.append(p)
    icon = raw(repo, branch, max(icons)[1]) if icons else None
    shots = [raw(repo, branch, p) for p in sorted(shots)[:6]]
    return icon, shots


def yaz(apps, releases, tree, repos):
    branches = {r["name"]: r.get("default_branch", "main") for r in repos}
    path = os.path.join(HERE, "site-veri.json")
    out = []
    for a in apps:
        repo, aid = a["repo"], a["id"]
        prefix = "" if aid == repo else aid + "/"
        rels = [r for r in releases(repo) if not r.get("draft")]
        if prefix:  # alt program: yalnız kendi dosyalarını taşıyan sürümler
            key = a["name"].lower().replace(" ", "-").replace("ı", "i")
            rels = [r for r in rels if any(x["name"].lower().startswith(key) for x in r.get("assets", []))]
        rels.sort(key=lambda r: r.get("published_at") or "", reverse=True)
        links = {}
        for k, l in a["links"].items():
            l = dict(l)
            total = 0
            for r in rels:
                for x in r.get("assets", []):
                    if kind_of(x["name"]) == k:
                        total += x.get("download_count") or 0
                    if x["name"] == l.get("file") and x.get("browser_download_url") == l.get("url"):
                        d = x.get("digest") or ""
                        if d.startswith("sha256:"):
                            l["sha256"] = d[7:]
            l["indirme"] = total
            links[k] = l
        notlar = []
        for r in rels[:4]:
            n = split_notes(r.get("body"))
            if n:
                notlar.append({"surum": r["tag_name"], "tarih": r.get("published_at"), "metin": n})
        icon, shots = find_images(tree(repo, branches.get(repo, "main")), repo, branches.get(repo, "main"), prefix)
        out.append({"id": aid, "name": a["name"], "repo": repo, "links": links, "notlar": notlar,
                    "ikon": icon, "ekranlar": shots,
                    "surumler": f"https://github.com/{OWNER}/{repo}/releases"})
    data = {"guncellendi": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "programlar": out}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"site verisi: {len(out)} program")
