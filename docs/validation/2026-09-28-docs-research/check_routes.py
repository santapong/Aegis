"""Read-only documentation route, anchor and downloadable-example smoke check."""
import json
import re
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = "http://127.0.0.1:3098"
source = (ROOT / "frontend/src/app/docs/catalog.ts").read_text()
routes = ["/docs", "/docs/guides", "/docs/developers"] + [
    f"/docs/{audience}/{slug}"
    for slug, audience in re.findall(r'slug: "([^"]+)",\s+audience: "([^"]+)"', source)
]

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.h1, self.sections = set(), [], 0, 0
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs: self.ids.add(attrs["id"])
        if tag == "a": self.links.append(attrs.get("href", ""))
        if tag == "h1": self.h1 += 1
        if tag == "section" and attrs.get("id"): self.sections += 1

pages, results = {}, []
for route in routes:
    with urllib.request.urlopen(BASE + route) as response:
        page = Page()
        page.feed(response.read().decode())
        pages[route] = page
        assert response.status == 200 and page.h1 == 1 and "docs-main" in page.ids
        if route.count("/") == 3: assert page.sections >= 3
        results.append({"route": route, "status": response.status, "h1_count": page.h1, "rendered_sections": page.sections})
errors = []
for route, page in pages.items():
    for href in page.links:
        target, _, anchor = href.partition("#")
        target = target or route
        if target in pages and anchor and anchor not in pages[target].ids:
            errors.append([route, href])
assert not errors, errors
with urllib.request.urlopen(BASE + "/docs/example-transactions.csv") as response:
    assert response.read() == (ROOT / "frontend/public/docs/example-transactions.csv").read_bytes()
try:
    urllib.request.urlopen(BASE + "/docs/guides/not-a-real-guide")
    raise AssertionError("Unknown guide did not return 404")
except urllib.error.HTTPError as error:
    assert error.code == 404
result = {"routes": results, "broken_doc_anchors": errors, "download_matches_source": True, "unknown_guide_status": 404}
Path(__file__).with_name("routes.json").write_text(json.dumps(result, indent=2) + "\n")
print(f"Passed: {len(routes)} routes, document anchors, CSV download and unknown-guide 404.")
