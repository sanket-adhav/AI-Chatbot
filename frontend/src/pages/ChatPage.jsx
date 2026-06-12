import { useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useChat } from '../hooks/useChat'
import MessageBubble, { TypingBubble } from '../components/chat/MessageBubble'
import InputBar from '../components/chat/InputBar'
import ChatOptionsMenu from '../components/chat/ChatOptionsMenu'
import EmptyState from '../components/common/EmptyState'

const STREAMING_ID = '__streaming__'

export default function ChatPage({ user, onRefreshSidebar, onProfileUpdated }) {
    const { convId } = useParams()
    const [searchParams] = useSearchParams()
    const highlightId = searchParams.get('highlight')
    const navigate = useNavigate()

    const {
        conversation,
        messages,
        loading,
        streaming,
        loadingInit,
        error,
        useDocuments,
        setUseDocuments,
        streamContent,
        handleSend,
        handleStop,
        handleRegenerate,
    } = useChat(convId)

    const messagesAreaRef = useRef(null)
    const bottomRef = useRef(null)
    const highlightRef = useRef(null)
    const inputRef = useRef(null)

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

    useEffect(() => {
        hasScrolledInitial.current = false
    }, [convId])

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