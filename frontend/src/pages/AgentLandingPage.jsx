import { useState, useEffect } from 'react'
import { fetchAgents, createConversation, createAgent } from '../api/client'

// Map agent names to their avatar images
const AGENT_AVATARS = {
    'General Assistant': '/avatars/general.png',
    'Code Expert': null,       // uses CSS avatar
    'Creative Writer': '/avatars/creative.png',
}

// CSS avatar fallback for Code Expert (and any future agent)
const CSS_AVATAR_COLORS = {
    'General Assistant': { bg: 'linear-gradient(135deg, #1a1a3e 0%, #0d1b4b 100%)', glow: '#6ee7f7' },
    'Code Expert': { bg: 'linear-gradient(135deg, #001a00 0%, #002800 100%)', glow: '#00ff88' },
    'Creative Writer': { bg: 'linear-gradient(135deg, #1a0a2e 0%, #2a0a1e 100%)', glow: '#c77dff' },
}

const CSS_AVATAR_ICONS = {
    'General Assistant': '🤖',
    'Code Expert': '💻',
    'Creative Writer': '✍️',
}

const AGENT_ICONS_GRID = ['🤖', '💻', '✍️', '🧠', '🧙‍♂️', '⚡', '🦉', '🚀', '🛠️', '🎨']

const AI_PROVIDERS = [
    { id: 'gemini', label: 'Gemini 2.5 Flash', icon: '⚡', available: true },
    { id: 'chatgpt', label: 'ChatGPT', icon: '🧠', available: false },
    { id: 'claude', label: 'Claude', icon: '🌟', available: false },
    { id: 'code', label: 'Code', icon: '💻', available: false },
]

function AgentAvatar({ agent, size = 160 }) {
    const imgSrc = AGENT_AVATARS[agent?.name]
    const colors = CSS_AVATAR_COLORS[agent?.name] || { bg: 'linear-gradient(135deg,#1a1a3e,#0d1b4b)', glow: '#7c5cfc' }
    const icon = agent?.avatar_icon || CSS_AVATAR_ICONS[agent?.name] || '🤖'

    if (imgSrc) {
        return (
            <div className="landing-avatar-wrapper" style={{ '--avatar-glow': colors.glow, '--avatar-size': size + 'px' }}>
                <div className="landing-avatar-circle">
                    <img src={imgSrc} alt={agent?.name} />
                </div>
                <div className="landing-avatar-ring" />
            </div>
        )
    }

    return (
        <div className="landing-avatar-wrapper" style={{ '--avatar-glow': colors.glow, '--avatar-size': size + 'px' }}>
            <div className="landing-avatar-circle">
                <span className="emoji-avatar">{icon}</span>
            </div>
            <div className="landing-avatar-ring" />
        </div>
    )
}

function AgentCard({ agent, onPrev, onNext, hasMultipleAgents }) {
    return (
        <div className="landing-agent-card-container">
            {/* Agent avatar with navigation */}
            <div className="landing-avatar-area">
                {hasMultipleAgents && (
                    <button className="landing-agent-nav prev" onClick={onPrev} title="Previous agent">‹</button>
                )}
                <AgentAvatar agent={agent} size={140} />
                {hasMultipleAgents && (
                    <button className="landing-agent-nav next" onClick={onNext} title="Next agent">›</button>
                )}
            </div>

            {/* Agent name layout - 3 column grid retains exact text centering */}
            <div className="landing-agent-name-layout">
                <div />
                <h2 className="landing-agent-name">
                    {agent?.name || '…'}
                </h2>
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    {agent && !agent.is_public && (
                        <span className="landing-custom-badge">CUSTOM</span>
                    )}
                </div>
            </div>

            <div className="landing-agent-desc">{agent?.description || ''}</div>
        </div>
    )
}

