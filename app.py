import streamlit as st
from llama_cpp import Llama
import json
import os
from huggingface_hub import hf_hub_download

# Google Drive file ID (replace with your actual file ID)
GOOGLE_DRIVE_FILE_ID = os.environ.get('GOOGLE_DRIVE_FILE_ID', '1922Nup8QOSxa8JCE4oQitDt0sW3DncI6')

# Download model from Google Drive or use local path
@st.cache_resource
def load_model():
    # Try to use local path first
    local_path = "models/blobs/sha256-2bada8a7450677000f678be90653b85d364de7db25eb5ea54136ada5f3933730"
    if os.path.exists(local_path):
        return Llama(model_path=local_path, n_ctx=4096, verbose=False)
    
    # Download from Google Drive if file ID is provided
    if GOOGLE_DRIVE_FILE_ID:
        import gdown
        st.write("Downloading model from Google Drive...")
        model_file = "sha256-2bada8a7450677000f678be90653b85d364de7db25eb5ea54136ada5f3933730"
        gdown.download(f"https://drive.google.com/uc?id={GOOGLE_DRIVE_FILE_ID}", model_file, quiet=False)
        return Llama(model_path=model_file, n_ctx=4096, verbose=False)
    
    raise ValueError("Model not found locally and no Google Drive file ID provided")

llm = load_model()

def generate(system_prompt, messages):
    """Generate response from the model"""
    full_messages = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        full_messages.append({"role": "user", "content": msg})
    
    response = llm.create_chat_completion(
        messages=full_messages,
        temperature=0.7,
        max_tokens=1024
    )
    return response["choices"][0]["message"]["content"]

# API endpoint for external calls
if st.query_params.get("api"):
    system_prompt = st.query_params.get("system_prompt", "")
    messages_json = st.query_params.get("messages", "[]")
    messages = json.loads(messages_json)
    
    result = generate(system_prompt, messages)
    st.json({"response": result})
else:
    st.title("Hyperpixel AI Model")
    st.write("Model loaded and ready!")
    
    # Simple chat interface for testing
    system_prompt = st.text_area("System Prompt", value="You are a helpful assistant.")
    user_input = st.text_input("Your message")
    
    if st.button("Generate"):
        response = generate(system_prompt, [user_input])
        st.write(response)