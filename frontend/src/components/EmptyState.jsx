import { useEffect, useState } from 'react'
import { fetchConversations } from '../api/client'

export default function EmptyState({ user, onSuggestionClick, onRecentChatClick }) {
    const [recentChats, setRecentChats] = useState([])

    useEffect(() => {
        fetchConversations()
            .then(convs => {
                // Get most recent 3 chats, excluding maybe some very old ones
                setRecentChats(convs.slice(0, 3))
            })
            .catch(() => { })
    }, [])

    const suggestions = [
        { id: 'pdf', icon: '🧠', label: 'Analyze a PDF', prompt: 'I want to analyze a PDF. How should we start?' },
        { id: 'python', icon: '🐍', label: 'Write Python code', prompt: 'Can you help me write a Python script for ' },
        { id: 'blog', icon: '✍️', label: 'Draft a blog post', prompt: 'I need to draft a blog post about ' },
        { id: 'data', icon: '📊', label: 'Summarize data', prompt: 'Can you help me summarize this data: ' },
    ]

    return (
        <div className="empty-state-container">
            <div className="empty-state-content">
                {/* 1️⃣ Animated AI Avatar */}
                <div className="ai-avatar-wrapper">
                    <div className="ai-avatar-glow"></div>
                    <div className="ai-avatar-main">
                        <span className="ai-avatar-pulse"></span>
                        <div className="ai-avatar-icon">✦</div>
                    </div>
                </div>

                {/* 2️⃣ Context-Aware Greeting */}
                <div className="greeting-section">
                    <div className="greeting-glow-orb"></div>
                    <h1 className="greeting-title">
                        Good to see you, <span className="user-name-highlight">{user?.username || 'User'}</span>.
                    </h1>
                    <p className="greeting-subtitle">What would you like to explore today?</p>
                </div>

                {/* 3️⃣ Smart Suggestion Cards */}
                <div className="suggestion-grid">
                    {suggestions.map(s => (
                        <button
                            key={s.id}
                            className="suggestion-card"
                            onClick={() => onSuggestionClick(s.prompt)}
                        >
                            <span className="suggestion-icon">{s.icon}</span>
                            <span className="suggestion-label">{s.label}</span>
                        </button>
                    ))}
                </div>

                {/* 4️⃣ Recent Activity Chips */}
                {recentChats.length > 0 && (
                    <div className="recent-activity">
                        <span className="recent-label">Recent chats</span>
                        <div className="recent-chips">
                            {recentChats.map(chat => (
                                <button
                                    key={chat.id}
                                    className="recent-chip"
                                    onClick={() => onRecentChatClick(chat)}
                                >
                                    <span className="chip-icon">💬</span>
                                    <span className="chip-text">{chat.title}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
