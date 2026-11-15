import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { formatUserType } from "../../utils/formatters";
import styles from "./Header.module.css";

export function Header() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

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
        <button className={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
