# ===== 정방향 계산기: 리스료를 입력하면 IRR이 바로 나옴 =====
# (조건은 기존 역방향 계산기와 동일 - 인도월 7월, 보증/무보증잔가 분리, 수수료 0)

# ===== 조건 =====
차량대금 = 50_000_000
개월수 = 36
월수수료 = 0
보증잔가 = 5_000_000
무보증잔가 = 15_000_000
잔가 = 보증잔가 + 무보증잔가  # 20,000,000

연보험료 = 2_100_000
연차세 = 1_200_000
월보험료 = 연보험료 / 12  # 고객에게 매월 균등 수납
월차세 = 연차세 / 12      # 고객에게 매월 균등 수납

인도월 = 7  # 1~12, 언제든 바뀔 수 있는 입력값


def 보험료지급스케줄(개월수):
    """인도 시점(0개월차)에 1회, 이후 12개월마다 1회씩"""
    return [{"month": m, "amount": 연보험료} for m in range(0, 개월수, 12)]


def 차세지급스케줄(인도월, 개월수):
    """0개월차: 인도월 기준 첫해 비례, 이후 12개월마다 전액 (마지막 회차도 항상 전액)"""
    지급목록 = []
    첫해_잔여월 = 13 - 인도월
    비례비율 = 첫해_잔여월 / 12
    지급목록.append({"month": 0, "amount": 연차세 * 비례비율})

    d = 첫해_잔여월
    while d < 개월수:
        지급목록.append({"month": d, "amount": 연차세})
        d += 12
    return 지급목록


def npv(cashflows, rate):
    return sum(cf / (1 + rate) ** t for t, cf in enumerate(cashflows))


def 월IRR계산(cashflows):
    """월 IRR 계산 (NPV=0 되는 할인율, 이분법)"""
    low, high = -0.9, 10
    for _ in range(500):
        mid = (low + high) / 2
        if npv(cashflows, mid) > 0:
            low = mid
        else:
            high = mid
    return (low + high) / 2


def 리스료로_IRR계산(순수리스료):
    """리스료를 입력받아 현금흐름표를 만들고 연IRR을 계산해서 반환한다.
    (목표IRR을 찾는 탐색 과정 없이, 딱 한 번의 계산으로 끝남)"""
    cashflows = [0.0] * (개월수 + 1)

    # 0개월차: 차량대금 지출
    cashflows[0] += -차량대금

    # 1~36개월차: 고객 수납 (매월 균등) - 수수료 차감
    for t in range(1, 개월수 + 1):
        cf = 순수리스료 + 월보험료 + 월차세 - 월수수료
        if t == 개월수:
            cf += 잔가
        cashflows[t] += cf

    # 보험료 실제 지급(지출) 반영
    for p in 보험료지급스케줄(개월수):
        cashflows[p["month"]] -= p["amount"]

    # 차세 실제 지급(지출) 반영
    for p in 차세지급스케줄(인도월, 개월수):
        cashflows[p["month"]] -= p["amount"]

    월IRR = 월IRR계산(cashflows)
    return {"연IRR": 월IRR * 12, "cashflows": cashflows}


def 절사(value, decimals):
    """표시 전용 절사(truncate) 함수 — 계산에는 전혀 관여하지 않고,
    화면에 보여줄 때만 소수점 n자리 미만을 반올림 없이 잘라낸다.
    부동소수점 오차를 피하기 위해 문자열로 처리한다."""
    sign = "-" if value < 0 else ""
    abs_value = abs(value)
    # decimals보다 충분히 긴 자릿수로 고정한 뒤, 그 문자열을 그대로 잘라낸다.
    s = f"{abs_value:.{decimals + 10}f}"
    dot_idx = s.index(".")
    truncated = s[:dot_idx] if decimals == 0 else s[: dot_idx + 1 + decimals]
    return sign + truncated


if __name__ == "__main__":
    순수리스료 = 965986  # 예시로 넣어볼 리스료 (이전 계산 결과값)
    결과 = 리스료로_IRR계산(순수리스료)
    연IRR_퍼센트 = 결과["연IRR"] * 100

    print("=== 정방향 계산 결과 (리스료 → IRR) ===")
    print(f"인도월: {인도월} 월")
    print(f"입력한 순수리스료: {순수리스료:,}")
    print("------------------------------")
    print(f"계산된 연IRR (전체 정밀도): {연IRR_퍼센트} %")
    print(f"계산된 연IRR (표시용, 소수점 4자리 절사): {절사(연IRR_퍼센트, 4)}%")
    print("------------------------------")
    print("[참고] 0~5개월차 현금흐름 샘플:", 결과["cashflows"][:6])
