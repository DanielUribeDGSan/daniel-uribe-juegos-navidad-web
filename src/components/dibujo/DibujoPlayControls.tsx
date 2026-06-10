import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { FaEraser, FaTrash, FaPaperPlane, FaUndo, FaRedo } from "react-icons/fa";

type Point = { x: number, y: number };
type Stroke = { color: string, size: number, points: Point[] };

export default function DibujoPlayControls() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  
  const [session, setSession] = useState<any>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [teamPlayers, setTeamPlayers] = useState<any[]>([]);

  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(0.01);
  const [guess, setGuess] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<Point | null>(null);
  const currentStroke = useRef<Stroke | null>(null);
  const broadcastChannelRef = useRef<any>(null);

  const lastBroadcastPos = useRef<Point | null>(null);
  const lastSendTime = useRef<number>(0);

  const [history, setHistory] = useState<Stroke[]>([]);
  const [redoQueue, setRedoQueue] = useState<Stroke[]>([]);
  
  const historyRef = useRef<Stroke[]>([]);
  useEffect(() => { historyRef.current = history; }, [history]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sId = params.get('session_id');
    const tId = params.get('team_id');
    const pId = params.get('player_id');
    
    if (sId && tId && pId) {
      setSessionId(sId);
      setTeamId(parseInt(tId, 10));
      setPlayerId(pId);
      initGame(sId, pId, tId);
    }
  }, []);

  const initGame = async (sId: string, pId: string, tIdStr: string) => {
     // Fetch initial
     const { data: s } = await supabase.from('dibujo_sessions').select('*').eq('id', sId).single();
     if(s) setSession(s);
     
     const { data: gs } = await supabase.from('dibujo_game_state').select('*').eq('session_id', sId).single();
     if(gs) setGameState(gs);

     const { data: p } = await supabase.from('dibujo_players').select('*').eq('id', pId).single();
     if(p) setPlayer(p);

     const parsedTeamId = parseInt(tIdStr, 10);
     const { data: tp } = await supabase.from('dibujo_players').select('*').eq('session_id', sId).eq('team_id', parsedTeamId).order('joined_at', { ascending: true });
     if(tp) setTeamPlayers(tp);

     // Subscriptions
     supabase.channel(`p_sess_${s.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dibujo_sessions' }, (p) => {
        if (p.new.id === sId) setSession((prev: any) => ({...prev, ...p.new}));
     }).subscribe();
     supabase.channel(`p_gs_${s.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dibujo_game_state' }, (p) => {
        if (p.new.session_id === sId) setGameState((prev: any) => ({...prev, ...p.new}));
     }).subscribe();
     supabase.channel(`p_team_${sId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'dibujo_players' }, async (p) => {
         if (p.new?.session_id === sId || p.old?.session_id === sId) {
             const parsedTeamId = parseInt(tIdStr, 10);
             const { data: newTp } = await supabase.from('dibujo_players').select('*').eq('session_id', sId).eq('team_id', parsedTeamId).order('joined_at', { ascending: true });
             if (newTp) setTeamPlayers(newTp);
         }
     }).subscribe();

     // Broadcast
     const channel = supabase.channel(`dibujo_room_${sId}`);
     channel.on('broadcast', { event: 'draw' }, (payload) => {
        handleRemoteDraw(payload.payload);
     });
     channel.on('broadcast', { event: 'replace_state' }, (payload) => {
        if (!isDrawer) redrawAllStrokes(payload.payload.strokes);
     });
     channel.on('broadcast', { event: 'clear' }, () => {
        if (!isDrawer) {
           const ctx = canvasRef.current?.getContext('2d');
           if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
     });
     channel.subscribe();
     broadcastChannelRef.current = channel;
  };

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
     // Delay slightly to ensure layout is done
     setTimeout(resizeCanvas, 100);
     window.addEventListener('resize', resizeCanvas);
     return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Prevent default touch gestures to ensure continuous drawing
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const preventDefault = (e: TouchEvent) => {
          if (e.target === canvas && e.touches.length === 1) {
              e.preventDefault();
          }
      };

      canvas.addEventListener('touchstart', preventDefault, { passive: false });
      canvas.addEventListener('touchmove', preventDefault, { passive: false });

      return () => {
          canvas.removeEventListener('touchstart', preventDefault);
          canvas.removeEventListener('touchmove', preventDefault);
      };
  }, [canvasRef.current]);

  const isDrawer = gameState?.active_drawer_id === playerId;

  // Drawing logic
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
     if (!isDrawer) return;
     isDrawing.current = true;
     const pos = getPos(e);
     lastPos.current = pos;
     lastBroadcastPos.current = pos;
     currentStroke.current = { color, size, points: [pos] };
     
     // Clear redo queue when new action starts
     if (redoQueue.length > 0) setRedoQueue([]);
  };

  const draw = (e: any) => {
     if (!isDrawer || !isDrawing.current || !lastPos.current || !canvasRef.current || !currentStroke.current) return;
     const currentPos = getPos(e);
     
     // Draw locally
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
     ctx.lineJoin = 'round';
     ctx.stroke();
     
     currentStroke.current.points.push(currentPos);

     const now = Date.now();
     if (now - lastSendTime.current > 100) {
         try {
             broadcastChannelRef.current?.send({
                 type: 'broadcast',
                 event: 'draw',
                 payload: { p0: lastBroadcastPos.current, p1: currentPos, color, size }
             });
         } catch (err) {
             console.error("Broadcast failed:", err);
         }
         lastBroadcastPos.current = currentPos;
         lastSendTime.current = now;
     }

     lastPos.current = currentPos;
  };

  const stopDrawing = () => {
     isDrawing.current = false;
     lastPos.current = null;
     if (currentStroke.current) {
        const newHistory = [...historyRef.current, currentStroke.current];
        setHistory(newHistory);
        currentStroke.current = null;
        try {
            broadcastChannelRef.current?.send({ type: 'broadcast', event: 'replace_state', payload: { strokes: newHistory } });
        } catch (err) {}
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
     try {
         broadcastChannelRef.current?.send({ type: 'broadcast', event: 'replace_state', payload: { strokes: newHistory } });
     } catch (err) {}
  };

  const handleRedo = () => {
     if (redoQueue.length === 0) return;
     const newRedo = [...redoQueue];
     const popped = newRedo.pop()!;
     setRedoQueue(newRedo);
     const newHistory = [...history, popped];
     setHistory(newHistory);
     
     redrawAllStrokes(newHistory);
     try {
         broadcastChannelRef.current?.send({ type: 'broadcast', event: 'replace_state', payload: { strokes: newHistory } });
     } catch (err) {}
  };

  const handleClear = () => {
     setHistory([]);
     setRedoQueue([]);
     const ctx = canvasRef.current?.getContext('2d');
     if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
     try {
         broadcastChannelRef.current?.send({ type: 'broadcast', event: 'clear', payload: {} });
     } catch (err) {}
  };

  const handleRemoteDraw = (data: any) => {
      if (isDrawer) return; // ignore if I am drawing
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const { p0, p1, color, size: s } = data;
      const w = canvas.width;
      const h = canvas.height;
      
      ctx.beginPath();
      ctx.moveTo(p0.x * w, p0.y * h);
      ctx.lineTo(p1.x * w, p1.y * h);
      ctx.strokeStyle = color;
      ctx.lineWidth = s * Math.min(w, h);
      ctx.lineCap = 'round';
      ctx.stroke();
  };



  const submitGuess = (e: React.FormEvent) => {
     e.preventDefault();
     if (!guess.trim() || isDrawer) return;
     try {
         broadcastChannelRef.current?.send({
            type: 'broadcast',
            event: 'guess',
            payload: { player_id: playerId, guess: guess.trim() }
         });
     } catch (err) {}
     setGuess("");
  };

  if (!session || !gameState || !player) {
     return <div className="p-8 text-center text-gray-400 animate-pulse">Cargando...</div>;
  }

  if (session.status === 'waiting') {
     const playerIndex = teamPlayers.findIndex(p => p.id === playerId);
     return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center relative overflow-hidden">
           <h2 className="text-3xl font-black text-white mb-4 uppercase">¡Estás dentro!</h2>
           <div className="bg-[#1a1b26] p-8 rounded-3xl border border-white/10 shadow-2xl relative">
              <p className="text-gray-400 mb-2 font-bold uppercase">Equipo {teamId}</p>
              <p className="text-4xl font-black text-pink-400 uppercase tracking-widest mb-4">{player.name}</p>
              {playerIndex !== -1 && (
                 <div className="bg-pink-500/20 text-pink-300 py-2 px-6 rounded-full border border-pink-500/50 inline-block font-black uppercase tracking-wider">
                    Tú eres el Jugador #{playerIndex + 1}
                 </div>
              )}
           </div>
           <p className="mt-8 text-xl text-gray-500 font-bold animate-pulse">Mira la pantalla principal para comenzar...</p>
        </div>
     );
  }

  if (session.status === 'prep') {
     // Determine who plays by looking at session.current_round and teamId
     // Note: We don't have the full team array here easily, so we just say "Prepárense"
     // The main dashboard shows exactly who draws.
     return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
           <h2 className="text-4xl font-black text-white mb-4 uppercase">Ronda {session.current_round}</h2>
           <h3 className="text-3xl font-bold text-pink-500 mb-2 uppercase">
              {session.active_team === teamId ? '¡ES EL TURNO DE TU EQUIPO!' : `EQUIPO ${session.active_team} JUGANDO`}
           </h3>
           <p className="text-gray-400 text-lg font-bold">Prepárense... ¡Miren la pantalla principal!</p>
        </div>
     );
  }

  if (session.status === 'round_end') {
      return (
         <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
            <h2 className="text-4xl font-black text-white mb-4 uppercase">Fin de la Ronda</h2>
            <p className="text-gray-400 text-lg font-bold">Mira los puntajes en la pantalla principal.</p>
         </div>
      );
  }

  if (session.status === 'finished') {
      return (
         <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
            <h2 className="text-4xl font-black text-white mb-4 uppercase">¡Juego Terminado!</h2>
         </div>
      );
  }

   const isMyTeam = session.active_team === teamId;
   const playerIndex = teamPlayers.findIndex(p => p.id === playerId);

   if (!isMyTeam) {
     return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
           <h2 className="text-3xl font-black text-gray-500 mb-4 uppercase">Equipo {session.active_team} Dibujando</h2>
           <p className="text-gray-600 font-bold">Espera tu turno.</p>
        </div>
     );
  }

  return (
      <div className="flex flex-col min-h-screen">
         <header className="bg-[#1a1b26] p-4 flex justify-between items-center border-b border-white/5">
            <div className="flex flex-col">
               <span className="text-pink-500 font-black uppercase">{player.name}</span>
               {playerIndex !== -1 && <span className="text-pink-400 text-xs font-bold uppercase">Jugador #{playerIndex + 1}</span>}
            </div>
            {isDrawer && (
               <div className="bg-pink-500 text-white px-4 py-1 rounded-full text-sm font-black uppercase">
                  Dibujando
               </div>
            )}
         </header>

        {isDrawer ? (
           <div className="bg-pink-900/30 p-4 border-b border-pink-500/30 text-center">
              <p className="text-sm font-bold text-pink-300 uppercase mb-1">Palabra a dibujar:</p>
              <p className="text-3xl font-black text-white uppercase tracking-widest">{gameState.current_word}</p>
           </div>
        ) : (
           <div className="bg-[#20222f] p-4 border-b border-white/10 text-center flex flex-col items-center">
              <p className="text-sm font-bold text-gray-400 uppercase mb-2">Adivina la palabra:</p>
              <div className="flex gap-2">
                 {gameState.current_word?.split('').map((char: string, i: number) => (
                    <div key={i} className={`w-8 h-10 flex items-end justify-center pb-1 ${char === ' ' ? '' : 'border-b-4 border-white'}`}>
                       <span className="opacity-0">{char}</span>
                    </div>
                 ))}
              </div>
           </div>
        )}

        <div className="flex-1 flex flex-col p-4 bg-[#111219]">
           <div className="relative w-full flex-1 bg-white rounded-xl overflow-hidden border-2 border-white/20 touch-none" style={{ touchAction: 'none' }}>
              <canvas 
                 ref={canvasRef}
                 className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
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

           {isDrawer ? (
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
           ) : (
              <form onSubmit={submitGuess} className="mt-4 flex gap-2">
                 <input 
                    type="text" 
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    placeholder="Escribe tu respuesta..."
                    className="flex-1 bg-[#1a1b26] border-2 border-white/10 focus:border-pink-500 rounded-xl px-4 py-3 text-white text-lg font-bold outline-none uppercase"
                 />
                 <button type="submit" className="bg-pink-500 hover:bg-pink-400 text-white w-14 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.4)]">
                    <FaPaperPlane />
                 </button>
              </form>
           )}
        </div>
     </div>
  );
}
