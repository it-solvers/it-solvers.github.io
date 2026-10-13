import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Precise lease-payment calculation with a detailed cash-flow model
 * (Uses actual insurance and vehicle-tax payment timing, a configurable delivery month, and direct lease-payment solving for a target IRR)
 */
public class LeasePreciseCashflowCalculator {

    // ===== Inputs =====
    static final double vehiclePrice = 50000000;
    static final int termMonths = 36;
    static final double targetAnnualIRR = 0.037412; // 3.7412%
    static final double monthlyFee = 0;
    static final double guaranteedResidual = 5000000;
    static final double unguaranteedResidual = 15000000;
    static final double residualValue = guaranteedResidual + unguaranteedResidual; // 20,000,000

    static final double annualInsurance = 2100000;
    static final double annualVehicleTax = 1200000;
    static final double monthlyInsurance = annualInsurance / 12; // Collected from the customer in equal monthly installments
    static final double monthlyVehicleTax = annualVehicleTax / 12;     // Collected from the customer in equal monthly installments

    // ===== Delivery month (input can be changed from 1 to 12) =====
    static final int deliveryMonth = 7; // Example: delivery in July. Change this value to recalculate the entire schedule.

    /** One scheduled payment (month, amount) */
    static class Payment {
        final int month;
        final double amount;

        Payment(int month, double amount) {
            this.month = month;
            this.amount = amount;
        }

        @Override
        public String toString() {
            return "{month=" + month + ", amount=" + amount + "}";
        }
    }

    /**
     * Actual insurance payment schedule.
     * One payment at delivery (month 0), then once every 12 months (three payments over 36 months: months 0, 12, and 24)
     */
    static List<Payment> insurancePaymentSchedule(int termMonths) {
        List<Payment> payments = new ArrayList<>();
        for (int m = 0; m < termMonths; m += 12) {
            payments.add(new Payment(m, annualInsurance));
        }
        return payments;
    }

    /**
     * Actual vehicle-tax payment schedule.
     * At delivery, pay a prorated amount based on the remaining months in the year (delivery month through December, inclusive).
     * After that, pay the full annual amount every January (the number of months until the next January depends on the delivery month).
     * (The final payment is also a full year of tax, treated as the registration cost until the vehicle is resold after return.)
     */
    static List<Payment> vehicleTaxPaymentSchedule(int deliveryMonth, int termMonths) {
        List<Payment> payments = new ArrayList<>();
        int remainingFirstYearMonths = 13 - deliveryMonth; // Months from delivery through December, inclusive
        double proratedShare = remainingFirstYearMonths / 12.0;
        payments.add(new Payment(0, annualVehicleTax * proratedShare));

        int d = remainingFirstYearMonths; // Months from delivery until the next January
        while (d < termMonths) {
            payments.add(new Payment(d, annualVehicleTax)); // The final payment is always a full 12 months of tax
            d += 12;
        }
        return payments;
    }

    /** Calculate monthly IRR (bisection) */
    static double calculateMonthlyIRR(double[] cashflows) {
        double low = -0.9;
        double high = 10;
        for (int i = 0; i < 500; i++) {
            double mid = (low + high) / 2;
            if (npv(cashflows, mid) > 0) {
                low = mid;
            } else {
                high = mid;
            }
        }
        return (low + high) / 2;
    }

    static double npv(double[] cashflows, double rate) {
        double sum = 0;
        for (int t = 0; t < cashflows.length; t++) {
            sum += cashflows[t] / Math.pow(1 + rate, t);
        }
        return sum;
    }

    /** Annual IRR result (annual IRR, cash-flow table) */
    static class IRRResult {
        final double annualIRR;
        final double[] cashflows;

        IRRResult(double annualIRR, double[] cashflows) {
            this.annualIRR = annualIRR;
            this.cashflows = cashflows;
        }
    }

