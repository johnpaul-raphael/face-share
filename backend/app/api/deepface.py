import os
import shutil
import uuid
import logging
import numpy as np
from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from deepface import DeepFace
import pandas as pd

router = APIRouter()
logger = logging.getLogger(__name__)

# Fast batch mode: SFace is fastest (~0.01s/face); Facenet also fast. VGG-Face is slowest.
FAST_MODEL = "SFace"
FAST_MODEL_THRESHOLD = 0.55  # SFace cosine default 0.593; lower = stricter
BATCH_SIZE = 12  # Process this many photos per represent() call

# 1. PATHS - Update these to your actual folder names
# This folder should have subfolders like /dataset/john/pic1.jpg
KNOWN_FACES_DB = "D:/JOHNPAUL/learning/learn-ai/dataset" 
# This folder contains your 10 unknown event photos
UNKNOWN_EVENT_PHOTOS = "D:/JOHNPAUL/learning/learn-ai/event_uploads" 

# Configuration
DB_PATH = "./dataset"  # Where user registration photos live
UPLOAD_PATH = "./event_uploads"

# Ensure directories exist
os.makedirs(DB_PATH, exist_ok=True)
os.makedirs(UPLOAD_PATH, exist_ok=True)

@router.post("/register-user/{user_id}")
async def register_user(user_id: str, file: UploadFile = File(...)):
    """
    Step 1: User signs up and uploads 1-3 reference photos.
    Save these into a folder named after the user_id.
    """
    user_folder = os.path.join(DB_PATH, user_id)
    os.makedirs(user_folder, exist_ok=True)
    
    file_path = os.path.join(user_folder, f"{uuid.uuid4()}.jpg")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"message": f"User {user_id} registered successfully."}

def process_and_match(event_photo_path: str):
    """
    The heavy lifter: Scans an event photo for all registered users.
    """
    try:
        # DeepFace.find looks for faces in event_photo_path 
        # that match any identity in the DB_PATH
        results = DeepFace.find(
            img_path=event_photo_path,
            db_path=DB_PATH,
            model_name="VGG-Face", # Fast and decent accuracy
            enforce_detection=False,
            detector_backend="opencv" # Fastest for POC
        )

        for df in results:
            if not df.empty:
                # df['identity'] contains the path to the matching reference photo
                # e.g., './dataset/user_1/unique_id.jpg'
                for match in df['identity']:
                    matched_user_id = match.split(os.sep)[-2] 
                    print(f"MATCH FOUND: Photo {event_photo_path} belongs to {matched_user_id}")
                    # Here you would: Update Postgres: photo_id -> matched_user_id
                    
    except Exception as e:
        print(f"Processing Error: {e}")

