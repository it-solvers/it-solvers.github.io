#!/usr/bin/env python3
"""공통 헤더·푸터를 모든 페이지에 찍어 넣는다(정적 사이트라 서버가 합쳐 주지 않기 때문).

사용법:  python3 tools/build-common.py          (고쳐서 저장)
         python3 tools/build-common.py --check  (바뀔 파일만 보여 주고 저장하지 않음)

- 조각 원본: tools/parts/{header,footer}.{ko,en}.html   ← 헤더·푸터를 고칠 때는 여기만 고친다
- 푸터: 모든 페이지(한글·영문)의 <footer>…</footer>를 조각으로 바꾼다.
- 헤더: 서브페이지의 첫 <header>…</header>를 조각으로 바꾼다.
  단, 메뉴가 있는 메인(index.html, en/index.html)의 헤더는 그 페이지 고유라 건드리지 않는다.
- 영어/한글 짝이 되는 주소는 파일 위치로 계산한다(en/X.html ↔ X.html).
- <script>와 본문은 건드리지 않는다. 같은 결과가 나오면 파일을 다시 쓰지 않는다(여러 번 돌려도 안전).
"""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARTS = ROOT / "tools" / "parts"
YEAR = "2026"
SKIP_PAGES = {"googlea9ab888401fe0dff.html"}          # 구글 인증 파일
SKIP_DIRS = {"app", "tools", "docs", "css", "js", "images"}  # 앱 개인정보 문서 등
KEEP_OWN_HEADER = {"index.html", "en/index.html"}      # 메뉴가 있는 메인

def part(name):
    return (PARTS / name).read_text(encoding="utf-8").rstrip("\n")

def url_of(rel, lang_switch):
    """rel: 'insights/x.html' 같은 사이트 경로. lang_switch: 'en'이면 en/ 붙임, 'ko'이면 en/ 뗌."""
    if lang_switch == "en":
        p = "en/" + rel
    else:
        p = rel[3:] if rel.startswith("en/") else rel
    if p in ("index.html", "en/index.html"):
        p = p[:-len("index.html")]
    return "/" + p

def build(path):
    rel = path.relative_to(ROOT).as_posix()
    is_en = rel.startswith("en/")
    lang = "en" if is_en else "ko"
    s = path.read_text(encoding="utf-8")
    orig = s

    ko_rel = rel[3:] if is_en else rel
    en_rel = rel if is_en else "en/" + rel
    ko_url = url_of(ko_rel, "ko")
    other_url = ko_url if is_en else url_of(rel, "en")
    # 한글 페이지의 영어 짝이 없으면 언어 링크 없이 둔다
    has_pair = (ROOT / (ko_rel)).exists() and (ROOT / en_rel).exists()

    footer = part(f"footer.{lang}.html").replace("{{YEAR}}", YEAR).replace("{{KO_URL}}", ko_url)
    s, n = re.subn(r"<footer\b.*?</footer>", lambda m: footer, s, count=1, flags=re.S)
    if n != 1:
        print("푸터 없음:", rel)

    if rel not in KEEP_OWN_HEADER:
        header = part(f"header.{lang}.html").replace("{{OTHER_URL}}", other_url)
        if not has_pair:
            header = re.sub(r'\n    <div class="nav-right">.*?</div>', '', header, flags=re.S)
        s, n = re.subn(r"<header\b.*?</header>", lambda m: header, s, count=1, flags=re.S)
        if n != 1:
            print("헤더 없음:", rel)

    return orig, s

def main():
    check = "--check" in sys.argv
    changed = 0
    for p in sorted(ROOT.rglob("*.html")):
        rel = p.relative_to(ROOT)
        if rel.parts[0] in SKIP_DIRS or p.name in SKIP_PAGES:
            continue
        orig, new = build(p)
        if new != orig:
            changed += 1
            print(("바뀜: " if not check else "바뀔 예정: ") + rel.as_posix())
            if not check:
                p.write_text(new, encoding="utf-8")
    print(f"{changed}개 파일" + (" (저장 안 함)" if check else " 저장"))

if __name__ == "__main__":
    main()
