import React, { useState, useEffect } from 'react'
import { updateProfile, uploadAvatar, getDocuments, uploadDocument, deleteDocument } from '../api/client'
import '../styles/global.css'

export default function SettingsModal({ user, onClose, onProfileUpdated }) {
    const [activeTab, setActiveTab] = useState('profile')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Profile State
    const [username, setUsername] = useState(user?.username || '')
    const [password, setPassword] = useState('')
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '')
    const [avatarFile, setAvatarFile] = useState(null)
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || '')

    // Preferences State
    const [systemPrompt, setSystemPrompt] = useState(user?.system_prompt || '')
    const [themePref, setThemePref] = useState(user?.theme_preference || 'dark')

    const THEMES = [
        { id: 'dark', name: 'Dark Base', color: '#161628' },
        { id: 'light', name: 'Light Base', color: '#eef0f5' },
        { id: 'ocean', name: 'Ocean Blue', color: '#0d1e36' },
        { id: 'emerald', name: 'Emerald Green', color: '#0c291d' }
    ]

    // Documents State
    const [documents, setDocuments] = useState([])
    const [docsLoading, setDocsLoading] = useState(false)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        if (activeTab === 'documents') {
            setDocsLoading(true)
            getDocuments().then(setDocuments).catch(() => setError('Failed to load documents')).finally(() => setDocsLoading(false))
        }
    }, [activeTab])

    const handleDocUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        if (file.type !== 'application/pdf') {
            setError('Only PDF files are supported.')
            return
        }
        setUploading(true)
        setError('')
        try {
            await uploadDocument(file)
            getDocuments().then(setDocuments)
        } catch (err) {
            setError(err.response?.data?.detail || 'Upload failed')
        } finally {
            setUploading(false)
        }
    }

    const handleDocDelete = async (id) => {
        if (!window.confirm('Delete this document? It will be removed from your knowledge base.')) return
        try {
            await deleteDocument(id)
            setDocuments(docs => docs.filter(d => d.id !== id))
        } catch (err) {
            setError(err.response?.data?.detail || 'Delete failed')
        }
    }

    useEffect(() => {
        // Preview theme while in modal
        document.documentElement.setAttribute('data-theme', themePref)
    }, [themePref])

    const handleAvatarUpload = (e) => {
        const file = e.target.files[0]
        if (!file) return

        setAvatarFile(file)
        const reader = new FileReader()
        reader.onloadend = () => {
            setAvatarPreview(reader.result)
        }
        reader.readAsDataURL(file)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            let finalAvatarUrl = avatarUrl

            // 1. Upload new avatar if selected
            if (avatarFile) {
                const res = await uploadAvatar(avatarFile)
                finalAvatarUrl = res.avatar_url
            }

            // 2. Prepare updates
            const updates = {
                theme_preference: themePref
            }
            if (username && username !== user?.username) updates.username = username
            if (password) updates.password = password
            if (finalAvatarUrl !== user?.avatar_url) updates.avatar_url = finalAvatarUrl
            if (systemPrompt !== user?.system_prompt) updates.system_prompt = systemPrompt

            const updatedUser = await updateProfile(updates)
            onProfileUpdated(updatedUser)
            onClose()
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to update profile')
        } finally {
            setLoading(false)
        }
    }

    // Restore original theme if user cancels without saving
    const handleClose = () => {
        document.documentElement.setAttribute('data-theme', user?.theme_preference || 'dark')
        onClose()
    }

    return (
        <div className="config-overlay" onClick={handleClose}>
            <div className="config-modal" onClick={e => e.stopPropagation()}>
                <button className="config-close-top" onClick={handleClose}>×</button>
                <div className="config-header">
                    <h2 className="config-title">User Settings</h2>
                    <p className="config-subtitle">Manage your profile and chat preferences.</p>
                </div>

                <div className="settings-tabs">
                    <button
                        className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >Profile</button>
                    <button
                        className={`settings-tab ${activeTab === 'preferences' ? 'active' : ''}`}
                        onClick={() => setActiveTab('preferences')}
                    >Preferences</button>
                    <button
                        className={`settings-tab ${activeTab === 'documents' ? 'active' : ''}`}
                        onClick={() => setActiveTab('documents')}
                    >Knowledge Base</button>
                </div>

                <form onSubmit={handleSave}>
                    {error && <div className="config-error" style={{ marginBottom: '16px' }}>{error}</div>}

                    {activeTab === 'profile' && (
                        <div className="settings-profile-section">
                            <div className="config-form-group" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div className="avatar-preview">
                                    {avatarPreview ? <img src={avatarPreview} alt="Avatar" /> : '👤'}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="config-label">Profile Picture</label>
                                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="config-input" />
                                </div>
                            </div>

                            <div className="config-form-group">
                                <label className="config-label">Username</label>
                                <input className="config-input" type="text" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} />
                            </div>
                            <div className="config-form-group">
                                <label className="config-label">New Password (Optional)</label>
                                <input className="config-input" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} placeholder="Leave blank to keep current" />
                            </div>
                        </div>
                    )}

                    {activeTab === 'preferences' && (
                        <div className="settings-preferences-section">
                            <div className="config-form-group">
                                <label className="config-label">Global System Prompt</label>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>These instructions will be applied to ALL agents you chat with.</p>
                                <textarea className="config-textarea" value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} placeholder="E.g., Always reply in Spanish, or Keep your answers incredibly brief." style={{ height: '80px' }}></textarea>
                            </div>

                            <div className="config-form-group">
                                <label className="config-label">Theme</label>
                                <div className="theme-grid">
                                    {THEMES.map(t => (
                                        <div
                                            key={t.id}
                                            onClick={() => setThemePref(t.id)}
                                            className={`theme-card ${themePref === t.id ? 'active' : ''}`}
                                        >
                                            <div className="theme-circle" style={{ background: t.color }}></div>
                                            <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{t.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'documents' && (
                        <div className="settings-documents-section">
                            <div className="config-form-group">
                                <label className="config-label">Upload PDF Document</label>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    Add PDFs to your knowledge base to enable Retrieval-Augmented Generation (RAG).
                                </p>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleDocUpload}
                                    disabled={uploading}
                                    className="config-input"
                                    style={{ padding: '8px' }}
                                />
                                {uploading && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>Uploading and processing context...</div>}
                            </div>

                            <div className="config-form-group" style={{ marginTop: '24px' }}>
                                <label className="config-label">Available Documents</label>
                                {docsLoading ? (
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading...</div>
                                ) : documents.length === 0 ? (
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px', background: 'var(--bg-input)', borderRadius: '8px', textAlign: 'center' }}>
                                        No documents uploaded yet.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {documents.map(doc => (
                                            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                                    <span style={{ fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                        {doc.filename}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                        {new Date(doc.created_at).toLocaleDateString()} •
                                                        <span style={{ marginLeft: '4px', color: doc.status === 'ready' ? '#4CAF50' : doc.status === 'failed' ? '#F44336' : '#FFC107' }}>
                                                            {doc.status.toUpperCase()}
                                                        </span>
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDocDelete(doc.id)}
                                                    style={{ background: 'transparent', border: 'none', color: '#F44336', cursor: 'pointer', padding: '4px', fontSize: '16px' }}
                                                    title="Delete Document"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="config-actions">
                        <button type="button" className="config-btn-secondary" onClick={handleClose}>Cancel</button>
                        <button type="submit" className="config-btn-primary" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
