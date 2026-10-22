/* 주요실적: 카드 위 연도 슬라이드. 연도를 누르면 그 연도에 시작한 실적만 보이고, '전체'는 처음 모양으로 돌아간다. */
(function () {
    var list = document.querySelector(".history-list");
    if (!list) return;

    var more = list.querySelector(".history-more");
    var items = Array.prototype.slice.call(list.querySelectorAll(".history-item"));
    var years = [];

    items.forEach(function (item) {
        var d = item.querySelector(".history-date");
        var m = d && d.textContent.match(/\d{4}/);
        item.dataset.year = m ? m[0] : "";
        if (m && years.indexOf(m[0]) < 0) years.push(m[0]);
    });
    if (!years.length) return;

    var bar = document.createElement("div");
    bar.className = "history-years";
    bar.setAttribute("role", "tablist");

    function select(year) {
        Array.prototype.forEach.call(bar.children, function (b) {
            var on = b.dataset.year === year;
            b.classList.toggle("is-active", on);
            b.setAttribute("aria-selected", on ? "true" : "false");
        });
        items.forEach(function (item) {
            item.hidden = year !== "all" && item.dataset.year !== year;
        });
        if (more) {
            more.open = year !== "all" ? true : false;
            var summary = more.querySelector("summary");
            if (summary) summary.hidden = year !== "all";
            more.hidden = year !== "all" && !more.querySelector(".history-item:not([hidden])");
        }
        if (year === "all") {
            items.forEach(function (item) { item.hidden = false; });
            if (more) more.hidden = false;
        }
    }

    ["all"].concat(years).forEach(function (y) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "history-year-chip";
        b.setAttribute("role", "tab");
        b.dataset.year = y;
        b.textContent = y === "all" ? "전체" : y;
        b.addEventListener("click", function () { select(y); });
        bar.appendChild(b);
    });

    list.parentNode.insertBefore(bar, list);
    select("all");
})();
