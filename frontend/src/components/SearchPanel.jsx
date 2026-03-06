import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { globalSearch } from '../api/client'

function highlightText(text, query) {
    if (!query.trim()) return text
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
            ? <mark key={i} className="search-highlight">{part}</mark>
            : part
    )
}

export default function SearchPanel({ onClose }) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const navigate = useNavigate()
    const inputRef = useRef(null)
    const debounceTimer = useRef(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const doSearch = useCallback(async (q, p = 1, append = false) => {
        if (!q.trim()) {
            setResults([])
            setTotal(0)
            return
        }
        setLoading(true)
        setError('')
        try {
            const data = await globalSearch(q, p)
            setResults(prev => append ? [...prev, ...data.results] : data.results)
            setTotal(data.total)
        } catch {
            setError('Search failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }, [])

    const handleInput = (e) => {
        const q = e.target.value
        setQuery(q)
        setPage(1)
        clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => doSearch(q, 1), 350)
    }

    const handleLoadMore = () => {
        const next = page + 1
        setPage(next)
        doSearch(query, next, true)
    }

    const handleResultClick = (result) => {
        onClose()
        navigate(`/chat/${result.conversation_id}?highlight=${result.message_id}`)
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose()
    }

    const groupedByConv = results.reduce((acc, r) => {
        const key = `${r.conversation_id}::${r.conv_title}`
        if (!acc[key]) acc[key] = []
        acc[key].push(r)
        return acc
    }, {})

    return (
        <div className="search-panel-overlay" onClick={onClose}>
            <div className="search-panel" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
                {/* Header */}
                <div className="search-panel-header">
                    <svg className="search-panel-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        ref={inputRef}
                        type="text"
                        className="search-panel-input"
                        placeholder="Search all chats..."
                        value={query}
                        onChange={handleInput}
                    />
                    <button className="search-panel-close" onClick={onClose} title="Close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Results */}
                <div className="search-panel-body">
                    {loading && results.length === 0 && (
                        <div className="search-state">
                            <div className="search-spinner" />
                            <span>Searching...</span>
                        </div>
                    )}
                    {error && <div className="search-state search-error">{error}</div>}

                    {!loading && query.trim() && results.length === 0 && !error && (
                        <div className="search-state">
                            <span style={{ fontSize: 28 }}>🔍</span>
                            <span>No results for "<b>{query}</b>"</span>
                        </div>
                    )}

                    {!query.trim() && (
                        <div className="search-state">
                            <span style={{ fontSize: 28 }}>✦</span>
                            <span style={{ color: 'var(--text-muted)' }}>Type to search across all your chats</span>
                        </div>
                    )}

                    {results.length > 0 && (
                        <>
                            <div className="search-summary">
                                {total} result{total !== 1 ? 's' : ''} for "<b>{query}</b>"
                            </div>
                            {Object.entries(groupedByConv).map(([key, msgs]) => {
                                const [convId, convTitle] = key.split('::')
                                return (
                                    <div key={key} className="search-group">
                                        <div className="search-group-title">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                            </svg>
                                            {convTitle}
                                        </div>
                                        {msgs.map(result => (
                                            <div
                                                key={result.message_id}
                                                className="search-result-item"
                                                onClick={() => handleResultClick(result)}
                                            >
                                                <div className="search-result-role">
                                                    {result.role === 'user' ? '👤 You' : '🤖 Assistant'}
                                                </div>
                                                <div className="search-result-content">
                                                    {highlightText(
                                                        result.content.length > 180
                                                            ? result.content.slice(0, 180) + '…'
                                                            : result.content,
                                                        query
                                                    )}
                                                </div>
                                                <div className="search-result-time">
                                                    {new Date(result.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })}
                            {results.length < total && (
                                <button
                                    className="search-load-more"
                                    onClick={handleLoadMore}
                                    disabled={loading}
                                >
                                    {loading ? 'Loading...' : `Load more (${total - results.length} remaining)`}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
