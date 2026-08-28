import type { ReactNode } from 'react';
export function Page({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: string;
  children: ReactNode;
}) {
  return (
    <section className="content page">
      <div className="title-row">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {action && <button className="primary">＋ {action}</button>}
      </div>
      {children}
    </section>
  );
}
export function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="table-wrap generic">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j}>
                  {['Active', 'Paid', 'Confirmed', 'Available'].includes(v) ? (
                    <span className="status on">
                      <i />
                      {v}
                    </span>
                  ) : (
                    v
                  )}
                </td>
              ))}
              <td>
                <button className="text-action">Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Filters() {
  return (
    <div className="filters">
      <input type="date" defaultValue="2026-07-01" />
      <input type="date" defaultValue="2026-08-12" />
      <select>
        <option>All Branches</option>
        <option>Sukhumvit</option>
      </select>
      <button>Apply filters</button>
    </div>
  );
}
export function Stat({
  label,
  value,
  tone = 'blue',
  icon,
}: {
  label: string;
  value: string;
  tone?: string;
  icon?: string;
}) {
  return (
    <article className="stat">
      <span>{label}</span>
      <b>{value}</b>
      <i className={tone}>{icon && <img src={icon} alt="" />}</i>
    </article>
  );
}
export function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="form-card">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
