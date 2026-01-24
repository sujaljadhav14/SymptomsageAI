# SymptomSage AI Documentation

## Overview
SymptomSage AI is a professional medical triage assistant designed to help users evaluate their symptoms through natural voice interaction. Powered by Gemini 2.5 Native Audio, it provides real-time assessments and guidance on the urgency of medical care.

## Key Features

### 1. Voice-First Triage
- Uses real-time audio streaming for a hands-free experience.
- Follows clinical triage logic to ask relevant clarifying questions.
- Identifies "Red Flag" symptoms and provides emergency guidance.

### 2. Intelligent Memory (Learning)
SymptomSage doesn't just forget. It "learns" from your history to provide better care over time.
- **Session Summarization:** After every consultation, the AI generates a concise medical summary of what was discussed.
- **Contextual Awareness:** When you start a new session, SymptomSage reads these summaries to remember past allergies, medications, or ongoing symptoms you've mentioned.
- **Privacy First:** Your data never leaves your device. All "training" data and histories are stored in your browser's `localStorage`.

### 3. Transparent Triage Logic
The AI is instructed to:
1. State its role as an AI (not a doctor).
2. Ask about onset, duration, and severity.
3. Limit itself to one question at a time for clarity.
4. Urge emergency care for life-threatening descriptions.

## Technical Details

### Storage Mechanism
- **Chat History:** Stores the last 10 full conversations for your reference.
- **Patient Context:** Stores the last 5 session summaries to inject into the AI's "long-term memory".

### Clearing Data
You can clear all stored memory at any time by:
1. Clicking the **"Clear Memory"** button in the top banner.
2. Clearing your browser's site data/cache.

## Disclaimer
SymptomSage AI is an informational tool only. It is **NOT** a clinical diagnosis tool. Always consult with a licensed healthcare professional for medical advice. **In case of an emergency, call 911 immediately.**
