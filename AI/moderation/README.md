Model server & training prototype

1) Install Python deps

```powershell
cd AI/moderation
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2) Train (example)

Prepare CSV with columns `text` and `labels` (labels comma-separated). Then:

```powershell
python train_moderation.py --data path\to\labeled.csv --out ./models/moderation --epochs 2
```

3) Run model server

```powershell
$env:MODEL_PATH = './models/moderation' # or use hub name
python model_server.py
# server listens on 0.0.0.0:8000 by default
```

4) Enable calling from Node AI module

Set env var in your app or .env: `MODERATION_MODEL_SERVER=true` and `MODERATION_MODEL_SERVER_URL=http://127.0.0.1:8000/predict`.

Notes:
- This is a prototype. For production, add batching, authentication, monitoring, and model versioning.