export default function AgentLandingPage({ onStartChat, onLogout }) {
    const [agents, setAgents] = useState([])
    const [selectedAgentIdx, setSelectedAgentIdx] = useState(0)
    const [provider, setProvider] = useState('gemini')
    const [providerOpen, setProviderOpen] = useState(false)
    const [apiKey, setApiKey] = useState('')
    const [starting, setStarting] = useState(false)

    // Agent Creation State
    const [isCreatingMode, setIsCreatingMode] = useState(false)
    const [isSavingAgent, setIsSavingAgent] = useState(false)
    const [newAgent, setNewAgent] = useState({
        name: '', description: '', instruction_template: '', avatar_icon: '🤖'
    })

    useEffect(() => {
        fetchAgents().then(setAgents).catch(() => { })
    }, [])

    const agent = agents[selectedAgentIdx]
    const selectedProvider = AI_PROVIDERS.find(p => p.id === provider)

    const handleStartChat = async () => {
        if (!agent) return
        setStarting(true)
        try {
            const conv = await createConversation({
                title: `Chat with ${agent.name}`,
                agent_id: agent.id,
            })
            onStartChat(conv)
        } catch {
            setStarting(false)
        }
    }

    const handleCreateAgentSubmit = async (e) => {
        e.preventDefault()
        if (!newAgent.name || !newAgent.instruction_template) return

        setIsSavingAgent(true)
        try {
            const created = await createAgent(newAgent)
            setAgents(prev => [...prev, created])
            setSelectedAgentIdx(agents.length) // Select the newly created agent
            setIsCreatingMode(false)
            setNewAgent({ name: '', description: '', instruction_template: '', avatar_icon: '🤖' })
        } catch (err) {
            console.error("Failed to create agent", err)
            alert(err.response?.data?.detail || "Failed to create agent")
        } finally {
            setIsSavingAgent(false)
        }
    }

    // Cycle through agents by clicking avatar
    const nextAgent = () => setSelectedAgentIdx(i => (i + 1) % agents.length)
    const prevAgent = () => setSelectedAgentIdx(i => (i - 1 + agents.length) % agents.length)

    return (
        <div className="landing-page">
            <button className="landing-logout-btn" onClick={onLogout} title="Sign Out">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Sign out</span>
            </button>

            {/* Dot grid background */}
            <div className="landing-dot-grid" />

            <div className="landing-card" style={{ transition: 'all 0.3s ease', width: isCreatingMode ? '450px' : '400px', maxWidth: '90vw' }}>
                {isCreatingMode ? (
                    // --- CREATE AGENT FRONT ---
                    <div className="landing-create-mode" style={{ animation: 'fadeIn 0.3s ease' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: '500', color: '#fff', margin: 0 }}>Create Custom Agent</h2>
                            <button onClick={() => setIsCreatingMode(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                        </div>

                        <form onSubmit={handleCreateAgentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label className="landing-label" style={{ display: 'block', marginBottom: '8px' }}>Avatar Icon</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {AGENT_ICONS_GRID.map(icon => (
                                        <button
                                            type="button"
                                            key={icon}
                                            style={{
                                                background: newAgent.avatar_icon === icon ? 'rgba(120, 100, 255, 0.2)' : 'rgba(255,255,255,0.02)',
                                                border: `1px solid ${newAgent.avatar_icon === icon ? 'var(--border-active)' : 'var(--border)'}`,
                                                borderRadius: '8px', padding: '8px', cursor: 'pointer', fontSize: '1.2rem', transition: 'all 0.2s',
                                                transform: newAgent.avatar_icon === icon ? 'scale(1.1)' : 'scale(1)'
                                            }}
                                            onClick={() => setNewAgent({ ...newAgent, avatar_icon: icon })}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="landing-label" style={{ display: 'block', marginBottom: '8px' }}>Agent Name <span style={{ color: '#ff6b6b' }}>*</span></label>
                                <input
                                    type="text"
                                    className="landing-input"
                                    placeholder="e.g. Code Reviewer"
                                    value={newAgent.name}
                                    onChange={e => setNewAgent({ ...newAgent, name: e.target.value })}
                                    required
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label className="landing-label" style={{ display: 'block', marginBottom: '8px' }}>Description</label>
                                <input
                                    type="text"
                                    className="landing-input"
                                    placeholder="Brief description..."
                                    value={newAgent.description}
                                    onChange={e => setNewAgent({ ...newAgent, description: e.target.value })}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label className="landing-label" style={{ display: 'block', marginBottom: '8px' }}>System Prompt <span style={{ color: '#ff6b6b' }}>*</span></label>
                                <textarea
                                    className="landing-input"
                                    rows="3"
                                    placeholder="You are an expert at reviewing code..."
                                    value={newAgent.instruction_template}
                                    onChange={e => setNewAgent({ ...newAgent, instruction_template: e.target.value })}
                                    required
                                    style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
                                />
                            </div>
                            <button
                                type="submit"
                                className={`landing-start-btn ${isSavingAgent ? 'loading' : ''}`}
                                disabled={isSavingAgent || !newAgent.name || !newAgent.instruction_template}
                                style={{ marginTop: '8px' }}
                            >
                                {isSavingAgent ? (
                                    <span className="landing-btn-spinner"><span /><span /><span /></span>
                                ) : (
                                    <><span>Save Agent</span><span className="landing-btn-arrow">✓</span></>
                                )}
                            </button>
                        </form>
                    </div>
                ) : (
                    // --- SELECT AGENT FRONT ---
                    <div style={{ animation: 'fadeIn 0.3s ease' }}>

                        {/* Unified Reusable AgentCard Component */}
                        <AgentCard
                            agent={agent}
                            onPrev={prevAgent}
                            onNext={nextAgent}
                            hasMultipleAgents={agents.length > 1}
                        />

                        {/* Create Agent Toggle */}
                        <div style={{ textAlign: 'center', marginTop: '-4px', marginBottom: '16px' }}>
                            <button
                                onClick={() => setIsCreatingMode(true)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', transition: 'color 0.2s' }}
                                onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
                                onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Create Custom Agent
                            </button>
                        </div>

                        {/* Agent dots selector */}
                        {agents.length > 1 && (
                            <div className="landing-agent-dots">
                                {agents.map((_, i) => (
                                    <button
                                        key={i}
                                        className={`landing-dot ${i === selectedAgentIdx ? 'active' : ''}`}
                                        onClick={() => setSelectedAgentIdx(i)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Form fields */}
                        <div className="landing-form">
                            {/* AI Provider */}
                            <div className="landing-field">
                                <label className="landing-label">AI Provider</label>
                                <div className="landing-dropdown-wrapper">
                                    <button
                                        className="landing-dropdown-btn"
                                        onClick={() => setProviderOpen(o => !o)}
                                    >
                                        <span>{selectedProvider?.icon} {selectedProvider?.label}</span>
                                        <span className={`landing-dropdown-arrow ${providerOpen ? 'open' : ''}`}>▾</span>
                                    </button>
                                    {providerOpen && (
                                        <div className="landing-dropdown-menu">
                                            {AI_PROVIDERS.map(p => (
                                                <button
                                                    key={p.id}
                                                    className={`landing-dropdown-item ${p.id === provider ? 'active' : ''} ${!p.available ? 'disabled' : ''}`}
                                                    onClick={() => { if (p.available) { setProvider(p.id); setProviderOpen(false) } }}
                                                    disabled={!p.available}
                                                >
                                                    <span>{p.icon} {p.label}</span>
                                                    {!p.available && <span className="landing-soon-badge">SOON</span>}
                                                    {p.available && p.id === provider && <span className="landing-check">✓</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Knowledge Path */}
                            <div className="landing-field">
                                <label className="landing-label">Knowledge Path</label>
                                <div className="landing-readonly-field">
                                    <span className="landing-readonly-icon">🧠</span>
                                    <span>Gemini</span>
                                </div>
                            </div>

                            {/* API Key (optional) */}
                            <div className="landing-field">
                                <label className="landing-label">
                                    API Key
                                    <span className="landing-optional-badge">optional</span>
                                </label>
                                <input
                                    type="password"
                                    className="landing-input"
                                    placeholder="sk-... (uses server key if blank)"
                                    value={apiKey}
                                    onChange={e => setApiKey(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Start Chat */}
                        <button
                            className={`landing-start-btn ${starting ? 'loading' : ''}`}
                            onClick={handleStartChat}
                            disabled={starting || !agent}
                        >
                            {starting ? (
                                <span className="landing-btn-spinner">
                                    <span />
                                    <span />
                                    <span />
                                </span>
                            ) : (
                                <>
                                    <span>Start Chat</span>
                                    <span className="landing-btn-arrow">→</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
