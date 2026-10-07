// ===== 입력 조건 =====
const currentMonth = new Date().getMonth() + 1;
const defaults = {
  vehiclePrice: 50000000,
  months: 36,
  annualRate: 5.5,
  monthlyFee: 0,
  residualValue: 20000000,
  annualInsurance: 2100000,
  annualTax: 1200000,
  deliveryMonth: currentMonth
};

// ===== 보험료 실제 지급 스케줄 =====
function 보험료지급스케줄(개월수, 연보험료) {
  const 지급목록 = [];
  for (let m = 0; m < 개월수; m += 12) {
    지급목록.push({ month: m, amount: 연보험료 });
  }
  return 지급목록;
}

// ===== 차세 실제 지급 스케줄 =====
function 차세지급스케줄(인도월, 개월수, 연차세) {
  const 지급목록 = [];
  const 첫해_잔여월 = 13 - 인도월;
  const 비례비율 = 첫해_잔여월 / 12;
  지급목록.push({ month: 0, amount: 연차세 * 비례비율 });

  let d = 첫해_잔여월;
  while (d < 개월수) {
    지급목록.push({ month: d, amount: 연차세 });
    d += 12;
  }
  return 지급목록;
}

// ===== 월 IRR 계산 (NPV=0 되는 할인율, 이분법) =====
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

function calculateLeaseIRR(input) {
  const monthlyRate = input.annualRate / 100 / 12;
  function calcMonthlyPayment(residualValue) {
    if (monthlyRate === 0) {
      return (input.vehiclePrice - residualValue) / input.months;
    }
    const pvAnnuityFactor = (1 - Math.pow(1 + monthlyRate, -input.months)) / monthlyRate;
    const residualPV = residualValue / Math.pow(1 + monthlyRate, input.months);
    return (input.vehiclePrice - residualPV) / pvAnnuityFactor;
  }

  const monthlyLease = calcMonthlyPayment(input.residualValue);
  const monthlyInsuranceIn = input.annualInsurance / 12;
  const monthlyTaxIn = input.annualTax / 12;
  const cashFlows = new Array(input.months + 1).fill(0);
  cashFlows[0] = -input.vehiclePrice;

  for (let month = 1; month <= input.months; month++) {
    let monthlyCashFlow = monthlyLease + monthlyInsuranceIn + monthlyTaxIn - input.monthlyFee;
    if (month === input.months) monthlyCashFlow += input.residualValue;
    cashFlows[month] += monthlyCashFlow;
  }
  for (const payment of 보험료지급스케줄(input.months, input.annualInsurance)) {
    cashFlows[payment.month] -= payment.amount;
  }
  for (const payment of 차세지급스케줄(input.deliveryMonth, input.months, input.annualTax)) {
    cashFlows[payment.month] -= payment.amount;
  }

  const irrMonthly = 월IRR계산(cashFlows);
  const irrAnnual = irrMonthly * 12;
  return {
    monthlyLease,
    monthlyInsuranceIn,
    monthlyTaxIn,
    residualValue: input.residualValue,
    cashFlows,
    irrMonthly,
    irrAnnual
  };
}

/**
 * 표시 전용 절사(truncate) 함수 — 계산에는 전혀 관여하지 않고,
 * 화면에 보여줄 때만 소수점 n자리 미만을 반올림 없이 잘라낸다.
 */
function 절사(value, decimals) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const str = abs.toFixed(decimals + 10);
  const dotIdx = str.indexOf(".");
  const truncated = decimals === 0 ? str.slice(0, dotIdx) : str.slice(0, dotIdx + 1 + decimals);
  return sign + truncated;
}

