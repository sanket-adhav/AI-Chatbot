with open('/Users/sanketadhav/.gemini/antigravity/playground/icy-cassini/frontend/src/components/MessageBubble.jsx', 'r') as f:
    content = f.read()

old_code = """            // Try to find a good English voice
            const voices = window.speechSynthesis.getVoices()
            const preferredVoice = voices.find(v => v.lang.startsWith('en-US'))
            if (preferredVoice) utterance.voice = preferredVoice"""

new_code = """            // Try to find a good English voice, prioritizing high-quality/premium voices
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
            if (preferredVoice) utterance.voice = preferredVoice"""

if old_code in content:
    content = content.replace(old_code, new_code)
    with open('/Users/sanketadhav/.gemini/antigravity/playground/icy-cassini/frontend/src/components/MessageBubble.jsx', 'w') as f:
        f.write(content)
    print("Replaced successfully")
else:
    print("Old code not found")
