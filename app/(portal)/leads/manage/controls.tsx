"use client";

export function SelectAll() {
  return (
    <input
      type="checkbox"
      aria-label="Select all leads on this page"
      onChange={(event) => {
        const checked = event.currentTarget.checked;
        document.querySelectorAll<HTMLInputElement>("input.lead-checkbox").forEach((box) => {
          box.checked = checked;
        });
      }}
    />
  );
}

export function ConfirmButton({
  confirm,
  className,
  children,
  formAction,
  name,
  value,
  title,
}: {
  confirm?: string;
  className?: string;
  children: React.ReactNode;
  formAction?: (fd: FormData) => Promise<void>;
  name?: string;
  value?: string;
  title?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      name={name}
      value={value}
      formAction={formAction}
      title={title}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
