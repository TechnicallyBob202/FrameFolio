"""
FrameTagger Backend - Simplified, single-container design
Serves API endpoints + static React frontend
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Table, ForeignKey, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from pathlib import Path
import os
import asyncio
import logging
import platform

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# DATABASE SETUP
# ============================================================================

DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'mysql+pymysql://root:frametagger@mariadb:3306/frametagger'
)
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Image-Tag association table
image_tags = Table(
    'image_tags',
    Base.metadata,
    Column('image_id', Integer, ForeignKey('images.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)

# ============================================================================
# DATABASE MODELS
# ============================================================================

class Folder(Base):
    __tablename__ = "folders"
    id = Column(Integer, primary_key=True)
    path = Column(String(512), unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    images = relationship("Image", back_populates="folder", cascade="all, delete-orphan")

class Image(Base):
    __tablename__ = "images"
    id = Column(Integer, primary_key=True)
    filename = Column(String(255), unique=True)
    original_filename = Column(String(255))
    path = Column(String(512))
    folder_id = Column(Integer, ForeignKey('folders.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    folder = relationship("Folder", back_populates="images")
    tags = relationship("Tag", secondary=image_tags, back_populates="images")

class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True)
    color = Column(String(7), default="#6366f1")
    parent_id = Column(Integer, ForeignKey('tags.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    images = relationship("Image", secondary=image_tags, back_populates="tags")
    children = relationship("Tag", remote_side=[id], cascade="all, delete-orphan", single_parent=True)
    parent = relationship("Tag", remote_side=[parent_id], foreign_keys=[parent_id], overlaps="children")

# Create tables
Base.metadata.create_all(bind=engine)

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class TagSchema(BaseModel):
    id: Optional[int] = None
    name: str
    color: str = "#6366f1"
    parent_id: Optional[int] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class TagWithChildrenSchema(BaseModel):
    id: int
    name: str
    color: str
    parent_id: Optional[int] = None
    children: List['TagWithChildrenSchema'] = []
    class Config:
        from_attributes = True

TagWithChildrenSchema.update_forward_refs()

class FolderSchema(BaseModel):
    id: Optional[int] = None
    path: str
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class ImageSchema(BaseModel):
    id: Optional[int] = None
    filename: str
    original_filename: str
    created_at: Optional[datetime] = None
    tags: List[TagSchema] = []
    class Config:
        from_attributes = True

class ImageListSchema(BaseModel):
    id: int
    filename: str
    original_filename: str
    created_at: datetime
    tags: List[TagSchema]
    class Config:
        from_attributes = True

# File browser models
class FsItemSchema(BaseModel):
    name: str
    path: str
    is_dir: bool
    size: int = 0
    modified: datetime
    class Config:
        from_attributes = True

class FsBrowseResponseSchema(BaseModel):
    current_path: str
    parent_path: Optional[str]
    folders: List[FsItemSchema] = Field(default_factory=list)
    total_folders: int = 0
    class Config:
        from_attributes = True

class HomeDirectorySchema(BaseModel):
    path: str
    os: str

# ============================================================================
# FASTAPI APP
# ============================================================================

app = FastAPI(title="FrameTagger", docs_url="/api/docs", openapi_url="/api/openapi.json")

# Minimal CORS for API health check
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("/media")
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)

# ============================================================================
# DATABASE DEPENDENCY
# ============================================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============================================================================
# FILE SYSTEM UTILITIES
# ============================================================================

def get_allowed_root_paths():
    """Get allowed root paths based on operating system"""
    if platform.system() == "Windows":
        return [Path("C:\\"), Path(os.path.expanduser("~"))]
    else:
        return [Path("/"), Path("/home"), Path("/mnt"), Path(os.path.expanduser("~"))]

def validate_path(requested_path: str) -> Path:
    """Validate path security - prevent directory traversal"""
    allowed_roots = get_allowed_root_paths()
    try:
        path = Path(requested_path).resolve()
        
        # Check if within allowed roots
        is_allowed = False
        for allowed_root in allowed_roots:
            try:
                path.relative_to(allowed_root.resolve())
                is_allowed = True
                break
            except ValueError:
                continue
        
        if not is_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied to path: {requested_path}"
            )
        
        if path.is_symlink():
            raise HTTPException(status_code=403, detail="Symlinks not allowed")
        
        return path
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid path: {str(e)}")

async def browse_directory(path: Path, max_items: int = 1000) -> FsBrowseResponseSchema:
    """Browse directory contents"""
    try:
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"Path not found: {path}")
        if not path.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory")
        
        parent_path = None
        try:
            parent = path.parent
            if parent != path:
                parent_path = str(parent)
        except Exception:
            parent_path = None
        
        folders = []
        try:
            items = sorted(
                [x for x in path.iterdir() if not x.name.startswith('.')],
                key=lambda x: (not x.is_dir(), x.name.lower())
            )
        except PermissionError:
            raise HTTPException(status_code=403, detail=f"Permission denied: {path}")
        
        for item in items[:max_items]:
            if item.is_dir() and not item.is_symlink():
                try:
                    stat_info = item.stat()
                    folders.append(FsItemSchema(
                        name=item.name,
                        path=str(item),
                        is_dir=True,
                        size=0,
                        modified=datetime.fromtimestamp(stat_info.st_mtime)
                    ))
                except (PermissionError, OSError):
                    continue
        
        return FsBrowseResponseSchema(
            current_path=str(path),
            parent_path=parent_path,
            folders=folders,
            total_folders=len(folders)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Browse error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def scan_folder(folder_path: str, folder_id: int, db: Session):
    """Scan folder for images and register them"""
    added = 0
    try:
        folder_path = Path(folder_path)
        if not folder_path.exists():
            return 0
        
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'}
        files_on_disk = {
            f.name for f in folder_path.glob('*')
            if f.is_file() and f.suffix.lower() in image_extensions
        }
        
        registered_files = {
            img.filename for img in db.query(Image).filter(Image.folder_id == folder_id).all()
        }
        
        for filename in files_on_disk - registered_files:
            file_path = folder_path / filename
            db_image = Image(
                filename=filename,
                original_filename=filename,
                path=str(file_path),
                folder_id=folder_id,
                created_at=datetime.fromtimestamp(file_path.stat().st_ctime)
            )
            db.add(db_image)
            added += 1
        
        if added > 0:
            db.commit()
    except Exception as e:
        logger.error(f"Scan error: {e}")
        db.rollback()
    
    return added

# ============================================================================
# STARTUP EVENT
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Wait for DB and scan folders on startup"""
    max_retries = 10
    for i in range(max_retries):
        try:
            db = SessionLocal()
            db.execute(text("SELECT 1"))
            db.close()
            logger.info("Database ready")
            break
        except Exception as e:
            if i < max_retries - 1:
                logger.info(f"Waiting for database... ({i+1}/{max_retries})")
                await asyncio.sleep(1)
            else:
                logger.error(f"Database failed after {max_retries} attempts")
                raise
    
    # Scan folders
    db = SessionLocal()
    try:
        folders = db.query(Folder).all()
        total = 0
        for folder in folders:
            added = scan_folder(folder.path, folder.id, db)
            total += added
        if total > 0:
            logger.info(f"Registered {total} new images")
    finally:
        db.close()

