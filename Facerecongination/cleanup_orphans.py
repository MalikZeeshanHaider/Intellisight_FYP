"""Delete orphan FaceEmbeddings rows (no Student_ID and no Teacher_ID)."""
import sys
if sys.platform == 'win32':
    try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

import psycopg2
from config import DB_CONFIG, EMBEDDINGS_FILE
import os, json

conn = psycopg2.connect(**DB_CONFIG)
with conn.cursor() as cur:
    cur.execute('SELECT COUNT(*) FROM "FaceEmbeddings"')
    before = cur.fetchone()[0]
    cur.execute('DELETE FROM "FaceEmbeddings" WHERE "Student_ID" IS NULL AND "Teacher_ID" IS NULL')
    deleted = cur.rowcount
    cur.execute('SELECT COUNT(*) FROM "FaceEmbeddings"')
    after = cur.fetchone()[0]
conn.commit()
conn.close()

# Reset JSON cache to a valid empty array
os.makedirs(os.path.dirname(EMBEDDINGS_FILE), exist_ok=True)
with open(EMBEDDINGS_FILE, 'w') as f:
    json.dump([], f)

print(f"FaceEmbeddings: {before} → {after} (deleted {deleted} orphan row(s))")
print(f"JSON cache reset → {EMBEDDINGS_FILE}")