if (typeof document !== 'undefined') {
  const fieldIds = [
    'vehiclePrice', 'months', 'annualRate', 'monthlyFee', 'residualValue',
    'annualInsurance', 'annualTax', 'deliveryMonth'
  ];
  const moneyFieldIds = ['vehiclePrice', 'monthlyFee', 'residualValue', 'annualInsurance', 'annualTax'];
  const $ = id => document.getElementById(id);
  const money = value => Math.round(value).toLocaleString('ko-KR') + '원';
  const parseMoney = value => Number(value.replace(/[^\d]/g, ''));

  function formatMoneyInput(input) {
    const caret = input.selectionStart;
    const digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, '').length;
    const digits = input.value.replace(/\D/g, '');
    input.value = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    let nextCaret = 0;
    let digitCount = 0;
    while (nextCaret < input.value.length && digitCount < digitsBeforeCaret) {
      if (/\d/.test(input.value[nextCaret])) digitCount++;
      nextCaret++;
    }
    input.setSelectionRange(nextCaret, nextCaret);
  }

  const deliveryMonth = $('deliveryMonth');
  for (let month = 1; month <= 12; month++) {
    const option = document.createElement('option');
    option.value = month;
    option.textContent = month + '월';
    if (month === currentMonth) option.selected = true;
    deliveryMonth.appendChild(option);
  }

  moneyFieldIds.forEach(id => $(id).addEventListener('input', event => {
    formatMoneyInput(event.currentTarget);
  }));

  function readInput() {
    const values = Object.fromEntries(fieldIds.map(id => {
      const value = $(id).value.trim();
      return [id, moneyFieldIds.includes(id) ? parseMoney(value) : Number(value)];
    }));
    if (fieldIds.some(id => $(id).value.trim() === '') ||
        Object.values(values).some(value => !Number.isFinite(value))) {
      throw new Error('모든 계산 조건에 유효한 숫자를 입력해 주세요.');
    }
    if (values.vehiclePrice <= 0 || values.annualRate < 0 || values.monthlyFee < 0 ||
        !Number.isInteger(values.months) || values.months < 1 || values.months > 120 ||
        values.annualInsurance < 0 || values.annualTax < 0 ||
        values.residualValue < 0 || values.residualValue > values.vehiclePrice ||
        !Number.isInteger(values.deliveryMonth) || values.deliveryMonth < 1 || values.deliveryMonth > 12) {
      throw new Error('차량가격·기간·보험료·자동차세·잔가·인도월 조건을 확인해 주세요.');
    }
    return values;
  }

  function renderCashflows(input, result) {
    const insurancePayments = new Array(input.months + 1).fill(0);
    const taxPayments = new Array(input.months + 1).fill(0);
    보험료지급스케줄(input.months, input.annualInsurance)
      .forEach(payment => insurancePayments[payment.month] += payment.amount);
    차세지급스케줄(input.deliveryMonth, input.months, input.annualTax)
      .forEach(payment => taxPayments[payment.month] += payment.amount);
    const currentYear = new Date().getFullYear();
    const rows = result.cashFlows.map((cashFlow, month) => {
      const date = new Date(currentYear, input.deliveryMonth - 1 + month);
      const yearMonth = date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0');
      const activeMonth = month >= 1;
      const customerBill = activeMonth
        ? result.monthlyLease + result.monthlyInsuranceIn + result.monthlyTaxIn
        : 0;
      const amounts = [
        month === 0 ? -input.vehiclePrice : 0,
        -insurancePayments[month],
        -taxPayments[month],
        activeMonth ? -input.monthlyFee : 0,
        activeMonth ? result.monthlyLease : 0,
        activeMonth ? result.monthlyInsuranceIn : 0,
        activeMonth ? result.monthlyTaxIn : 0,
        month === input.months ? input.residualValue : 0
      ];
      const cells = [
        month,
        yearMonth,
        customerBill ? money(customerBill) : '-',
        ...amounts.map(amount => amount ? money(amount) : '-'),
        money(cashFlow)
      ];
      return '<tr>' + cells.map((value, index) =>
        '<td' + (index >= 3 ? ' class="cf-detail"' : '') + '>' + value + '</td>'
      ).join('') + '</tr>';
    });
    const headers = [
      '회차', '년월', '고객 청구액', '차량대금 (−)', '보험료 지급 (−)', '자동차세 지급 (−)',
      '수수료 (−)', '순수 리스료 (+)', '보험료 수납 (+)', '자동차세 수납 (+)', '잔가 (+)', '순현금흐름'
    ];
    $('cashflowTable').innerHTML =
      '<thead><tr>' + headers.map((header, index) =>
        '<th' + (index >= 3 ? ' class="cf-detail"' : '') + '>' + header + '</th>'
      ).join('') + '</tr></thead><tbody>' +
      rows.join('') + '</tbody>';
  }

  function calculate() {
    $('error').hidden = true;
    $('output').hidden = true;
    try {
      const input = readInput();
      const result = calculateLeaseIRR(input);

      $('monthlyLeaseResult').textContent = money(result.monthlyLease);
      $('monthlyTotal').textContent = money(
        result.monthlyLease + result.monthlyInsuranceIn + result.monthlyTaxIn
      );
      $('monthlyInsurance').textContent = money(result.monthlyInsuranceIn);
      $('monthlyTax').textContent = money(result.monthlyTaxIn);
      $('annualIRR').textContent = 절사(result.irrAnnual * 100, 4) + '%';
      $('resultNote').textContent =
        '월 금리 ' + (input.annualRate / 12).toFixed(5) + '% · 잔가 합계 ' +
        money(input.residualValue) + ' · 연 환산 방식: 월 IRR × 12';
      renderCashflows(input, result);
      $('output').hidden = false;
    } catch (error) {
      $('error').textContent = error.message;
      $('error').hidden = false;
    }
  }

  $('calculateButton').addEventListener('click', calculate);
  $('cfDetailsBtn').addEventListener('click', () => {
    const expanded = $('cfDetailsBtn').getAttribute('aria-expanded') !== 'true';
    $('cfScroll').classList.toggle('show-details', expanded);
    $('cfDetailsBtn').setAttribute('aria-expanded', String(expanded));
    $('cfDetailsBtn').textContent = expanded ? '간략히 보기' : '자세히 보기';
  });
  $('resetButton').addEventListener('click', () => {
    for (const [id, value] of Object.entries(defaults)) $(id).value = value;
    moneyFieldIds.forEach(id => formatMoneyInput($(id)));
    $('error').hidden = true;
    $('output').hidden = true;
  });
  fieldIds.forEach(id => $(id).addEventListener('keydown', event => {
    if (event.key === 'Enter') calculate();
  }));
  calculate();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateLeaseIRR, 보험료지급스케줄, 차세지급스케줄, 절사 };
}
