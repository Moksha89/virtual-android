import { useEffect, useState } from 'react';
import { Activity, Clock, Smartphone, StopCircle } from 'lucide-react';
import api from '../services/api';
import { Session } from '../types';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  const fetchSessions = async () => {
    try {
      const { sessions } = await api.getSessions(filter || undefined);
      setSessions(sessions);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [filter]);

  const handleEndSession = async (sessionId: string) => {
    try {
      await api.endSession(sessionId);
      fetchSessions();
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
          <p className="text-dark-400 mt-1">Active and past control sessions</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-white appearance-none focus:outline-none focus:border-primary-500"
        >
          <option value="">All Sessions</option>
          <option value="active">Active</option>
          <option value="ended">Ended</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-dark-800 rounded-xl border border-dark-700 p-4 animate-pulse">
              <div className="h-5 bg-dark-700 rounded w-1/3 mb-2" />
              <div className="h-4 bg-dark-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-12 text-center">
          <Activity className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Sessions</h3>
          <p className="text-dark-400">Open a device to start a control session.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-dark-800 rounded-xl border border-dark-700 p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    session.status === 'active' ? 'bg-green-500/20' : 'bg-dark-700'
                  }`}
                >
                  <Smartphone
                    className={`w-5 h-5 ${
                      session.status === 'active' ? 'text-green-400' : 'text-dark-500'
                    }`}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {session.model || session.serial || 'Unknown Device'}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        session.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-dark-700 text-dark-400'
                      }`}
                    >
                      {session.status}
                    </span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-dark-500" />
                      <span className="text-xs text-dark-400">
                        {new Date(session.started_at).toLocaleString()}
                      </span>
                    </div>
                    {session.ended_at && (
                      <span className="text-xs text-dark-500">
                        Ended: {new Date(session.ended_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {session.status === 'active' && (
                <button
                  onClick={() => handleEndSession(session.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm transition-colors"
                >
                  <StopCircle className="w-4 h-4" />
                  End
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
