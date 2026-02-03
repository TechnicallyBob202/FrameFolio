from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import sqlite3
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
def init_db():
    conn = sqlite3.connect('frametagger.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS image_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_path TEXT NOT NULL,
            tag_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE,
            UNIQUE(image_path, tag_id)
        )
    ''')
    
    conn.commit()
    conn.close()

init_db()

# FOLDER FUNCTIONS
def get_folders_from_db():
    conn = sqlite3.connect('frametagger.db')
    cursor = conn.cursor()
    cursor.execute('SELECT id, path FROM folders ORDER BY created_at')
    results = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "path": r[1]} for r in results]

def add_folder_to_db(path):
    conn = sqlite3.connect('frametagger.db')
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO folders (path, created_at) VALUES (?, ?)', 
                      (path, datetime.now().isoformat()))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        conn.close()
        return False

def remove_folder_from_db(folder_id):
    conn = sqlite3.connect('frametagger.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM folders WHERE id = ?', (folder_id,))
    conn.commit()
    conn.close()

# TAG FUNCTIONS
def get_tags_from_db():
    conn = sqlite3.connect('frametagger.db')
    cursor = conn.cursor()
    cursor.execute('SELECT id, name FROM tags ORDER BY name')
    results = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1]} for r in results]

def create_tag(name):
    """Create a single tag"""
    conn = sqlite3.connect('frametagger.db')
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO tags (name, created_at) VALUES (?, ?)',
                      (name.strip(), datetime.now().isoformat()))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        conn.close()
        return False

def delete_tag(tag_id):
    conn = sqlite3.connect('frametagger.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM tags WHERE id = ?', (tag_id,))
    conn.commit()
    conn.close()

def get_image_tags(image_path):
    """Get all tags for an image"""
    conn = sqlite3.connect('frametagger.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT t.id, t.name FROM tags t
        JOIN image_tags it ON t.id = it.tag_id
        WHERE it.image_path = ?
        ORDER BY t.name
    ''', (image_path,))
    results = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1]} for r in results]

def add_tag_to_image(image_path, tag_id):
    """Add a tag to an image"""
    conn = sqlite3.connect('frametagger.db')
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO image_tags (image_path, tag_id, created_at) VALUES (?, ?, ?)',
                      (image_path, tag_id, datetime.now().isoformat()))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        conn.close()
        return False

def remove_tag_from_image(image_path, tag_id):
    """Remove a tag from an image"""
    conn = sqlite3.connect('frametagger.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM image_tags WHERE image_path = ? AND tag_id = ?',
                  (image_path, tag_id))
    conn.commit()
    conn.close()

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg'}

# API ENDPOINTS

@app.get("/health")
def health():
    return {"status": "ok"}

# FOLDERS

@app.get("/api/folders/browse")
def browse_folders(path: str = "/"):
    try:
        p = Path(path)
        if not p.exists():
            return {"error": "Path does not exist"}
        if not p.is_dir():
            return {"error": "Path is not a directory"}
        
        items = []
        for item in sorted(p.iterdir()):
            try:
                if item.is_dir():
                    items.append({
                        "name": item.name,
                        "path": str(item),
                        "is_dir": True
                    })
            except PermissionError:
                pass
        
        return {
            "current_path": str(p),
            "parent_path": str(p.parent) if p.parent != p else None,
            "folders": items
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/folders/add")
def add_folder(path: str):
    try:
        p = Path(path)
        if not p.exists():
            return {"error": "Path does not exist"}
        if not p.is_dir():
            return {"error": "Path is not a directory"}
        
        if add_folder_to_db(path):
            return {"status": "ok", "path": path}
        else:
            return {"error": "Folder already added"}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/folders/{folder_id}")
def remove_folder(folder_id: int):
    try:
        remove_folder_from_db(folder_id)
        return {"status": "ok"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/folders")
def list_folders():
    try:
        folders = get_folders_from_db()
        return {"folders": folders}
    except Exception as e:
        return {"error": str(e)}

# TAGS

@app.get("/api/tags")
def list_tags():
    try:
        tags = get_tags_from_db()
        return {"tags": tags}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/tags")
def create_tag_endpoint(name: str):
    try:
        if not name or not name.strip():
            return {"error": "Tag name required"}
        
        if create_tag(name):
            return {"status": "ok", "name": name.strip()}
        else:
            return {"error": "Tag already exists"}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/tags/{tag_id}")
def remove_tag(tag_id: int):
    try:
        delete_tag(tag_id)
        return {"status": "ok"}
    except Exception as e:
        return {"error": str(e)}

# IMAGES

@app.get("/api/images")
def get_images():
    try:
        folders = get_folders_from_db()
        if not folders:
            return {"total_images": 0, "images": []}
        
        all_images = []
        
        for folder in folders:
            folder_path = Path(folder["path"])
            if not folder_path.exists():
                continue
            
            try:
                for file_path in folder_path.rglob('*'):
                    try:
                        if file_path.is_file() and file_path.suffix.lower() in IMAGE_EXTENSIONS:
                            stat = file_path.stat()
                            all_images.append({
                                "name": file_path.name,
                                "path": str(file_path),
                                "folder_id": folder["id"],
                                "folder_path": folder["path"],
                                "size": stat.st_size,
                                "extension": file_path.suffix.lower(),
                                "date_modified": stat.st_mtime,
                                "tags": get_image_tags(str(file_path))
                            })
                    except PermissionError:
                        pass
            except PermissionError:
                pass
        
        return {
            "total_images": len(all_images),
            "library_folders": len(folders),
            "images": all_images
        }
    except Exception as e:
        return {"error": str(e)}



@app.post("/api/images/tag")
def tag_image(image_path: str, tag_id: int):
    try:
        if add_tag_to_image(image_path, tag_id):
            return {"status": "ok"}
        else:
            return {"error": "Tag already applied"}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/images/tag")
def untag_image(image_path: str, tag_id: int):
    try:
        remove_tag_from_image(image_path, tag_id)
        return {"status": "ok"}
    except Exception as e:
        return {"error": str(e)}