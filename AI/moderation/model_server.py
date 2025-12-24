"""
Simple FastAPI model server for multi-label text moderation.
- Loads a Hugging Face transformer model (path or hub id from env VAR MODEL_PATH)
- Exposes POST /predict with JSON {"text": "..."}
- Returns JSON { labels: [{label, score}], scores: {label:score}, aggregate: <0-1> }

Note: This is a prototype. For production, add batching, auth, rate limiting, logging.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import uvicorn
import torch
from typing import List, Dict, Any

from transformers import AutoTokenizer, AutoModelForSequenceClassification
import numpy as np

LABELS = os.environ.get('MODERATION_LABELS')
if LABELS:
    LABELS = [l.strip() for l in LABELS.split(',') if l.strip()]
else:
    LABELS = ['spam','sexual','hate','violence','scam','political','other']

MODEL_PATH = os.environ.get('MODEL_PATH', 'vinai/phobert-base')
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'

app = FastAPI()

class PredictRequest(BaseModel):
    text: str


# Load model & tokenizer
print(f"Loading model {MODEL_PATH} on {DEVICE} ...")
try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH, num_labels=len(LABELS))
    model.to(DEVICE)
    model.eval()
    print("Model loaded")
except Exception as e:
    print("Warning: failed to load model:", e)
    tokenizer = None
    model = None


def sigmoid(x):
    return 1 / (1 + np.exp(-x))

@app.post('/predict')
async def predict(req: PredictRequest):
    text = (req.text or '').strip()
    if not text:
        raise HTTPException(status_code=400, detail='text is required')

    if model is None or tokenizer is None:
        # fallback: simple heuristic - zeros
        return { 'labels': [ { 'label': l, 'score': 0.0 } for l in LABELS ], 'scores': { l: 0.0 for l in LABELS }, 'aggregate': 0.0 }

    try:
        inputs = tokenizer(text, truncation=True, padding=True, return_tensors='pt')
        inputs = {k: v.to(DEVICE) for k,v in inputs.items()}
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits.cpu().numpy()[0]
            probs = sigmoid(logits)

        scores = { LABELS[i]: float(probs[i]) for i in range(min(len(LABELS), len(probs))) }
        labels = [ { 'label': k, 'score': v } for k,v in scores.items() ]
        aggregate = float(max(scores.values())) if scores else 0.0

        return { 'labels': labels, 'scores': scores, 'aggregate': aggregate }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    uvicorn.run('model_server:app', host='0.0.0.0', port=port, workers=1)
