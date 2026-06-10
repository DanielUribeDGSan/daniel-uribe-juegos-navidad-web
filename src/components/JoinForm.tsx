import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { GiTribalMask } from 'react-icons/gi';

export default function JoinForm() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    // Get session_id from URL
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session_id');
    if (sid) setSessionId(sid);
    
    // Auto-redirect if already joined
    const savedPlayerId = localStorage.getItem('player_id');
    if (savedPlayerId && sid) {
      window.location.href = `/play?session_id=${sid}`;
    }
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sessionId) {
      setError('Name and Session ID are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let finalSessionId = sessionId.trim();

      // If it looks like a short PIN (length < 15), look up the UUID in Supabase
      if (finalSessionId.length < 15) {
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('id')
          .eq('pin', finalSessionId.toLowerCase())
          .eq('status', 'waiting')
          .single();
          
        if (sessionError || !sessionData) throw new Error('PIN inválido o partida ya iniciada');
        finalSessionId = sessionData.id;
      }

      const { data, error } = await supabase
        .from('game_players')
        .insert([{ session_id: finalSessionId, name: name.trim(), score: 0 }])
        .select()
        .single();

      if (error) throw error;

      localStorage.setItem('player_id', data.id);
      window.location.href = `/play?session_id=${finalSessionId}`;
    } catch (err: any) {
      setError(err.message || 'Failed to join game');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-[#111219]">
      <div className="w-full max-w-sm bg-[#191a24] p-8 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] border border-white/5 text-center">
        <GiTribalMask className="text-8xl text-orange-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
        <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-2">Voodoo Trivia</h1>
        <p className="text-gray-400 text-sm mb-8">Enter your nickname to join the game!</p>

        {error && <div className="bg-red-900/50 text-red-400 p-3 rounded-lg mb-4 text-sm font-bold border border-red-500/30">{error}</div>}

        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#111219] border-2 border-[#20222f] text-white font-bold text-xl p-4 rounded-xl text-center focus:outline-none focus:border-orange-500 transition-colors placeholder-gray-600"
            maxLength={15}
            required
          />
          {(!sessionId.length || sessionId.length < 15) && (
             <input
               type="text"
               placeholder="PIN del Juego (Ej: abc-123)"
               value={sessionId}
               onChange={(e) => setSessionId(e.target.value)}
               className="w-full bg-[#111219] border-2 border-[#20222f] text-white font-bold p-3 rounded-xl text-center focus:outline-none focus:border-orange-500 transition-colors placeholder-gray-600"
               required
             />
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn-3d-green w-full py-4 text-2xl uppercase tracking-widest mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Joining...' : 'Enter Game'}
          </button>
        </form>
      </div>
    </div>
  );
}
