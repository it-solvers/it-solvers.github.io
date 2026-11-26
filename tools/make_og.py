#!/usr/bin/env python3
"""페이지별 공유 이미지(og:image, 1200x630)를 만들고 HTML의 태그를 연결한다.

사용법(저장소 어디서든):
  python3 tools/make_og.py                  # PAGES 전체를 다시 만든다
  python3 tools/make_og.py about en/about   # 지정한 페이지만

새 페이지를 만들면 PAGES에 한 항목을 더하고 실행한다. Google Chrome이 필요하다.
"""
import html
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://itsolvers.co.kr/"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# 페이지: (제목(줄바꿈은 |), 초록 부제, 설명 2줄, 터미널 창 이름, 창 안의 항목들)
PAGES = {
    "index": ("아이티해결단", "IT Solvers", ["AI 중심 소프트웨어·앱 개발", "IT자산 공급 · 서버·NAS 구축"], "home",
              ["MVP", "계산도구", "업무지식", "서비스", "문의"]),
    "about": ("아이티해결단|소개", "About IT Solvers", ["소프트웨어·웹·앱 개발과", "유지보수, IT자산 공급"], "about",
              ["서비스", "진행순서", "주요실적", "문의"]),
    "contact": ("문의 안내", "Contact", ["개발·유지보수·IT자산 상담", "오류 제보와 제휴 문의"], "contact",
                ["개발 상담", "유지보수", "IT자산", "콘텐츠 오류 제보", "제휴 문의"]),
    "privacy": ("개인정보|처리방침", "Privacy Policy", ["수집 항목과 이용 목적", "보유 기간, 이용자의 권리"], "privacy",
                ["수집 항목·이용 목적", "보유 기간과 파기", "쿠키와 방문 분석", "이용자의 권리"]),
    "insights/account-quiz": ("개발자를 위한|회계", "계정과목 퀴즈", ["퀴즈로 익히는", "개발자용 회계 기초"], "account-quiz",
                              ["Q. 이 거래의 계정과목은?", "자산", "부채", "자본", "수익 · 비용"]),
    "insights/e-contract": ("전자계약서|전자서명", "구독료 없이, 내 계약서는 내가", ["PDF를 올리고 링크 하나로", "가입·설치 없이 휴대폰 서명"], "e-contract",
                            ["1. PDF 올리기", "2. 링크 보내기", "3. 휴대폰으로 서명", "4. 서명 이력·문서 지문"]),
    "insights/irr-to-rate-calculator": ("목표 IRR|금리 역산", "시행착오법과 이분법", ["목표 연 IRR에 맞는", "순수 리스료 구하기"], "irr-to-rate",
                                        ["목표 IRR 입력", "범위를 절반씩 좁히기", "순수 리스료", "월별 현금흐름"]),
    "insights/lease-cashflow-irr-calculator": ("리스 현금흐름|IRR 계산기", "보험료·자동차세 반영", ["월 리스료와", "현금흐름 기준 연 IRR"], "cashflow-irr",
                                               ["차량가격 · 기간 · 금리", "보증·무보증 잔가", "보험료 · 자동차세", "월 리스료", "연 IRR"]),
    "insights/lease-estimate": ("리스 견적|내기", "진행중", ["차량·기간·금리 조건으로", "만드는 학습용 웹 도구"], "lease-estimate",
                                ["차량 선택", "리스 기간", "금리", "리스 견적", "※ 현대자동차 승용차만 지원"]),
    "insights/lease-overview": ("리스 개요", "K-IFRS 제1116호", ["정의와 흐름, 회계처리", "리스 분류와 종류"], "lease-overview",
                                ["리스의 정의·흐름", "리스이용자 회계처리", "금융리스 · 운용리스", "리스 변경", "리스의 종류"]),
    "insights/lease-payment-calculator": ("리스료|계산기", "PMT 공식", ["차량대금·기간·금리·잔가로", "월 리스료 계산"], "lease-payment",
                                          ["차량대금", "리스 기간", "연 금리", "만기 잔가", "→ 월 리스료"]),
    "insights/lease-revenue-recognition-guide": ("리스 수익|인식 가이드", "금융리스 vs 운용리스", ["36개월 예시로 비교하는", "수익 인식과 분개"], "revenue-guide",
                                                 ["계약 실행일", "리스료 수취", "이자수익 · 원금 회수", "감가상각비", "월별 이익 비교"]),
    "insights/lease-terms": ("리스 용어|정리", "K-IFRS 제1116호 관점", ["리스 실무에서 자주 쓰는", "용어를 쉽게 설명"], "lease-terms",
                             ["매수선택권", "잔존가치", "공정가치", "내재이자율(IRR)", "규정손해금"]),
    "insights/soundstaff": ("SoundStaff", "MIDI·음원을 악보로", ["무료 MIDI 악보 변환 웹앱", "PDF · MusicXML 저장"], "images/soundstaff/03-score.png", []),
    "insights/web-ui-glossary": ("웹 UI|용어 사전", "Web UI Glossary", ["105개 화면 용어", "예시와 복사용 코드"], "ui-glossary",
                                 ["히어로 섹션", "모달", "드로어", "토스트", "스켈레톤 로딩"]),
    "en/index": ("IT Solvers", "AI-first IT company", ["Software and app development", "IT asset supply · servers · NAS"], "home",
                 ["MVPs", "Calculators", "Insights", "Services", "Contact"]),
    "en/about": ("About|IT Solvers", "Software · Web · Apps", ["Development, maintenance,", "and IT asset supply"], "about",
                 ["Services", "Process", "Track record", "Contact"]),
    "en/contact": ("Contact", "IT Solvers", ["Development and maintenance,", "IT assets, and partnerships"], "contact",
                   ["Development", "Maintenance", "IT assets", "Content corrections", "Partnerships"]),
    "en/privacy": ("Privacy|Policy", "IT Solvers", ["What we collect and why,", "and your rights"], "privacy",
                   ["Information we collect", "How long we keep it", "Cookies and analytics", "Your rights"]),
    "en/insights/account-quiz": ("Accounting for|Developers", "Account Title Quiz", ["Learn accounting basics", "one quiz at a time"], "account-quiz",
                                 ["Q. Which account is this?", "Assets", "Liabilities", "Equity", "Revenue · Expenses"]),
    "en/insights/e-contract": ("E-Contract|Signing", "Without a subscription", ["Upload a PDF, send one link,", "sign on a phone"], "e-contract",
                               ["1. Upload a PDF", "2. Send the link", "3. Sign on a phone", "4. Signature history"]),
    "en/insights/irr-to-rate-calculator": ("Target IRR to|Lease Payment", "Bisection search", ["Back-solve the base payment", "from a target IRR"], "irr-to-rate",
                                           ["Enter a target IRR", "Halve the range", "Base lease payment", "Monthly cash flows"]),
    "en/insights/lease-cashflow-irr-calculator": ("Lease Cash-Flow|IRR Calculator", "Insurance and vehicle tax", ["Lease payments, residual value,", "and payment timing"], "cashflow-irr",
                                                  ["Price · Term · Rate", "Residual value", "Insurance · Vehicle tax", "Monthly payment", "Annualized IRR"]),
    "en/insights/lease-estimate": ("Get a Lease|Estimate", "In progress", ["A learning tool for vehicle,", "term, and interest rate"], "lease-estimate",
                                   ["Vehicle", "Lease term", "Interest rate", "Estimate", "* Available in Korean only"]),
    "en/insights/lease-overview": ("Lease|Overview", "K-IFRS 1116", ["Definition, flow, accounting,", "classification, and types"], "lease-overview",
                                   ["Definition and flow", "Lessee accounting", "Finance · Operating", "Modifications", "Types of leases"]),
    "en/insights/lease-payment-calculator": ("Lease Payment|Calculator", "The PMT formula", ["Estimate a monthly payment", "from price, term, and rate"], "lease-payment",
                                             ["Vehicle price", "Lease term", "Annual rate", "Residual value", "→ Monthly payment"]),
    "en/insights/lease-revenue-recognition-guide": ("Lease Revenue|Recognition", "Finance vs. operating", ["Journal entries compared", "in a 36-month example"], "revenue-guide",
                                                    ["Start date", "Monthly payment", "Interest · Principal", "Depreciation", "Monthly profit"]),
    "en/insights/lease-terms": ("Lease|Terminology", "13 terms explained", ["Plain-language definitions", "with examples"], "lease-terms",
                                ["Purchase option", "Residual value", "Fair value", "Implicit rate (IRR)", "Deposits"]),
    "en/insights/soundstaff": ("SoundStaff", "MIDI and audio to sheet music", ["Free MIDI to sheet music web app", "Save as PDF or MusicXML"], "images/soundstaff/en/03-score.png", []),
    "en/insights/web-ui-glossary": ("Web UI|Glossary", "Live examples and code", ["105 screen elements", "with copy-ready code"], "ui-glossary",
                                    ["Hero section", "Modal", "Drawer", "Toast", "Skeleton loading"]),
}


