/* 화면 밝기(밝게/어둡게): 모든 페이지 공통.
   - 기본은 자동이다. 인천 동인천역(북위 37.4752°, 동경 126.6329°) 기준 그날의 일출~일몰에는 밝게, 그 밖에는 어둡게 보인다.
     일출·일몰 시각은 이 파일 안에서 계산하므로 외부 서비스나 위치 권한이 필요 없다.
   - 사용자가 ☀ ☾ 버튼으로 직접 바꾸면 다음 일출·일몰 시각까지만 그 선택을 유지하고, 그 뒤에는 다시 자동으로 돌아간다.
     선택은 localStorage의 theme(dark/light)과 themeUntil(유지 종료 시각, 밀리초)에 저장하며 한글·영문 모든 페이지가 공유한다.
   - 페이지를 열어 둔 채로 일출·일몰이 지나면 화면이 저절로 바뀐다.
   - <head>에서 바로 실행해 깜빡임을 막고, 헤더에 ☀ ☾ 버튼이 없으면 자동으로 넣는다. 계산·화면 로직과 무관하다. */
(function () {
  var root = document.documentElement;
  var LAT = 37.4752, LON = 126.6329; /* 인천 동인천역 */
  var KST = 9 * 3600 * 1000;
  var RAD = Math.PI / 180;

  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function write(key, value) { try { localStorage.setItem(key, value); } catch (e) { } }
  function remove(key) { try { localStorage.removeItem(key); } catch (e) { } }

  /* 한국 날짜(y, m, d)의 일출·일몰 시각(Date). NOAA 태양 위치 계산식을 쓴다. */
  function sunTimes(y, m, d) {
    var jd = Date.UTC(y, m, d, 3, 0, 0) / 86400000 + 2440587.5; /* 한국 정오 = 03:00 UTC */
    var t = (jd - 2451545.0) / 36525;
    var l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
    var mA = 357.52911 + t * (35999.05029 - 0.0001537 * t);
    var e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
    var c = Math.sin(mA * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
      Math.sin(2 * mA * RAD) * (0.019993 - 0.000101 * t) + Math.sin(3 * mA * RAD) * 0.000289;
    var omega = 125.04 - 1934.136 * t;
    var lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(omega * RAD);
    var eps = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(omega * RAD);
    var decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
    var yy = Math.pow(Math.tan(eps * RAD / 2), 2);
    var eq = 4 / RAD * (yy * Math.sin(2 * l0 * RAD) - 2 * e * Math.sin(mA * RAD) +
      4 * e * yy * Math.sin(mA * RAD) * Math.cos(2 * l0 * RAD) - 0.5 * yy * yy * Math.sin(4 * l0 * RAD) -
      1.25 * e * e * Math.sin(2 * mA * RAD));
    var cosHa = Math.cos(90.833 * RAD) / (Math.cos(LAT * RAD) * Math.cos(decl)) - Math.tan(LAT * RAD) * Math.tan(decl);
    cosHa = Math.max(-1, Math.min(1, cosHa));
    var ha = Math.acos(cosHa) / RAD;
    var base = Date.UTC(y, m, d);
    return {
      rise: base + (720 - 4 * (LON + ha) - eq) * 60000,
      set: base + (720 - 4 * (LON - ha) - eq) * 60000
    };
  }

  function koreanDay(ms) {
    var k = new Date(ms + KST);
    return [k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()];
  }

  function isDay(now) {
    var d = koreanDay(now), s = sunTimes(d[0], d[1], d[2]);
    return now >= s.rise && now < s.set;
  }

  /* now 이후 처음 오는 일출 또는 일몰 시각(밀리초) */
  function nextTransition(now) {
    var best = Infinity;
    for (var add = -1; add <= 2; add++) {
      var d = koreanDay(now + add * 86400000), s = sunTimes(d[0], d[1], d[2]);
      if (s.rise > now && s.rise < best) best = s.rise;
      if (s.set > now && s.set < best) best = s.set;
    }
    return best;
  }

  /* 지금 보여 줄 밝기: 아직 유효한 직접 선택이 있으면 그것, 없으면 자동 */
  function resolve() {
    var now = Date.now(), saved = read("theme"), until = Number(read("themeUntil"));
    if ((saved === "dark" || saved === "light") && until > now) return saved;
    if (saved || read("themeUntil")) { remove("theme"); remove("themeUntil"); }
    return isDay(now) ? "light" : "dark";
  }

  function updateButtons() {
    var b = document.querySelector(".theme-toggle");
    if (b) b.setAttribute("aria-pressed", root.classList.contains("dark-mode") ? "true" : "false");
  }

  function apply() {
    if (resolve() === "light") root.classList.remove("dark-mode");
    else root.classList.add("dark-mode");
    updateButtons();
  }

  var timer = null;
  function schedule() {
    if (timer) clearTimeout(timer);
    var wait = Math.min(nextTransition(Date.now()) - Date.now() + 1000, 2147483000);
    timer = setTimeout(function () { apply(); schedule(); }, Math.max(wait, 1000));
  }

  /* ☀ ☾ 버튼: 지금과 반대로 바꾸고 다음 일출·일몰까지만 유지한다 */
  function toggle() {
    var toDark = !root.classList.contains("dark-mode");
    write("theme", toDark ? "dark" : "light");
    write("themeUntil", String(nextTransition(Date.now())));
    apply();
  }

  window.SunTheme = { toggle: toggle, apply: apply, isDay: isDay, sunTimes: sunTimes };

  apply();
  schedule();
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { apply(); schedule(); } });

  var isKo = (root.getAttribute("lang") || "").indexOf("ko") === 0;

  function addButton() {
    if (document.querySelector(".theme-toggle")) return;
    var header = document.querySelector("header");
    if (!header) return;
    var host = header.querySelector(".nav-right") || header.querySelector(".container, .wrap") || header;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "theme-toggle";
    b.title = isKo ? "화면 밝기 전환" : "Switch light or dark mode";
    b.setAttribute("aria-label", isKo ? "어두운 화면 모드" : "Dark mode");
    b.innerHTML = '<span class="light">☀</span><span class="dark"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M15 3.3A9 9 0 1 0 15 20.7A11 11 0 0 1 15 3.3z"/></svg></span>';
    b.addEventListener("click", toggle);
    host.appendChild(b);
    updateButtons();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButton);
  else addButton();
})();
