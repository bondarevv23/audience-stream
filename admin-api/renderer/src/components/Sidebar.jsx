import { NAV_ITEMS } from "../constants/navigation";

export default function Sidebar({ activeView, onChangeView, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div>
          <p className="eyebrow">Analytics workspace</p>
          <h1>Administrator Statistics</h1>
        </div>
      </div>

      <nav className="nav-list" aria-label="Dashboard navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={activeView === item.id ? "nav-button active" : "nav-button"}
            type="button"
            onClick={() => onChangeView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <button className="logout-button" type="button" onClick={onLogout}>
        Log out
      </button>
    </aside>
  );
}
