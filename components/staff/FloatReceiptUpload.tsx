"use client";

import { type FormEvent, useState } from "react";

type FloatItem = {
  id: string;
  amount: number | string;
  purpose?: string | null;
};

export default function FloatReceiptUpload({
  float,
  onSaved,
}: {
  float: FloatItem;
  onSaved?: () => void;
}) {
  const [returnedAmount, setReturnedAmount] = useState(String(float.amount));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setMessage("Upload the return receipt first.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("floatId", float.id);
      form.append("returnedAmount", returnedAmount);
      form.append("file", file);

      const response = await fetch("/api/staff/float-receipt", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Submission failed.");
      }

      setMessage(result.message);
      onSaved?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
      <strong>{float.purpose || "Operational float"}</strong>
      <label>
        Returned amount
        <input
          type="number"
          min="1"
          max={Number(float.amount)}
          value={returnedAmount}
          onChange={(event) => setReturnedAmount(event.target.value)}
          required
        />
      </label>
      <label>
        Return receipt
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          required
        />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? "Uploading..." : "Upload receipt for verification"}
      </button>
      {message && <p>{message}</p>}
    </form>
  );
}
