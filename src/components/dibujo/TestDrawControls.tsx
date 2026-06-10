import { useState, useRef, useEffect } from "react";
import { FaEraser, FaTrash, FaUndo, FaRedo } from "react-icons/fa";

type Point = { x: number, y: number };
type Stroke = { color: string, size: number, points: Point[] };

export default function TestDrawControls() {
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(0.01);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<Point | null>(null);
  const currentStroke = useRef<Stroke | null>(null);

  const [history, setHistory] = useState<Stroke[]>([]);
  const [redoQueue, setRedoQueue] = useState<Stroke[]>([]);
  
  const historyRef = useRef<Stroke[]>([]);
  useEffect(() => { historyRef.current = history; }, [history]);

  // Resize canvas to fill container
  useEffect(() => {
     const resizeCanvas = () => {
        if (!canvasRef.current) return;
        const parent = canvasRef.current.parentElement;
        if (parent) {
           const dpr = window.devicePixelRatio || 1;
           canvasRef.current.width = parent.clientWidth * dpr;
           canvasRef.current.height = parent.clientHeight * dpr;
           if (historyRef.current) redrawAllStrokes(historyRef.current);
        }
     };
     setTimeout(resizeCanvas, 100);
     window.addEventListener('resize', resizeCanvas);
     return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getPos = (e: any) => {
     const canvas = canvasRef.current;
     if (!canvas) return { x: 0, y: 0 };
     const rect = canvas.getBoundingClientRect();
     const clientX = e.touches ? e.touches[0].clientX : e.clientX;
     const clientY = e.touches ? e.touches[0].clientY : e.clientY;
     return {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height
     };
  };

  const startDrawing = (e: any) => {
     isDrawing.current = true;
     const pos = getPos(e);
     lastPos.current = pos;
     currentStroke.current = { color, size, points: [pos] };
     if (redoQueue.length > 0) setRedoQueue([]);
  };

  const draw = (e: any) => {
     if (!isDrawing.current || !lastPos.current || !canvasRef.current || !currentStroke.current) return;
     const currentPos = getPos(e);
     const ctx = canvasRef.current.getContext('2d');
     if (!ctx) return;
     
     const w = canvasRef.current.width;
     const h = canvasRef.current.height;

     ctx.beginPath();
     ctx.moveTo(lastPos.current.x * w, lastPos.current.y * h);
     ctx.lineTo(currentPos.x * w, currentPos.y * h);
     ctx.strokeStyle = color;
     ctx.lineWidth = size * Math.min(w, h);
     ctx.lineCap = 'round';
     ctx.stroke();

     currentStroke.current.points.push(currentPos);
     lastPos.current = currentPos;
  };

  const stopDrawing = () => {
     isDrawing.current = false;
     lastPos.current = null;
     if (currentStroke.current) {
        setHistory(prev => [...prev, currentStroke.current!]);
        currentStroke.current = null;
     }
  };

  const redrawAllStrokes = (strokes: Stroke[]) => {
     const canvas = canvasRef.current;
     if (!canvas) return;
     const ctx = canvas.getContext('2d');
     if (!ctx) return;
     
     const w = canvas.width;
     const h = canvas.height;
     ctx.clearRect(0, 0, w, h);
     
     strokes.forEach(s => {
        if (s.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size * Math.min(w, h);
        ctx.lineCap = 'round';
        
        ctx.moveTo(s.points[0].x * w, s.points[0].y * h);
        for (let i = 1; i < s.points.length; i++) {
           ctx.lineTo(s.points[i].x * w, s.points[i].y * h);
        }
        ctx.stroke();
     });
  };

  const handleUndo = () => {
     if (history.length === 0) return;
     const newHistory = [...history];
     const popped = newHistory.pop()!;
     setHistory(newHistory);
     setRedoQueue(prev => [...prev, popped]);
     redrawAllStrokes(newHistory);
  };

  const handleRedo = () => {
     if (redoQueue.length === 0) return;
     const newRedo = [...redoQueue];
     const popped = newRedo.pop()!;
     setRedoQueue(newRedo);
     const newHistory = [...history, popped];
     setHistory(newHistory);
     redrawAllStrokes(newHistory);
  };

  const handleClear = () => {
     setHistory([]);
     setRedoQueue([]);
     const ctx = canvasRef.current?.getContext('2d');
     if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  return (
     <div className="flex flex-col min-h-screen bg-[#111219]">
        <header className="bg-[#1a1b26] p-4 text-center font-bold uppercase">
           Modo de Prueba Local
        </header>

        <div className="flex-1 flex flex-col p-4">
           {/* Canvas Container */}
           <div className="relative w-full flex-1 bg-white rounded-xl overflow-hidden touch-none" style={{ touchAction: 'none' }}>
              <canvas 
                 ref={canvasRef}
                 className="absolute inset-0 cursor-crosshair touch-none"
                 onMouseDown={startDrawing}
                 onMouseMove={draw}
                 onMouseUp={stopDrawing}
                 onMouseOut={stopDrawing}
                 onTouchStart={startDrawing}
                 onTouchMove={draw}
                 onTouchEnd={stopDrawing}
                 onTouchCancel={stopDrawing}
                 style={{ touchAction: 'none' }}
              />
           </div>

           <div className="mt-4 bg-[#1a1b26] p-4 rounded-xl border border-white/10 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-2">
                 {["#000000", "#ef4444", "#3b82f6", "#22c55e", "#eab308", "#d946ef"].map(c => (
                    <button 
                       key={c}
                       onClick={() => setColor(c)}
                       className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                       style={{ backgroundColor: c }}
                    />
                 ))}
                 <button onClick={() => setColor("#ffffff")} className={`w-8 h-8 rounded-full bg-white flex items-center justify-center text-black border-2 shadow-[inset_0_0_5px_rgba(0,0,0,0.5)] ${color === "#ffffff" ? 'border-pink-500 scale-110' : 'border-gray-300'}`}>
                    <FaEraser size={14}/>
                 </button>
              </div>
              
              <div className="flex gap-4 items-center w-full justify-between mt-2 sm:mt-0 sm:w-auto">
                 <input 
                    type="range" 
                    min="0.005" max="0.05" step="0.005" 
                    value={size} 
                    onChange={e => setSize(parseFloat(e.target.value))} 
                    className="w-24"
                 />
                 <div className="flex gap-2">
                    <button onClick={handleUndo} disabled={history.length === 0} className="w-10 h-10 bg-gray-500/20 text-gray-300 flex items-center justify-center rounded-xl hover:bg-gray-500 hover:text-white transition-colors disabled:opacity-30">
                       <FaUndo />
                    </button>
                    <button onClick={handleRedo} disabled={redoQueue.length === 0} className="w-10 h-10 bg-gray-500/20 text-gray-300 flex items-center justify-center rounded-xl hover:bg-gray-500 hover:text-white transition-colors disabled:opacity-30">
                       <FaRedo />
                    </button>
                    <button onClick={handleClear} className="w-10 h-10 bg-red-500/20 text-red-500 flex items-center justify-center rounded-xl hover:bg-red-500 hover:text-white transition-colors ml-2">
                       <FaTrash />
                    </button>
                 </div>
              </div>
           </div>
        </div>
     </div>
  );
}
