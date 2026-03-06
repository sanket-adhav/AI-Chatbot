import { useState, useEffect } from 'react'
import { fetchAgents, createAgent, deleteAgent } from '../api/client'

const AGENT_ICONS_GRID = ['🤖', '💻', '✍️', '🧠', '🧙‍♂️', '⚡', '🦉', '🚀', '🛠️', '🎨']

const INFO_ROWS = [
    { label: 'AI Provider', value: 'Google Gemini' },
    { label: 'Model', value: 'gemini-2.5-flash' },
    { label: 'Rate Limit', value: '20 req / minute per IP' },
    { label: 'Database', value: 'PostgreSQL, Chroma DB' },
    { label: 'API Status', value: null, live: true },
]

export default function ConfigPage() {
    const [agents, setAgents] = useState([])
    const [showAgentForm, setShowAgentForm] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [newAgent, setNewAgent] = useState({
        name: '',
        description: '',
        instruction_template: '',
        avatar_icon: '🤖'
    })

    useEffect(() => {
        loadAgents()
    }, [])

    const loadAgents = () => {
        fetchAgents().then(setAgents).catch(() => { })
    }

    const handleDeleteAgent = async (id) => {
        if (!confirm('Are you sure you want to delete this custom agent? This cannot be undone.')) return
        try {
            await deleteAgent(id)
            setAgents(prev => prev.filter(a => a.id !== id))
        } catch (err) {
            console.error("Failed to delete agent", err)
            alert("Failed to delete agent")
        }
    }

    const handleCreateAgent = async (e) => {
        e.preventDefault()
        if (!newAgent.name || !newAgent.instruction_template) return

        setIsCreating(true)
        try {
            const created = await createAgent(newAgent)
            setAgents(prev => [...prev, created])
            setShowAgentForm(false)
            setNewAgent({ name: '', description: '', instruction_template: '', avatar_icon: '🤖' })
        } catch (err) {
            console.error("Failed to create agent", err)
            alert(err.response?.data?.detail || "Failed to create agent")
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <div className="config-page">
            <div className="config-header">
                <h1>Configuration</h1>
                <p>Platform settings, agent management, and system information.</p>
            </div>

            {/* System Info */}
            <div className="config-section">
                <div className="config-section-title">System Information</div>
                {INFO_ROWS.map(row => (
                    <div className="config-info-row" key={row.label}>
                        <span className="config-info-label">{row.label}</span>
                        {row.live ? (
                            <span className="config-info-value">
                                <span className="status-dot online" />
                                Operational
                            </span>
                        ) : (
                            <span className="config-info-value">{row.value}</span>
                        )}
                    </div>
                ))}
            </div>

            {/* Agents */}
            <div className="config-section">
                <div className="config-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Available Agents ({agents.length})</span>
                    <button
                        className="config-btn-primary"
                        style={{ padding: '6px 12px', fontSize: '13px' }}
                        onClick={() => setShowAgentForm(!showAgentForm)}
                    >
                        {showAgentForm ? 'Cancel' : '+ Create Custom Agent'}
                    </button>
                </div>

                {showAgentForm && (
                    <form className="agent-create-form glass-panel" onSubmit={handleCreateAgent}>
                        <div className="form-group">
                            <label>Avatar Icon</label>
                            <div className="avatar-grid">
                                {AGENT_ICONS_GRID.map(icon => (
                                    <button
                                        type="button"
                                        key={icon}
                                        className={`avatar-btn ${newAgent.avatar_icon === icon ? 'selected' : ''}`}
                                        onClick={() => setNewAgent({ ...newAgent, avatar_icon: icon })}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Agent Name</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="e.g. SEO Content Writer"
                                value={newAgent.name}
                                onChange={e => setNewAgent({ ...newAgent, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Description</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Brief description of what this agent does..."
                                value={newAgent.description}
                                onChange={e => setNewAgent({ ...newAgent, description: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>System Prompt (Instructions)</label>
                            <textarea
                                className="form-control"
                                rows="4"
                                placeholder="You are an expert SEO content writer. Always format your responses with H1/H2 tags..."
                                value={newAgent.instruction_template}
                                onChange={e => setNewAgent({ ...newAgent, instruction_template: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="config-btn-primary" disabled={isCreating}>
                                {isCreating ? 'Saving...' : 'Save Agent'}
                            </button>
                        </div>
                    </form>
                )}

                <div className="config-cards">
                    {agents.map((agent) => (
                        <div className="config-card" key={agent.id}>
                            <div className="config-card-icon">{agent.avatar_icon || '🤖'}</div>
                            <div className="config-card-name">
                                {agent.name}
                                {!agent.is_public && <span className="badge" style={{ marginLeft: '8px', fontSize: '10px', background: 'rgba(120, 100, 255, 0.2)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-primary)' }}>Custom</span>}
                            </div>
                            <div className="config-card-desc">{agent.description}</div>
                            <div style={{
                                marginTop: '12px', paddingTop: '12px',
                                borderTop: '1px solid var(--border)',
                                fontSize: '12px', color: 'var(--text-muted)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div style={{ flex: 1 }}>
                                    <strong style={{ color: 'var(--text-secondary)' }}>Instruction:</strong>{' '}
                                    {agent.instruction_template.slice(0, 80)}…
                                </div>
                                {!agent.is_public && (
                                    <button
                                        className="agent-delete-btn"
                                        onClick={() => handleDeleteAgent(agent.id)}
                                        title="Delete agent"
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: 'none',
                                            color: '#ef4444',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            marginLeft: '12px',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff' }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444' }}
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Application Info */}
            <div className="config-section">
                <div className="config-section-title">Active Features</div>
                <div className="config-cards">
                    {[
                        { icon: '�', name: 'Authentication', desc: 'JWT-based secure login & session management' },
                        { icon: '🌊', name: 'Streaming Responses', desc: 'Real-time token streaming via Server-Sent Events' },
                        { icon: '📁', name: 'Folders & Bookmarks', desc: 'Organize chats and pin important conversations' },
                    ].map(item => (
                        <div className="config-card" key={item.name} style={{ borderColor: 'rgba(124, 92, 252, 0.4)', background: 'rgba(124, 92, 252, 0.03)' }}>
                            <div className="config-card-icon">{item.icon}</div>
                            <div className="config-card-name" style={{ color: '#fff' }}>{item.name}</div>
                            <div className="config-card-desc">{item.desc}</div>
                            <div style={{ marginTop: 10, fontSize: '11px', color: '#4ade80', fontWeight: 600 }}>
                                ● ACTIVE
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
