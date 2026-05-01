#!/bin/bash
# Download Ollama models to pen drive

echo "🚀 Downloading Ollama models to pen drive..."
echo "📁 Location: /Volumes/GODBOTY/ollama/models"
echo ""

# Set Ollama models path
export OLLAMA_MODELS="/Volumes/GODBOTY/ollama/models"
mkdir -p "$OLLAMA_MODELS"

# Check if Ollama is running, if not start it
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "Starting Ollama server..."
    ollama serve &
    sleep 5
fi

echo "📥 Downloading models:"
echo "  1. llama3.1:8b (Hyperpixel - ~4.9GB)"
echo "  2. phi3:mini (Minipixel - ~2GB)"
echo "  3. gemma2:2b (Minipixel2 - ~1.6GB)"
echo "  4. llama3.2:3b (Minipixel3 - ~2GB)"
echo ""

# Download all models
ollama pull llama3.1:8b
ollama pull phi3:mini
ollama pull gemma2:2b
ollama pull llama3.2:3b

echo ""
echo "✅ All models downloaded!"
echo "📊 Storage used:"
du -sh /Volumes/GODBOTY/ollama/models/
