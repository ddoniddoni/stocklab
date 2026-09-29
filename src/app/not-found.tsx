import Link from "next/link";
export default function NotFound() {
  return (
    <section className="empty-state">
      <p className="eyebrow">지원하지 않는 종목</p>
      <h1>현재 데모에서 지원하지 않는 종목입니다</h1>
      <p>지원하는 다섯 종목의 합성 시세를 종목 목록에서 선택해 주세요.</p>
      <Link href="/" className="button-link">
        종목 탐색으로 돌아가기
      </Link>
    </section>
  );
}
