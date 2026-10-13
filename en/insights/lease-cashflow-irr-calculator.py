# ===== Forward calculator: enter a lease payment to calculate IRR =====
# (Same assumptions as the reverse calculator: July delivery, separate guaranteed and non-guaranteed residuals, and no fee)

# ===== Assumptions =====
vehiclePrice = 50_000_000
termMonths = 36
monthlyFee = 0
guaranteedResidual = 5_000_000
unguaranteedResidual = 15_000_000
residualValue = guaranteedResidual + unguaranteedResidual  # 20,000,000

annualInsurance = 2_100_000
annualVehicleTax = 1_200_000
monthlyInsurance = annualInsurance / 12  # collected from the customer in equal monthly installments
monthlyTax = annualVehicleTax / 12      # collected from the customer in equal monthly installments

deliveryMonth = 7  # Input can be changed to any month from 1 to 12


def insurancePaymentSchedule(termMonths):
    """Once at delivery (month 0), then once every 12 months"""
    return [{"month": m, "amount": annualInsurance} for m in range(0, termMonths, 12)]


def vehicleTaxPaymentSchedule(deliveryMonth, termMonths):
    """At month 0, prorate the first year based on the delivery month; then charge the full amount every 12 months, including the final payment"""
    payments = []
    firstYearRemainingMonths = 13 - deliveryMonth
    proratedRatio = firstYearRemainingMonths / 12
    payments.append({"month": 0, "amount": annualVehicleTax * proratedRatio})

    d = firstYearRemainingMonths
    while d < termMonths:
        payments.append({"month": d, "amount": annualVehicleTax})
        d += 12
    return payments


def npv(cashflows, rate):
    return sum(cf / (1 + rate) ** t for t, cf in enumerate(cashflows))


def calculateMonthlyIrr(cashflows):
    """Monthly IRR calculation (bisection to find the rate where NPV = 0)"""
    low, high = -0.9, 10
    for _ in range(500):
        mid = (low + high) / 2
        if npv(cashflows, mid) > 0:
            low = mid
        else:
            high = mid
    return (low + high) / 2


def calculateIrrFromLeasePayment(baseLeasePayment):
    """Builds cash flows from the lease payment and returns the annualized IRR.
    (Completes in one calculation without searching for a target IRR)"""
    cashflows = [0.0] * (termMonths + 1)

    # Month 0: vehicle-price outflow
    cashflows[0] += -vehiclePrice

    # Months 1–36: equal monthly customer receipts, less the fee
    for t in range(1, termMonths + 1):
        cf = baseLeasePayment + monthlyInsurance + monthlyTax - monthlyFee
        if t == termMonths:
            cf += residualValue
        cashflows[t] += cf

    # Apply actual insurance payments (cash outflows)
    for p in insurancePaymentSchedule(termMonths):
        cashflows[p["month"]] -= p["amount"]

    # Apply actual vehicle tax payments (cash outflows)
    for p in vehicleTaxPaymentSchedule(deliveryMonth, termMonths):
        cashflows[p["month"]] -= p["amount"]

    monthlyIrr = calculateMonthlyIrr(cashflows)
    return {"annualIrr": monthlyIrr * 12, "cashflows": cashflows}


def truncate(value, decimals):
    """Truncate beyond n decimal places without rounding, for display only.
    This does not affect calculations and uses strings to avoid
    floating-point errors."""
    sign = "-" if value < 0 else ""
    abs_value = abs(value)
    # Format with enough decimal places, then truncate the resulting string.
    s = f"{abs_value:.{decimals + 10}f}"
    dot_idx = s.index(".")
    truncated = s[:dot_idx] if decimals == 0 else s[: dot_idx + 1 + decimals]
    return sign + truncated


if __name__ == "__main__":
    baseLeasePayment = 965986  # Example lease payment (from a previous calculation)
    result = calculateIrrFromLeasePayment(baseLeasePayment)
    annualIrrPercent = result["annualIrr"] * 100

    print("=== Forward calculation result (lease payment → IRR) ===")
    print(f"Delivery month: {deliveryMonth}")
    print(f"Base lease payment: ${baseLeasePayment:,}")
    print("------------------------------")
    print(f"Calculated annualized IRR (full precision): {annualIrrPercent} %")
    print(f"Calculated annualized IRR (display, truncated to 4 decimal places): {truncate(annualIrrPercent, 4)}%")
    print("------------------------------")
    print("[Note] Sample cash flows for months 0–5:", result["cashflows"][:6])
