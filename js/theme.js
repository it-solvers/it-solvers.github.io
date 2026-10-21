/* 화면 밝기(밝게/어둡게) 전환: 모든 서브페이지 공통.
   - 한글 메인·영문 메인과 같은 저장값(localStorage "theme")을 쓴다. 저장값이 없으면 어두운 화면이 기본이다.
   - <head>에서 바로 실행해 깜빡임을 막고, 헤더에 ☀ ☾ 버튼을 자동으로 넣는다.
   - 계산·화면 로직과 무관하다. */
(function () {
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) { }
  if (saved === "light") root.classList.remove("dark-mode");
  else root.classList.add("dark-mode");

  var isKo = (root.getAttribute("lang") || "").indexOf("ko") === 0;

  function update(button) {
    button.setAttribute("aria-pressed", root.classList.contains("dark-mode") ? "true" : "false");
  }

  function toggle() {
    var dark = root.classList.toggle("dark-mode");
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (e) { }
    var b = document.querySelector(".theme-toggle");
    if (b) update(b);
  }

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
    update(b);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButton);
  else addButton();
})();
