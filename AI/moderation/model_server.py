"""
Simple FastAPI model server for multi-label text moderation.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import uvicorn
import torch
import re
import unicodedata
from typing import List, Dict, Any
import numpy as np
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from torch.nn.functional import softmax as torch_softmax

# --- CONFIGURATION ---
LABELS = os.environ.get('MODERATION_LABELS')
if LABELS:
    LABELS = [l.strip() for l in LABELS.split(',') if l.strip()]
else:
    LABELS = ['spam', 'sexual', 'hate', 'violence', 'scam', 'political', 'other']

MODEL_PATH = os.environ.get('MODEL_PATH', 'vinai/phobert-base')
# Tự động chọn Device
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'

SENTIMENT_MODEL = os.environ.get('SENTIMENT_MODEL', 'wonrax/phobert-base-vietnamese-sentiment')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"^https?://(?:localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictRequest(BaseModel):
    text: str

# --- MODEL LOADING ---
print(f"Loading main model {MODEL_PATH} on {DEVICE} ...")
try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    # Lưu ý: Nếu model của bạn là Binary classification nhưng len(LABELS) > 2, cần check lại num_labels
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH, num_labels=len(LABELS), ignore_mismatched_sizes=True)
    model.to(DEVICE)
    model.eval()
    print(">>> Main Model loaded")
except Exception as e:
    print("Warning: failed to load main model:", e)
    tokenizer = None
    model = None


print(f"Loading sentiment model {SENTIMENT_MODEL} on {DEVICE} ...")
try:
    sent_tokenizer = AutoTokenizer.from_pretrained(SENTIMENT_MODEL)
    sent_model = AutoModelForSequenceClassification.from_pretrained(SENTIMENT_MODEL)
    sent_model.to(DEVICE)
    sent_model.eval()
    print(">>> Sentiment model loaded")
except Exception as e:
    print("Warning: failed to load sentiment model:", e)
    sent_tokenizer = None
    sent_model = None


# --- HELPER FUNCTIONS ---
def sigmoid(x):
    return 1 / (1 + np.exp(-x))

def sanitize_for_matching(text: str) -> str:
    if not text:
        return ''
    t = text.lower()
    t = t.replace('đ', 'd').replace('Đ', 'd')
    subs = {'@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', '$': 's', '+': 't'}
    for k, v in subs.items():
        t = t.replace(k, v)
    t = ''.join([c for c in unicodedata.normalize('NFKD', t) if not unicodedata.combining(c)])
    t = re.sub(r'[^a-z0-9\s]', '', t)
    return re.sub(r'\s+', ' ', t).strip()


def gambling_score_detection(text: str) -> float:
    if not text:
        return 0.0
    nt = text.lower()
    compact = sanitize_for_matching(text).replace(' ', '')
    score = 0.0
    
    # emoji/icons
    if re.search(r'[\U0001F3B2\U0001F3B0\U0001F4B0\U0001F4B8\U0001F0CF\U0001F3AF]', text):
        score = max(score, 0.8)
    
    # keywords
    kws = ['casino', 'slot', 'xổ số', 'xoso', 'cá cược', 'cacuoc', 'kèo', 'keo', 'kèo nhà cái', 'tỷ lệ', 'odds']
    for k in kws:
        if k in nt or k in compact:
            score = max(score, 0.85 if k in ('casino','slot','xổ số','xoso') else 0.85)
            
    # contact info + payment patterns
    if re.search(r'(?:(?:\+?84)|0)\s?\d{8,11}', text) or re.search(r'\b(zalo|fb|facebook|inbox|pm)\b', nt):
        score = max(score, 0.85)
        
    # odds or numeric patterns
    if re.search(r'\b\d{1,3}[:\-]\d{1,3}\b', text) or re.search(r'\b\d+(?:\.\d+)?k?\b', text, re.I):
        score = max(score, 0.7)
        
    return float(min(1.0, score))


def check_toxic_content(text: str) -> float:
    """Return a negative/toxic score between 0 and 1 using the sentiment model."""
    if not sent_model or not sent_tokenizer:
        return 0.0
    try:
        inputs = sent_tokenizer(text, return_tensors='pt', truncation=True, padding=True, max_length=256)
        inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = sent_model(**inputs)
            logits = outputs.logits
            probs = torch_softmax(logits, dim=1).cpu().numpy()[0]
        # Giả định: Model sentiment trả về [Negative, Positive, Neutral] hoặc tương tự
        # Lấy phần tử đầu tiên làm Negative score. Cần kiểm tra lại config của model cụ thể.
        negative_score = float(probs[0]) if len(probs) >= 1 else 0.0
        return negative_score
    except Exception as e:
        print(f"Error in check_toxic_content: {e}")
        return 0.0

# --- ROUTES ---

@app.post('/predict')
async def predict(req: PredictRequest):
    text = (req.text or '').strip()
    if not text:
        raise HTTPException(status_code=400, detail='text is required')

    # 1. Khởi tạo điểm mặc định cho tất cả nhãn là 0.0
    scores = {l: 0.0 for l in LABELS}

    # 2. Dự đoán bằng AI Model (Nếu model load thành công)
    if model is not None and tokenizer is not None:
        try:
            inputs = tokenizer(text, truncation=True, padding=True, max_length=256, return_tensors='pt')
            inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
            with torch.no_grad():
                outputs = model(**inputs)
                logits = outputs.logits.cpu().numpy()[0]
                probs = sigmoid(logits)

            # Cập nhật điểm từ Model
            for i in range(min(len(LABELS), len(probs))):
                scores[LABELS[i]] = float(probs[i])
        except Exception as e:
            print(f"Prediction error: {e}")
    g = gambling_score_detection(text)
    if g > 0.0:
        if 'spam' in scores:
            scores['spam'] = max(scores.get('spam', 0.0), float(g))
        if 'scam' in scores:
            scores['scam'] = max(scores.get('scam', 0.0), float(g * 0.8))

    labels_list = [{'label': k, 'score': v} for k, v in scores.items()]
    labels_list.sort(key=lambda x: x['score'], reverse=True)
    
    aggregate = float(max(scores.values())) if scores else 0.0

    return { 
        'labels': labels_list, 
        'scores': scores, 
        'aggregate': aggregate 
    }


@app.post('/sentiment')
async def sentiment(req: PredictRequest):
    """
    Return a simple sentiment/toxicity score.
    """
    text = (req.text or '').strip()
    if not text:
        raise HTTPException(status_code=400, detail='text is required')

    score = check_toxic_content(text)
    
    action = 'ok'
    if score >= 0.85:
        action = 'delete'
    elif score >= 0.6:
        action = 'review'

    return { 'negative_score': score, 'action': action }


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    uvicorn.run(app, host='0.0.0.0', port=port)