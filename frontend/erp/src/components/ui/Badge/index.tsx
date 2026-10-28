import React from "react";
import styles from "./Badge.module.css";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

interface BadgeProps { variant?: BadgeVariant; children: React.ReactNode; }

export function Badge({ variant = "neutral", children }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[variant]}`}>{children}</span>;
}
