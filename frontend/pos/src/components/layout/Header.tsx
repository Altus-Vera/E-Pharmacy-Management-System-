import { useAuthStore } from "../../store/authStore";
import { formatUserType } from "../../utils/formatters";
import { ShiftBadge, useLogoutGuard } from "../Shift";
import styles from "./Header.module.css";

export function Header() {
  const { user } = useAuthStore();
  const logout = useLogoutGuard();

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.brand}>
          <span className={styles.brandName}>AltusVera</span>
          <span className={styles.terminalBadge}>Terminal POS-01</span>
        </div>
        <div className={styles.brandSub}>National Medicines Regulatory Authority Licensed</div>
      </div>

      <div className={styles.right}>
        <ShiftBadge />
        <div className={styles.onlineBadge}>
          <span className={styles.onlineDot} />
          Online
        </div>
        {user && (
          <div className={styles.userInfo}>
            <div className={styles.userName}>{user.name}</div>
            <div className={styles.userRole}>{formatUserType(user.user_type)} · ID: {user.username.toUpperCase()}</div>
          </div>
        )}
        <button className={styles.logoutBtn} onClick={logout.request}>
          Logout
        </button>
        {logout.dialog}
      </div>
    </header>
  );
}
