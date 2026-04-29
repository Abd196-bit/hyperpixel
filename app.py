import streamlit as st
from llama_cpp import Llama
import json

# Load your model
model_path = "models/blobs/sha256-2bada8a7450677000f678be90653b85d364de7db25eb5ea54136ada5f3933730"
llm = Llama(model_path=model_path, n_ctx=4096, verbose=False)

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