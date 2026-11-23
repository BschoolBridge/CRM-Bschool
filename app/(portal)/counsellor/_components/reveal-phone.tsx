"use client";

import { useState } from "react";

export function RevealPhoneButton({ url, masked, which }: { url: string; masked: string; which?: string }) {
  const [phone, setPhone] = useState<string | null>(null);
  if (phone !== null) {
    return phone ? (
      <a href={`tel:${phone}`} className="text-primary">
        <i className="fas fa-phone mr-1" />
        {phone}
      </a>
    ) : (
      <span className="text-muted">Not provided</span>
    );
  }
  return (
    <>
      <span>{masked}</span>
      <button
        type="button"
        className="btn btn-xs btn-outline-secondary ml-1"
        onClick={async () => {
          const init: RequestInit = { method: "POST" };
          if (which !== undefined) {
            const body = new FormData();
            body.set("which", which);
            init.body = body;
          }
          const response = await fetch(url, init);
          const data = (await response.json()) as { phone?: string };
          if (!response.ok) return;
          if (which === undefined) {
            if (data.phone) setPhone(data.phone);
          } else if (data.phone !== undefined) {
            setPhone(data.phone);
          }
        }}
      >
        View
      </button>
    </>
  );
}
