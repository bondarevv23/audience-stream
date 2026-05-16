export default function Topbar({ title }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">User activity statistics</p>
        <h2>{title}</h2>
      </div>
    </header>
  );
}
