import os
import re
import uvicorn
import torch
import unicodedata
import numpy as np
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from torch.nn.functional import softmax

# --- SETUP DEVICE & CONFIG ---
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Running on device: {DEVICE}")

MODEL_PATH = os.environ.get('MODEL_PATH', 'vinai/phobert-base') 

LABELS_ENV = os.environ.get('MODERATION_LABELS')
if LABELS_ENV:
    LABELS = [l.strip() for l in LABELS_ENV.split(',') if l.strip()]
else:
    LABELS = ['spam', 'sexual', 'hate', 'violence', 'scam', 'political', 'profanity', 'advertisement', 'other']

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


# --- HELPERS ---
def load_wordlist(fname: str):
    try:
        base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data'))
        path = os.path.join(base, fname)
        if not os.path.exists(path):
            return []
        with open(path, 'r', encoding='utf-8') as f:
            return [l.strip().lower() for l in f if l.strip() and not l.startswith('#')]
    except Exception:
        return []

BLACKLIST = load_wordlist('blacklist.txt')

def normalize_text(text: str) -> str:
    if not text:
        return ''
    text = text.lower()
    text = unicodedata.normalize('NFKD', text)
    text = ''.join([c for c in text if not unicodedata.combining(c)])
    text = text.replace('.', '')
    text = re.sub(r'(.)\1{2,}', r"\1\1", text)
    return text

def sanitize_for_matching(text: str) -> str:
    """Prepare text for robust matching against blacklist entries."""
    t = text.lower()
    # map Vietnamese special letter đ -> d
    t = t.replace('đ', 'd').replace('Đ', 'd')
    # common leets/substitutions
    subs = {
        '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i',
        '0': 'o', '$': 's', '+': 't', '*': '', '#': '', '%': '',
    }
    for k, v in subs.items():
        t = t.replace(k, v)

    # remove diacritics
    t = unicodedata.normalize('NFKD', t)
    t = ''.join([c for c in t if not unicodedata.combining(c)])

    # remove non alphanumeric characters
    t = re.sub(r'[^a-z0-9\s]', '', t)
    # collapse whitespace
    t = re.sub(r'\s+', ' ', t).strip()
    # also return a compact version without spaces for substring matching
    compact = t.replace(' ', '')
    return compact

# --- SCORING FUNCTIONS ---

def profanity_score_from_blacklist(text: str) -> float:
    if not BLACKLIST:
        return 0.0
    nt = normalize_text(text)
    matches = 0
    compact = sanitize_for_matching(text)
    for w in BLACKLIST:
        try:
            if re.search(r'\b' + re.escape(w) + r'\b', nt):
                matches += 1
                continue
            w_s = sanitize_for_matching(w)
            if w_s and w_s in compact:
                matches += 1
        except re.error:
            continue
    score = min(1.0, matches * 0.33)
    return float(score)

def ad_score_detection(text: str) -> float:
    nt = normalize_text(text)
    score = 0.0
    if re.search(r'https?://|www\.|@gmail\.|\.com', text, re.I):
        score = max(score, 0.9)
    if re.search(r'(?:(?:\+?84)|0)\s?\d{8,11}', text):
        score = max(score, 0.85)
    keywords = ['mua', 'ban', 'bán', 'khuyến mại', 'giao hang', 'ship', 'lienhe', 'liên hệ', 'zalo', 'fb', 'facebook']
    for k in keywords:
        if k in nt:
            score = max(score, 0.6)
    return float(score)

def gambling_score_detection(text: str) -> float:
    """ Detect gambling-related spam even when obfuscated. """
    if not text:
        return 0.0
    nt = normalize_text(text)
    compact = sanitize_for_matching(text)

    score = 0.0

    # 1) emoji / icon indicators
    if re.search(r'[\U0001F3B2\U0001F3B0\U0001F4B0\U0001F4B5\U0001F4B8\U0001F0CF\U0001F3AF\u2605\u2696\u2606\u25B2]', text):
        score = max(score, 0.8)

    # 2) common gambling keywords
    keywords = [
        'casino', 'slot', 'xổ số', 'xoso', 'cá cược', 'ca cuoc', 'keo', 'kèo', 'kèo nhà cái', 'kèo thơm',
        'tỷ lệ', 'tỷ', 'ty le', 'odds', 'đặt cược', 'dat cuoc', 'cược', 'cuoc', 'thắng', 'thua',
        'nạp', 'rút', 'nap tien', 'rut tien', 'rút', 'rút tiền', 'thưởng', 'khuyến mãi', 'khuyếnmai', 'khuyen mai'
    ]
    for k in keywords:
        if k in nt:
            score = max(score, 0.85 if k in ('casino','slot','xổ số','xoso') else 0.75)

    # 3) obfuscated substring matches
    obfs = ['cacuoc', 'datcuoc', 'cuoc', 'keo', 'xoso', 'slot', 'casino']
    for w in obfs:
        if w in compact:
            score = max(score, 0.8)

    # 4) patterns: odds
    if re.search(r'\b\d{1,3}[:\-]\d{1,3}\b', text) or re.search(r'\b\d+(?:\.\d+)?k?v?n?\b', text, re.I):
        score = max(score, 0.7)

    # 5) contact channel indicators
    if re.search(r'(?:(?:\+?84)|0)\s?\d{8,11}', text) or re.search(r'\b(zalo|fb|facebook|inbox|pm|liên hệ|lienhe)\b', nt):
        score = max(score, 0.85)

    # 6) many short-lines (obfuscation)
    lines = [l for l in text.splitlines() if l.strip()]
    if len(lines) >= 3 and sum(1 for l in lines if len(sanitize_for_matching(l)) < 6) >= 2:
        score = max(score, 0.6)

    return float(min(1.0, score))