    /** Calculate annual IRR for a base lease payment, using actual insurance and vehicle-tax payment timing */
    static IRRResult calculatePreciseAnnualIRR(double baseLeasePayment) {
        double[] cashflows = new double[termMonths + 1];

        // Month 0: vehicle-price outflow
        cashflows[0] += -vehiclePrice;

        // Months 1–36: equal monthly customer collections, less fees
        for (int t = 1; t <= termMonths; t++) {
            double cf = baseLeasePayment + monthlyInsurance + monthlyVehicleTax - monthlyFee;
            if (t == termMonths) cf += residualValue;
            cashflows[t] += cf;
        }

        // Include actual insurance payments (outflows)
        for (Payment p : insurancePaymentSchedule(termMonths)) {
            cashflows[p.month] -= p.amount;
        }

        // Include actual vehicle-tax payments (outflows)
        for (Payment p : vehicleTaxPaymentSchedule(deliveryMonth, termMonths)) {
            cashflows[p.month] -= p.amount;
        }

        double monthlyIRR = calculateMonthlyIRR(cashflows);
        return new IRRResult(monthlyIRR * 12, cashflows);
    }

    /** Solve directly for the base lease payment that meets the target IRR using bisection */
    static long solveLeasePaymentPrecisely() {
        double low = 0, high = vehiclePrice;
        for (int i = 0; i < 200; i++) {
            double mid = (low + high) / 2;
            double annualIRR = calculatePreciseAnnualIRR(Math.floor(mid)).annualIRR;
            if (annualIRR < targetAnnualIRR) {
                low = mid;
            } else {
                high = mid;
            }
        }
        return (long) Math.floor((low + high) / 2);
    }

    /**
     * (For reference/accounting) After amortizing the finalized lease payment over 36 months
     * Calculate the ending balance for solving the implied rate that makes the balance exactly equal to the residual value (monthly interest is truncated).
     */
    static double calculateEndingBalance(double annualRate, double leasePayment) {
        double monthlyRate = annualRate / 12;
        double balance = vehiclePrice;
        for (int t = 1; t <= termMonths; t++) {
            double interest = Math.floor(balance * monthlyRate);
            balance = balance + interest - leasePayment;
        }
        return balance;
    }

    static double solveImpliedRate(double leasePayment) {
        double low = -0.5, high = 1.0;
        for (int i = 0; i < 200; i++) {
            double mid = (low + high) / 2;
            double endingBalance = calculateEndingBalance(mid, leasePayment);
            if (endingBalance < residualValue) {
                low = mid;
            } else {
                high = mid;
            }
        }
        return (low + high) / 2;
    }

    public static void main(String[] args) {
        NumberFormat nf = NumberFormat.getNumberInstance(Locale.US);

        long baseLeasePayment = solveLeasePaymentPrecisely();
        IRRResult result = calculatePreciseAnnualIRR(baseLeasePayment);
        double totalMonthlyCustomerBill = baseLeasePayment + monthlyInsurance + monthlyVehicleTax;
        double impliedRate = solveImpliedRate(baseLeasePayment);
        double verifiedEndingBalance = calculateEndingBalance(impliedRate, baseLeasePayment);

        System.out.println("=== Results (actual insurance and vehicle-tax timing from delivery month) ===");
        System.out.println("Delivery month: " + deliveryMonth + " month");
        System.out.println("Target annual IRR: " + (targetAnnualIRR * 100) + "%");
        System.out.println("------------------------------");
        System.out.println("Base monthly lease payment ($, truncated): " + nf.format(baseLeasePayment));
        System.out.println("Total monthly customer bill ($): " + nf.format(totalMonthlyCustomerBill));
        System.out.println("Check — actual annual IRR: " + (result.annualIRR * 100) + " %");
        System.out.println("------------------------------");
        System.out.println("[Reference/accounting] Solved implied annual rate: " + (impliedRate * 100) + " %");
        System.out.println("[Reference/accounting] Ending balance after 36 months at the implied rate (compare with residual value): " + verifiedEndingBalance);
        System.out.println("------------------------------");
        System.out.println("[Reference] Insurance payment schedule (month/amount): " + insurancePaymentSchedule(termMonths));
        System.out.println("[Reference] Vehicle-tax payment schedule (month/amount): " + vehicleTaxPaymentSchedule(deliveryMonth, termMonths));
        System.out.println("------------------------------");
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < 6 && i < result.cashflows.length; i++) {
            if (i > 0) sb.append(", ");
            sb.append(result.cashflows[i]);
        }
        sb.append("]");
        System.out.println("[Reference] Sample cash flows for months 0–5: " + sb);
    }
}
