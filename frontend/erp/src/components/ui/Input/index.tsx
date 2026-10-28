import React from "react";
import styles from "./Input.module.css";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...rest }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  const inputClasses = [styles.input, error ? styles.inputError : "", className ?? ""].filter(Boolean).join(" ");

  return (
    <div className={styles.wrapper}>
      {label && <label htmlFor={inputId} className={styles.label}>{label}</label>}
      <div className={styles.inputWrap}>
        <input id={inputId} className={inputClasses} {...rest} />
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
