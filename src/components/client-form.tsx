"use client";

import { useActionState, useEffect } from "react";
import type { FormState } from "../server/form";

export function ClientForm({
  action,
  markup,
  submitLabel,
  extra,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  markup: string;
  submitLabel: string;
  extra?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} encType="multipart/form-data">
      <fieldset disabled={pending} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <div dangerouslySetInnerHTML={{ __html: state?.markup ?? markup }} />
        {extra}
        <button className="btn btn-primary" type="submit">
          {pending ? "Saving…" : submitLabel}
        </button>
      </fieldset>
    </form>
  );
}

export function PostButton({
  action,
  children,
  className,
  confirm,
  title,
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  title?: string;
}) {
  return (
    <form action={action} className="d-inline">
      <button
        className={className}
        type="submit"
        title={title}
        onClick={(event) => {
          if (confirm && !window.confirm(confirm)) event.preventDefault();
        }}
      >
        {children}
      </button>
    </form>
  );
}

export function BodyClass({ name }: { name: string }) {
  useEffect(() => {
    const previous = document.body.className;
    document.body.className = name;
    return () => {
      document.body.className = previous;
    };
  }, [name]);
  return null;
}
