export default function StaffDashboardLoading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f6f8fb",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "min(420px, calc(100% - 32px))",
          padding: 28,
          borderRadius: 20,
          background: "white",
          boxShadow: "0 18px 50px rgba(15, 23, 42, 0.10)",
          textAlign: "center",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 42,
            height: 42,
            margin: "0 auto 16px",
            border: "4px solid #e2e8f0",
            borderTopColor: "#0f172a",
            borderRadius: "50%",
          }}
        />
        <h1 style={{ margin: 0, fontSize: 20 }}>Opening Staff Portal</h1>
        <p style={{ margin: "8px 0 0", color: "#64748b" }}>
          Loading your company, float, attendance and operational records…
        </p>
      </section>
    </main>
  );
}
