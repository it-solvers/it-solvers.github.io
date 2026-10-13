# ===== Inputs =====
vehiclePrice = 50_000_000
termMonths = 36
targetAnnualIRR = 0.037412  # 3.7412%
monthlyFee = 0
guaranteedResidual = 5_000_000
unguaranteedResidual = 15_000_000
residualValue = guaranteedResidual + unguaranteedResidual  # 20,000,000

annualInsurance = 2_100_000
annualVehicleTax = 1_200_000
monthlyInsurance = annualInsurance / 12  # Collected from the customer in equal monthly installments
monthlyVehicleTax = annualVehicleTax / 12      # Collected from the customer in equal monthly installments

# ===== Delivery month (input can be changed from 1 to 12) =====
deliveryMonth = 7  # Example: delivery in July. Change this value to recalculate the entire schedule.


def insurancePaymentSchedule(termMonths):
    """One payment at delivery (month 0), then once every 12 months (three payments over 36 months: months 0, 12, and 24)"""
    return [{"month": m, "amount": annualInsurance} for m in range(0, termMonths, 12)]


def vehicleTaxPaymentSchedule(deliveryMonth, termMonths):
    """
    At delivery, pay a prorated amount based on the remaining months in the year (delivery month through December, inclusive).
    After that, pay the full annual amount every January (the number of months until the next January depends on the delivery month).
    (The final payment is also a full year of tax, treated as the registration cost until the vehicle is resold after return.)
    """
    payments = []
    remainingFirstYearMonths = 13 - deliveryMonth  # Months from delivery through December, inclusive
    proratedShare = remainingFirstYearMonths / 12
    payments.append({"month": 0, "amount": annualVehicleTax * proratedShare})

    d = remainingFirstYearMonths  # Months from delivery until the next January
    while d < termMonths:
        payments.append({"month": d, "amount": annualVehicleTax})  # The final payment is always a full 12 months of tax
        d += 12
    return payments


def npv(cashflows, rate):
    return sum(cf / (1 + rate) ** t for t, cf in enumerate(cashflows))


def calculateMonthlyIRR(cashflows):
    """Calculate monthly IRR (bisection)"""
    low, high = -0.9, 10
    for _ in range(500):
        mid = (low + high) / 2
        if npv(cashflows, mid) > 0:
            low = mid
        else:
            high = mid
    return (low + high) / 2


def calculatePreciseAnnualIRR(baseLeasePayment):
    """Calculate annual IRR for a base lease payment, using actual insurance and vehicle-tax payment timing"""
    cashflows = [0.0] * (termMonths + 1)

    # Month 0: vehicle-price outflow
    cashflows[0] += -vehiclePrice

    # Months 1–36: equal monthly customer collections, less fees
    for t in range(1, termMonths + 1):
        cf = baseLeasePayment + monthlyInsurance + monthlyVehicleTax - monthlyFee
        if t == termMonths:
            cf += residualValue
        cashflows[t] += cf

    # Include actual insurance payments (outflows)
    for p in insurancePaymentSchedule(termMonths):
        cashflows[p["month"]] -= p["amount"]

    # Include actual vehicle-tax payments (outflows)
    for p in vehicleTaxPaymentSchedule(deliveryMonth, termMonths):
        cashflows[p["month"]] -= p["amount"]

    monthlyIRR = calculateMonthlyIRR(cashflows)
    return {"annualIRR": monthlyIRR * 12, "cashflows": cashflows}


def solveLeasePaymentPrecisely():
    """Solve directly for the base lease payment that meets the target IRR using bisection"""
    low, high = 0, vehiclePrice
    for _ in range(200):
        mid = (low + high) / 2
        annualIRR = calculatePreciseAnnualIRR(int(mid // 1))["annualIRR"]
        if annualIRR < targetAnnualIRR:
            low = mid
        else:
            high = mid
    return int((low + high) / 2 // 1)


def calculateEndingBalance(annualRate, leasePayment):
    """(For reference/accounting) Calculate the ending balance after 36 months of amortization (monthly interest is truncated)"""
    monthlyRate = annualRate / 12
    balance = vehiclePrice
    for _ in range(1, termMonths + 1):
        interest = (balance * monthlyRate) // 1  # Truncate fractional amounts
        balance = balance + interest - leasePayment
    return balance


def solveImpliedRate(leasePayment):
    """Solve for the implied rate that makes the ending balance exactly equal to the residual value"""
    low, high = -0.5, 1.0
    for _ in range(200):
        mid = (low + high) / 2
        endingBalance = calculateEndingBalance(mid, leasePayment)
        if endingBalance < residualValue:
            low = mid
        else:
            high = mid
    return (low + high) / 2


if __name__ == "__main__":
    baseLeasePayment = solveLeasePaymentPrecisely()
    result = calculatePreciseAnnualIRR(baseLeasePayment)
    totalMonthlyCustomerBill = baseLeasePayment + monthlyInsurance + monthlyVehicleTax
    impliedRate = solveImpliedRate(baseLeasePayment)
    verifiedEndingBalance = calculateEndingBalance(impliedRate, baseLeasePayment)

    print("=== Results (actual insurance and vehicle-tax timing from delivery month) ===")
    print(f"Delivery month: {deliveryMonth} month")
    print(f"Target annual IRR: {targetAnnualIRR * 100}%")
    print("------------------------------")
    print(f"Base monthly lease payment ($, truncated): {baseLeasePayment:,}")
    print(f"Total monthly customer bill ($): {totalMonthlyCustomerBill:,.0f}")
    print(f"Check — actual annual IRR: {result['annualIRR'] * 100} %")
    print("------------------------------")
    print(f"[Reference/accounting] Solved implied annual rate: {impliedRate * 100} %")
    print(f"[Reference/accounting] Ending balance after 36 months at the implied rate (compare with residual value): {verifiedEndingBalance}")
    print("------------------------------")
    print("[Reference] Insurance payment schedule (month/amount):", insurancePaymentSchedule(termMonths))
    print("[Reference] Vehicle-tax payment schedule (month/amount):", vehicleTaxPaymentSchedule(deliveryMonth, termMonths))
    print("------------------------------")
    print("[Reference] Sample cash flows for months 0–5:", result["cashflows"][:6])
