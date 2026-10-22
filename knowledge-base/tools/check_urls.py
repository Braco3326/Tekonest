"""Check every URL recorded in the knowledge base and annotate url_status.

Stdlib only. Run from repo root:  python knowledge-base/tools/check_urls.py [--no-write]
Status values:
  ok          2xx after redirects
  blocked     401/403/405/429/999 or similar: the server refused a bot; the page probably exists
  dead        404/410: broken link
  error:<x>   DNS/TLS/timeout/connection error (re-check by hand before calling it broken)
Writes tools/url-check.json and adds "url_status" to sources[] and manuals[] in equipment/*.json,
learning-resources.json and 3d-models.json.
"""
import argparse
import json
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

KB = Path(__file__).resolve().parent.parent
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
URL_RE = re.compile(r"https?://[^\s\)\]\"'<>|`]+")
BLOCKED = {401, 403, 405, 406, 429, 451, 503, 999}


def fetch(url):
    if "://" not in url or " " in url.split("://", 1)[1].split("/", 1)[0] or re.search(r"\s(returned|and|not)\s", url):
        return "not-a-url"  # prose from a not_found_log, e.g. "https://x returned 403"
    ctx = ssl.create_default_context()
    # browsers percent-encode spaces and non-ASCII; do the same, keeping existing escapes
    url = urllib.parse.quote(url, safe=":/?#[]@!$&'()*+,;=%~")
    for method in ("HEAD", "GET"):
        req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "*/*", "Accept-Language": "fr,en;q=0.8"})
        try:
            with urllib.request.urlopen(req, timeout=25, context=ctx) as r:
                return "ok" if 200 <= r.status < 400 else f"http-{r.status}"
        except urllib.error.HTTPError as e:
            if method == "HEAD" and e.code in (400, 403, 404, 405, 501):
                continue  # many servers mishandle HEAD; retry GET
            if e.code in (404, 410):
                return "dead"
            if e.code in BLOCKED:
                return "blocked"
            return f"http-{e.code}"
        except Exception as e:  # noqa: BLE001
            if method == "HEAD":
                continue
            return f"error:{type(e).__name__}"
    return "error:unknown"


def collect(obj, acc):
    if isinstance(obj, dict):
        for v in obj.values():
            collect(v, acc)
    elif isinstance(obj, list):
        for v in obj:
            collect(v, acc)
    elif isinstance(obj, str) and obj.startswith("http"):
        acc.add(obj.strip())


def annotate(obj, status):
    if isinstance(obj, dict):
        if isinstance(obj.get("url"), str) and obj["url"] in status:
            obj["url_status"] = status[obj["url"]]
        for k in ("manual_url", "datasheet_url", "product_page_url", "model_url", "access_link"):
            if isinstance(obj.get(k), str) and obj[k] in status:
                obj[k + "_status"] = status[obj[k]]
        for v in obj.values():
            annotate(v, status)
    elif isinstance(obj, list):
        for v in obj:
            annotate(v, status)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-write", action="store_true")
    a = ap.parse_args()
    json_files = sorted((KB / "equipment").glob("*.json")) + [p for p in [KB / "learning-resources.json", KB / "3d-models.json", KB / "taxonomy.json"] if p.exists()]
    md_files = sorted((KB / "fundamentals").glob("*.md")) if (KB / "fundamentals").exists() else []
    urls = set()
    loaded = {}
    for p in json_files:
        loaded[p] = json.loads(p.read_text(encoding="utf-8"))
        collect(loaded[p], urls)
    for p in md_files:
        for u in URL_RE.findall(p.read_text(encoding="utf-8")):
            urls.add(u.rstrip(".,;:"))
    urls = sorted(urls)
    print(f"checking {len(urls)} URLs")
    with ThreadPoolExecutor(max_workers=16) as ex:
        status = dict(zip(urls, ex.map(fetch, urls)))
    (KB / "tools" / "url-check.json").write_text(json.dumps(status, indent=1, ensure_ascii=False), encoding="utf-8")
    if not a.no_write:
        for p, data in loaded.items():
            if p.name == "taxonomy.json":
                continue
            annotate(data, status)
            p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    counts = {}
    for s in status.values():
        k = s.split(":")[0]
        counts[k] = counts.get(k, 0) + 1
    print(json.dumps(counts))


if __name__ == "__main__":
    main()
