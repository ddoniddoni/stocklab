"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="empty-state" role="alert">
      <p className="eyebrow">화면 오류</p>
      <h1>화면을 불러오지 못했습니다</h1>
      <p>다시 시도하거나 종목 탐색으로 돌아가세요.</p>
      <div className="empty-actions">
        <button onClick={reset}>다시 시도</button>
        <Link href="/">종목 탐색</Link>
      </div>
    </section>
  );
}
