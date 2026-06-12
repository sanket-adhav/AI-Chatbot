import { useState, useEffect, useRef, useCallback } from 'react'
import {
    fetchConversation,
    fetchMessages,
    sendImageMessage,
    streamChatMessage,
    deleteMessage,
} from '../api/client'

const STREAMING_ID = '__streaming__'

export function useChat(convId) {
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
    const abortRef = useRef(null)

    // Load Conversation and messages
    useEffect(() => {
        if (!convId) {
            setConversation(null)
            setMessages([])
            return
        }

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

    // Abort stream on unmount or conv change
    useEffect(() => {
        return () => {
            if (abortRef.current) abortRef.current.abort()
        }
    }, [convId])

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

    // Smooth typing animation frame loop
    useEffect(() => {
        let rafId;
        const typeChar = () => {
            const state = streamStateRef.current

            if (state.buffer.length > state.displayed.length) {
                const remaining = state.buffer.slice(state.displayed.length)
                const charsToAdd = Math.max(1, Math.ceil(remaining.length / 15))
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

    const handleStop = useCallback(() => {
        if (abortRef.current) abortRef.current.abort()
        streamStateRef.current.isDone = true
    }, [])

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
    }, [convId, useDocuments, selectedModelId])

    const handleRegenerate = useCallback(async () => {
        if (streaming || loading || messages.length < 2) return

        const lastMsg = messages[messages.length - 1]
        if (lastMsg.role !== 'model') return

        const userMsg = messages[messages.length - 2]
        if (userMsg.role !== 'user') return

        handleStop()

        const oldMessages = [...messages]
        const lastMsgId = lastMsg.id

        setMessages(prev => prev.slice(0, -1))
        setError(null)
        setLoading(true)

        try {
            if (!String(lastMsgId).startsWith('temp-') && !String(lastMsgId).startsWith('msg-')) {
                await deleteMessage(convId, lastMsgId)
            }

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
                    setMessages(oldMessages)
                },
            })

            abortRef.current = controller
        } catch (err) {
            setLoading(false)
            setError('Failed to initiate regeneration.')
            setMessages(oldMessages)
        }
    }, [convId, messages, streaming, loading, useDocuments, selectedModelId, handleStop])

    return {
        conversation,
        setConversation,
        messages,
        setMessages,
        loading,
        streaming,
        loadingInit,
        error,
        setError,
        useDocuments,
        setUseDocuments,
        selectedModelId,
        setSelectedModelId,
        streamContent,
        handleSend,
        handleStop,
        handleRegenerate,
    }
}
