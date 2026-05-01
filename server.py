from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
import json, os, threading, base64
import requests
import werkzeug
from datetime import datetime
import gdown

# ── Config ───────────────────────────────────────────────────────────────────
GOOGLE_DRIVE_FILE_ID = os.environ.get('GOOGLE_DRIVE_FILE_ID', '1A_VXnNlamJK_aKgbq8Oco7tC82LYvwJu')
MODEL_PATH = os.environ.get('MODEL_PATH', "/tmp/model.gguf")
LOCAL_MODEL_PATH = "/Volumes/GODBOTY/hyperpixel/models/blobs/sha256-2bada8a7450677000f678be90653b85d364de7db25eb5ea54136ada5f3933730"
USE_STREAMLIT = os.environ.get('USE_STREAMLIT', 'false').lower() == 'true'
SYSTEM_PROMPT = """You are Hyperpixel AI, a brilliant and friendly assistant who excels at coding, analysis, and conversation. Be concise, warm, and helpful. You were created by bilta studios.

CRITICAL INSTRUCTIONS:
1. Always use current web search results and uploaded file context when answering user queries.
2. When a user uploads files, you MUST analyze them thoroughly and incorporate their content into your response.
3. For code files: identify bugs, suggest improvements, explain what the code does, and provide refactored versions if needed.
4. For documents: summarize key points, extract important information, and answer questions about the content.
5. For images: describe what you see in detail.
6. For data files (CSV, JSON, etc.): analyze patterns, provide statistics, and suggest insights.
7. When search results are available, incorporate them directly with relevant details, sources, and links.
8. Always prefer the date/time supplied by the system context over any internal model knowledge cutoff.
9. Avoid guessing and clearly cite the information you use.

When files are uploaded, start your response by acknowledging what files were received, then provide your detailed analysis."""
HTML_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=HTML_DIR)
CORS(app)

# ── Load model once at startup ────────────────────────────────────────────────
ai = None
model_error = None

def load_model():
    global ai, model_error
    try:
        # Use local model if it exists (for development)
        if os.path.exists(LOCAL_MODEL_PATH):
            model_file = LOCAL_MODEL_PATH
            print("📁 Using local model")
        # Download from Google Drive if model doesn't exist
        elif not os.path.exists(MODEL_PATH):
            print(f"📥 Downloading model from Google Drive (ID: {GOOGLE_DRIVE_FILE_ID})...")
            os.makedirs(os.path.dirname(MODEL_PATH) or '.', exist_ok=True)
            gdown.download(f"https://drive.google.com/uc?id={GOOGLE_DRIVE_FILE_ID}", MODEL_PATH, quiet=False)
            model_file = MODEL_PATH
            print("✅ Model downloaded successfully")
        else:
            model_file = MODEL_PATH
            print("📁 Using cached model")
        
        from llama_cpp import Llama
        ai = Llama(
            model_path=model_file,
            n_ctx=4096,
            n_gpu_layers=0,  # No GPU on Render free tier
            verbose=False,
        )
        print("✅  Hyperpixel AI model loaded")
    except Exception as e:
        model_error = str(e)
        print(f"❌  Model load failed: {e}")

# Load model in background thread
threading.Thread(target=load_model, daemon=True).start()

# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(HTML_DIR, "hyperpixel.html")

@app.route("/style.css")
def style_css():
    return send_from_directory(HTML_DIR, "style.css")

@app.route("/script.js")
def script_js():
    return send_from_directory(HTML_DIR, "script.js")

@app.route("/status")
def status():
  if ai:
    return jsonify({"ready": True, "provider": "Local"})
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
        file_size = os.path.getsize(file_path)
        content = ""
        file_type = "binary"
        
        # Text files
        if filename.lower().endswith(('.txt', '.md', '.py', '.js', '.html', '.css', '.json', '.xml', '.yaml', '.yml', '.csv', '.ts', '.jsx', '.tsx', '.vue', '.php', '.rb', '.java', '.c', '.cpp', '.h', '.go', '.rs', '.swift', '.kt')):
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                file_type = "code/text"
                if filename.lower().endswith('.csv'):
                    file_type = "csv"
                elif filename.lower().endswith(('.py', '.js', '.html', '.css', '.json')):
                    file_type = "code"
        # Images
        elif filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg')):
            content = f"[Image file: {filename}, size: {file_size} bytes. Image analysis available.]"
            file_type = "image"
        # Documents
        elif filename.lower().endswith(('.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx')):
            content = f"[Document file: {filename}, size: {file_size} bytes. Document content extraction not available in basic mode.]"
            file_type = "document"
        # Archives
        elif filename.lower().endswith(('.zip', '.tar', '.gz', '.rar', '.7z')):
            content = f"[Archive file: {filename}, size: {file_size} bytes]"
            file_type = "archive"
        else:
            content = f"File uploaded: {filename} (size: {file_size} bytes, type: {file_type})"
            file_type = "other"

        return jsonify({
            "filename": filename,
            "content": content[:5000],  # Limit content size
            "file_type": file_type,
            "file_size": file_size,
            "message": f"File '{filename}' uploaded successfully ({file_type})"
        })
    except Exception as e:
        return jsonify({"error": f"Failed to process file: {str(e)}"}), 500

