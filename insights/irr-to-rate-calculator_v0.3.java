import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * 리스료 계산 - 정밀 현금흐름 모델
 * (보험료/차세 실제 지급시점 반영, 인도월 파라미터화, 목표IRR로 리스료 직접 역산)
 */
public class LeasePreciseCashflowCalculator {

    // ===== 조건 =====
    static final double 차량대금 = 50000000;
    static final int 개월수 = 36;
    static final double 목표IRR_연 = 0.037412; // 3.7412%
    static final double 월수수료 = 0;
    static final double 보증잔가 = 5000000;
    static final double 무보증잔가 = 15000000;
    static final double 잔가 = 보증잔가 + 무보증잔가; // 20,000,000

    static final double 연보험료 = 2100000;
    static final double 연차세 = 1200000;
    static final double 월보험료 = 연보험료 / 12; // 고객에게 매월 균등 수납
    static final double 월차세 = 연차세 / 12;     // 고객에게 매월 균등 수납

    // ===== 인도월 (1~12, 언제든 바뀔 수 있는 입력값) =====
    static final int 인도월 = 7; // 예시: 7월 인도. 필요하면 이 값만 바꾸면 전체 스케줄이 자동으로 재계산됨

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

    /**
     * 보험료 실제 지급 스케줄.
     * 인도 시점(0개월차)에 1회, 이후 12개월마다 1회씩 (36개월 기준 총 3회: 0, 12, 24개월차)
     */
    static List<Payment> 보험료지급스케줄(int 개월수) {
        List<Payment> 지급목록 = new ArrayList<>();
        for (int m = 0; m < 개월수; m += 12) {
            지급목록.add(new Payment(m, 연보험료));
        }
        return 지급목록;
    }

    /**
     * 차세 실제 지급 스케줄.
     * 인도 시점에 "그 해 남은 개월수(인도월~12월, 인도월 포함)" 비율만큼 비례 지급.
     * 그 다음부터는 매 1월(=인도월 기준 다음 1월이 몇 개월 뒤인지)마다 전액 지급.
     * (마지막 회차도 항상 12개월치 전액 납부 — 반납 후 되팔릴 때까지 등록 유지 비용으로 간주)
     */
    static List<Payment> 차세지급스케줄(int 인도월, int 개월수) {
        List<Payment> 지급목록 = new ArrayList<>();
        int 첫해_잔여월 = 13 - 인도월; // 인도월부터 12월까지 개월 수 (인도월 포함)
        double 비례비율 = 첫해_잔여월 / 12.0;
        지급목록.add(new Payment(0, 연차세 * 비례비율));

        int d = 첫해_잔여월; // 인도 시점부터 다음 1월까지의 개월수
        while (d < 개월수) {
            지급목록.add(new Payment(d, 연차세)); // 마지막 회차도 항상 12개월치 전액 납부
            d += 12;
        }
        return 지급목록;
    }

    /** 월 IRR 계산 (이분법) */
    static double 월IRR계산(double[] cashflows) {
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

    /** 연IRR 계산 결과 (연IRR, 현금흐름표) */
    static class IRR결과 {
        final double 연IRR;
        final double[] cashflows;

        IRR결과(double 연IRR, double[] cashflows) {
            this.연IRR = 연IRR;
            this.cashflows = cashflows;
        }
    }

    /** 순수리스료가 주어졌을 때, 실제(보험료/차세 지급시점 반영) 연IRR 계산 */
    static IRR결과 연IRR_정밀(double 순수리스료) {
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

    /** 목표IRR에 맞는 순수리스료를 직접 이분법으로 탐색 */
    static long 리스료탐색_정밀() {
        double low = 0, high = 차량대금;
        for (int i = 0; i < 200; i++) {
            double mid = (low + high) / 2;
            double 연IRR = 연IRR_정밀(Math.floor(mid)).연IRR;
            if (연IRR < 목표IRR_연) {
                low = mid;
            } else {
                high = mid;
            }
        }
        return (long) Math.floor((low + high) / 2);
    }

    /**
     * (참고/회계용) 확정된 리스료로 36개월 상각했을 때
     * 잔액이 정확히 "잔가"가 되도록 만드는 내재금리(월이자 절사 반영) 역산용 최종잔액 계산.
     */
    static double 최종잔액계산(double 연금리, double 리스료) {
        double 월금리 = 연금리 / 12;
        double 잔액 = 차량대금;
        for (int t = 1; t <= 개월수; t++) {
            double 이자 = Math.floor(잔액 * 월금리);
            잔액 = 잔액 + 이자 - 리스료;
        }
        return 잔액;
    }

    static double 내재금리탐색(double 리스료) {
        double low = -0.5, high = 1.0;
        for (int i = 0; i < 200; i++) {
            double mid = (low + high) / 2;
            double 최종잔액 = 최종잔액계산(mid, 리스료);
            if (최종잔액 < 잔가) {
                low = mid;
            } else {
                high = mid;
            }
        }
        return (low + high) / 2;
    }

    public static void main(String[] args) {
        NumberFormat nf = NumberFormat.getNumberInstance(Locale.KOREA);

        long 순수리스료 = 리스료탐색_정밀();
        IRR결과 결과 = 연IRR_정밀(순수리스료);
        double 고객청구_총_리스료 = 순수리스료 + 월보험료 + 월차세;
        double 내재금리 = 내재금리탐색(순수리스료);
        double 검증_최종잔액 = 최종잔액계산(내재금리, 순수리스료);

        System.out.println("=== 계산 결과 (인도월 기준 보험료/차세 실제 지급시점 반영) ===");
        System.out.println("인도월: " + 인도월 + " 월");
        System.out.println("목표IRR(연): " + (목표IRR_연 * 100) + "%");
        System.out.println("------------------------------");
        System.out.println("구해진 순수 리스료(월, 절사됨): " + nf.format(순수리스료));
        System.out.println("고객청구 총 월 리스료: " + nf.format(고객청구_총_리스료));
        System.out.println("검산 - 실제 연IRR: " + (결과.연IRR * 100) + " %");
        System.out.println("------------------------------");
        System.out.println("[참고/회계용] 역산된 내재금리(연): " + (내재금리 * 100) + " %");
        System.out.println("[참고/회계용] 내재금리로 36개월 상각 시 최종잔액(잔가와 비교): " + 검증_최종잔액);
        System.out.println("------------------------------");
        System.out.println("[참고] 보험료 지급 스케줄(개월차/금액): " + 보험료지급스케줄(개월수));
        System.out.println("[참고] 차세 지급 스케줄(개월차/금액): " + 차세지급스케줄(인도월, 개월수));
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
