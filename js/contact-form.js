/* 문의 폼 공용 스크립트: 한글 메인(index.html)·소개·문의 안내와 영문 소개·문의 안내가 함께 쓴다.
   1) 이메일 주소 복사  2) 문의 폼 전송(Web3Forms). 해당 요소가 없는 페이지에서는 아무 일도 하지 않는다.
   화면에 보이는 문구는 <html lang>이 en이면 영어, 아니면 한국어로 보여 준다. */
var CF_TEXT = (document.documentElement.lang || "").toLowerCase().indexOf("en") === 0 ? {
    copyOk: "Email address copied. Paste it into your email to send us a message.",
    copyFail: "Could not copy. Click the address above to select it and copy it yourself.",
    sending: "Sending…",
    sent: "Your message was sent. We will review it and reply to the email you entered.",
    failTry: "Could not send. Please try again later or email us at the address below.",
    failNet: "Could not send. Please check your connection or email us at the address below."
} : {
    copyOk: "이메일 주소를 복사했습니다. 메일에 붙여넣어 보내 주세요.",
    copyFail: "복사하지 못했습니다. 위의 주소를 눌러 선택한 뒤 직접 복사해 주세요.",
    sending: "보내는 중…",
    sent: "문의가 전달되었습니다. 확인 후 입력하신 이메일로 답변드리겠습니다.",
    failTry: "전송하지 못했습니다. 잠시 후 다시 시도하시거나 아래 이메일로 보내 주세요.",
    failNet: "전송하지 못했습니다. 인터넷 연결을 확인하시거나 아래 이메일로 보내 주세요."
};

/* 문의: 이메일 주소 복사. 최신 방식(navigator.clipboard)이 막힌 환경에서는 임시 입력칸으로 복사한다. */
(function () {

    const button = document.getElementById("copyEmail");
    const status = document.getElementById("copyStatus");
    if (!button || !status) return;

    let timer = null;

    function show(message) {
        status.textContent = message;
        clearTimeout(timer);
        timer = setTimeout(function () { status.textContent = ""; }, 5000);
    }

    function legacyCopy(text) {
        const box = document.createElement("textarea");
        box.value = text;
        box.setAttribute("readonly", "");
        box.style.position = "fixed";
        box.style.opacity = "0";
        document.body.appendChild(box);
        box.select();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { }
        document.body.removeChild(box);
        return ok;
    }

    button.addEventListener("click", function () {

        const email = button.getAttribute("data-email");

        const done = function (ok) {
            show(ok
                ? CF_TEXT.copyOk
                : CF_TEXT.copyFail);
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(email).then(
                function () { done(true); },
                function () { done(legacyCopy(email)); }
            );
        } else {
            done(legacyCopy(email));
        }
    });

})();


/* 문의 폼 전송: 페이지를 벗어나지 않고 그 자리에서 결과를 보여 준다.
   (JavaScript가 꺼져 있으면 form의 action/method로 그대로 전송된다) */
(function () {

    const form = document.getElementById("contactForm");
    const submit = document.getElementById("contactSubmit");
    const status = document.getElementById("contactStatus");
    if (!form || !submit || !status) return;

    const labelOriginal = submit.textContent.trim();

    function show(message, isError) {
        status.textContent = message;
        status.classList.toggle("is-error", !!isError);
    }

    form.addEventListener("submit", function (e) {

        e.preventDefault();

        show("", false);
        submit.disabled = true;
        submit.textContent = CF_TEXT.sending;

        fetch(form.action, {
            method: "POST",
            headers: { "Accept": "application/json" },
            body: new FormData(form)
        })
            .then(function (res) {
                return res.json().catch(function () { return {}; }).then(function (data) {
                    return { ok: res.ok && data.success !== false, data: data };
                });
            })
            .then(function (result) {
                if (result.ok) {
                    form.reset();
                    show(CF_TEXT.sent, false);
                } else {
                    show(CF_TEXT.failTry, true);
                }
            })
            .catch(function () {
                show(CF_TEXT.failNet, true);
            })
            .then(function () {
                submit.disabled = false;
                submit.textContent = labelOriginal;
            });
    });

})();
