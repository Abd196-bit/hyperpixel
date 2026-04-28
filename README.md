# Hyperpixel AI

A modern, deployable AI chat interface built with Flask and a local Llama model.

## Features

- **Random Suggestions**: Dynamic suggestion prompts that change each session
- **Edit Messages**: Click the edit button (✎) on your messages to modify and resend
- **Deployable**: Ready for deployment on Render and other cloud platforms
- **Responsive Design**: Clean, modern UI that works on desktop and mobile

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
- **Deployment**: Render-compatible with environment variable configuration# hyperpixel
# hyperpixel
