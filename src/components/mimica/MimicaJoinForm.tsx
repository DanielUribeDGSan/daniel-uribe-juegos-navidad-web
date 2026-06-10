import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { GiTribalMask } from 'react-icons/gi';

export default function MimicaJoinForm() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [teamId, setTeamId] = useState<number>(0);

  useEffect(() => {
    // Get session_id and team_id from URL
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session_id');
    const tid = params.get('team_id');
    if (sid) setSessionId(sid);
    if (tid) setTeamId(parseInt(tid, 10));
    
    // Auto-redirect if already joined
    const savedPlayerId = localStorage.getItem('mimica_player_id');
    if (savedPlayerId && sid && tid) {
      window.location.href = `/mimica/play?session_id=${sid}&team_id=${tid}`;
    }
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sessionId || !teamId) {
      setError('Nombre, ID de sesión o equipo faltante.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('mimica_players')
        .insert([{ session_id: sessionId, name: name.trim(), team_id: teamId }])
        .select()
        .single();

      if (error) throw error;

      localStorage.setItem('mimica_player_id', data.id);
      window.location.href = `/mimica/play?session_id=${sessionId}&team_id=${teamId}`;
    } catch (err: any) {
      setError(err.message || 'Error al unirse a la partida');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-[#111219]">
      <div className="w-full max-w-sm bg-[#191a24] p-8 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] border border-white/5 text-center">
        <GiTribalMask className="text-8xl text-orange-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
        <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-2">Mimica Salvaje</h1>
        <p className="text-orange-400 font-bold mb-8">Te estás uniendo al Equipo {teamId}</p>

        {error && <div className="bg-red-900/50 text-red-400 p-3 rounded-lg mb-4 text-sm font-bold border border-red-500/30">{error}</div>}

        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Tu nombre (Nickname)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#111219] border-2 border-[#20222f] text-white font-bold text-xl p-4 rounded-xl text-center focus:outline-none focus:border-orange-500 transition-colors placeholder-gray-600"
            maxLength={15}
            required
          />
          <button
            type="submit"
            disabled={loading || !sessionId || !teamId}
            className="btn-3d-green w-full py-4 text-2xl uppercase tracking-widest mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Uniéndose...' : 'Unirse al Equipo'}
          </button>
        </form>
      </div>
    </div>
  );
}