# ============================================================================
# API ENDPOINTS - HEALTH
# ============================================================================

@app.get("/api/health")
def health():
    return {"status": "ok"}

# ============================================================================
# API ENDPOINTS - FILE SYSTEM
# ============================================================================

@app.get("/api/fs/home", response_model=HomeDirectorySchema)
async def get_home_directory():
    """Get user's home directory"""
    home = Path.home()
    return HomeDirectorySchema(path=str(home), os=platform.system().lower())

@app.get("/api/fs/browse", response_model=FsBrowseResponseSchema)
async def browse_files(
    path: str = Query("/mnt"),
    max_items: int = Query(1000, ge=1, le=5000)
):
    """Browse filesystem"""
    validated_path = validate_path(path)
    return await browse_directory(validated_path, max_items)

# ============================================================================
# API ENDPOINTS - FOLDERS
# ============================================================================

@app.get("/api/folders", response_model=List[FolderSchema])
def get_folders(db: Session = Depends(get_db)):
    return db.query(Folder).all()

@app.post("/api/folders", response_model=FolderSchema)
def add_folder(folder: FolderSchema, db: Session = Depends(get_db)):
    try:
        validated_path = validate_path(folder.path)
        if not validated_path.is_dir():
            raise HTTPException(status_code=400, detail="Not a directory")
    except HTTPException:
        raise
    
    existing = db.query(Folder).filter(Folder.path == folder.path).first()
    if existing:
        raise HTTPException(status_code=400, detail="Folder already added")
    
    db_folder = Folder(path=folder.path)
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    
    scan_folder(folder.path, db_folder.id, db)
    return db_folder

