import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'

const InputBar = forwardRef(({ onSend, onStop, loading, streaming, disabled, isCentered, useDocuments, onToggleDocuments }, ref) => {
    const [value, setValue] = useState('')
    const [imageFile, setImageFile] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)
    const [isRecording, setIsRecording] = useState(false)
    const textareaRef = useRef(null)
    const fileInputRef = useRef(null)
    const recognitionRef = useRef(null)

    // Model Selector
    const [modelMenuOpen, setModelMenuOpen] = useState(false)
    const [selectedModel, setSelectedModel] = useState({
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'Google',
        tag: 'New',
        icon: '✨'
    })
    const modelMenuRef = useRef(null)

    const models = [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', tag: 'New', icon: '✨' },
        { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', tag: 'Max', icon: '🎭' },
        { id: 'o1-preview', name: 'o1-preview', provider: 'OpenAI', tag: 'Plus', icon: '🌀' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', tag: 'Plus', icon: '🤖' }
    ]

    // Actions Dropdown
    const [actionsMenuOpen, setActionsMenuOpen] = useState(false)
    const actionsMenuRef = useRef(null)

    useImperativeHandle(ref, () => ({
        setValue: (v) => setValue(v),
        focus: () => textareaRef.current?.focus()
    }))

    useEffect(() => {
        const handler = (e) => {
            if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target)) setActionsMenuOpen(false)
            if (modelMenuRef.current && !modelMenuRef.current.contains(e.target)) setModelMenuOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Setup Speech Recognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition()
            recognition.continuous = true
            recognition.interimResults = true
            recognition.lang = 'en-US'

            let finalTranscriptStr = ''

            recognition.onresult = (event) => {
                let interimTranscript = ''
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscriptStr += event.results[i][0].transcript + ' '
                    } else {
                        interimTranscript += event.results[i][0].transcript
                    }
                }
                setValue((prev) => {
                    // We append the new speech to whatever was already in the box when recording started
                    const baseStr = prev.replace(/ \[[^\]]+\]$/, '') // remove previous interim tag if any
                    return (baseStr + ' ' + finalTranscriptStr + (interimTranscript ? ` [${interimTranscript}]` : '')).trim()
                })
            }

            recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error)
                setIsRecording(false)
            }

            recognition.onend = () => {
                setIsRecording(false)
                // Clean up any remaining interim tags
                setValue(prev => prev.replace(/ \[[^\]]+\]$/, '').trim())
            }

            recognitionRef.current = recognition
        }
    }, [])

    const toggleRecording = () => {
        if (!recognitionRef.current) {
            alert('Speech recognition is not supported in this browser.')
            return
        }
        if (isRecording) {
            recognitionRef.current.stop()
        } else {
            setValue(prev => prev + (prev ? ' ' : '')) // Add space if appending
            recognitionRef.current.start()
            setIsRecording(true)
        }
    }

    // Auto-grow textarea
    useEffect(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = Math.min(el.scrollHeight, 180) + 'px'
    }, [value])

    const submit = () => {
        if (isRecording && recognitionRef.current) {
            recognitionRef.current.stop()
        }
        if (streaming && onStop) {
            onStop()
            return
        }
        // Clean up any interim brackets before sending
        const cleanValue = value.replace(/ \[[^\]]+\]$/, '').trim()

        if ((!cleanValue && !imageFile) || loading || disabled) return
        onSend(cleanValue, imageFile, selectedModel.id)
        setValue('')
        setImageFile(null)
        setImagePreview(null)
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
        }
    }

    const handleFileChange = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setImageFile(file)
        const reader = new FileReader()
        reader.onloadend = () => setImagePreview(reader.result)
        reader.readAsDataURL(file)
        e.target.value = ''
    }

    const removeImage = () => {
        setImageFile(null)
        setImagePreview(null)
    }

    const canSend = streaming || ((value.trim() || imageFile) && !loading && !disabled)

    return (
        <div className={`input-area ${isCentered ? 'centered' : ''}`}>
            {/* Image Preview Strip */}
            {imagePreview && (
                <div className="image-preview-bar">
                    <div className="image-preview-wrapper">
                        <img src={imagePreview} alt="Preview" className="image-preview-thumb" />
                        <button
                            className="image-preview-remove"
                            onClick={removeImage}
                            title="Remove image"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                    <span className="image-preview-name">{imageFile?.name}</span>
                </div>
            )}

            <div className="input-bar perplexity-style">
                <textarea
                    ref={textareaRef}
                    className="input-textarea"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={imageFile ? "Add a message about this image…" : "Ask Anything..."}
                    rows={1}
                    disabled={disabled}
                />

                <div className="input-actions-row">
                    <div className="input-actions-left">
                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />

                        {/* Actions Dropdown */}
                        <div style={{ position: 'relative' }} ref={actionsMenuRef}>
                            <button
                                className={`attach-btn-circle ${actionsMenuOpen || imageFile || useDocuments || isRecording ? 'active' : ''}`}
                                onClick={() => setActionsMenuOpen(o => !o)}
                                title="More Actions"
                                type="button"
                                disabled={disabled}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </button>

                            {actionsMenuOpen && (
                                <div className="action-dropdown" style={{ minWidth: '240px', bottom: 'calc(100% + 12px)', left: 0 }}>
                                    <div className="options-section-label" style={{
                                        fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em',
                                        color: 'var(--text-muted)', padding: '4px 12px 8px', fontWeight: 600
                                    }}>
                                        Input Options
                                    </div>

                                    <button
                                        className={`export-option ${imageFile ? 'action-option-active' : ''}`}
                                        onClick={() => { fileInputRef.current?.click(); setActionsMenuOpen(false); }}
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                            <circle cx="8.5" cy="8.5" r="1.5" />
                                            <polyline points="21 15 16 10 5 21" />
                                        </svg>
                                        <div>
                                            <div className="export-option-name">{imageFile ? 'Replace Image' : 'Upload Image'}</div>
                                            <div className="export-option-desc">{imageFile ? imageFile.name : 'Attach a photo for analysis'}</div>
                                        </div>
                                    </button>

                                    {onToggleDocuments && (
                                        <button
                                            className={`export-option ${useDocuments ? 'action-option-active' : ''}`}
                                            onClick={() => { onToggleDocuments(); setActionsMenuOpen(false); }}
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                                <polyline points="10 9 9 9 8 9"></polyline>
                                            </svg>
                                            <div>
                                                <div className="export-option-name">{useDocuments ? 'RAG Active' : 'Use Knowledge Base'}</div>
                                                <div className="export-option-desc">{useDocuments ? 'Searching your documents' : 'Search uploaded PDFs'}</div>
                                            </div>
                                        </button>
                                    )}

                                    <button
                                        className={`export-option ${isRecording ? 'action-option-active mic-active-option' : ''}`}
                                        onClick={(e) => { e.preventDefault(); toggleRecording(); setActionsMenuOpen(false); }}
                                    >
                                        {isRecording ? (
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="6" y="4" width="4" height="16" rx="1"></rect>
                                                <rect x="14" y="4" width="4" height="16" rx="1"></rect>
                                            </svg>
                                        ) : (
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                                <line x1="12" y1="19" x2="12" y2="22"></line>
                                            </svg>
                                        )}
                                        <div>
                                            <div className="export-option-name">{isRecording ? 'Stop Dictating' : 'Voice Dictation'}</div>
                                            <div className="export-option-desc">{isRecording ? 'Listening...' : 'Speak your message'}</div>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="input-actions-right">
                        {/* Model Selector */}
                        <div style={{ position: 'relative' }} ref={modelMenuRef}>
                            <button
                                className={`model-selector-btn-minimal ${modelMenuOpen ? 'active' : ''}`}
                                onClick={() => setModelMenuOpen(o => !o)}
                                type="button"
                                disabled={disabled || streaming}
                            >
                                <span className="model-name">Model</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`chevron ${modelMenuOpen ? 'open' : ''}`}>
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>

                            {modelMenuOpen && (
                                <div className="model-dropdown-perplexity">
                                    <div className="model-dropdown-header">Upgrade for best models</div>
                                    <div className="model-list">
                                        {models.map(m => (
                                            <button
                                                key={m.id}
                                                className={`model-item ${selectedModel.id === m.id ? 'selected' : ''}`}
                                                onClick={() => {
                                                    setSelectedModel(m)
                                                    setModelMenuOpen(false)
                                                }}
                                            >
                                                <div className="model-item-main">
                                                    <span className="model-item-icon">{m.icon}</span>
                                                    <div className="model-item-info">
                                                        <div className="model-item-name">
                                                            {m.name}
                                                            {m.tag && <span className={`model-tag tag-${m.tag.toLowerCase()}`}>{m.tag}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Mic Button (outside dropdown) */}
                        {!streaming && (
                            <button
                                className={`mic-btn-minimal ${isRecording ? 'active' : ''}`}
                                onClick={toggleRecording}
                                title="Voice input"
                                type="button"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                </svg>
                            </button>
                        )}

                        <button
                            className={`send-btn-circle ${streaming ? 'stop' : ''}`}
                            onClick={streaming ? onStop : submit}
                            disabled={!canSend}
                            title={streaming ? "Stop generating" : "Send"}
                        >
                            {streaming ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="6" width="12" height="12" rx="1"></rect>
                                </svg>
                            ) : loading ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                            ) : (
                                <div className="send-icon-wrapper">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                                    </svg>
                                </div>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            <p className="input-hint">AI can make mistakes. Verify important information.</p>
        </div>
    )
})

export default InputBar
