/* 서브페이지 공통: 스크롤해서 카드가 화면에 들어오면 나타나게 한다.
   - 자바스크립트가 꺼져 있거나 '움직임 줄이기'를 켰으면 아무것도 하지 않아 처음부터 모두 보인다.
   - 계산기·용어 사전처럼 입력과 결과가 바뀌는 화면에는 이 카드들이 없어 영향이 없다.
   - 메인·소개·문의(인사이트 카드, 서비스 카드, 진행순서 카드)와 영문 메인(.card-link)에도 쓴다. */
(function () {
    'use strict';
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var items = document.querySelectorAll('.lease-overview .card, .cards .card, .insight-card, .service-card, .process-card, .card-link');
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
        // 나타난 뒤에는 효과용 클래스를 떼어, 카드 자체의 호버 효과·전환이 원래대로 동작하게 한다
        el.addEventListener('transitionend', function done(ev) {
            if (ev.propertyName !== 'opacity' || !el.classList.contains('is-in')) return; // 숨길 때 생긴 전환은 무시
            el.classList.remove('fx-reveal', 'is-in');
            el.style.removeProperty('--d');
            el.removeEventListener('transitionend', done);
        });
        io.observe(el);
    });
})();
