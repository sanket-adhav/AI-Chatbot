import { useState, useRef, useEffect } from 'react'
import { exportChatJson, exportChatPdf, updateProfile, getUser } from '../api/client'
import '../styles/global.css'

const THEMES = [
    { id: 'dark', name: 'Dark Base', color: '#161628' },
    { id: 'light', name: 'Light Base', color: '#eef0f5' },
    { id: 'ocean', name: 'Ocean Blue', color: '#0d1e36' },
    { id: 'emerald', name: 'Emerald', color: '#0c291d' }
]

export default function ChatOptionsMenu({ convId, onProfileUpdated }) {
    const [open, setOpen] = useState(false)
    const [exporting, setExporting] = useState(null) // 'json' | 'pdf' | null
    const [savingTheme, setSavingTheme] = useState(false)
    const menuRef = useRef(null)
    const user = getUser()

    // Assuming user is loaded, otherwise default to dark.
    const activeTheme = user?.theme_preference || 'dark'

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleExport = async (format) => {
        setOpen(false)
        setExporting(format)
        try {
            if (format === 'json') await exportChatJson(convId)
            else await exportChatPdf(convId)
        } catch (e) {
            console.error('Export failed', e)
            alert('Export failed. Please try again.')
        } finally {
            setExporting(null)
        }
    }

    const handleThemeChange = async (themeId) => {
        if (themeId === activeTheme) return

        // Optimistically apply the theme immediately for instant feedback
        document.documentElement.setAttribute('data-theme', themeId)

        setSavingTheme(true)
        try {
            const updatedUser = await updateProfile({ theme_preference: themeId })
            if (onProfileUpdated) {
                onProfileUpdated(updatedUser)
            }
        } catch (error) {
            console.error("Failed to save theme preference:", error)
            // Revert on failure
            document.documentElement.setAttribute('data-theme', activeTheme)
            alert("Failed to save theme preference.")
        } finally {
            setSavingTheme(false)
            setOpen(false)
        }
    }

    return (
        <div className="export-menu-wrapper" ref={menuRef}>
            <button
                className="export-trigger-btn"
                style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: open ? 'var(--bg-input)' : 'transparent',
                    border: '1px solid',
                    borderColor: open ? 'var(--border)' : 'transparent',
                    color: open ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                }}
                onClick={() => setOpen(o => !o)}
                title="More Options"
                disabled={!!exporting}
            >
                {exporting ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="19" cy="12" r="1"></circle>
                        <circle cx="5" cy="12" r="1"></circle>
                    </svg>
                )}
            </button>

            {open && (
                <div className="export-dropdown" style={{
                    width: '260px',
                    right: 0,
                    padding: '8px',
                    top: 'calc(100% + 8px)',
                    animation: 'dropdownFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>

                    {/* Theme Section */}
                    <div className="options-section-label" style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-muted)',
                        padding: '4px 8px 8px',
                        fontWeight: 600
                    }}>
                        Appearance
                    </div>

                    <div className="theme-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '6px',
                        marginBottom: '12px'
                    }}>
                        {THEMES.map(t => (
                            <button
                                key={t.id}
                                onClick={() => handleThemeChange(t.id)}
                                disabled={savingTheme}
                                title={t.name}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '10px 4px',
                                    borderRadius: '6px',
                                    border: activeTheme === t.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                                    background: activeTheme === t.id ? 'var(--bg-input)' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    opacity: savingTheme ? 0.6 : 1
                                }}
                                onMouseEnter={(e) => {
                                    if (activeTheme !== t.id) e.currentTarget.style.background = 'var(--bg-input)'
                                }}
                                onMouseLeave={(e) => {
                                    if (activeTheme !== t.id) e.currentTarget.style.background = 'transparent'
                                }}
                            >
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: t.color,
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    marginBottom: '6px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }} />
                                <span style={{
                                    fontSize: '11px',
                                    color: activeTheme === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                                    fontWeight: activeTheme === t.id ? 600 : 400
                                }}>
                                    {t.name}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0 8px 0' }} />

                    {/* Export Section */}
                    <div className="options-section-label" style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-muted)',
                        padding: '4px 8px 8px',
                        fontWeight: 600
                    }}>
                        Export Chat
                    </div>

                    <button className="export-option" onClick={() => handleExport('json')} disabled={!convId}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <div>
                            <div className="export-option-name">Export as JSON</div>
                            <div className="export-option-desc">Structured data</div>
                        </div>
                    </button>

                    <button className="export-option" onClick={() => handleExport('pdf')} disabled={!convId}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                        <div>
                            <div className="export-option-name">Export as PDF</div>
                            <div className="export-option-desc">Formatted document</div>
                        </div>
                    </button>
                </div>
            )}
        </div>
    )
}
