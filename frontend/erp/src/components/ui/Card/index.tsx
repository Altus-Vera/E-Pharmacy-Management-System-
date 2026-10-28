import React from "react";
import styles from "./Card.module.css";

interface CardProps { title?: string; padded?: boolean; className?: string; children: React.ReactNode; }

export function Card({ title, padded = false, className, children }: CardProps) {
  return (
    <div className={`${styles.card} ${padded ? styles.padded : ""} ${className ?? ""}`}>
      {title && <div className={styles.header}>{title}</div>}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