@router.post("/upload-event-photo/")
async def upload_event_photo(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Step 2: Upload 100 photos. Each one triggers a background recognition task.
    """
    file_path = os.path.join(UPLOAD_PATH, f"{uuid.uuid4()}.jpg")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Run recognition in the background so the user doesn't wait
    background_tasks.add_task(process_and_match, file_path)
    
    return {"status": "Photo received. Analyzing in background..."}

@router.post("/trigger-batch-scan")
async def trigger_scan(background_tasks: BackgroundTasks, sync: bool = False):
    """
    Scan event photos against known faces. Use ?sync=true to run synchronously
    and get results in the response (request may take 1-2 min). Default runs in background.
    """
    # Check if folders exist
    if not os.path.exists(UNKNOWN_EVENT_PHOTOS):
        logger.warning("Event photos folder not found: %s", UNKNOWN_EVENT_PHOTOS)
        return {"error": f"Folder {UNKNOWN_EVENT_PHOTOS} not found", "photos_found": 0}

    if not os.path.exists(KNOWN_FACES_DB):
        logger.warning("Known faces DB not found: %s", KNOWN_FACES_DB)
        return {"error": f"Dataset folder {KNOWN_FACES_DB} not found", "photos_found": 0}

    unknown_files = [
        f for f in os.listdir(UNKNOWN_EVENT_PHOTOS)
        if f.lower().endswith(('.png', '.jpg', '.jpeg'))
    ]

    if not unknown_files:
        logger.info("No photos in %s", UNKNOWN_EVENT_PHOTOS)
        return {"message": "No photos found in the unknown folder.", "photos_found": 0}

    if sync:
        # Fast path: batch represent() + cached embeddings for speed
        known = _build_known_embeddings(KNOWN_FACES_DB)
        if not known:
            return {"results": [], "matches": [], "unmatched": unknown_files, "note": "No known faces in dataset."}
        results_all = []
        matches_out = []
        unmatched_out = []
        # Process in batches to reduce represent() calls
        for i in range(0, len(unknown_files), BATCH_SIZE):
            chunk = unknown_files[i : i + BATCH_SIZE]
            batch = [(name, os.path.join(UNKNOWN_EVENT_PHOTOS, name)) for name in chunk]
            batch_results = _process_batch_fast(batch, known, FAST_MODEL_THRESHOLD)
            for photo_name, matched in batch_results:
                results_all.append({"photo": photo_name, "matched_users": matched})
                if matched:
                    matches_out.append({"photo": photo_name, "matched_users": matched})
                else:
                    unmatched_out.append(photo_name)
        return {"results": results_all, "matches": matches_out, "unmatched": unmatched_out}

    # Background mode (uses fast path: cached embeddings + Facenet)
    known = _build_known_embeddings(KNOWN_FACES_DB)
    if known:
        for photo_name in unknown_files:
            full_path = os.path.join(UNKNOWN_EVENT_PHOTOS, photo_name)
            background_tasks.add_task(process_recognition_fast, full_path, known, FAST_MODEL_THRESHOLD)
    logger.info("Triggered batch scan for %d photos (fast mode)", len(unknown_files))
    return {
        "message": f"Processing {len(unknown_files)} photos in the background.",
        "photos_found": len(unknown_files),
    }


# Stricter threshold to reduce false positives (default VGG-Face cosine is 0.68)
MATCH_THRESHOLD = 0.35

# In-memory cache: list of (identity, embedding) for known faces
_known_cache: list[tuple[str, np.ndarray]] | None = None
_cache_db_mtime: float = 0
_cache_model: str = ""


def _collect_known_images(db_path: str) -> list[tuple[str, str]]:
    """Return [(identity, absolute_path), ...] for all images in dataset."""
    result = []
    db_name = os.path.basename(os.path.normpath(db_path))
    for root, _, files in os.walk(db_path):
        for f in files:
            if f.lower().endswith((".png", ".jpg", ".jpeg")):
                full = os.path.join(root, f)
                rel = os.path.relpath(root, db_path)
                identity = rel if rel != "." else os.path.splitext(f)[0]
                result.append((identity, full))
    return result


def _build_known_embeddings(db_path: str) -> list[tuple[str, np.ndarray]]:
    """Pre-compute embeddings for all known faces once. Reuse for 500 photos."""
    global _known_cache, _cache_db_mtime, _cache_model
    mtime = os.path.getmtime(db_path) if os.path.exists(db_path) else 0
    if _known_cache is not None and _cache_db_mtime == mtime and _cache_model == FAST_MODEL:
        return _known_cache
    items = _collect_known_images(db_path)
    if not items:
        _known_cache = []
        return []
    cache = []
    for identity, path in items:
        try:
            objs = DeepFace.represent(
                img_path=path,
                model_name=FAST_MODEL,
                enforce_detection=False,
                detector_backend="opencv",
                align=True,
            )
            for obj in objs:
                emb = np.array(obj["embedding"], dtype=np.float32)
                cache.append((identity, emb))
        except Exception as e:
            logger.warning("Skip %s: %s", path, e)
    _known_cache = cache
    _cache_db_mtime = mtime
    _cache_model = FAST_MODEL
    logger.info("Built embeddings cache: %d known faces (%s)", len(cache), FAST_MODEL)
    return cache


def _cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine distance 0..2 (0 = identical)."""
    a = np.asarray(a, dtype=np.float32).flatten()
    b = np.asarray(b, dtype=np.float32).flatten()
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na < 1e-9 or nb < 1e-9:
        return 2.0
    return 1.0 - float(np.dot(a, b) / (na * nb))


def _embeddings_to_matches(objs: list, known: list[tuple[str, np.ndarray]], threshold: float) -> list[str]:
    """Compare face embeddings against known cache; return matched identities."""
    matches = []
    for obj in objs:
        q = np.array(obj["embedding"], dtype=np.float32)
        for identity, ref in known:
            if identity in matches:
                continue
            if _cosine_distance(q, ref) <= threshold:
                matches.append(identity)
    return matches


def process_recognition_fast(image_path: str, known: list[tuple[str, np.ndarray]], threshold: float) -> dict:
    """Fast path: represent() once, compare with cached embeddings."""
    try:
        objs = DeepFace.represent(
            img_path=image_path,
            model_name=FAST_MODEL,
            enforce_detection=False,
            detector_backend="opencv",
            align=False,  # Slightly faster
        )
        matched = _embeddings_to_matches(objs, known, threshold)
        return {"status": "ok", "matched_users": matched}
    except Exception as e:
        logger.exception("Error processing %s: %s", image_path, e)
        return {"status": "error", "error": str(e), "matched_users": []}


def _process_batch_fast(
    batch: list[tuple[str, str]], known: list[tuple[str, np.ndarray]], threshold: float
) -> list[tuple[str, list[str]]]:
    """Process multiple photos in one represent() call. Returns [(photo_name, matched_users), ...]."""
    paths = [p for _, p in batch]
    names = [n for n, _ in batch]
    results: list[tuple[str, list[str]]] = []
    try:
        batch_out = DeepFace.represent(
            img_path=paths,
            model_name=FAST_MODEL,
            enforce_detection=False,
            detector_backend="opencv",
            align=False,
        )
        # represent(list) returns List[List[Dict]] - one list per input image
        out_list = batch_out if isinstance(batch_out, list) else [batch_out]
        for i, face_list in enumerate(out_list):
            photo_name = names[i] if i < len(names) else str(i)
            faces = face_list if isinstance(face_list, list) else [face_list] if face_list else []
            matched = _embeddings_to_matches(faces, known, threshold)
            results.append((photo_name, matched))
    except Exception as e:
        logger.warning("Batch represent failed, falling back to per-image: %s", e)
        for name, path in batch:
            out = process_recognition_fast(path, known, threshold)
            results.append((name, out.get("matched_users") or []))
    return results


def process_recognition(image_path: str) -> dict:
    """Run face recognition on one image. Returns dict with status and matches."""
    logger.info("Analyzing photo: %s", image_path)
    matches = []
    try:
        results = DeepFace.find(
            img_path=image_path,
            db_path=KNOWN_FACES_DB,
            model_name="VGG-Face",
            distance_metric="cosine",
            enforce_detection=False,
            detector_backend="opencv",
            threshold=MATCH_THRESHOLD,
        )
        for df in results:
            if not df.empty:
                # Filter by actual distance (column name varies: 'distance' or 'VGG-Face_cosine')
                dist_cols = [c for c in df.columns if "cosine" in c.lower() or c == "distance"]
                dist_col = dist_cols[0] if dist_cols else None
                if dist_col:
                    df = df[df[dist_col] <= MATCH_THRESHOLD]
                for _, row in df.iterrows():
                    match_path = str(row["identity"])
                    # Identity: subfolder name if db has identity folders, else filename (no ext)
                    norm_path = match_path.replace("/", os.sep)
                    parts = norm_path.split(os.sep)
                    db_name = os.path.basename(os.path.normpath(KNOWN_FACES_DB))
                    parent = parts[-2] if len(parts) > 1 else ""
                    user_name = os.path.splitext(parts[-1])[0] if parent == db_name else parent
                    if user_name not in matches:
                        matches.append(user_name)
                        logger.info("MATCH: %s -> %s", os.path.basename(image_path), user_name)
            else:
                logger.info("No faces matched in %s", os.path.basename(image_path))
        return {"status": "ok", "matched_users": matches}
    except Exception as e:
        logger.exception("Error processing %s: %s", image_path, e)
        return {"status": "error", "error": str(e), "matched_users": []}