// Explains the difference between the private dashboard link and the public share link.
const ROWS = [
  ["Looks like", "/me#… (your private token)", "/s/… (a separate random code)"],
  ["Shows", "Everything: totals, models, history, your logged savings", "Only three totals: used, saved and balance"],
  ["Can change things", "Yes: add and remove savings, change country, turn sharing on or off, delete all data", "No. It can only be viewed"],
  ["Safe to post publicly", "No. Anyone with it controls your dashboard", "Yes. Turn it off any time and the link stops working"],
];

export function LinkInfo() {
  return (
    <div className="box table-wrap">
      <table className="wrap-cells">
        <thead>
          <tr><th /><th>Private dashboard link</th><th>Share link</th></tr>
        </thead>
        <tbody>
          {ROWS.map(([label, priv, share]) => (
            <tr key={label}><td><strong>{label}</strong></td><td>{priv}</td><td>{share}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
