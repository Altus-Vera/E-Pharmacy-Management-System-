import styles from "./Reports.module.css";

const reportCards = [
  { icon: "📦", title: "Stock Report", desc: "Current inventory levels, low-stock and expiry alerts across all drug categories." },
  { icon: "📋", title: "BIN Card", desc: "Per-drug stock movement history: purchases, sales, adjustments and returns." },
  { icon: "🧾", title: "Sales Report", desc: "Daily, weekly and monthly invoice summary with payment mode breakdown." },
  { icon: "🚚", title: "GRN Listing", desc: "Goods receipt notes — all received purchase orders with batch and quantity detail." },
  { icon: "↩️", title: "Supplier Returns", desc: "Log of items returned to suppliers with reason and value." },
  { icon: "💰", title: "Price Adjustments", desc: "Audit trail of all unit price changes made by authorised users." },
];

export function ReportsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        {reportCards.map((r) => (
          <div key={r.title} className={styles.reportCard}>
            <div className={styles.reportIcon}>{r.icon}</div>
            <div className={styles.reportTitle}>{r.title}</div>
            <div className={styles.reportDesc}>{r.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
