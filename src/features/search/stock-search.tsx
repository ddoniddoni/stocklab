"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { searchInstruments } from "@/domain/instruments";
export function StockSearch() {
  const router = useRouter();
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = searchInstruments(query);
  const choose = (symbol: string) => {
    setOpen(false);
    router.push(`/stocks/${symbol}`);
  };
  return (
    <div
      className="search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>종목 검색</label>
      <div className="search-input">
        <span aria-hidden="true">⌕</span>
        <input
          id={id}
          type="search"
          role="combobox"
          autoComplete="off"
          maxLength={50}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? `${id}-list` : undefined}
          aria-activedescendant={
            open && active >= 0 && matches[active]
              ? `${id}-${active}`
              : undefined
          }
          placeholder="회사명 또는 6자리 종목코드"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              setActive(-1);
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive(
                matches.length
                  ? (active +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      matches.length) %
                      matches.length
                  : -1,
              );
            }
            if (
              event.key === "Enter" &&
              !event.nativeEvent.isComposing &&
              open &&
              matches[active]
            ) {
              event.preventDefault();
              choose(matches[active].symbol);
            }
          }}
        />
        <kbd aria-hidden="true">↵</kbd>
      </div>
      {open ? (
        <div className="search-results">
          <div
            id={`${id}-list`}
            role="listbox"
            aria-label="지원 종목 검색 결과"
          >
            {matches.map((stock, index) => (
              <button
                type="button"
                role="option"
                aria-selected={active === index}
                id={`${id}-${index}`}
                key={stock.symbol}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(stock.symbol)}
              >
                <strong>{stock.name}</strong>
                <span>{stock.symbol} · 합성 시세</span>
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
          {matches.length === 0 ? (
            <p role="status">
              현재 데모에서 지원하지 않는 종목입니다. 삼성전자 또는 005930을
              검색해 보세요.
            </p>
          ) : (
            <p className="search-hint">↑↓ 선택 · Enter 열기 · Esc 닫기</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
