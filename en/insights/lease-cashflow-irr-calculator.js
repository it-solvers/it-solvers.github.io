// ===== Inputs =====
const currentMonth = new Date().getMonth() + 1;
const defaults = {
  vehiclePrice: 37000,
  months: 36,
  annualRate: 5.5,
  monthlyFee: 0,
  residualValue: 14800,
  annualInsurance: 1554,
  annualTax: 888,
  deliveryMonth: currentMonth
};

// ===== Actual insurance payment schedule =====
function insurancePaymentSchedule(months, annualInsurance) {
  const payments = [];
  for (let month = 0; month < months; month += 12) {
    payments.push({ month, amount: annualInsurance });
  }
  return payments;
}

// ===== Actual vehicle-tax payment schedule =====
function vehicleTaxPaymentSchedule(deliveryMonth, months, annualTax) {
  const payments = [];
  const firstYearMonths = 13 - deliveryMonth;
  const proratedShare = firstYearMonths / 12;
  payments.push({ month: 0, amount: annualTax * proratedShare });

  let month = firstYearMonths;
  while (month < months) {
    payments.push({ month, amount: annualTax });
    month += 12;
  }
  return payments;
}

// ===== Monthly IRR (bisection, where NPV = 0) =====
function monthlyIrr(cashFlows) {
  function npv(rate) {
    let sum = 0;
    for (let month = 0; month < cashFlows.length; month++) {
      sum += cashFlows[month] / Math.pow(1 + rate, month);
    }
    return sum;
  }
  let low = -0.9, high = 10;
  for (let iteration = 0; iteration < 500; iteration++) {
    const mid = (low + high) / 2;
    if (npv(mid) > 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function calculateLeaseIRR(input) {
  const monthlyRate = input.annualRate / 100 / 12;
  function calculateMonthlyPayment(residualValue) {
    if (monthlyRate === 0) {
      return (input.vehiclePrice - residualValue) / input.months;
    }
    const annuityFactor = (1 - Math.pow(1 + monthlyRate, -input.months)) / monthlyRate;
    const residualPresentValue = residualValue / Math.pow(1 + monthlyRate, input.months);
    return (input.vehiclePrice - residualPresentValue) / annuityFactor;
  }

  const monthlyLease = calculateMonthlyPayment(input.residualValue);
  const monthlyInsuranceIn = input.annualInsurance / 12;
  const monthlyTaxIn = input.annualTax / 12;
  const cashFlows = new Array(input.months + 1).fill(0);
  cashFlows[0] = -input.vehiclePrice;

  for (let month = 1; month <= input.months; month++) {
    let monthlyCashFlow = monthlyLease + monthlyInsuranceIn + monthlyTaxIn - input.monthlyFee;
    if (month === input.months) monthlyCashFlow += input.residualValue;
    cashFlows[month] += monthlyCashFlow;
  }
  for (const payment of insurancePaymentSchedule(input.months, input.annualInsurance)) {
    cashFlows[payment.month] -= payment.amount;
  }
  for (const payment of vehicleTaxPaymentSchedule(input.deliveryMonth, input.months, input.annualTax)) {
    cashFlows[payment.month] -= payment.amount;
  }

  const irrMonthly = monthlyIrr(cashFlows);
  return {
    monthlyLease,
    monthlyInsuranceIn,
    monthlyTaxIn,
    residualValue: input.residualValue,
    cashFlows,
    irrMonthly,
    irrAnnual: irrMonthly * 12
  };
}

// Truncate for display only; this does not affect the calculation.
function truncate(value, decimals) {
  const sign = value < 0 ? '-' : '';
  const absoluteValue = Math.abs(value);
  const fixed = absoluteValue.toFixed(decimals + 10);
  const dotIndex = fixed.indexOf('.');
  const truncated = decimals === 0 ? fixed.slice(0, dotIndex) : fixed.slice(0, dotIndex + 1 + decimals);
  return sign + truncated;
}

if (typeof document !== 'undefined') {
  const fieldIds = [
    'vehiclePrice', 'months', 'annualRate', 'monthlyFee', 'residualValue',
    'annualInsurance', 'annualTax', 'deliveryMonth'
  ];
  const moneyFieldIds = ['vehiclePrice', 'monthlyFee', 'residualValue', 'annualInsurance', 'annualTax'];
  const $ = id => document.getElementById(id);
  const moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  });
  const money = value => moneyFormatter.format(Math.round(value));
  const parseMoney = value => Number(value.replace(/[^\d.-]/g, ''));

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
    option.textContent = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(2020, month - 1));
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
      throw new Error('Enter a valid number for every input.');
    }
    if (values.vehiclePrice <= 0 || values.annualRate < 0 || values.monthlyFee < 0 ||
        !Number.isInteger(values.months) || values.months < 1 || values.months > 120 ||
        values.annualInsurance < 0 || values.annualTax < 0 ||
        values.residualValue < 0 || values.residualValue > values.vehiclePrice ||
        !Number.isInteger(values.deliveryMonth) || values.deliveryMonth < 1 || values.deliveryMonth > 12) {
      throw new Error('Check the vehicle price, term, insurance, tax, residual value, and delivery month. The term must be 1–120 whole months, amounts and rate cannot be negative, and residual value cannot exceed the vehicle price.');
    }
    return values;
  }

  function renderCashflows(input, result) {
    const insurancePayments = new Array(input.months + 1).fill(0);
    const taxPayments = new Array(input.months + 1).fill(0);
    insurancePaymentSchedule(input.months, input.annualInsurance)
      .forEach(payment => insurancePayments[payment.month] += payment.amount);
    vehicleTaxPaymentSchedule(input.deliveryMonth, input.months, input.annualTax)
      .forEach(payment => taxPayments[payment.month] += payment.amount);
    const currentYear = new Date().getFullYear();
    const rows = result.cashFlows.map((cashFlow, month) => {
      const date = new Date(currentYear, input.deliveryMonth - 1 + month);
      const yearMonth = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short' }).format(date);
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
        customerBill ? money(customerBill) : '—',
        ...amounts.map(amount => amount ? money(amount) : '—'),
        money(cashFlow)
      ];
      return '<tr>' + cells.map((value, index) =>
        '<td' + (index >= 3 ? ' class="cf-detail"' : '') + '>' + value + '</td>'
      ).join('') + '</tr>';
    });
    const headers = [
      'Lease month', 'Year-month', 'Customer bill', 'Vehicle price (−)', 'Insurance paid (−)', 'Vehicle tax paid (−)',
      'Fee (−)', 'Base lease payment (+)', 'Insurance collected (+)', 'Vehicle tax collected (+)', 'Residual (+)', 'Net cash flow'
    ];
    $('cashflowTable').innerHTML =
      '<thead><tr>' + headers.map((header, index) =>
        '<th' + (index >= 3 ? ' class="cf-detail"' : '') + '>' + header + '</th>'
      ).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody>';
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
      $('annualIRR').textContent = ((result.irrAnnual * 100).toFixed(4)) + '%';
      $('resultNote').textContent =
        'Monthly rate used for the payment estimate: ' + (input.annualRate / 12).toFixed(5) +
        '% · Residual value: ' + money(input.residualValue) + ' · Annualization: monthly IRR × 12.';
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
    $('cfDetailsBtn').textContent = expanded ? 'Hide details' : 'Show details';
  });
  $('resetButton').addEventListener('click', () => {
    for (const id of fieldIds) $(id).value = id === 'deliveryMonth' ? defaults[id] : '';
    $('error').hidden = true;
    $('output').hidden = true;
  });
  document.querySelectorAll('input').forEach(input => input.addEventListener('keydown', event => {
    if (event.key === 'Enter') calculate();
  }));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateLeaseIRR, insurancePaymentSchedule, vehicleTaxPaymentSchedule, truncate };
}
