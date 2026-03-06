import { useState, useEffect } from 'react'
import { fetchAgents, createConversation } from '../api/client'

export default function NewChatModal({ onClose, onCreated }) {
    const [agents, setAgents] = useState([])
    const [agentId, setAgentId] = useState('')
    const [title, setTitle] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchAgents().then(a => {
            setAgents(a)
            if (a.length) setAgentId(a[0].id)
        })
    }, [])

    const submit = async () => {
        if (!agentId) return
        setLoading(true)
        try {
            const conv = await createConversation({
                title: title.trim() || 'New Chat',
                agent_id: Number(agentId),
            })
            onCreated(conv)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 100,
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '32px',
                    width: '420px',
                    boxShadow: 'var(--shadow-md)',
                }}
                onClick={e => e.stopPropagation()}
            >
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>New Conversation</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                    Choose an AI agent to power this chat.
                </p>

                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    CHAT TITLE (optional)
                </label>
                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Weekend project ideas"
                    style={{
                        width: '100%', padding: '10px 14px',
                        background: 'var(--bg-input)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                        fontSize: '14px', outline: 'none', fontFamily: 'inherit',
                        marginBottom: '18px', boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--border-active)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />

                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    SELECT AGENT
                </label>
                <div style={{ display: 'grid', gap: '10px', marginBottom: '24px' }}>
                    {agents.map(agent => (
                        <div
                            key={agent.id}
                            onClick={() => setAgentId(agent.id)}
                            style={{
                                padding: '12px 16px',
                                background: agentId === agent.id ? 'rgba(124,92,252,0.12)' : 'var(--bg-input)',
                                border: `1px solid ${agentId === agent.id ? 'var(--border-active)' : 'var(--border)'}`,
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{agent.name}</div>
                            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{agent.description}</div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, padding: '11px', background: 'var(--bg-hover)',
                            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                            color: 'var(--text-secondary)', fontFamily: 'inherit',
                            fontSize: '14px', cursor: 'pointer', transition: 'all 0.15s',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={loading || !agentId}
                        style={{
                            flex: 1, padding: '11px',
                            background: 'var(--accent-gradient)', border: 'none',
                            borderRadius: 'var(--radius-md)', color: 'white',
                            fontFamily: 'inherit', fontSize: '14px', fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                        }}
                    >
                        {loading ? 'Creating…' : 'Start Chat'}
                    </button>
                </div>
            </div>
        </div>
    )
}
