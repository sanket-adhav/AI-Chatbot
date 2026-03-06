import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
    fetchConversation,
    fetchMessages,
    sendImageMessage,
    streamChatMessage,
    deleteMessage,
} from '../api/client'
import MessageBubble, { TypingBubble } from '../components/MessageBubble'
import InputBar from '../components/InputBar'
import ChatOptionsMenu from '../components/ChatOptionsMenu'
import EmptyState from '../components/EmptyState'

const STREAMING_ID = '__streaming__'

export default function ChatPage({ user, onRefreshSidebar, onProfileUpdated }) {
    const { convId } = useParams()
    const [searchParams] = useSearchParams()
    const highlightId = searchParams.get('highlight')
    const navigate = useNavigate()

    const [conversation, setConversation] = useState(null)
    const [messages, setMessages] = useState([])
    const [loading, setLoading] = useState(false)
    const [streaming, setStreaming] = useState(false)
    const [loadingInit, setLoadingInit] = useState(false)
    const [error, setError] = useState(null)
    const [useDocuments, setUseDocuments] = useState(false)
    const [selectedModelId, setSelectedModelId] = useState('gemini-2.5-flash')

    const [streamContent, setStreamContent] = useState('')
    const streamStateRef = useRef({ buffer: '', displayed: '', isDone: false, msgId: null })
    const finalizeLockRef = useRef(false)

    const messagesAreaRef = useRef(null)
    const bottomRef = useRef(null)
    const highlightRef = useRef(null)
    const abortRef = useRef(null)
    const inputRef = useRef(null)

    /* ================= LOAD CONVERSATION ================= */

    useEffect(() => {
        if (!convId) return

        setLoadingInit(true)
        setMessages([])
        setConversation(null)
        setError(null)

        Promise.all([
            fetchConversation(convId),
            fetchMessages(convId),
        ])
            .then(([conv, msgs]) => {
                setConversation(conv)
                setMessages(msgs)
            })
            .catch(() => setError('Failed to load conversation.'))
            .finally(() => setLoadingInit(false))
    }, [convId])

    /* ================= AUTO SCROLL ================= */
    const hasScrolledInitial = useRef(false)
    const isUserScrolledUp = useRef(false)

    // Detect user scrolling up
    useEffect(() => {
        const container = messagesAreaRef.current
        if (!container) return

        const handleScroll = () => {
            const distanceToBottom = container.scrollHeight - container.clientHeight - container.scrollTop
            isUserScrolledUp.current = distanceToBottom > 50
        }
        container.addEventListener('scroll', handleScroll, { passive: true })
        return () => container.removeEventListener('scroll', handleScroll)
    }, [])

    useEffect(() => {
        if (loadingInit) return

        const container = messagesAreaRef.current
        if (!container) return

        if (highlightId && highlightRef.current && !hasScrolledInitial.current) {
            highlightRef.current.scrollIntoView({ behavior: 'auto', block: 'center' })
            hasScrolledInitial.current = true
        } else {
            if (!isUserScrolledUp.current || !hasScrolledInitial.current) {
                const targetScroll = container.scrollHeight

                if (hasScrolledInitial.current && !streaming && streamContent === '') {
                    container.scrollTo({ top: targetScroll, behavior: 'smooth' })
                } else {
                    container.scrollTop = targetScroll
                }
            }
            hasScrolledInitial.current = true
        }
    }, [messages, streamContent, loading, streaming, highlightId, loadingInit])

    /* ================= STREAMING EFFECT ================= */

    const finalizeStream = useCallback(() => {
        const state = streamStateRef.current
        if (state.displayed) {
            setMessages(prev => [
                ...prev,
                {
                    id: state.msgId || `msg-${Date.now()}`,
                    role: 'model',
                    content: state.displayed,
                    created_at: new Date().toISOString()
                }
            ])
        }
        setStreaming(false)
        setStreamContent('')
        streamStateRef.current = { buffer: '', displayed: '', isDone: false, msgId: null }
        finalizeLockRef.current = false
    }, [])

    useEffect(() => {
        let rafId;
        const typeChar = () => {
            const state = streamStateRef.current

            if (state.buffer.length > state.displayed.length) {
                const remaining = state.buffer.slice(state.displayed.length)
                const charsToAdd = Math.max(1, Math.ceil(remaining.length / 15)) // smooth typing
                state.displayed += remaining.slice(0, charsToAdd)
                setStreamContent(state.displayed)
            } else if (state.isDone && !finalizeLockRef.current) {
                finalizeLockRef.current = true
                finalizeStream()
            }
            rafId = requestAnimationFrame(typeChar)
        }
        rafId = requestAnimationFrame(typeChar)
        return () => cancelAnimationFrame(rafId)
    }, [finalizeStream])

    useEffect(() => {
        hasScrolledInitial.current = false
    }, [convId])

    /* ================= ABORT STREAM ================= */

    useEffect(() => {
        return () => abortRef.current?.abort()
    }, [convId])

    /* ================= SEND MESSAGE ================= */

    const handleSend = useCallback(async (content, imageFile = null, modelId = null) => {
        if (modelId) setSelectedModelId(modelId)
        const currentModel = modelId || selectedModelId

        setError(null)

        if (imageFile) {
            setLoading(true)

            const optimisticMsg = {
                id: `temp-${Date.now()}`,
                role: 'user',
                content: content || '📷 Image uploaded.',
                image_url: URL.createObjectURL(imageFile),
                created_at: new Date().toISOString(),
            }

            setMessages(prev => [...prev, optimisticMsg])

            try {
                const { user_message, assistant_message } =
                    await sendImageMessage(convId, content, imageFile, currentModel)

                setMessages(prev => [
                    ...prev.filter(m => m.id !== optimisticMsg.id),
                    user_message,
                    assistant_message,
                ])
            } catch {
                setMessages(prev =>
                    prev.filter(m => m.id !== optimisticMsg.id)
                )
                setError('Failed to send image.')
            } finally {
                setLoading(false)
            }

            return
        }

        setLoading(true)

        const optimisticUser = {
            id: `temp-user-${Date.now()}`,
            role: 'user',
            content,
            created_at: new Date().toISOString(),
        }

        setMessages(prev => [...prev, optimisticUser])

        streamStateRef.current = { buffer: '', displayed: '', isDone: false, msgId: null }
        setStreamContent('')
        finalizeLockRef.current = false

        const controller = streamChatMessage(convId, content, useDocuments, currentModel, {
            onChunk: (chunk) => {
                setLoading(false)
                setStreaming(true)
                streamStateRef.current.buffer += chunk
            },
            onDone: ({ msg_id }) => {
                streamStateRef.current.isDone = true
                streamStateRef.current.msgId = msg_id
            },
            onError: (message) => {
                streamStateRef.current.isDone = true
                setLoading(false)
                setError(message)
                setMessages(prev =>
                    prev.filter(m => m.id !== optimisticUser.id)
                )
            },
        })

        abortRef.current = controller
    }, [convId, useDocuments])

    const handleStop = useCallback(() => {
        if (abortRef.current) abortRef.current.abort()
        streamStateRef.current.isDone = true
    }, [])

    const handleRegenerate = useCallback(async () => {
        if (streaming || loading || messages.length < 2) return

        // 1. Find last assistant message and its trigger user message
        const lastMsg = messages[messages.length - 1]
        if (lastMsg.role !== 'model') return

        const userMsg = messages[messages.length - 2]
        if (userMsg.role !== 'user') return

        // 2. Abort any previous stream just in case
        handleStop()

        // 3. Backup old message for restoration on failure
        const oldMessages = [...messages]
        const lastMsgId = lastMsg.id

        // 4. Update UI: Remove last assistant message
        setMessages(prev => prev.slice(0, -1))
        setError(null)
        setLoading(true)

        try {
            // 5. Delete from backend if it's a persisted message (not temp)
            if (!String(lastMsgId).startsWith('temp-') && !String(lastMsgId).startsWith('msg-')) {
                await deleteMessage(convId, lastMsgId)
            }

            // 6. Trigger new stream with same content
            streamStateRef.current = { buffer: '', displayed: '', isDone: false, msgId: null }
            setStreamContent('')
            finalizeLockRef.current = false

            const controller = streamChatMessage(convId, userMsg.content, lastMsg.used_rag || useDocuments, selectedModelId, {
                onChunk: (chunk) => {
                    setLoading(false)
                    setStreaming(true)
                    streamStateRef.current.buffer += chunk
                },
                onDone: ({ msg_id }) => {
                    streamStateRef.current.isDone = true
                    streamStateRef.current.msgId = msg_id
                },
                onError: (message) => {
                    streamStateRef.current.isDone = true
                    setLoading(false)
                    setError(message)
                    // Restore old message on error
                    setMessages(oldMessages)
                },
            })

            abortRef.current = controller
        } catch (err) {
            setLoading(false)
            setError('Failed to initiate regeneration.')
            setMessages(oldMessages)
        }
    }, [convId, messages, streaming, loading, useDocuments, handleStop])

    const handleSuggestionClick = (prompt) => {
        if (inputRef.current) {
            inputRef.current.setValue(prompt)
            inputRef.current.focus()
        }
    }

    const handleRecentChatClick = (chat) => {
        navigate(`/chat/${chat.id}`)
    }

    const isInputDisabled = loading || streaming
    const isChatEmpty =
        messages.length === 0 &&
        !loading &&
        !streaming &&
        streamContent === '' &&
        !loadingInit

    /* ================= NO CONVERSATION ================= */
    if (!convId) {
        return (
            <div className="main-area">
                <div className="chat-header">
                    <span className="chat-header-title">AI Chatbot</span>
                </div>

                <EmptyState
                    user={user}
                    onSuggestionClick={handleSuggestionClick}
                    onRecentChatClick={handleRecentChatClick}
                />

                <InputBar ref={inputRef} disabled />
            </div>
        )
    }

    /* ================= MAIN RENDER ================= */

    return (
        <div className="main-area">

            {/* Header */}
            <div className="chat-header">
                <div className="chat-header-title">
                    {conversation?.title || (loadingInit ? 'Loading...' : 'Chat')}
                </div>

                <div className="chat-header-meta">
                    {conversation?.agent && (
                        <span className="badge-pill">
                            Agent: {conversation.agent.name}
                        </span>
                    )}

                    {convId && conversation &&
                        <ChatOptionsMenu
                            convId={convId}
                            onProfileUpdated={onProfileUpdated}
                        />}
                </div>
            </div>

            {/* Messages */}
            <div className="messages-area" ref={messagesAreaRef} key={convId}>
                {loadingInit ? (
                    <div className="flex-center" style={{ flex: 1 }}>
                        Loading conversation…
                    </div>
                ) : isChatEmpty ? (
                    <EmptyState
                        user={user}
                        onSuggestionClick={handleSuggestionClick}
                        onRecentChatClick={handleRecentChatClick}
                    />
                ) : (
                    <div className="messages-inner">
                        {messages.map((msg, idx) => {
                            const isHighlighted = String(msg.id) === String(highlightId)
                            const isLastAssistant = !streaming && msg.role === 'model' && idx === messages.length - 1
                            return (
                                <div
                                    key={msg.id}
                                    ref={isHighlighted ? highlightRef : null}
                                >
                                    <MessageBubble
                                        message={msg}
                                        onRegenerate={handleRegenerate}
                                        isLastAssistant={isLastAssistant}
                                        isRegenerating={streaming || loading}
                                    />
                                </div>
                            )
                        })}

                        {loading && <TypingBubble />}

                        {(streaming || streamContent !== '') && (
                            <MessageBubble
                                message={{
                                    id: STREAMING_ID,
                                    role: 'model',
                                    content: streamContent,
                                    created_at: new Date().toISOString(),
                                    isStreaming: true
                                }}
                            />
                        )}

                        {error && (
                            <div style={{
                                textAlign: 'center',
                                padding: '10px',
                                color: 'var(--danger)',
                                fontSize: '13px'
                            }}>
                                {error}
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>
                )}
            </div>

            {/* Input */}
            <InputBar
                ref={inputRef}
                onSend={handleSend}
                onStop={handleStop}
                streaming={streaming}
                loading={loading}
                disabled={isInputDisabled || loadingInit}
                isCentered={isChatEmpty}
                useDocuments={useDocuments}
                onToggleDocuments={() => setUseDocuments(!useDocuments)}
            />
        </div>
    )
}