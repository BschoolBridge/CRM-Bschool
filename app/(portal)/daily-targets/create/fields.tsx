"use client";

import { useEffect, useRef } from "react";
import { ClientForm } from "@/components/client-form";
import type { FormState } from "@/server/form";

export function DailyTargetFields({
  action,
  markup,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  markup: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const sync = () => {
      const mode = root.querySelector<HTMLInputElement>('input[name="assign_mode"]:checked');
      const box = root.querySelector("#id_counsellors");
      const group = box?.closest(".form-group");
      if (group instanceof HTMLElement) group.style.display = mode?.value === "selected" ? "" : "none";
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      root.removeEventListener("change", sync);
    };
  }, [markup]);
  return (
    <div ref={ref}>
      <ClientForm action={action} markup={markup} submitLabel="Set Target" />
    </div>
  );
}
