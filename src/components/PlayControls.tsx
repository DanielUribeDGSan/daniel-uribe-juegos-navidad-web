import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { GiTribalMask } from 'react-icons/gi';
import { QUESTION_CATEGORIES } from '../data/questions';

export default function PlayControls() {
  const [session, setSession] = useState<any>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [answeredIndex, setAnsweredIndex] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    setTimeLeft(30);
  }, [session?.current_question]);

  useEffect(() => {
    let timer: any;
    if (session?.status === 'playing' && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [session?.status, timeLeft]);

  useEffect(() => {
    const pId = localStorage.getItem('player_id');
    if (!pId) {
      window.location.href = '/';
      return;
    }
    setPlayerId(pId);

    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session_id');

    if (sid) {
      fetchSession(sid);
    }
  }, []);

  const fetchSession = async (sidOrPin: string) => {
    let finalSid = sidOrPin;
    let currentSession = null;
    
    if (sidOrPin.length < 15) {
      const { data } = await supabase.from('game_sessions').select('*').eq('pin', sidOrPin.toLowerCase()).single();
      if (data) {
        currentSession = data;
        finalSid = data.id;
      }
    } else {
      const { data } = await supabase.from('game_sessions').select('*').eq('id', sidOrPin).single();
      if (data) currentSession = data;
    }
    
    if (currentSession) {
      setSession(currentSession);
      
      supabase
        .channel(`game_sessions_changes_${finalSid}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${finalSid}` }, (payload) => {
          setSession((prevSession: any) => {
             if (prevSession && payload.new.current_question !== prevSession.current_question) {
                setAnsweredIndex(null);
             }
             return payload.new;
          });
        })
        .subscribe();
    }
  };

  const handleAnswer = async (index: number, answerText: string) => {
    if (!session || answeredIndex !== null || !playerId) return;
    
    setAnsweredIndex(index);
    
    // In a real Kahoot, we would validate if it's correct on the server.
    // For now, we just insert the answer. The Host will evaluate.
    const { error } = await supabase.from('game_answers').insert([{
      session_id: session.id,
      player_id: playerId,
      question_index: session.current_question,
      answer: answerText,
      response_time_ms: timeLeft, // Using timeLeft instead of Date.now() to fit in Postgres INTEGER
      is_correct: false // Host will update this later or we do it securely via edge function
    }]);
    
    if (error) console.error("Error saving answer:", error);
  };

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#111219] text-center">
         <GiTribalMask className="text-8xl text-orange-500 animate-spin-slow mb-6 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
         <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-2 animate-pulse">Conectando...</h2>
         <p className="text-gray-400 font-bold">Buscando la sala mágica</p>
      </div>
    );
  }

  if (session.status === 'waiting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#111219] text-center">
         <GiTribalMask className="text-8xl text-orange-500 animate-pulse mb-6 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
         <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">¡Estás dentro!</h2>
         <p className="text-gray-400 font-bold">Mira a la pantalla principal<br/>y espera a que empiece la partida...</p>
      </div>
    );
  }

  const q = session.category ? QUESTION_CATEGORIES[session.category][session.current_question || 0] : null;
  const colors = [
    { bg: 'btn-3d-red', shape: '▲' },
    { bg: 'btn-3d-blue', shape: '◆' },
    { bg: 'btn-3d-yellow', shape: '●', text: 'text-black' },
    { bg: 'btn-3d-green', shape: '■' }
  ];

  return (
    <div className="min-h-screen flex flex-col p-4 bg-[#111219]">
      <div className="flex items-center justify-between mb-8 mt-4 bg-[#191a24] p-4 rounded-xl border border-white/5">
         <span className="text-white font-black text-lg">Pregunta {session.current_question + 1}</span>
         <span className={`font-black text-2xl ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-orange-500'}`}>
           ⏳ {timeLeft}s
         </span>
      </div>

      <div className="flex-1 flex items-center justify-center pb-8">
        <div className="grid grid-cols-2 gap-4 w-full max-w-md aspect-square">
          {q && q.options.map((opt, idx) => (
            <button 
              key={idx}
              onClick={() => handleAnswer(idx, ['A','B','C','D'][idx])}
              disabled={answeredIndex !== null || timeLeft === 0}
              className={`${colors[idx].bg} rounded-2xl flex flex-col items-center justify-center p-4 relative overflow-hidden transition-all ${answeredIndex !== null && answeredIndex !== idx ? 'opacity-30 scale-95' : ''}`}
            >
              <span className={`text-6xl mb-2 drop-shadow-md ${colors[idx].text || 'text-white'} z-10`}>{colors[idx].shape}</span>
              <span className={`text-lg sm:text-xl font-black text-center leading-tight drop-shadow-md ${colors[idx].text || 'text-white'} z-10`}>
                {opt.replace(/^[A-D]\) /, '')}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