@app.delete("/api/folders/{folder_id}")
def remove_folder(folder_id: int, db: Session = Depends(get_db)):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    db.query(Image).filter(Image.folder_id == folder_id).delete()
    db.delete(folder)
    db.commit()
    return {"status": "success"}

# ============================================================================
# API ENDPOINTS - IMAGES
# ============================================================================

@app.get("/api/images", response_model=List[ImageListSchema])
def get_images(
    skip: int = 0,
    limit: int = 100,
    tag_ids: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Image)
    if tag_ids:
        tag_list = [int(tid) for tid in tag_ids.split(",")]
        for tag_id in tag_list:
            query = query.filter(Image.tags.any(Tag.id == tag_id))
    return query.offset(skip).limit(limit).all()

@app.get("/api/images/{image_id}", response_model=ImageSchema)
def get_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return image

@app.post("/api/images/{image_id}/tags")
def add_tag_to_image(image_id: int, tag_id: int, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == image_id).first()
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not image or not tag:
        raise HTTPException(status_code=404, detail="Not found")
    if tag not in image.tags:
        image.tags.append(tag)
        db.commit()
    return {"status": "success"}

@app.delete("/api/images/{image_id}/tags/{tag_id}")
def remove_tag_from_image(image_id: int, tag_id: int, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == image_id).first()
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not image or not tag:
        raise HTTPException(status_code=404, detail="Not found")
    if tag in image.tags:
        image.tags.remove(tag)
        db.commit()
    return {"status": "success"}

@app.get("/api/images/{image_id}/download")
def download_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(image.path, filename=image.original_filename)

# ============================================================================
# API ENDPOINTS - TAGS
# ============================================================================

@app.get("/api/tags", response_model=List[TagWithChildrenSchema])
def get_tags(db: Session = Depends(get_db)):
    return db.query(Tag).filter(Tag.parent_id == None).all()

@app.post("/api/tags", response_model=TagSchema)
def create_tag(tag: TagSchema, db: Session = Depends(get_db)):
    existing = db.query(Tag).filter(Tag.name == tag.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tag exists")
    
    if tag.parent_id:
        parent = db.query(Tag).filter(Tag.id == tag.parent_id).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Parent not found")
    
    db_tag = Tag(name=tag.name, color=tag.color, parent_id=tag.parent_id)
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

@app.put("/api/tags/{tag_id}", response_model=TagSchema)
def update_tag(tag_id: int, tag: TagSchema, db: Session = Depends(get_db)):
    db_tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not db_tag:
        raise HTTPException(status_code=404, detail="Not found")
    if tag.parent_id == tag_id:
        raise HTTPException(status_code=400, detail="Invalid parent")
    
    db_tag.name = tag.name
    db_tag.color = tag.color
    db_tag.parent_id = tag.parent_id
    db.commit()
    db.refresh(db_tag)
    return db_tag

@app.delete("/api/tags/{tag_id}")
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    db_tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not db_tag:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(db_tag)
    db.commit()
    return {"status": "success"}

# ============================================================================
# API ENDPOINTS - BATCH OPERATIONS
# ============================================================================

@app.post("/api/batch/tag")
def batch_tag_images(image_ids: List[int], tag_id: int, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    count = 0
    for image_id in image_ids:
        image = db.query(Image).filter(Image.id == image_id).first()
        if image and tag not in image.tags:
            image.tags.append(tag)
            count += 1
    db.commit()
    return {"tagged": count}

@app.delete("/api/batch/untag")
def batch_untag_images(image_ids: List[int], tag_id: int, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    count = 0
    for image_id in image_ids:
        image = db.query(Image).filter(Image.id == image_id).first()
        if image and tag in image.tags:
            image.tags.remove(tag)
            count += 1
    db.commit()
    return {"untagged": count}

# ============================================================================
# API ENDPOINTS - ADMIN
# ============================================================================

@app.post("/api/rescan")
def rescan_all_folders(db: Session = Depends(get_db)):
    folders = db.query(Folder).all()
    total = 0
    for folder in folders:
        total += scan_folder(folder.path, folder.id, db)
    return {"added": total}

# ============================================================================
# SERVE STATIC REACT APP
# ============================================================================

# Mount React static files (built by Dockerfile)
# All non-API routes serve index.html for SPA routing
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
