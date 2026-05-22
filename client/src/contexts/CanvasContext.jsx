import { createContext, useState, useRef } from "react";

export const CanvasContext = createContext({});

export const CanvasContextProvider = ({ children }) => {
  const [currentColor, setCurrentColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [strokeHistory, setStrokeHistory] = useState([]);
  const [prevCoordianates, setPrevCoordinates] = useState({ offsetX: 0, offsetY: 0 });

  const ctxRef = useRef(null);
  const canvasRef = useRef(null);

  const saveStroke = () => {
    if (!ctxRef.current || !canvasRef.current) return;
    const imageData = ctxRef.current.getImageData(
      0, 0, canvasRef.current.width, canvasRef.current.height
    );
    setStrokeHistory((prev) => [...prev, imageData]);
  };

  const startDrawing = (offsetX, offsetY, color = currentColor, size = brushSize) => {
    setIsDrawing(true);
    ctxRef.current.strokeStyle = color;
    ctxRef.current.lineWidth = size;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(offsetX, offsetY);
  };

  const draw = (offsetX, offsetY) => {
    ctxRef.current.lineTo(offsetX, offsetY);
    ctxRef.current.stroke();
  };

  const finishDrawing = () => {
    setIsDrawing(false);
    ctxRef.current.closePath();
    saveStroke();
  };

  const clearCanvas = () => {
    if (!ctxRef.current || !canvasRef.current) return;
    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setStrokeHistory([]);
  };

  const undoCanvas = () => {
    setStrokeHistory((prev) => {
      if (prev.length === 0) return prev;
      const newHistory = prev.slice(0, -1);
      if (newHistory.length === 0) {
        ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      } else {
        ctxRef.current.putImageData(newHistory[newHistory.length - 1], 0, 0);
      }
      return newHistory;
    });
  };

  const resizeCanvas = (width, height) => {
    canvasRef.current.width = width * 0.5;
    canvasRef.current.height = height * 0.6;
    setStrokeHistory([]);
  };

  const toggleEraser = () => setIsErasing((prev) => !prev);

  const value = {
    currentColor, setCurrentColor,
    brushSize, setBrushSize,
    isDrawing, setIsDrawing,
    isErasing, toggleEraser,
    strokeHistory,
    ctxRef,
    canvasRef,
    prevCoordianates, setPrevCoordinates,
    startDrawing,
    draw,
    finishDrawing,
    clearCanvas,
    undoCanvas,
    resizeCanvas,
  };

  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  );
};