def image_path(page):
    """공유 이미지의 저장소 안 경로."""
    name = page.rsplit("/", 1)[-1]
    english = page.startswith("en/")
    if name == "soundstaff":
        return f"images/soundstaff/{'en/' if english else ''}og.png"
    return f"images/og/{'en/' if english else ''}{'home' if name == 'index' else name}.png"


def render(page, spec):
    title, sub, lines, window, items = spec
    esc = html.escape
    size = 68 if max(len(t) for t in title.split("|")) <= 11 else 56
    if items:
        rows = "".join(f'<p><b>›</b> {esc(i)}</p>' for i in items)
        right = (f'<div class="win"><div class="bar"><i></i><i></i><i></i><span>~/{esc(window)}</span></div>'
                 f'{rows}</div>')
    else:  # window 값이 화면 그림 경로: 악보 부분만 잘라 보여 준다
        right = f'<div class="shot"><img src="{(ROOT / window).as_uri()}"></div>'
    doc = f"""<!doctype html><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box;font-style:normal}}
body{{width:1200px;height:630px;overflow:hidden;background:#0b0e13;color:#f1f5f9;font-family:"Apple SD Gothic Neo",sans-serif;position:relative}}
.left{{position:absolute;left:80px;top:0;height:630px;width:540px;display:flex;flex-direction:column;justify-content:center}}
h1{{font-size:{size}px;line-height:1.18;font-weight:800;white-space:nowrap}}
h2{{font-size:31px;font-weight:500;color:#3fdc8a;margin:16px 0 36px;white-space:nowrap}}
.left p{{font-size:30px;line-height:1.65;white-space:nowrap}}
.left small{{font-size:23px;color:#94a3b8;margin-top:40px}}
.win,.shot{{position:absolute;left:648px;top:135px;width:488px;height:360px;border-radius:16px;overflow:hidden}}
.win{{background:#131923;border:1px solid #2a3444}}
.bar{{height:48px;background:#1b2330;display:flex;align-items:center;gap:9px;padding:0 18px;margin-bottom:20px}}
.bar i{{width:13px;height:13px;border-radius:50%;background:#475569}}
.bar span{{font:17px Menlo,monospace;color:#94a3b8;margin-left:10px}}
.win p{{font-size:25px;line-height:54px;padding:0 30px;white-space:nowrap}}
.win b{{color:#5cc8ff;margin-right:10px}}
.shot{{left:624px;width:528px;background:#f1f4f9}}
.shot img{{position:absolute;width:660px;left:-66px;top:-70px}}
</style>
<div class="left"><h1>{'<br>'.join(map(esc, title.split('|')))}</h1><h2>{esc(sub)}</h2>
{''.join(f'<p>{esc(l)}</p>' for l in lines)}<small>itsolvers.co.kr</small></div>{right}"""
    out = ROOT / image_path(page)
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "og.html"
        src.write_text(doc, encoding="utf-8")
        subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
                        "--force-device-scale-factor=1", "--allow-file-access-from-files",
                        "--window-size=1200,630", f"--screenshot={out}", src.as_uri()],
                       check=True, capture_output=True)


