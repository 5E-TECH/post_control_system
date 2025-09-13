// components/Card.tsx
import React from "react";
import clsx from "clsx";

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={clsx("rounded-2xl bg-white dark:bg-gray-900 shadow-md", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={clsx("p-4 border-b dark:border-gray-800", className)}>{children}</div>
  );
}

export function CardTitle({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <h2 className={clsx("text-xl font-bold text-gray-800 dark:text-gray-100", className)}>{children}</h2>
  );
}

export function CardContent({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx("p-4", className)}>{children}</div>;
}
