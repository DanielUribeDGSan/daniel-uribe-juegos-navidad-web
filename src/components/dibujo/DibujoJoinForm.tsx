import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import { FaPaintBrush } from "react-icons/fa";

export default function DibujoJoinForm() {
  const [name, setName] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionId(params.get('session_id'));
    const tId = params.get('team_id');
    if (tId) setTeamId(parseInt(tId, 10));
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Por favor ingresa tu nombre");
    if (!sessionId || !teamId) return setError("Código QR inválido");

    setLoading(true);
    
    // Check if session exists and is waiting
    const { data: session } = await supabase.from('dibujo_sessions').select('*').eq('id', sessionId).single();
    if (!session) {
      setLoading(false);
      return setError("La sesión no existe");
    }

    // Join
    const { data, error } = await supabase.from('dibujo_players').insert([{
       session_id: sessionId,
       team_id: teamId,
       name: name.trim().toUpperCase()
    }]).select().single();

    if (error) {
      setLoading(false);
      return setError("Error al unirse. Intenta de nuevo.");
    }

    // Redirect to play page
    window.location.href = `/dibujo/play?session_id=${sessionId}&team_id=${teamId}&player_id=${data.id}`;
  };

  if (!sessionId || !teamId) {
     return <div className="text-white text-center">Escanea el QR desde la pantalla principal.</div>;
  }

  return (
    <div className="bg-[#1a1b26] p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
       <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-pink-500 to-purple-500"></div>
       <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-pink-500/20 rounded-2xl flex items-center justify-center border border-pink-500/50">
             <FaPaintBrush className="text-3xl text-pink-400" />
          </div>
       </div>
       <h1 className="text-3xl font-black text-white text-center mb-2 uppercase tracking-widest">Dibujo Extremo</h1>
       <p className="text-gray-400 text-center mb-8 font-bold">Equipo <span className="text-pink-400">{teamId}</span></p>

       <form onSubmit={handleJoin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Tu Nombre</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#111219] border-2 border-white/10 focus:border-pink-500 rounded-xl px-4 py-4 text-white text-xl font-bold outline-none transition-colors"
              placeholder="Ej. DANIEL"
              maxLength={15}
            />
          </div>
          
          {error && <p className="text-red-400 text-sm font-bold text-center">{error}</p>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-pink-500 hover:bg-pink-400 text-white font-black text-xl py-4 rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.4)] transition-all disabled:opacity-50 border-b-4 border-pink-700 active:border-b-0 active:translate-y-1"
          >
            {loading ? 'UNIENDO...' : 'ENTRAR AL JUEGO'}
          </button>
       </form>
    </div>
  );
}
