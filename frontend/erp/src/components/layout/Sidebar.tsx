import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { useAuthStore } from "../../store/authStore";
import { canAccess } from "../../utils/roles";

const navItems = [
  { section: "Operations" },
  { to: "/", label: "Dashboard", icon: "▦" },
  { to: "/customers", label: "Customers", icon: "👥" },
  { to: "/doctors", label: "Doctors", icon: "🩺" },
  { to: "/prescriptions", label: "Prescriptions", icon: "📝" },
  { section: "Inventory" },
  { to: "/inventory", label: "Drug Catalog", icon: "💊" },
  { to: "/stock-view", label: "Stock View", icon: "📦" },
  { to: "/stock-locations", label: "Stock Locations", icon: "🗄" },
  { to: "/uom", label: "Units of Measure", icon: "⚖" },
  { to: "/dose-codes", label: "Dose Codes", icon: "⏱" },
  { section: "Procurement" },
  { to: "/suppliers", label: "Suppliers", icon: "🏭" },
  { to: "/purchase-requisitions", label: "Purchase Requisitions", icon: "📋" },
  { to: "/purchase-orders", label: "Purchase Orders", icon: "🛒" },
  { to: "/grn", label: "Goods Receipt (GRN)", icon: "📥" },
  { to: "/purchase-invoices", label: "Purchase Invoices", icon: "🧾" },
  { to: "/supplier-returns", label: "Supplier Returns", icon: "↪" },
  { section: "Sales" },
  { to: "/sales-returns", label: "Sales Returns", icon: "↩" },
  { section: "Branches" },
  { to: "/outlets", label: "Outlets", icon: "🏪" },
  { to: "/stock-transfers", label: "Stock Transfers", icon: "🔀" },
  { section: "Admin" },
  { to: "/users", label: "User Management", icon: "👤" },
  { to: "/reports", label: "Reports", icon: "📊" },
  { to: "/audit-log", label: "Audit Log", icon: "🛡" },
  { to: "/system", label: "System & Backup", icon: "⚙" },
];

export function Sidebar() {
  const userType = useAuthStore((s) => s.user?.user_type);
  // hide links the role cannot open, then drop section headers left empty
  const visible = navItems.filter((it) => "section" in it || canAccess(it.to, userType));
  const items = visible.filter((it, i) => !("section" in it) || (visible[i + 1] && !("section" in visible[i + 1])));
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        {items.map((item, i) => {
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
