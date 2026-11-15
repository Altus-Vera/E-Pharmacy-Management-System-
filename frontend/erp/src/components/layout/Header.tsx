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
      <div>
        <span className={styles.brand}>AltusVera</span>
        <span className={styles.brandSub}>ERP</span>
      </div>
      <div className={styles.right}>
        {user && (
          <div className={styles.userInfo}>
            <div className={styles.userName}>{user.name}</div>
            <div className={styles.userRole}>{formatUserType(user.user_type)}</div>
          </div>
        )}
        <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>
    </header>
  );
}
