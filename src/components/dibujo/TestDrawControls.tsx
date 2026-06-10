import { useState, useRef, useEffect } from "react";
import { FaEraser, FaTrash } from "react-icons/fa";

export default function TestDrawControls() {
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(0.01);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{x: number, y: number} | null>(null);

  // Resize canvas to fill container
  useEffect(() => {
     const resizeCanvas = () => {
        if (!canvasRef.current) return;
        const parent = canvasRef.current.parentElement;
        if (parent) {
           canvasRef.current.width = parent.clientWidth;
           canvasRef.current.height = parent.clientHeight;
        }
     };
     window.addEventListener('resize', resizeCanvas);
     resizeCanvas();
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
     lastPos.current = getPos(e);
  };

  const draw = (e: any) => {
     if (!isDrawing.current || !lastPos.current || !canvasRef.current) return;
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

     lastPos.current = currentPos;
  };

  const stopDrawing = () => {
     isDrawing.current = false;
     lastPos.current = null;
  };

  const handleClear = () => {
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
                 {["#ffffff", "#000000", "#ef4444", "#3b82f6", "#22c55e", "#eab308", "#d946ef"].map(c => (
                    <button 
                       key={c}
                       onClick={() => setColor(c)}
                       className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                       style={{ backgroundColor: c }}
                    />
                 ))}
                 <button onClick={() => setColor("#111219")} className={`w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white border-2 ${color === "#111219" ? 'border-white scale-110' : 'border-transparent'}`}>
                    <FaEraser size={14}/>
                 </button>
              </div>
              
              <div className="flex gap-4 items-center">
                 <input 
                    type="range" 
                    min="0.005" max="0.05" step="0.005" 
                    value={size} 
                    onChange={e => setSize(parseFloat(e.target.value))} 
                    className="w-24"
                 />
                 <button onClick={handleClear} className="w-10 h-10 bg-red-500/20 text-red-500 flex items-center justify-center rounded-xl hover:bg-red-500 hover:text-white transition-colors">
                    <FaTrash />
                 </button>
              </div>
           </div>
        </div>
     </div>
  );
}
