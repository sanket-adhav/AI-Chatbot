import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { fetchConversations, deleteConversation, getUser, fetchFolders, createFolder, deleteFolder, togglePin, moveToFolder, updateConversation } from '../api/client'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import SearchPanel from './SearchPanel'
import SettingsModal from './SettingsModal'

export default function Sidebar({ onNewChat, onLogout, activeConvId, refresh, isCollapsed, setIsCollapsed, onProfileUpdated }) {
    const [conversations, setConversations] = useState([])
    const [folders, setFolders] = useState([])
    const [showSearch, setShowSearch] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const location = useLocation()
    const navigate = useNavigate()
    const user = getUser()

    const [editingId, setEditingId] = useState(null)
    const [editTitle, setEditTitle] = useState('')

    // Folders UI state
    const [expandedFolders, setExpandedFolders] = useState({})
    const [contextMenuId, setContextMenuId] = useState(null)
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
    const [movingConv, setMovingConv] = useState(null)
    const [draggingChatId, setDraggingChatId] = useState(null)
    const [dragOverFolderId, setDragOverFolderId] = useState(null)
    const [isOverRecent, setIsOverRecent] = useState(false)
    const [isOverTrash, setIsOverTrash] = useState(false)
    const expandTimerRef = useRef(null)

    // New Folder UI state
    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')

    const load = () => {
        Promise.all([fetchConversations(), fetchFolders()])
            .then(([convs, flds]) => {
                setConversations(convs)
                setFolders(flds)
            })
            .catch(() => { })
    }

    useEffect(() => { load() }, [refresh])

    // Close context menu on outside click
    useEffect(() => {
        const handleClick = () => setContextMenuId(null)
        window.addEventListener('click', handleClick)
        return () => window.removeEventListener('click', handleClick)
    }, [])

    const handleDelete = async (e, id) => {
        e.stopPropagation()
        if (!confirm('Are you sure you want to delete this chat?')) return
        await deleteConversation(id).catch(() => { })
        setConversations(cs => cs.filter(c => c.id !== id))
        if (activeConvId === id) navigate('/')
    }

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return setIsCreatingFolder(false)
        try {
            const f = await createFolder(newFolderName.trim())
            setFolders([...folders, f])
            setExpandedFolders(prev => ({ ...prev, [f.id]: true }))
        } catch { }
        setNewFolderName('')
        setIsCreatingFolder(false)
    }

    const handleDeleteFolder = async (e, id) => {
        e.stopPropagation()
        if (!confirm('Are you sure you want to delete this folder? (Chats inside will not be deleted)')) return
        try {
            await deleteFolder(id)
            setFolders(fs => fs.filter(f => f.id !== id))
            setConversations(cs => cs.map(c => c.folder_id === id ? { ...c, folder_id: null } : c))
        } catch { }
    }

    const handleToggleFolder = (id) => {
        setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }))
    }

    const handleTogglePin = async (conv) => {
        try {
            const updated = await togglePin(conv.id)
            setConversations(cs => cs.map(c => c.id === conv.id ? updated : c))
        } catch { }
    }

    const handleMoveToFolder = async (folderId, convIdOverride = null) => {
        const cid = convIdOverride ? Number(convIdOverride) : movingConv?.id
        const targetFolderId = folderId ? Number(folderId) : null

        if (!cid && cid !== 0) return

        // Optimistic UI update
        const originalConvs = [...conversations]
        setConversations(cs => cs.map(c => c.id === cid ? { ...c, folder_id: targetFolderId } : c))

        try {
            const updated = await moveToFolder(cid, targetFolderId)
            setConversations(cs => cs.map(c => c.id === cid ? updated : c))
        } catch {
            setConversations(originalConvs)
            alert('Failed to move chat.')
        }
        setMovingConv(null)
    }

    /* ================= DRAG AND DROP ================= */

    const onChatDragStart = (e, chat) => {
        console.log('Drag Start:', chat.id)
        setDraggingChatId(chat.id)
        e.dataTransfer.setData('chatId', String(chat.id))
        e.dataTransfer.effectAllowed = 'move'
    }

    const onChatDragEnd = () => {
        setDraggingChatId(null)
        setDragOverFolderId(null)
        if (expandTimerRef.current) clearTimeout(expandTimerRef.current)
    }

    const onFolderDragOver = (e, folderId) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const onFolderDragEnter = (e, folderId) => {
        e.preventDefault()
        setDragOverFolderId(folderId)

        // Auto-expand folder after 800ms
        if (expandTimerRef.current) clearTimeout(expandTimerRef.current)
        if (!expandedFolders[folderId]) {
            expandTimerRef.current = setTimeout(() => {
                setExpandedFolders(prev => ({ ...prev, [folderId]: true }))
            }, 800)
        }
    }

    const onFolderDragLeave = (e) => {
        // Only clear if we're not entering a child element
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverFolderId(null)
            if (expandTimerRef.current) clearTimeout(expandTimerRef.current)
        }
    }

    const onFolderDrop = (e, folderId) => {
        e.preventDefault()
        const chatId = e.dataTransfer.getData('chatId')
        console.log('Drop Received. chatId:', chatId, 'folderId:', folderId)
        setDragOverFolderId(null)
        if (expandTimerRef.current) clearTimeout(expandTimerRef.current)

        if (!chatId) {
            console.error('No chatId found in dataTransfer')
            return
        }

        const cid = Number(chatId)
        const fid = Number(folderId)

        // Check if chat is already in this folder
        const chat = conversations.find(c => c.id === cid)
        if (chat?.folder_id === fid) return

        handleMoveToFolder(fid, cid)
    }

    const onRecentDrop = (e) => {
        e.preventDefault()
        const chatId = e.dataTransfer.getData('chatId')
        setIsOverRecent(false)
        if (!chatId) return
        const cid = Number(chatId)
        const chat = conversations.find(c => c.id === cid)
        if (chat && chat.folder_id) {
            handleMoveToFolder(null, cid)
        }
    }

    const onTrashDrop = async (e) => {
        e.preventDefault()
        const chatId = e.dataTransfer.getData('chatId')
        setIsOverTrash(false)
        if (!chatId) return
        const cid = Number(chatId)
        if (!confirm('Are you sure you want to delete this chat?')) return
        try {
            await deleteConversation(cid)
            setConversations(cs => cs.filter(c => c.id !== cid))
            if (activeConvId === cid) navigate('/')
        } catch { }
    }

    const startRenaming = (e, conv) => {
        if (e) e.stopPropagation()
        setEditingId(conv.id)
        setEditTitle(conv.title)
    }

    const saveRename = async (id) => {
        if (!editTitle.trim() || editTitle === conversations.find(c => c.id === id)?.title) {
            setEditingId(null)
            return
        }
        setConversations(cs => cs.map(c => c.id === id ? { ...c, title: editTitle } : c))
        setEditingId(null)
        try {
            await updateConversation(id, { title: editTitle })
        } catch {
            load()
        }
    }

    const isConfig = location.pathname === '/config'
    const isDashboard = location.pathname === '/dashboard'

    const pinnedChats = conversations.filter(c => c.is_pinned)
    const unpinnedChats = conversations.filter(c => !c.is_pinned)
    const foldersWithChats = folders.map(f => ({
        ...f,
        chats: unpinnedChats.filter(c => c.folder_id === f.id)
    }))
    const looseChats = unpinnedChats.filter(c => !c.folder_id)

    const renderChat = (conv, icon) => (
        <div
            key={conv.id}
            className={`sidebar-chat-item ${activeConvId === conv.id ? 'active' : ''} ${draggingChatId === conv.id ? 'dragging' : ''}`}
            onClick={() => navigate(`/chat/${conv.id}`)}
            draggable
            onDragStart={(e) => onChatDragStart(e, conv)}
            onDragEnd={onChatDragEnd}
        >
            <span className="sidebar-chat-icon">{icon || '💬'}</span>

            {editingId === conv.id ? (
                <input
                    type="text"
                    className="sidebar-rename-input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => saveRename(conv.id)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(conv.id)
                        if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <span className="sidebar-chat-title" onDoubleClick={(e) => startRenaming(e, conv)} title={conv.title}>
                    {conv.title}
                </span>
            )}

            <div className="sidebar-actions dropdown-trigger">
                <button
                    className="sidebar-action-btn context-menu-btn"
                    onClick={(e) => {
                        e.stopPropagation()
                        if (contextMenuId === conv.id) {
                            setContextMenuId(null)
                        } else {
                            const rect = e.currentTarget.getBoundingClientRect()
                            // Position below the button, aligned to the right edge
                            setMenuPosition({ top: rect.bottom + 4, left: rect.right })
                            setContextMenuId(conv.id)
                        }
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                    </svg>
                </button>

                {contextMenuId === conv.id && createPortal(
                    <div
                        className="sidebar-context-menu"
                        style={{
                            position: 'fixed',
                            top: menuPosition.top,
                            left: menuPosition.left,
                            transform: 'translateX(-100%)', // Align right edge to the button right
                            zIndex: 9999
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button onClick={() => { handleTogglePin(conv); setContextMenuId(null) }}>
                            {conv.is_pinned ? 'Unpin from Top' : 'Pin to Top'}
                        </button>
                        <button onClick={() => { setMovingConv(conv); setContextMenuId(null) }}>
                            Move to Folder...
                        </button>
                        <button onClick={() => { startRenaming(null, conv); setContextMenuId(null) }}>
                            Rename
                        </button>
                        <div className="context-divider"></div>
                        <button className="danger" onClick={(e) => { handleDelete(e, conv.id); setContextMenuId(null) }}>
                            Delete Chat
                        </button>
                    </div>,
                    document.body
                )}
            </div>
        </div>
    )

    return (
        <>
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-logo">
                    <div className="sidebar-logo-clickable" onClick={onNewChat} title="Go to home">
                        <div className="sidebar-logo-icon">✦</div>
                        <span className="sidebar-logo-text">AI Chatbot <span className="sidebar-version-badge">1.1</span></span>
                    </div>
                    <button className="sidebar-toggle-btn" onClick={() => setIsCollapsed(true)} title="Close sidebar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                    </button>
                </div>

                <button className="sidebar-new-btn" onClick={onNewChat}>
                    <span>＋</span> New Chat
                </button>

                <button className="sidebar-search-btn" onClick={() => setShowSearch(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    Search
                    <span className="sidebar-search-kbd">⌘K</span>
                </button>

                <div className="sidebar-scrollable">
                    {/* Folders List (if moving conv, show folder selector mode) */}
                    {movingConv ? (
                        <div className="folder-selector">
                            <div className="sidebar-section-label">
                                Move "{movingConv.title.length > 15 ? movingConv.title.slice(0, 15) + '...' : movingConv.title}" to...
                            </div>
                            <div className="folder-selector-list">
                                <button className="folder-select-item" onClick={() => handleMoveToFolder(null)}>
                                    (Remove from folder)
                                </button>
                                {folders.map(f => (
                                    <button key={f.id} className="folder-select-item" onClick={() => handleMoveToFolder(f.id)}>
                                        📁 {f.name}
                                    </button>
                                ))}
                            </div>
                            <button className="folder-select-cancel" onClick={() => setMovingConv(null)}>Cancel</button>
                        </div>
                    ) : (
                        <>
                            {/* Pinned Section */}
                            {pinnedChats.length > 0 && (
                                <div className="sidebar-section">
                                    <div className="sidebar-section-label">Pinned</div>
                                    <div className="sidebar-chats">
                                        {pinnedChats.map(c => renderChat(c, '📌'))}
                                    </div>
                                </div>
                            )}

                            {/* Folders Section */}
                            <div className="sidebar-section">
                                <div className="sidebar-section-header">
                                    <div className="sidebar-section-label">Folders</div>
                                    <button className="sidebar-new-folder-icon" onClick={() => setIsCreatingFolder(true)} title="New Folder">
                                        +
                                    </button>
                                </div>

                                {isCreatingFolder && (
                                    <div className="new-folder-input-wrapper">
                                        <input
                                            type="text"
                                            autoFocus
                                            placeholder="Folder name..."
                                            value={newFolderName}
                                            onChange={(e) => setNewFolderName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleCreateFolder()
                                                if (e.key === 'Escape') setIsCreatingFolder(false)
                                            }}
                                            onBlur={handleCreateFolder}
                                        />
                                    </div>
                                )}

                                <div className="sidebar-folders">
                                    {foldersWithChats.map(folder => (
                                        <div key={folder.id} className="folder-container">
                                            <div
                                                className={`folder-header ${dragOverFolderId === folder.id ? 'drop-active' : ''}`}
                                                onClick={() => handleToggleFolder(folder.id)}
                                                onDragOver={(e) => onFolderDragOver(e, folder.id)}
                                                onDragEnter={(e) => onFolderDragEnter(e, folder.id)}
                                                onDragLeave={onFolderDragLeave}
                                                onDrop={(e) => onFolderDrop(e, folder.id)}
                                            >
                                                <span className="folder-arrow">
                                                    {expandedFolders[folder.id] ? '▾' : '▸'}
                                                </span>
                                                <span className="folder-icon">📁</span>
                                                <span className="folder-title">{folder.name}</span>
                                                <button className="folder-delete-btn" onClick={(e) => handleDeleteFolder(e, folder.id)}>✕</button>
                                            </div>
                                            {expandedFolders[folder.id] && (
                                                <div className="folder-contents">
                                                    {folder.chats.length === 0 ? (
                                                        <div className="folder-empty">Empty folder</div>
                                                    ) : (
                                                        folder.chats.map(c => renderChat(c))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Loose Chats */}
                            <div
                                className={`sidebar-section ${isOverRecent ? 'drop-target-active' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setIsOverRecent(true); }}
                                onDragLeave={() => setIsOverRecent(false)}
                                onDrop={onRecentDrop}
                            >
                                <div className="sidebar-section-label">Recent Unpinned</div>
                                <div className="sidebar-chats">
                                    {looseChats.length === 0 && folders.length === 0 && pinnedChats.length === 0 ? (
                                        <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                            No conversations yet
                                        </div>
                                    ) : (
                                        looseChats.map(c => renderChat(c))
                                    )}
                                </div>
                            </div>

                            {/* Trash Zone */}
                            {draggingChatId && (
                                <div
                                    className={`sidebar-trash-zone ${isOverTrash ? 'drop-active' : ''}`}
                                    onDragOver={(e) => { e.preventDefault(); setIsOverTrash(true); }}
                                    onDragLeave={() => setIsOverTrash(false)}
                                    onDrop={onTrashDrop}
                                >
                                    <span className="trash-icon">🗑️</span>
                                    <span>Drop here to delete</span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <nav className="sidebar-nav">
                    <Link to="/" className={`sidebar-nav-link ${(!isConfig && !isDashboard) ? 'active' : ''}`}>
                        <span>💬</span> Chat
                    </Link>
                    <Link to="/dashboard" className={`sidebar-nav-link ${isDashboard ? 'active' : ''}`}>
                        <span>📊</span> Analytics
                    </Link>
                    <Link to="/config" className={`sidebar-nav-link ${isConfig ? 'active' : ''}`}>
                        <span>⚙️</span> Configuration
                    </Link>
                </nav>

                <div className="sidebar-user">
                    <div className="sidebar-user-avatar" style={user?.avatar_url ? { background: 'none', border: 'none', overflow: 'hidden' } : {}}>
                        {user?.avatar_url ? (
                            <img src={user.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : (
                            user?.username?.[0]?.toUpperCase() || '?'
                        )}
                    </div>
                    <div className="sidebar-user-info">
                        <span className="sidebar-user-name" title={user?.username || 'User'}>{user?.username || 'User'}</span>
                        <span className="sidebar-user-role">Member</span>
                    </div>
                    <button className="sidebar-settings-btn" onClick={() => setShowSettings(true)} title="Settings" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer', padding: '4px', transition: 'color var(--transition-fast)' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                        ⚙️
                    </button>
                    <button className="sidebar-logout-btn" onClick={onLogout} title="Logout" style={{ marginLeft: '4px' }}>
                        ⎋
                    </button>
                </div>
            </aside>

            {isCollapsed && (
                <button
                    className="sidebar-expand-btn"
                    onClick={() => setIsCollapsed(false)}
                    title="Open sidebar"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
            )}

            {showSearch && <SearchPanel onClose={() => setShowSearch(false)} />}
            {showSettings && <SettingsModal user={user} onClose={() => setShowSettings(false)} onProfileUpdated={onProfileUpdated} />}
        </>
    )
}