def heuristics_scores(text: str) -> Dict[str, float]:
    return {
        'profanity': profanity_score_from_blacklist(text),
        'advertisement': ad_score_detection(text),
        'gambling': gambling_score_detection(text)
    }

# --- MODEL LOADING ---
print(f"Loading main model {MODEL_PATH}...")
try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_PATH, 
        num_labels=len(LABELS),
        ignore_mismatched_sizes=True 
    )
    model.to(DEVICE)
    model.eval()
    print(">>> Main Model loaded successfully.")
except Exception as e:
    print(f"Warning: Failed to load main model ({MODEL_PATH}). /predict will return defaults. Error: {e}")
    tokenizer = None
    model = None

print(f"Loading sentiment model {SENTIMENT_MODEL}...")
try:
    sent_tokenizer = AutoTokenizer.from_pretrained(SENTIMENT_MODEL)
    sent_model = AutoModelForSequenceClassification.from_pretrained(SENTIMENT_MODEL)
    sent_model.to(DEVICE)
    sent_model.eval()
    print(">>> Sentiment Model loaded successfully.")
except Exception as e:
    print(f"Warning: Failed to load sentiment model. Error: {e}")
    sent_tokenizer = None
    sent_model = None


def check_toxic_content(text: str) -> float:
    """
    Trả về điểm tiêu cực (0.0 -> 1.0) sử dụng sentiment model.
    """
    if not sent_model or not sent_tokenizer:
        return 0.0
    
    try:
        inputs = sent_tokenizer(text, return_tensors='pt', truncation=True, padding=True, max_length=256)
        inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
        
        with torch.no_grad():
            outputs = sent_model(**inputs)
            probs = softmax(outputs.logits, dim=1)
        probs_np = probs.cpu().numpy()[0]

        negative_score = float(probs_np[0])
        return negative_score

    except Exception as e:
        print(f"Error in check_toxic_content: {e}")
        return 0.0

# --- ROUTES ---

@app.post('/predict')
async def predict(req: PredictRequest):
    text = (req.text or '').strip()
    if not text:
        return {'error': 'text is required'}
    
    # 1. Tính điểm Heuristics
    heur = heuristics_scores(text)
    scores = {l: 0.0 for l in LABELS}
    
    if model is not None and tokenizer is not None:
        try:
            inputs = tokenizer(text, truncation=True, padding=True, max_length=256, return_tensors='pt')
            inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = model(**inputs)
                probs = torch.sigmoid(outputs.logits).cpu().numpy()[0]

            for i in range(min(len(LABELS), len(probs))):
                scores[LABELS[i]] = float(probs[i])
        except Exception as e:
            print(f"Model prediction error: {e}")
    else:
        # Nếu không có model, chỉ dùng heuristics
        pass

    # 3. Gộp điểm Heuristics vào điểm Model
    for k, v in heur.items():
        if k in scores:
            scores[k] = max(scores.get(k, 0.0), float(v))
    g = heur.get('gambling', 0.0)
    if g > 0.0:
        if 'spam' in scores:
            scores['spam'] = max(scores.get('spam', 0.0), float(g))
        if 'scam' in scores:
            scores['scam'] = max(scores.get('scam', 0.0), float(g * 0.8))

    # 5. Sắp xếp và trả về
    labels = sorted([{'label': k, 'score': v} for k, v in scores.items()], key=lambda x: x['score'], reverse=True)
    aggregate = float(max(scores.values())) if scores else 0.0

    return {
        'labels': labels, 
        'scores': scores, 
        'aggregate': aggregate,
        'used_model': (model is not None)
    }


@app.post('/sentiment')
async def sentiment(req: PredictRequest):
    text = (req.text or '').strip()
    if not text:
        raise HTTPException(status_code=400, detail='text is required')

    score = check_toxic_content(text)
    heur = heuristics_scores(text)

    action = 'ok'
    if score >= 0.75 or heur.get('profanity', 0.0) >= 0.75:
        action = 'delete'
    elif score >= 0.60 or heur.get('profanity', 0.0) >= 0.6:
        action = 'review'

    return {
        'text_snippet': text[:50],
        'negative_score': score,
        'heuristics': heur,
        'action': action
    }

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    uvicorn.run(app, host='0.0.0.0', port=port)