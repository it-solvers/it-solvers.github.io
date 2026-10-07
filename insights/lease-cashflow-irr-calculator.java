import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * 정방향 계산기: 리스료를 입력하면 IRR이 바로 나옴
 * (조건은 기존 역방향 계산기와 동일 - 인도월 7월, 보증/무보증잔가 분리, 수수료 0)
 */
public class ForwardIrrCalculator {

    // ===== 조건 =====
    static final double 차량대금 = 50000000;
    static final int 개월수 = 36;
    static final double 월수수료 = 0;
    static final double 보증잔가 = 5000000;
    static final double 무보증잔가 = 15000000;
    static final double 잔가 = 보증잔가 + 무보증잔가; // 20,000,000

    static final double 연보험료 = 2100000;
    static final double 연차세 = 1200000;
    static final double 월보험료 = 연보험료 / 12; // 고객에게 매월 균등 수납
    static final double 월차세 = 연차세 / 12;     // 고객에게 매월 균등 수납

    static final int 인도월 = 7; // 1~12, 언제든 바뀔 수 있는 입력값

    /** 지급 스케줄 한 건 (개월차, 금액) */
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

    /** 보험료 실제 지급 스케줄 — 인도 시점(0개월차)에 1회, 이후 12개월마다 1회씩 */
    static List<Payment> 보험료지급스케줄(int 개월수) {
        List<Payment> 지급목록 = new ArrayList<>();
        for (int m = 0; m < 개월수; m += 12) {
            지급목록.add(new Payment(m, 연보험료));
        }
        return 지급목록;
    }

    /** 차세 실제 지급 스케줄 — 0개월차: 인도월 기준 첫해 비례, 이후 12개월마다 전액 (마지막 회차도 항상 전액) */
    static List<Payment> 차세지급스케줄(int 인도월, int 개월수) {
        List<Payment> 지급목록 = new ArrayList<>();
        int 첫해_잔여월 = 13 - 인도월;
        double 비례비율 = 첫해_잔여월 / 12.0;
        지급목록.add(new Payment(0, 연차세 * 비례비율));

        int d = 첫해_잔여월;
        while (d < 개월수) {
            지급목록.add(new Payment(d, 연차세));
            d += 12;
        }
        return 지급목록;
    }

    /** 월 IRR 계산 (NPV=0 되는 할인율, 이분법) */
    static double 월IRR계산(double[] cashflows) {
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

    static class IRR결과 {
        final double 연IRR;
        final double[] cashflows;

        IRR결과(double 연IRR, double[] cashflows) {
            this.연IRR = 연IRR;
            this.cashflows = cashflows;
        }
    }

    /**
     * 리스료를 입력받아 현금흐름표를 만들고 연IRR을 계산해서 반환한다.
     * (목표IRR을 찾는 탐색 과정 없이, 딱 한 번의 계산으로 끝남)
     */
    static IRR결과 리스료로_IRR계산(double 순수리스료) {
        double[] cashflows = new double[개월수 + 1];

        // 0개월차: 차량대금 지출
        cashflows[0] += -차량대금;

        // 1~36개월차: 고객 수납 (매월 균등) - 수수료 차감
        for (int t = 1; t <= 개월수; t++) {
            double cf = 순수리스료 + 월보험료 + 월차세 - 월수수료;
            if (t == 개월수) cf += 잔가;
            cashflows[t] += cf;
        }

        // 보험료 실제 지급(지출) 반영
        for (Payment p : 보험료지급스케줄(개월수)) {
            cashflows[p.month] -= p.amount;
        }

        // 차세 실제 지급(지출) 반영
        for (Payment p : 차세지급스케줄(인도월, 개월수)) {
            cashflows[p.month] -= p.amount;
        }

        double 월IRR = 월IRR계산(cashflows);
        return new IRR결과(월IRR * 12, cashflows);
    }

    /**
     * 표시 전용 절사(truncate) 함수 — 계산에는 전혀 관여하지 않고,
     * 화면에 보여줄 때만 소수점 n자리 미만을 반올림 없이 잘라낸다.
     * 부동소수점 오차를 피하기 위해 문자열로 처리한다.
     */
    static String 절사(double value, int decimals) {
        String sign = value < 0 ? "-" : "";
        double absValue = Math.abs(value);
        // decimals보다 충분히 긴 자릿수로 고정한 뒤, 그 문자열을 그대로 잘라낸다.
        String s = String.format("%." + (decimals + 10) + "f", absValue);
        int dotIdx = s.indexOf('.');
        String truncated = decimals == 0 ? s.substring(0, dotIdx) : s.substring(0, dotIdx + 1 + decimals);
        return sign + truncated;
    }

    public static void main(String[] args) {
        NumberFormat nf = NumberFormat.getNumberInstance(Locale.KOREA);

        double 순수리스료 = 965986; // 예시로 넣어볼 리스료 (이전 계산 결과값)
        IRR결과 결과 = 리스료로_IRR계산(순수리스료);
        double 연IRR_퍼센트 = 결과.연IRR * 100;

        System.out.println("=== 정방향 계산 결과 (리스료 → IRR) ===");
        System.out.println("인도월: " + 인도월 + " 월");
        System.out.println("입력한 순수리스료: " + nf.format(순수리스료));
        System.out.println("------------------------------");
        System.out.println("계산된 연IRR (전체 정밀도): " + 연IRR_퍼센트 + " %");
        System.out.println("계산된 연IRR (표시용, 소수점 4자리 절사): " + 절사(연IRR_퍼센트, 4) + "%");
        System.out.println("------------------------------");
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < 6 && i < 결과.cashflows.length; i++) {
            if (i > 0) sb.append(", ");
            sb.append(결과.cashflows[i]);
        }
        sb.append("]");
        System.out.println("[참고] 0~5개월차 현금흐름 샘플: " + sb);
    }
}
