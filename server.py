from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
import json, os, threading
import requests
import werkzeug
from datetime import datetime

# ── Config ───────────────────────────────────────────────────────────────────
MODEL_PATH = os.environ.get('MODEL_PATH', "/Volumes/GODBOTY/hyperpixel/models/blobs/sha256-2bada8a7450677000f678be90653b85d364de7db25eb5ea54136ada5f3933730")
SYSTEM_PROMPT = "You are Hyperpixel AI, a brilliant and friendly assistant who excels at coding, analysis, and conversation. Be concise, warm, and helpful. You were created by bilta studios. Always use current web search results and uploaded file context when answering user queries. When search results are available, incorporate them directly into your response with relevant details, sources, and links. Avoid guessing and clearly cite the found information. Always prefer the date/time supplied by the system context over any internal model knowledge cutoff, and treat that date/time as the current real time."
HTML_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=HTML_DIR)
CORS(app)

# ── Load model once at startup ────────────────────────────────────────────────
ai = None
model_error = None

def load_model():
    global ai, model_error
    try:
        from llama_cpp import Llama
        ai = Llama(
            model_path=MODEL_PATH,
            n_ctx=4096,
            n_gpu_layers=29,
            verbose=False,
        )
        print("✅  Hyperpixel AI model loaded")
    except Exception as e:
        model_error = str(e)
        print(f"❌  Model load failed: {e}")

# Only load model if MODEL_PATH is set and file exists
if MODEL_PATH and os.path.exists(MODEL_PATH):
    threading.Thread(target=load_model, daemon=True).start()
else:
    print("⚠️  No model path provided or model file not found - running in API-only mode")

# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(HTML_DIR, "hyperpixel.html")

@app.route("/status")
def status():
    if ai:
        return jsonify({"ready": True})
    elif model_error:
        return jsonify({"ready": False, "error": model_error})
    else:
        return jsonify({"ready": False, "loading": True})

@app.route("/upload", methods=["POST"])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    # Create uploads directory if it doesn't exist
    uploads_dir = os.path.join(HTML_DIR, 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)

    # Save the file
    filename = werkzeug.utils.secure_filename(file.filename)
    file_path = os.path.join(uploads_dir, filename)
    file.save(file_path)

    # Read file content for processing
    try:
        if filename.lower().endswith(('.txt', '.md', '.py', '.js', '.html', '.css', '.json')):
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        else:
            content = f"File uploaded: {filename} ({len(file.read())} bytes)"

        return jsonify({
            "filename": filename,
            "content": content[:5000],  # Limit content size
            "message": f"File '{filename}' uploaded successfully"
        })
    except Exception as e:
        return jsonify({"error": f"Failed to process file: {str(e)}"}), 500

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    messages = data.get("messages", [])
    files = data.get("files", [])

    if not ai:
        return jsonify({"error": "Model not loaded yet"}), 503

    # Always perform a web search for the latest user message
    user_query = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            user_query = msg.get("content", "")
            break

    search_results = []
    if user_query:
        try:
            search_results = perform_search(user_query)
        except Exception as e:
            print(f"Search failed: {e}")

    def generate():
        try:
            # Add search results, current time, and file content to system prompt if available
            system_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            context_parts = []
            current_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
            context_parts.append(f"Current time (UTC): {current_time}")

            if search_results:
                search_time = current_time
                search_context = format_search_results(search_results, search_time)
                context_parts.append(f"Current web search results for context (retrieved at {search_time}):\n{search_context}")

            if files:
                file_context = format_file_content(files)
                context_parts.append(f"Uploaded files for context:\n{file_context}")

            if context_parts:
                system_messages[0]["content"] += "\n\n" + "\n\n".join(context_parts)

            response = ai.create_chat_completion(
                messages=system_messages + messages,
                stream=True,
                temperature=0.7,
                max_tokens=1024,
            )
            for chunk in response:
                delta = chunk["choices"][0]["delta"]
                text = delta.get("content", "")
                if text:
                    yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

def should_search(query):
    """Always return true so every user query searches the web."""
    return True

def perform_search(query):
    """Perform web search and return results"""
    if not query:
        return []

    try:
        url = "https://api.duckduckgo.com/"
        params = {
            "q": query,
            "format": "json",
            "no_html": "1",
            "skip_disambig": "1"
        }
        headers = {
            "User-Agent": "HyperpixelAI/1.0 (+https://hyperpixel.example.com)"
        }

        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        result = response.json()

        search_results = []

        if result.get("Abstract"):
            search_results.append({
                "title": result.get("Heading", "Summary"),
                "content": result["Abstract"],
                "url": result.get("AbstractURL", ""),
                "source": result.get("AbstractSource", "DuckDuckGo")
            })

        if result.get("Definition"):
            search_results.append({
                "title": "Definition",
                "content": result["Definition"],
                "url": result.get("DefinitionURL", ""),
                "source": result.get("DefinitionSource", "DuckDuckGo")
            })

        if result.get("Answer"):
            answer_title = result.get("AnswerType") or "Answer"
            search_results.append({
                "title": answer_title.title(),
                "content": result["Answer"],
                "url": result.get("AnswerURL", ""),
                "source": "DuckDuckGo"
            })

        for item in result.get("Results", [])[:4]:
            if item.get("Text"):
                search_results.append({
                    "title": item.get("Title", item.get("FirstURL", "Result")),
                    "content": item["Text"],
                    "url": item.get("FirstURL", ""),
                    "source": "DuckDuckGo"
                })

        added = 0
        for topic in result.get("RelatedTopics", []):
            if added >= 4:
                break
            if topic.get("Text"):
                search_results.append({
                    "title": topic.get("FirstURL", "Related Topic").split('/')[-1] if topic.get("FirstURL") else "Related Topic",
                    "content": topic["Text"],
                    "url": topic.get("FirstURL", ""),
                    "source": "DuckDuckGo"
                })
                added += 1
            elif topic.get("Topics"):
                for subtopic in topic.get("Topics", [])[:2]:
                    if added >= 4:
                        break
                    if subtopic.get("Text"):
                        search_results.append({
                            "title": subtopic.get("FirstURL", "Related Topic").split('/')[-1] if subtopic.get("FirstURL") else "Related Topic",
                            "content": subtopic["Text"],
                            "url": subtopic.get("FirstURL", ""),
                            "source": "DuckDuckGo"
                        })
                        added += 1

        return search_results

    except Exception as e:
        print(f"Search error: {e}")
        return []

def format_search_results(results, timestamp=None):
    """Format search results for AI context"""
    if not results:
        return "No search results found."

    formatted = ""
    if timestamp:
        formatted += f"Search retrieved at: {timestamp}\n\n"

    for i, result in enumerate(results, 1):
        title = result.get('title', 'Result')
        content = result.get('content', '').strip()
        formatted += f"{i}. {title}\n"
        if content:
            formatted += f"   {content}\n"
        if result.get('source'):
            formatted += f"   Source: {result['source']}\n"
        if result.get('url'):
            formatted += f"   URL: {result['url']}\n"
        formatted += "\n"

    return formatted

def format_file_content(files):
    """Format uploaded file content for AI context"""
    if not files:
        return ""

    formatted = ""
    for file_info in files:
        formatted += f"File: {file_info['filename']}\n"
        formatted += f"Content:\n{file_info['content']}\n\n"

    return formatted

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    print("🚀  Starting Hyperpixel AI server...")
    print(f"🌐  Open http://localhost:{port} in your browser")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)