def detect_image_request(text):
    """Detect if user is asking for an image generation"""
    import re
    image_keywords = [
        r'generate\s+(?:an?\s+)?image',
        r'create\s+(?:an?\s+)?image',
        r'make\s+(?:an?\s+)?image',
        r'draw\s+(?:an?\s+)?',
        r'show\s+me\s+(?:an?\s+)?(?:picture|image|photo)',
        r'can\s+you\s+(?:draw|generate|create)\s+(?:an?\s+)?image',
        r'visualize',
        r'illustrate',
        r'render\s+(?:an?\s+)?image',
        r'produce\s+(?:an?\s+)?image'
    ]
    
    text_lower = text.lower()
    for pattern in image_keywords:
        if re.search(pattern, text_lower):
            # Extract the image description (everything after the keyword)
            match = re.search(pattern + r'\s+(?:of\s+)?(.+)', text_lower, re.IGNORECASE)
            if match:
                return match.group(1).strip()
            # If no specific pattern match, return the whole text minus the keyword
            return re.sub(pattern, '', text_lower, flags=re.IGNORECASE).strip()
    return None

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    messages = data.get("messages", [])
    files = data.get("files", [])

    # Check if user is requesting an image
    user_message = messages[-1].get("content", "") if messages else ""
    image_prompt = detect_image_request(user_message)
    
    if image_prompt and len(image_prompt) > 3:
        # User wants an image - generate it
        def generate_image_response():
            try:
                yield f"data: {json.dumps({'text': "I'll generate that image for you...\\n\\n"})}\n\n"
                
                # Call Pollinations AI
                encoded_prompt = requests.utils.quote(image_prompt[:500])  # Limit prompt length
                image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true&seed={hash(image_prompt) % 10000}"
                
                response = requests.get(image_url, timeout=180)
                response.raise_for_status()
                image_base64 = base64.b64encode(response.content).decode('utf-8')
                
                yield f"data: {json.dumps({'image': f'data:image/png;base64,{image_base64}', 'prompt': image_prompt})}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'text': f"Sorry, I couldn't generate that image: {str(e)}"})}\n\n"
                yield "data: [DONE]\n\n"
        
        return Response(generate_image_response(), mimetype="text/event-stream",
                        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    # Use local model for text response
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
            # Enhanced time accuracy with local and UTC time
            utc_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            local_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S %Z")
            day_of_week = datetime.now().strftime("%A")
            context_parts.append(f"Current time - UTC: {utc_time} | Local: {local_time} | Day: {day_of_week}")

            if search_results:
                search_time = utc_time
                search_context = format_search_results(search_results, search_time)
                context_parts.append(f"Current web search results for context (retrieved at {search_time}):\n{search_context}")

            if files:
                file_context = format_file_content(files)
                context_parts.append(f"Uploaded files for context:\n{file_context}")

            # Add learned facts if provided
            learned_facts = data.get('learned_facts', [])
            if learned_facts:
                facts_context = "User's learned facts (verified information):\n"
                for fact in learned_facts[:10]:  # Limit to top 10 facts
                    facts_context += f"- {fact.get('fact', '')} (confidence: {fact.get('confidence', 0):.2f})\n"
                context_parts.append(facts_context)

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

def verify_fact_with_duckduckgo(fact):
    """Verify a fact using DuckDuckGo search"""
    try:
        url = "https://api.duckduckgo.com/"
        params = {
            "q": fact,
            "format": "json",
            "no_html": 1,
            "skip_disambig": 0
        }
        headers = {
            "User-Agent": "HyperpixelAI/1.0 (+https://hyperpixel.example.com)"
        }
        
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        result = response.json()
        
        verification_result = {
            "fact": fact,
            "verified": False,
            "confidence": 0.0,
            "sources": [],
            "summary": ""
        }
        
        # Check if there's relevant information
        if result.get("Abstract"):
            verification_result["verified"] = True
            verification_result["confidence"] = 0.8
            verification_result["sources"].append({
                "title": result.get("Heading", "Summary"),
                "url": result.get("AbstractURL", ""),
                "content": result["Abstract"][:500]
            })
            verification_result["summary"] = result["Abstract"][:300]
        
        if result.get("Answer"):
            verification_result["verified"] = True
            verification_result["confidence"] = min(verification_result["confidence"] + 0.2, 1.0)
            verification_result["sources"].append({
                "title": "Direct Answer",
                "content": result["Answer"][:300]
            })
        
        return verification_result
        
    except Exception as e:
        print(f"Fact verification error: {e}")
        return {
            "fact": fact,
            "verified": False,
            "confidence": 0.0,
            "sources": [],
            "summary": "Verification failed due to error"
        }

@app.route('/verify_fact', methods=['POST'])
def verify_fact():
    """Verify a fact before storing in memory"""
    try:
        data = request.json
        fact = data.get('fact', '')
        
        if not fact:
            return jsonify({"error": "No fact provided"}), 400
        
        verification = verify_fact_with_duckduckgo(fact)
        return jsonify(verification)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/learn', methods=['POST'])
def learn_from_interaction():
    """Store learned information after fact verification"""
    try:
        data = request.json
        user_id = data.get('user_id')
        fact = data.get('fact')
        context = data.get('context', '')
        verification = data.get('verification', {})
        
        if not user_id or not fact:
            return jsonify({"error": "Missing required fields"}), 400
        
        # Only store if fact is verified with high confidence
        if verification.get('verified', False) and verification.get('confidence', 0) >= 0.7:
            learned_info = {
                "fact": fact,
                "context": context,
                "verification": verification,
                "learned_at": datetime.utcnow().isoformat(),
                "confidence": verification.get('confidence', 0)
            }
            
            # Store in Firebase (this would be done client-side with Firebase SDK)
            # For now, return the data to be stored
            return jsonify({
                "success": True,
                "learned": learned_info,
                "message": "Fact verified and stored in memory"
            })
        else:
            return jsonify({
                "success": False,
                "message": "Fact could not be verified with sufficient confidence"
            })
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
    """Format uploaded file content for AI context with enhanced analysis support"""
    if not files:
        return ""

    formatted = "UPLOADED FILES FOR ANALYSIS:\n"
    formatted += "=" * 50 + "\n\n"
    
    for i, file_info in enumerate(files, 1):
        filename = file_info.get('filename', f'file_{i}')
        content = file_info.get('content', '')
        file_type = file_info.get('file_type', 'unknown')
        file_size = file_info.get('file_size', 0)
        
        formatted += f"[{i}] FILE: {filename}\n"
        formatted += f"    Type: {file_type}\n"
        formatted += f"    Size: {file_size} bytes\n"
        formatted += f"    Content:\n"
        
        # Add content with proper indentation
        content_lines = content.split('\n') if content else []
        for line in content_lines[:100]:  # Limit to 100 lines per file
            formatted += f"    {line}\n"
        
        if len(content_lines) > 100:
            formatted += f"    ... ({len(content_lines) - 100} more lines)\n"
        
        formatted += "\n" + "-" * 50 + "\n\n"
    
    formatted += "END OF UPLOADED FILES\n"
    formatted += "Please analyze these files and provide insights, suggestions, or answer questions about them."
    
    return formatted

@app.route('/generate-image', methods=['POST'])
def generate_image():
    """Generate image using Pollinations AI"""
    try:
        data = request.json
        prompt = data.get('prompt', '')
        width = data.get('width', 1024)
        height = data.get('height', 1024)
        seed = data.get('seed', None)
        
        if not prompt:
            return jsonify({"error": "No prompt provided"}), 400
        
        # Build Pollinations URL
        encoded_prompt = requests.utils.quote(prompt)
        image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&nologo=true"
        if seed:
            image_url += f"&seed={seed}"
        
        # Download the image
        response = requests.get(image_url, timeout=60)
        response.raise_for_status()
        
        # Return the image as base64 or direct URL
        image_base64 = base64.b64encode(response.content).decode('utf-8')
        
        return jsonify({
            "success": True,
            "image_url": image_url,
            "image_data": f"data:image/png;base64,{image_base64}",
            "prompt": prompt,
            "width": width,
            "height": height
        })
        
    except Exception as e:
        return jsonify({"error": f"Image generation failed: {str(e)}"}), 500

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5500))
    print("🚀  Starting Hyperpixel AI server...")
    print(f"🌐  Open http://localhost:{port} in your browser")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)