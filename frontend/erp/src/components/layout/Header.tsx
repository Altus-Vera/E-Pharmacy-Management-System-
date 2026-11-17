import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { formatUserType } from "../../utils/formatters";
import { useEffect, useState } from "react";
import { LANGS, getLang, setLang, onLangChange, type Lang } from "../../i18n";
import styles from "./Header.module.css";

export function Header() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [lang, setL] = useState<Lang>(getLang());
  useEffect(() => onLangChange(setL), []);

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  return (
    <header className={styles.header}>
      <div>
        <span className={styles.brand} data-no-i18n>AltusVera</span>
        <span className={styles.brandSub}>ERP</span>
      </div>
      <div className={styles.right}>
        <select className={styles.langSelect} value={lang} onChange={e => setLang(e.target.value as Lang)} aria-label="Language" data-no-i18n>
          {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
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
