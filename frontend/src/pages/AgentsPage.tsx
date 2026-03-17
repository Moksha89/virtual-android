import { useEffect, useState } from 'react';
import {
  Server,
  Plus,
  Trash2,
  Copy,
  Check,
  Wifi,
  WifiOff,
  Clock,
} from 'lucide-react';
import api from '../services/api';
import { Agent } from '../types';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newAgentKey, setNewAgentKey] = useState<string | null>(null);

  const fetchAgents = async () => {
    try {
      const { agents } = await api.getAgents();
      setAgents(agents);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleCreate = async () => {
    if (!agentName.trim()) return;
    setCreating(true);
    try {
      const { agent } = await api.registerAgent(agentName);
      setNewAgentKey(agent.api_key || null);
      setAgentName('');
      fetchAgents();
    } catch (err) {
      console.error('Failed to create agent:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (agent: Agent) => {
    if (confirm(`Delete agent "${agent.name}"? All associated devices will be removed.`)) {
      try {
        await api.deleteAgent(agent.id);
        fetchAgents();
      } catch (err) {
        console.error('Failed to delete agent:', err);
      }
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agents</h1>
          <p className="text-dark-400 mt-1">Manage home gateway agents</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Register Agent
        </button>
      </div>

      {/* Create Agent Form */}
      {showCreate && (
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Register New Agent</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Agent name (e.g., Home-PC)"
              className="flex-1 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !agentName.trim()}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>

          {newAgentKey && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-sm text-green-400 mb-2">Agent created! Save this API key - it won&apos;t be shown again:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-green-300 bg-dark-900 px-3 py-2 rounded font-mono break-all">
                  {newAgentKey}
                </code>
                <button
                  onClick={() => copyToClipboard(newAgentKey, 'new')}
                  className="p-2 rounded-lg bg-dark-700 text-dark-300 hover:text-white"
                >
                  {copiedKey === 'new' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Agents List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-dark-800 rounded-xl border border-dark-700 p-4 animate-pulse">
              <div className="h-5 bg-dark-700 rounded w-1/4 mb-2" />
              <div className="h-4 bg-dark-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-12 text-center">
          <Server className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Agents Registered</h3>
          <p className="text-dark-400 max-w-md mx-auto">
            Register a home gateway agent to start connecting devices.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-dark-800 rounded-xl border border-dark-700 p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    agent.status === 'online' ? 'bg-green-500/20' : 'bg-dark-700'
                  }`}
                >
                  <Server
                    className={`w-5 h-5 ${
                      agent.status === 'online' ? 'text-green-400' : 'text-dark-500'
                    }`}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1">
                      {agent.status === 'online' ? (
                        <Wifi className="w-3 h-3 text-green-400" />
                      ) : (
                        <WifiOff className="w-3 h-3 text-dark-500" />
                      )}
                      <span
                        className={`text-xs ${
                          agent.status === 'online' ? 'text-green-400' : 'text-dark-500'
                        }`}
                      >
                        {agent.status}
                      </span>
                    </div>
                    {agent.ip_address && (
                      <span className="text-xs text-dark-400">{agent.ip_address}</span>
                    )}
                    {agent.last_heartbeat && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-dark-500" />
                        <span className="text-xs text-dark-400">
                          {new Date(agent.last_heartbeat).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDelete(agent)}
                className="p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-dark-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