def connect(page, spec):
    """HTML의 og:image·twitter 태그가 전용 이미지를 가리키게 한다(없으면 넣는다)."""
    path = ROOT / f"{page}.html"
    text = path.read_text(encoding="utf-8")
    url = SITE + image_path(page)
    alt = html.escape(f"{spec[0].replace('|', ' ')}: {spec[1]}")
    tags = [("property", "og:image", url), ("property", "og:image:width", "1200"),
            ("property", "og:image:height", "630"), ("property", "og:image:alt", alt),
            ("name", "twitter:card", "summary_large_image"), ("name", "twitter:image", url)]
    previous = None
    for attr, key, value in tags:
        tag = f'<meta {attr}="{key}" content="{value}">'
        pattern = re.compile(rf'<meta {attr}="{re.escape(key)}" content="[^"]*"\s*/?>')
        if pattern.search(text):
            text = pattern.sub(lambda _: tag, text, count=1)
        elif previous:
            text = text.replace(previous, f"{previous}\n  {tag}", 1)
        else:
            text = text.replace("</head>", f"  {tag}\n</head>", 1)
        previous = tag
    path.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    for page in sys.argv[1:] or PAGES:
        render(page, PAGES[page])
        connect(page, PAGES[page])
        print(page, "->", image_path(page))
