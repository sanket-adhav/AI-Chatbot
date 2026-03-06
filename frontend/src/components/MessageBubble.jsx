import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useState, useEffect } from 'react'

export default function MessageBubble({ message, onRegenerate, isLastAssistant, isRegenerating }) {
    const isUser = message.role === 'user'
    const time = new Date(message.created_at).toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit',
    })

    const [isPlaying, setIsPlaying] = useState(false)

    // Cleanup speech synthesis on unmount
    useEffect(() => {
        return () => {
            if (isPlaying) {
                window.speechSynthesis.cancel()
            }
        }
    }, [isPlaying])

    const toggleSpeech = () => {
        if (!window.speechSynthesis) {
            alert('Text-to-speech is not supported in this browser.')
            return
        }

        if (isPlaying) {
            window.speechSynthesis.cancel()
            setIsPlaying(false)
        } else {
            // Strip markdown before speaking
            const cleanText = message.content
                .replace(/```[\s\S]*?```/g, ' Code block omitted. ') // remove code blocks
                .replace(/[*_~`#]/g, '') // remove common markdown formatting characters

            const utterance = new SpeechSynthesisUtterance(cleanText)

            // Try to find a good English voice, prioritizing high-quality/premium voices
            const voices = window.speechSynthesis.getVoices()
            let preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Google UK English'))
            if (!preferredVoice) {
                preferredVoice = voices.find(v => v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Karen') || v.name.includes('Tessa') || v.name.includes('Microsoft'))
            }
            if (!preferredVoice) {
                preferredVoice = voices.find(v => v.name.includes('Premium') || v.name.includes('Enhanced'))
            }
            if (!preferredVoice) {
                preferredVoice = voices.find(v => v.lang.startsWith('en-US'))
            }
            if (preferredVoice) utterance.voice = preferredVoice

            utterance.onend = () => setIsPlaying(false)
            utterance.onerror = () => setIsPlaying(false)

            window.speechSynthesis.speak(utterance)
            setIsPlaying(true)
        }
    }

    // Resolve image URL: support both server URLs and local data URLs (optimistic preview)
    const imageUrl = message.image_url
        ? message.image_url.startsWith('http') || message.image_url.startsWith('blob') || message.image_url.startsWith('data')
            ? message.image_url
            : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${message.image_url}`
        : null

    return (
        <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
            {!isUser && (
                <div className="message-avatar">✦</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '88%' }}>
                <div className={`message-bubble${message.isStreaming ? ' is-streaming' : ''}`}>
                    {/* Image content — shown above text */}
                    {imageUrl && (
                        <div className="message-image-wrapper">
                            <img
                                src={imageUrl}
                                alt="Uploaded image"
                                className="message-image"
                                loading="lazy"
                                onClick={() => window.open(imageUrl, '_blank')}
                            />
                        </div>
                    )}
                    {isUser ? (
                        message.content && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</p>
                    ) : (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ node, inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '')
                                    return !inline && match ? (
                                        <CodeBlock
                                            language={match[1]}
                                            value={String(children).replace(/\n$/, '')}
                                            {...props}
                                        />
                                    ) : (
                                        <code className={className} {...props}>
                                            {children}
                                        </code>
                                    )
                                }
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    )}

                    {/* Assistant actions: TTS and Regenerate */}
                    {!isUser && !message.isStreaming && message.content && (
                        <div className="message-actions">
                            <button className={`tts-btn ${isPlaying ? 'playing' : ''}`} onClick={toggleSpeech} title={isPlaying ? "Stop playing" : "Read aloud"}>
                                {isPlaying ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="6" y="4" width="4" height="16"></rect>
                                        <rect x="14" y="4" width="4" height="16"></rect>
                                    </svg>
                                ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                    </svg>
                                )}
                            </button>

                            {isLastAssistant && (
                                <button
                                    className="regenerate-btn"
                                    onClick={onRegenerate}
                                    disabled={isRegenerating}
                                    title="Regenerate response"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="23 4 23 10 17 10"></polyline>
                                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                                    </svg>
                                    <span>Regenerate</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
                <div className="message-meta">{time}</div>
            </div>
            {isUser && (
                <div className="message-avatar">👤</div>
            )}
        </div>
    )
}

function CodeBlock({ language, value }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="code-block-wrapper">
            <div className="code-block-header">
                <span className="code-lang">{language}</span>
                <button className={`code-copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
                    {copied ? (
                        <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>Copied!</span>
                        </>
                    ) : (
                        <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>Copy Code</span>
                        </>
                    )}
                </button>
            </div>
            <SyntaxHighlighter
                style={oneDark}
                language={language}
                PreTag="div"
                customStyle={{ margin: 0, paddingOrigin: '16px', borderRadius: '0 0 10px 10px', background: '#1e1e24' }}
            >
                {value}
            </SyntaxHighlighter>
        </div>
    )
}

export function TypingBubble() {
    return (
        <div className="message-row assistant">
            <div className="message-avatar">✦</div>
            <div className="message-bubble">
                <div className="typing-indicator">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                </div>
            </div>
        </div>
    )
}
