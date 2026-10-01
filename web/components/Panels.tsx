import type { Impact } from "@/lib/footprint";
import { FACTORS, num, signed, type BalanceState, type Factor } from "@/lib/format";

export function Icon({ factor }: { factor: Factor }) {
  const d = {
    water: "M12 2.8c-.3.3-7 7.6-7 12.3a7 7 0 0 0 14 0c0-4.7-6.7-12-7-12.3Z",
    energy: "M13.4 2 4.6 13.6h6.2L9.9 22l8.8-11.8h-6.2L13.4 2Z",
    co2: "M7.2 19h10.2a4.3 4.3 0 0 0 .4-8.6A6 6 0 0 0 6.4 9.6 4.7 4.7 0 0 0 7.2 19Z",
  }[factor];
  return (
    <span className={`chip ${factor}`} aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d={d} fill="currentColor" /></svg>
    </span>
  );
}

function Panel({ title, values, sign, className }: { title: string; values: Impact; sign?: boolean; className: string }) {
  return (
    <div className={`panel box ${className}`}>
      <div className="label">{title}</div>
      {FACTORS.map((f) => (
        <div className="row" key={f.key}>
          <Icon factor={f.key} />
          <span className="num">
            {sign ? signed(values[f.key]) : num(values[f.key])}
            <small>{f.unit}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

export function Panels({ used, saved, balance, state }: { used: Impact; saved: Impact; balance: Impact; state: BalanceState }) {
  return (
    <div className="panels">
      <Panel title="Used by my AI" values={used} className="" />
      <Panel title="Saved by me" values={saved} className="" />
      <Panel title="Balance" values={balance} sign className={`bal bal-${state}`} />
    </div>
  );
}
