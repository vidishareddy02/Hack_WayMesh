// CategoryButtons.jsx — Filter messages by category

const categories = ["all", "medical", "shelter", "danger", "transport"];

function CategoryButtons({ selectedCategory, setSelectedCategory, messages }) {
  // Count messages for each category
  function getCount(category) {
    if (category === "all") return messages.length;
    return messages.filter((m) => m.category === category).length;
  }

  // Style for each button (highlighted when selected)
  function getStyle(category) {
    const isSelected = selectedCategory === category;
    return {
      margin: "5px",
      padding: "8px 14px",
      borderRadius: "20px",
      border: "none",
      cursor: "pointer",
      fontWeight: "bold",
      fontSize: "14px",
      backgroundColor: isSelected ? "#3b82f6" : "#1e293b",
      color: isSelected ? "white" : "#94a3b8",
    };
  }

  return (
    <div style={{ marginBottom: "15px", display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => setSelectedCategory(cat)}
          style={getStyle(cat)}
        >
          {cat.charAt(0).toUpperCase() + cat.slice(1)} ({getCount(cat)})
        </button>
      ))}
    </div>
  );
}

export default CategoryButtons;
