/* 서브페이지 공통: 스크롤해서 카드가 화면에 들어오면 나타나게 한다.
   - 자바스크립트가 꺼져 있거나 '움직임 줄이기'를 켰으면 아무것도 하지 않아 처음부터 모두 보인다.
   - 계산기·용어 사전처럼 입력과 결과가 바뀌는 화면에는 카드(.card)가 없어 영향이 없다. */
(function () {
    'use strict';
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var items = document.querySelectorAll('.lease-overview .card, .cards .card');
    if (!items.length) return;

    document.documentElement.classList.add('js-fx');
    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
        });
    }, { threshold: 0.12 });

    items.forEach(function (el, i) {
        el.classList.add('fx-reveal');
        el.style.setProperty('--d', ((i % 3) * 0.06) + 's'); // 같은 줄 카드는 조금씩 늦게
        io.observe(el);
    });
})();
