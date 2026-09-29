import Link from "next/link";
export default function NotFound() {
  return (
    <section className="empty-state">
      <p className="eyebrow">지원하지 않는 종목</p>
      <h1>현재 데모에서 지원하지 않는 종목입니다</h1>
      <p>지금은 삼성전자(005930)의 합성 시세를 확인할 수 있습니다.</p>
      <Link href="/" className="button-link">
        종목 탐색으로 돌아가기
      </Link>
    </section>
  );
}
