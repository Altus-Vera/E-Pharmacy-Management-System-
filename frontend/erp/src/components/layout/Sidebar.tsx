import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";

const navItems = [
  { section: "Operations" },
  { to: "/", label: "Dashboard", icon: "▦" },
  { to: "/inventory", label: "Inventory", icon: "⬡" },
  { to: "/suppliers", label: "Suppliers", icon: "🏭" },
  { to: "/purchase-orders", label: "Purchase Orders", icon: "📋" },
  { section: "Admin" },
  { to: "/users", label: "User Management", icon: "👤" },
  { to: "/reports", label: "Reports", icon: "📊" },
];

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        {navItems.map((item, i) => {
          if ("section" in item) {
            return <div key={i} className={styles.section}>{item.section}</div>;
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ""}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
