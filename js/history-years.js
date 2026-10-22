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

    var label = document.createElement("output");
    label.className = "history-years-label";

    var range = document.createElement("input");
    range.type = "range";
    range.className = "history-years-range";
    range.min = 0;
    range.max = years.length;
    range.step = 1;
    range.value = 0;
    range.setAttribute("aria-label", "시작 연도 선택");

    function select(year) {
        label.textContent = year === "all" ? "전체" : year + "년";
        label.style.setProperty("--pos", range.value / range.max);
        items.forEach(function (item) {
            item.hidden = year !== "all" && item.dataset.year !== year;
        });
        if (more) {
            var summary = more.querySelector("summary");
            if (year === "all") {
                more.open = false;
                more.hidden = false;
                if (summary) summary.hidden = false;
            } else {
                more.open = true;
                if (summary) summary.hidden = true;
                more.hidden = !more.querySelector(".history-item:not([hidden])");
            }
        }
    }

    range.addEventListener("input", function () {
        var i = Number(range.value);
        select(i === 0 ? "all" : years[i - 1]);
    });

    bar.appendChild(range);
    bar.appendChild(label);
    list.parentNode.insertBefore(bar, list);
    select("all");
})();
