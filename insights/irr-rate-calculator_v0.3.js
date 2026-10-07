// ===== 조건 =====
const 차량대금 = 50000000;
const 개월수 = 36;
const 목표IRR_연 = 0.037412; // 3.7412%
const 월수수료 = 0;
const 보증잔가 = 5000000;
const 무보증잔가 = 15000000;
const 잔가 = 보증잔가 + 무보증잔가; // 20,000,000

const 연보험료 = 2100000;
const 연차세 = 1200000;
const 월보험료 = 연보험료 / 12; // 고객에게 매월 균등 수납
const 월차세 = 연차세 / 12;     // 고객에게 매월 균등 수납

// ===== 인도월 (1~12, 언제든 바뀔 수 있는 입력값) =====
const 인도월 = 7; // 예시: 7월 인도. 필요하면 이 값만 바꾸면 전체 스케줄이 자동으로 재계산됨

// ===== 보험료 실제 지급 스케줄 =====
// 인도 시점(0개월차)에 1회, 이후 12개월마다 1회씩 (36개월 기준 총 3회: 0, 12, 24개월차)
function 보험료지급스케줄(개월수) {
  const 지급목록 = [];
  for (let m = 0; m < 개월수; m += 12) {
    지급목록.push({ month: m, amount: 연보험료 });
  }
  return 지급목록;
}

// ===== 차세 실제 지급 스케줄 =====
// 인도 시점에 "그 해 남은 개월수(인도월~12월, 인도월 포함)" 비율만큼 비례 지급
// 그 다음부터는 매 1월(=인도월 기준 다음 1월이 몇 개월 뒤인지)마다 전액 지급
function 차세지급스케줄(인도월, 개월수) {
  const 지급목록 = [];
  const 첫해_잔여월 = 13 - 인도월; // 인도월부터 12월까지 개월 수 (인도월 포함)
  const 비례비율 = 첫해_잔여월 / 12;
  지급목록.push({ month: 0, amount: 연차세 * 비례비율 });

  let d = 첫해_잔여월; // 인도 시점부터 다음 1월까지의 개월수
  while (d < 개월수) {
    지급목록.push({ month: d, amount: 연차세 }); // 마지막 회차도 항상 12개월치 전액 납부
    d += 12;
  }
  return 지급목록;
}

// ===== 월 IRR 계산 (이분법) =====
function 월IRR계산(cashflows) {
  function npv(rate) {
    let sum = 0;
    for (let t = 0; t < cashflows.length; t++) {
      sum += cashflows[t] / Math.pow(1 + rate, t);
    }
    return sum;
  }
  let low = -0.9, high = 10;
  for (let i = 0; i < 500; i++) {
    const mid = (low + high) / 2;
    if (npv(mid) > 0) low = mid; else high = mid;
  }
  return (low + high) / 2;
}

// ===== 순수리스료가 주어졌을 때, 실제(보험료/차세 지급시점 반영) 연IRR 계산 =====
function 연IRR_정밀(순수리스료) {
  const cashflows = new Array(개월수 + 1).fill(0);

  // 0개월차: 차량대금 지출
  cashflows[0] += -차량대금;

  // 1~36개월차: 고객 수납 (매월 균등) - 수수료 차감
  for (let t = 1; t <= 개월수; t++) {
    let cf = 순수리스료 + 월보험료 + 월차세 - 월수수료;
    if (t === 개월수) cf += 잔가;
    cashflows[t] += cf;
  }

  // 보험료 실제 지급(지출) 반영
  for (const p of 보험료지급스케줄(개월수)) {
    cashflows[p.month] -= p.amount;
  }

  // 차세 실제 지급(지출) 반영
  for (const p of 차세지급스케줄(인도월, 개월수)) {
    cashflows[p.month] -= p.amount;
  }

  const 월IRR = 월IRR계산(cashflows);
  return { 연IRR: 월IRR * 12, cashflows };
}

// ===== 목표IRR에 맞는 순수리스료를 직접 이분법으로 탐색 =====
function 리스료탐색_정밀() {
  let low = 0, high = 차량대금;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const { 연IRR } = 연IRR_정밀(Math.floor(mid));
    if (연IRR < 목표IRR_연) low = mid; else high = mid;
  }
  return Math.floor((low + high) / 2);
}

// ===== (참고/회계용) 확정된 리스료로 36개월 상각했을 때 =====
// ===== 잔액이 정확히 "잔가"가 되도록 만드는 내재금리(월이자 절사 반영) 역산 =====
function 최종잔액계산(연금리, 리스료) {
  const 월금리 = 연금리 / 12;
  let 잔액 = 차량대금;
  for (let t = 1; t <= 개월수; t++) {
    const 이자 = Math.floor(잔액 * 월금리);
    잔액 = 잔액 + 이자 - 리스료;
  }
  return 잔액;
}

function 내재금리탐색(리스료) {
  let low = -0.5, high = 1.0;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const 최종잔액 = 최종잔액계산(mid, 리스료);
    if (최종잔액 < 잔가) low = mid; else high = mid;
  }
  return (low + high) / 2;
}

// ===== 실행 =====
const 순수리스료 = 리스료탐색_정밀();
const 결과 = 연IRR_정밀(순수리스료);
const 고객청구_총_리스료 = 순수리스료 + 월보험료 + 월차세;
const 내재금리 = 내재금리탐색(순수리스료);
const 검증_최종잔액 = 최종잔액계산(내재금리, 순수리스료);

console.log("=== 계산 결과 (인도월 기준 보험료/차세 실제 지급시점 반영) ===");
console.log("인도월:", 인도월, "월");
console.log("목표IRR(연):", (목표IRR_연 * 100) + "%");
console.log("------------------------------");
console.log("구해진 순수 리스료(월, 절사됨):", 순수리스료);
console.log("고객청구 총 월 리스료:", 고객청구_총_리스료);
console.log("검산 - 실제 연IRR:", (결과.연IRR * 100), "%");
console.log("------------------------------");
console.log("[참고/회계용] 역산된 내재금리(연):", (내재금리 * 100), "%");
console.log("[참고/회계용] 내재금리로 36개월 상각 시 최종잔액(잔가와 비교):", 검증_최종잔액);
console.log("------------------------------");
console.log("[참고] 보험료 지급 스케줄(개월차/금액):", 보험료지급스케줄(개월수));
console.log("[참고] 차세 지급 스케줄(개월차/금액):", 차세지급스케줄(인도월, 개월수));
console.log("------------------------------");
console.log("[참고] 0~5개월차 현금흐름 샘플:", 결과.cashflows.slice(0, 6));
