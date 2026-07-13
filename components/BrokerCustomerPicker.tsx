"use client";

import { useEffect, useMemo, useState } from "react";

type BrokerItem = {
  id: string;
  code: string;
  name: string;
  businessName: string | null;
  phone: string;
  location: string;
  region: string | null;
  district: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
};

type Props = {
  value: string;
  onChange: (brokerCustomerId: string, broker: BrokerItem | null) => void;
  disabled?: boolean;
};

export default function BrokerCustomerPicker({
  value,
  onChange,
  disabled = false,
}: Props) {
  const [brokers, setBrokers] = useState<BrokerItem[]>([]);
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/staff/brokers", {
          credentials: "include",
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || result.success === false) {
          throw new Error(result.message || "Could not load brokers.");
        }

        if (!cancelled) {
          setBrokers(
            Array.isArray(result.brokers) ? result.brokers : [],
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const locations = useMemo(
    () =>
      Array.from(
        new Set(
          brokers
            .map((broker) => broker.location)
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [brokers],
  );

  const visibleBrokers = useMemo(
    () =>
      brokers.filter(
        (broker) =>
          !location ||
          broker.location.toLowerCase() === location.toLowerCase(),
      ),
    [brokers, location],
  );

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <select
        value={location}
        disabled={disabled || loading}
        onChange={(event) => {
          setLocation(event.target.value);
          onChange("", null);
        }}
      >
        <option value="">All broker locations</option>
        {locations.map((item) => (
          <option value={item} key={item}>
            {item}
          </option>
        ))}
      </select>

      <select
        value={value}
        disabled={disabled || loading}
        onChange={(event) => {
          const id = event.target.value;
          const broker =
            brokers.find((item) => item.id === id) ?? null;

          onChange(id, broker);
        }}
        required
      >
        <option value="">
          {loading ? "Loading brokers..." : "Select broker customer"}
        </option>

        {visibleBrokers.map((broker) => (
          <option value={broker.id} key={broker.id}>
            {broker.name} — {broker.location} — {broker.phone}
          </option>
        ))}
      </select>
    </div>
  );
}
