import "./canvas.styles.scss";
import { useContext, useEffect } from "react";
import { CanvasContext } from "../../contexts/CanvasContext";
import { GameContext } from "../../contexts/GameContext";

export default function Canvas() {
  const {
    ctxRef, finishDrawing, isDrawing, startDrawing, draw,
    brushSize, currentColor, canvasRef, prevCoordianates, setPrevCoordinates, isErasing,
  } = useContext(CanvasContext);
  const { socket, isAllowedToDraw } = useContext(GameContext);

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
  }, []);

  useEffect(() => {
    canvasRef.current.height = window.innerHeight * 0.6;
    canvasRef.current.width = window.innerWidth * 0.5;
  }, []);

  const effectiveColor = isErasing ? "#FFFFFF" : currentColor;
  const effectiveSize = isErasing ? brushSize * 2.5 : brushSize;

  const handleMouseDown = ({ nativeEvent }) => {
    if (!isAllowedToDraw) return;
    const { offsetX, offsetY } = nativeEvent;
    socket.emit("start_drawing", { offsetX, offsetY, color: effectiveColor, size: effectiveSize });
    startDrawing(offsetX, offsetY, effectiveColor, effectiveSize);
  };

  const handleMouseUp = () => {
    if (!isAllowedToDraw) return;
    setPrevCoordinates({ offsetX: 0, offsetY: 0 });
    socket.emit("finish_drawing");
    finishDrawing();
  };

  const handleMouseMove = ({ nativeEvent }) => {
    if (!isAllowedToDraw || !isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    const threshold = effectiveSize + 5;
    if (Math.abs(offsetX - prevCoordianates.offsetX) > threshold ||
        Math.abs(offsetY - prevCoordianates.offsetY) > threshold) {
      socket.emit("draw", { offsetX, offsetY });
      draw(offsetX, offsetY);
      setPrevCoordinates({ offsetX, offsetY });
    }
  };

  const handleMouseEnter = () => {
    if (isAllowedToDraw)
      canvasRef.current.style.cursor = isErasing ? "cell" : "url(./assets/pencil.png), crosshair";
  };

  const handleMouseLeave = () => {
    if (isAllowedToDraw && isDrawing) {
      setPrevCoordinates({ offsetX: 0, offsetY: 0 });
      socket.emit("finish_drawing");
      finishDrawing();
    }
  };

  return (
    <div className="canvas-container">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
