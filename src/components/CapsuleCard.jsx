function CapsuleCard({ category, messages, onClick, isSelected }) {
  const colors = {
    medical: "#3b82f6",
    danger: "#ef4444",
    shelter: "#22c55e",
    transport: "#f59e0b",
    other: "#64748b",
  };

  return (
    <div
      onClick={() => onClick(category)}
     style={{
  width: "150px",
  height: "150px",
  borderRadius: "20px",
  background: `linear-gradient(135deg, ${colors[category] || "#64748b"}, #0f172a)`,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  cursor: "pointer",
  boxShadow: isSelected
    ? "0 0 20px rgba(59,130,246,0.8)"
    : "0 10px 25px rgba(0,0,0,0.3)",
  transform: isSelected ? "scale(1.08)" : "scale(1)",
  opacity: isSelected ? 1 : 0.7,
  transition: "0.3s",
}}
      onMouseEnter={(e) => {
  e.currentTarget.style.transform = isSelected ? "scale(1.08)" : "scale(1.05)";
  e.currentTarget.style.boxShadow = "0 15px 35px rgba(0,0,0,0.5)";
}}

onMouseLeave={(e) => {
  e.currentTarget.style.transform = isSelected ? "scale(1.08)" : "scale(1)";
  e.currentTarget.style.boxShadow = isSelected
    ? "0 0 20px rgba(59,130,246,0.8)"
    : "0 10px 25px rgba(0,0,0,0.3)";
}}
    >
      <h3
  style={{
    margin: 0,
    fontSize: "18px",
    letterSpacing: "0.5px",
  }}
>
  {category.toUpperCase()}
</h3>

      <p
  style={{
    marginTop: "8px",
    opacity: 0.85,
    fontSize: "13px",
  }}
>
  {messages.length} alerts
</p>
    </div>
  );
}

export default CapsuleCard;