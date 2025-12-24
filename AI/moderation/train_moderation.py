"""
Training script (prototype) to fine-tune a transformer for multi-label moderation.
Expect CSV with columns: text, labels
- labels: comma-separated list of label names (matching MODERATION_LABELS env or default set)

This script uses Hugging Face Trainer for simplicity.
"""
import os
import argparse
import pandas as pd
import numpy as np
from datasets import Dataset
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification, TrainingArguments, Trainer

DEFAULT_LABELS = ['spam','sexual','hate','violence','scam','political','other']

parser = argparse.ArgumentParser()
parser.add_argument('--data', required=True, help='CSV file with text and labels columns')
parser.add_argument('--model', default=os.environ.get('MODEL_PATH','vinai/phobert-base'))
parser.add_argument('--out', default='./models/moderation')
parser.add_argument('--epochs', type=int, default=3)
parser.add_argument('--batch_size', type=int, default=8)
args = parser.parse_args()

LABELS = os.environ.get('MODERATION_LABELS')
if LABELS:
    LABELS = [l.strip() for l in LABELS.split(',') if l.strip()]
else:
    LABELS = DEFAULT_LABELS

print('Labels:', LABELS)

# Load data
df = pd.read_csv(args.data)
if 'text' not in df.columns or 'labels' not in df.columns:
    raise SystemExit('CSV must contain text and labels columns')

# Convert labels to multi-hot
def to_multihot(lbls):
    if pd.isna(lbls):
        return [0]*len(LABELS)
    parts = [p.strip() for p in str(lbls).split(',') if p.strip()]
    arr = [1 if lab in parts else 0 for lab in LABELS]
    return arr

labels_arr = df['labels'].apply(to_multihot).tolist()

dataset = Dataset.from_pandas(df[['text']])
dataset = dataset.add_column('labels', labels_arr)

# Tokenize
tokenizer = AutoTokenizer.from_pretrained(args.model)

def preprocess(batch):
    toks = tokenizer(batch['text'], truncation=True, padding='max_length', max_length=256)
    toks['labels'] = batch['labels']
    return toks

dataset = dataset.map(preprocess, batched=True, remove_columns=['text'])

dataset.set_format(type='torch')

# Model
model = AutoModelForSequenceClassification.from_pretrained(args.model, num_labels=len(LABELS), problem_type='multi_label_classification')

training_args = TrainingArguments(
    output_dir=args.out,
    num_train_epochs=args.epochs,
    per_device_train_batch_size=args.batch_size,
    save_total_limit=2,
    evaluation_strategy='no',
    logging_steps=50,
    fp16=torch.cuda.is_available(),
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset,
)

trainer.train()
trainer.save_model(args.out)
print('Model saved to', args.out)
