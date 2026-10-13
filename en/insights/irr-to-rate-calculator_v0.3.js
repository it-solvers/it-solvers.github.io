// ===== Inputs =====
const vehiclePrice = 50000000;
const termMonths = 36;
const targetAnnualIRR = 0.037412; // 3.7412%
const monthlyFee = 0;
const guaranteedResidual = 5000000;
const unguaranteedResidual = 15000000;
const residualValue = guaranteedResidual + unguaranteedResidual; // 20,000,000

const annualInsurance = 2100000;
const annualVehicleTax = 1200000;
const monthlyInsurance = annualInsurance / 12; // Collected from the customer in equal monthly installments
const monthlyVehicleTax = annualVehicleTax / 12;     // Collected from the customer in equal monthly installments

// ===== Delivery month (input can be changed from 1 to 12) =====
const deliveryMonth = 7; // Example: delivery in July. Change this value to recalculate the entire schedule.

// ===== Actual insurance payment schedule =====
// One payment at delivery (month 0), then once every 12 months (three payments over 36 months: months 0, 12, and 24)
function insurancePaymentSchedule(termMonths) {
  const payments = [];
  for (let m = 0; m < termMonths; m += 12) {
    payments.push({ month: m, amount: annualInsurance });
  }
  return payments;
}

// ===== Actual vehicle-tax payment schedule =====
// At delivery, pay a prorated amount based on the remaining months in the year (delivery month through December, inclusive).
// After that, pay the full annual amount every January (the number of months until the next January depends on the delivery month).
function vehicleTaxPaymentSchedule(deliveryMonth, termMonths) {
  const payments = [];
  const remainingFirstYearMonths = 13 - deliveryMonth; // Months from delivery through December, inclusive
  const proratedShare = remainingFirstYearMonths / 12;
  payments.push({ month: 0, amount: annualVehicleTax * proratedShare });

  let d = remainingFirstYearMonths; // Months from delivery until the next January
  while (d < termMonths) {
    payments.push({ month: d, amount: annualVehicleTax }); // The final payment is always a full 12 months of tax
    d += 12;
  }
  return payments;
}

// ===== Calculate monthly IRR (bisection) =====
function calculateMonthlyIRR(cashflows) {
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

// ===== Calculate annual IRR using actual insurance and vehicle-tax payment timing =====
function calculatePreciseAnnualIRR(baseLeasePayment) {
  const cashflows = new Array(termMonths + 1).fill(0);

  // Month 0: vehicle-price outflow
  cashflows[0] += -vehiclePrice;

  // Months 1–36: equal monthly customer collections, less fees
  for (let t = 1; t <= termMonths; t++) {
    let cf = baseLeasePayment + monthlyInsurance + monthlyVehicleTax - monthlyFee;
    if (t === termMonths) cf += residualValue;
    cashflows[t] += cf;
  }

  // Include actual insurance payments (outflows)
  for (const p of insurancePaymentSchedule(termMonths)) {
    cashflows[p.month] -= p.amount;
  }

  // Include actual vehicle-tax payments (outflows)
  for (const p of vehicleTaxPaymentSchedule(deliveryMonth, termMonths)) {
    cashflows[p.month] -= p.amount;
  }

  const monthlyIRR = calculateMonthlyIRR(cashflows);
  return { annualIRR: monthlyIRR * 12, cashflows };
}

// ===== Solve for the base lease payment that meets the target IRR using bisection =====
function solveLeasePaymentPrecisely() {
  let low = 0, high = vehiclePrice;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const { annualIRR } = calculatePreciseAnnualIRR(Math.floor(mid));
    if (annualIRR < targetAnnualIRR) low = mid; else high = mid;
  }
  return Math.floor((low + high) / 2);
}

// ===== (For reference/accounting) Amortize the finalized lease payment over 36 months =====
// ===== Solve for the implied rate that makes the balance equal the residual value (monthly interest is truncated) =====
function calculateEndingBalance(annualRate, leasePayment) {
  const monthlyRate = annualRate / 12;
  let balance = vehiclePrice;
  for (let t = 1; t <= termMonths; t++) {
    const interest = Math.floor(balance * monthlyRate);
    balance = balance + interest - leasePayment;
  }
  return balance;
}

function solveImpliedRate(leasePayment) {
  let low = -0.5, high = 1.0;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const endingBalance = calculateEndingBalance(mid, leasePayment);
    if (endingBalance < residualValue) low = mid; else high = mid;
  }
  return (low + high) / 2;
}

// ===== Run calculation =====
const baseLeasePayment = solveLeasePaymentPrecisely();
const result = calculatePreciseAnnualIRR(baseLeasePayment);
const totalMonthlyCustomerBill = baseLeasePayment + monthlyInsurance + monthlyVehicleTax;
const impliedRate = solveImpliedRate(baseLeasePayment);
const verifiedEndingBalance = calculateEndingBalance(impliedRate, baseLeasePayment);

console.log("=== Results (actual insurance and vehicle-tax timing from delivery month) ===");
console.log("Delivery month:", deliveryMonth, "month");
console.log("Target annual IRR:", (targetAnnualIRR * 100) + "%");
console.log("------------------------------");
console.log("Base monthly lease payment ($, truncated):", baseLeasePayment);
console.log("Total monthly customer bill ($):", totalMonthlyCustomerBill);
console.log("Check — actual annual IRR:", (result.annualIRR * 100), "%");
console.log("------------------------------");
console.log("[Reference/accounting] Solved implied annual rate:", (impliedRate * 100), "%");
console.log("[Reference/accounting] Ending balance after 36 months at the implied rate (compare with residual value):", verifiedEndingBalance);
console.log("------------------------------");
console.log("[Reference] Insurance payment schedule (month/amount):", insurancePaymentSchedule(termMonths));
console.log("[Reference] Vehicle-tax payment schedule (month/amount):", vehicleTaxPaymentSchedule(deliveryMonth, termMonths));
console.log("------------------------------");
console.log("[Reference] Sample cash flows for months 0–5:", result.cashflows.slice(0, 6));
