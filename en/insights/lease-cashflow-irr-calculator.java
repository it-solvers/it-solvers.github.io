import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Forward calculator: enter a lease payment to calculate IRR
 * (Same assumptions as the reverse calculator: July delivery, separate guaranteed and non-guaranteed residuals, and no fee)
 */
class ForwardIrrCalculator {

    // ===== Assumptions =====
    static final double vehiclePrice = 50000000;
    static final int termMonths = 36;
    static final double monthlyFee = 0;
    static final double guaranteedResidual = 5000000;
    static final double unguaranteedResidual = 15000000;
    static final double residualValue = guaranteedResidual + unguaranteedResidual; // 20,000,000

    static final double annualInsurance = 2100000;
    static final double annualVehicleTax = 1200000;
    static final double monthlyInsurance = annualInsurance / 12; // collected from the customer in equal monthly installments
    static final double monthlyTax = annualVehicleTax / 12;     // collected from the customer in equal monthly installments

    static final int deliveryMonth = 7; // Input can be changed to any month from 1 to 12

    /** One payment in the schedule (month, amount) */
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

    /** Actual insurance payments: once at delivery (month 0), then every 12 months. */
    static List<Payment> insurancePaymentSchedule(int termMonths) {
        List<Payment> payments = new ArrayList<>();
        for (int m = 0; m < termMonths; m += 12) {
            payments.add(new Payment(m, annualInsurance));
        }
        return payments;
    }

    /** Actual vehicle tax payment schedule — At month 0, prorate the first year based on the delivery month; then charge the full amount every 12 months, including the final payment */
    static List<Payment> vehicleTaxPaymentSchedule(int deliveryMonth, int termMonths) {
        List<Payment> payments = new ArrayList<>();
        int firstYearRemainingMonths = 13 - deliveryMonth;
        double proratedRatio = firstYearRemainingMonths / 12.0;
        payments.add(new Payment(0, annualVehicleTax * proratedRatio));

        int d = firstYearRemainingMonths;
        while (d < termMonths) {
            payments.add(new Payment(d, annualVehicleTax));
            d += 12;
        }
        return payments;
    }

    /** Monthly IRR calculation (bisection to find the rate where NPV = 0) */
    static double calculateMonthlyIrr(double[] cashflows) {
        double low = -0.9, high = 10;
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

    static class IrrResult {
        final double annualIrr;
        final double[] cashflows;

        IrrResult(double annualIrr, double[] cashflows) {
            this.annualIrr = annualIrr;
            this.cashflows = cashflows;
        }
    }

    /**
     * Builds cash flows from the lease payment and returns the annualized IRR.
     * (Completes in one calculation without searching for a target IRR)
     */
    static IrrResult calculateIrrFromLeasePayment(double baseLeasePayment) {
        double[] cashflows = new double[termMonths + 1];

        // Month 0: vehicle-price outflow
        cashflows[0] += -vehiclePrice;

        // Months 1–36: equal monthly customer receipts, less the fee
        for (int t = 1; t <= termMonths; t++) {
            double cf = baseLeasePayment + monthlyInsurance + monthlyTax - monthlyFee;
            if (t == termMonths) cf += residualValue;
            cashflows[t] += cf;
        }

        // Apply actual insurance payments (cash outflows)
        for (Payment p : insurancePaymentSchedule(termMonths)) {
            cashflows[p.month] -= p.amount;
        }

        // Apply actual vehicle tax payments (cash outflows)
        for (Payment p : vehicleTaxPaymentSchedule(deliveryMonth, termMonths)) {
            cashflows[p.month] -= p.amount;
        }

        double monthlyIrr = calculateMonthlyIrr(cashflows);
        return new IrrResult(monthlyIrr * 12, cashflows);
    }

    /**
     * Display-only truncation; it does not affect calculations.
     * Digits beyond n decimal places are truncated without rounding.
     * String formatting avoids floating-point errors.
     */
    static String truncate(double value, int decimals) {
        String sign = value < 0 ? "-" : "";
        double absValue = Math.abs(value);
        // Format with enough decimal places, then truncate the resulting string.
        String s = String.format("%." + (decimals + 10) + "f", absValue);
        int dotIdx = s.indexOf('.');
        String truncated = decimals == 0 ? s.substring(0, dotIdx) : s.substring(0, dotIdx + 1 + decimals);
        return sign + truncated;
    }

    public static void main(String[] args) {
        NumberFormat nf = NumberFormat.getNumberInstance(Locale.US);

        double baseLeasePayment = 965986; // Example lease payment (from a previous calculation)
        IrrResult result = calculateIrrFromLeasePayment(baseLeasePayment);
        double annualIrrPercent = result.annualIrr * 100;

        System.out.println("=== Forward calculation result (lease payment → IRR) ===");
        System.out.println("Delivery month: " + deliveryMonth);
        System.out.println("Base lease payment: $" + nf.format(baseLeasePayment));
        System.out.println("------------------------------");
        System.out.println("Calculated annualized IRR (full precision): " + annualIrrPercent + " %");
        System.out.println("Calculated annualized IRR (display, truncated to 4 decimal places): " + truncate(annualIrrPercent, 4) + "%");
        System.out.println("------------------------------");
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < 6 && i < result.cashflows.length; i++) {
            if (i > 0) sb.append(", ");
            sb.append(result.cashflows[i]);
        }
        sb.append("]");
        System.out.println("[Note] Sample cash flows for months 0–5: " + sb);
    }
}
