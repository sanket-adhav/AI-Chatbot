import { useState, useRef, useEffect } from 'react'
import { exportChatJson, exportChatPdf } from '../api/client'

export default function ExportMenu({ convId }) {
    const [open, setOpen] = useState(false)
    const [exporting, setExporting] = useState(null) // 'json' | 'pdf' | null
    const menuRef = useRef(null)
    
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

    return (
        <div className="export-menu-wrapper" ref={menuRef}>
            <button
                className="export-trigger-btn"
                onClick={() => setOpen(o => !o)}
                title="Export chat"
                disabled={!!exporting}
            >
                {exporting ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                )}
                <span>{exporting ? 'Exporting…' : 'Export'}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {open && (
                <div className="export-dropdown">
                    <button className="export-option" onClick={() => handleExport('json')}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <div>
                            <div className="export-option-name">Export as JSON</div>
                            <div className="export-option-desc">Structured data with all messages</div>
                        </div>
                    </button>
                    <button className="export-option" onClick={() => handleExport('pdf')}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                        <div>
                            <div className="export-option-name">Export as PDF</div>
                            <div className="export-option-desc">Formatted document with timestamps</div>
                        </div>
                    </button>
                </div>
            )}
        </div>
    )
}
