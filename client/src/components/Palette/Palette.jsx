import "./palette.style.scss";
import colors from "../../data/colors";
import { useContext, useState } from "react";
import { CanvasContext } from "../../contexts/CanvasContext";
import { GameContext } from "../../contexts/GameContext";

export default function Palette() {
  const { setCurrentColor, currentColor, clearCanvas, setBrushSize, brushSize, undoCanvas, isErasing, toggleEraser } =
    useContext(CanvasContext);
  const { socket, isAllowedToDraw } = useContext(GameContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleClear = () => { clearCanvas(); socket.emit("clear_canvas"); };
  const handleUndo = () => { undoCanvas(); socket.emit("undo_stroke"); };
  const handleColorClick = (color) => { if (isErasing) toggleEraser(); setCurrentColor(color); };

  const BRUSH_SIZES = [
    { label: "Small", size: 4 },
    { label: "Medium", size: 10 },
    { label: "Large", size: 18 },
    { label: "XL", size: 28 },
  ];

  return (
    <div className={`palette-container ${isAllowedToDraw ? "" : "hidden"}`}>
      <div
        style={{ backgroundColor: isErasing ? "#fff" : currentColor, border: isErasing ? "2px dashed #aaa" : "2px solid #333" }}
        className="selected-color"
      />
      <div className="colors">
        {colors.map((color) => (
          <div className="color" key={color.id} onClick={() => handleColorClick(color.value)} style={{ backgroundColor: color.value }} />
        ))}
      </div>
      <div className="tool-buttons">
        <button className={`tool-btn ${isErasing ? "active" : ""}`} onClick={toggleEraser}>Eraser</button>
        <button className="tool-btn" onClick={handleUndo}>Undo</button>
        <button className="tool-btn danger" onClick={handleClear}>Clear</button>
      </div>
      <div className="brush-selector">
        <button className="brush" onClick={() => setIsMenuOpen((v) => !v)}>Brush: {brushSize}px</button>
        {isMenuOpen && (
          <div className="menu">
            {BRUSH_SIZES.map(({ label, size }) => (
              <div key={size} onClick={() => { setIsMenuOpen(false); setBrushSize(size); }} className={brushSize === size ? "selected" : ""}>
                {label} ({size}px)
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
