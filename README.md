# Hyperpixel AI

A modern, deployable AI chat interface built with Flask and a local Llama model, now with Firebase authentication and persistent user memory.

## Features

- **Firebase Authentication**: Secure login/signup with email and password
- **Persistent Memory**: User chat history saved to Firebase Realtime Database
- **User Profiles**: Each user has their own conversation history
- **Learning System**: AI learns from user interactions and adapts responses
- **Fact Verification**: All learned information is verified against DuckDuckGo before storage
- **Personalized Responses**: AI uses verified facts to provide more relevant answers
- **Home Page**: Professional JetBrains IDE-style landing page
- **Enhanced Animations**: Smooth transitions and modern UI animations
- **Random Suggestions**: Dynamic suggestion prompts that change each session
- **Edit Messages**: Click the edit button on your messages to modify and resend
- **Deployable**: Ready for deployment on Render and other cloud platforms
- **Responsive Design**: Clean, modern UI that works on desktop and mobile
- **Accurate Time/Date**: Real-time clock with timezone information

## Firebase Setup

To enable authentication and persistent memory, you need to set up Firebase:

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup wizard
3. Enable Google Analytics (optional)

### 2. Enable Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** provider
3. Click **Save**

### 3. Enable Realtime Database

1. In Firebase Console, go to **Realtime Database**
2. Click **Create Database**
3. Choose a location (closest to your users)
4. Select **Start in test mode** (for development) or set up proper security rules
5. Click **Enable**

### 4. Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps" section
3. Click the web icon (`</>`) to add a web app
4. Give it a name (e.g., "Hyperpixel AI")
5. Check "Firebase Hosting" (optional)
6. Click **Register app**
7. Copy the `firebaseConfig` object

### 5. Update Configuration in hyperpixel.html

Open `hyperpixel.html` and replace the placeholder Firebase config with your actual credentials:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 6. Database Security Rules (Recommended)

For production, set these security rules in Firebase Console → Realtime Database → Rules:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

## Local Development

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Set the model path (optional - defaults to local path):
   ```bash
   export MODEL_PATH="/path/to/your/model.bin"
   ```

3. Run the server:
   ```bash
   python server.py
   ```

4. Open http://localhost:5000 in your browser

5. Sign up for a new account or sign in to access the chat interface

## Deployment on Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the following:
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python server.py`
   - **Environment Variables**:
     - `MODEL_PATH`: (optional) Path to your model file if uploading to Render
     - `PORT`: Automatically set by Render

4. If using a local model, you'll need to upload the model file to Render's persistent disk or use a cloud storage solution.

## API Endpoints

- `GET /` - Serve the main HTML interface
- `GET /status` - Check if the model is loaded
- `POST /chat` - Send chat messages (expects JSON with "messages" array)

## Architecture

- **Frontend**: Vanilla JavaScript with modern CSS
- **Backend**: Flask with CORS support
- **AI Model**: Llama.cpp for local inference
- **Authentication**: Firebase Auth (Email/Password)
- **Database**: Firebase Realtime Database for user chat history
- **Deployment**: Render-compatible with environment variable configuration

## Database Schema

Firebase Realtime Database structure:

```
users/
  {user_uid}/
    email: "user@example.com"
    createdAt: timestamp
    lastLogin: timestamp
    chats/
      {chat_id}/
        title: "Conversation title"
        messages: [
          { role: "user", content: "message" },
          { role: "assistant", content: "response" }
        ]
        updatedAt: timestamp
    learned_facts/
      {fact_id}/
        fact: "The verified fact"
        context: "Conversation context where fact was learned"
        verification:
          verified: true
          confidence: 0.8
          sources: [...]
        learned_at: timestamp
        confidence: 0.8
```

## Learning System

The AI learning system works as follows:

1. **Fact Extraction**: After each conversation, the system extracts potential facts from the messages using pattern matching
2. **Fact Verification**: Each extracted fact is verified against DuckDuckGo search results
3. **Confidence Scoring**: Facts are assigned a confidence score based on verification results
4. **Storage**: Only facts with confidence >= 0.7 are stored in the user's memory
5. **Personalization**: Stored facts are included in future AI requests to provide personalized responses

### Fact Verification Process

- Facts are searched on DuckDuckGo to find supporting information
- Abstracts, definitions, and direct answers are analyzed
- Confidence scores are calculated based on available evidence
- Multiple sources increase confidence
- Verified facts are stored with their sources and confidence scores

### API Endpoints

- `POST /verify_fact` - Verify a fact against DuckDuckGo
- `POST /learn` - Store a verified fact in user memory
