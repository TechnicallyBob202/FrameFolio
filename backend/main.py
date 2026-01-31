from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Table, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
from pathlib import Path
import shutil

# Database setup
DATABASE_URL = "sqlite:///./imagetagger.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Image-Tag association table
image_tags = Table(
    'image_tags',
    Base.metadata,
    Column('image_id', Integer, ForeignKey('images.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)

# Database Models
class Image(Base):
    __tablename__ = "images"
    id = Column(Integer, primary_key=True)
    filename = Column(String, unique=True)
    original_filename = Column(String)
    path = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    tags = relationship("Tag", secondary=image_tags, back_populates="images")

class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)
    color = Column(String, default="#6366f1")
    images = relationship("Image", secondary=image_tags, back_populates="tags")

# Create tables
Base.metadata.create_all(bind=engine)

# Pydantic models for API
class TagSchema(BaseModel):
    id: Optional[int] = None
    name: str
    color: str = "#6366f1"
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

# FastAPI app
app = FastAPI(title="FrameTagger")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory
UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Scan uploads directory and add missing files to database
def scan_and_register_files(db: Session = None):
    """Scan uploads directory and register any files not in database"""
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True
    
    added = 0
    try:
        # Get all image files in uploads directory
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'}
        files_on_disk = {
            f.name for f in UPLOAD_DIR.glob('*')
            if f.is_file() and f.suffix.lower() in image_extensions
        }
        
        # Get all registered filenames in database
        registered_files = {
            img.filename for img in db.query(Image).all()
        }
        
        # Add any missing files
        for filename in files_on_disk - registered_files:
            file_path = UPLOAD_DIR / filename
            db_image = Image(
                filename=filename,
                original_filename=filename,
                path=str(file_path),
                created_at=datetime.fromtimestamp(file_path.stat().st_ctime)
            )
            db.add(db_image)
            added += 1
        
        if added > 0:
            db.commit()
            print(f"[Startup] Registered {added} new image files from uploads directory")
    except Exception as e:
        print(f"Error scanning uploads directory: {e}")
        db.rollback()
    finally:
        if close_db:
            db.close()
    
    return added

# Startup event
@app.on_event("startup")
async def startup_event():
    """Scan uploads directory on startup"""
    scan_and_register_files()

# Routes
@app.get("/api/images", response_model=List[ImageListSchema])
def get_images(skip: int = 0, limit: int = 100, tag_ids: Optional[str] = None, db: Session = Depends(get_db)):
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
        raise HTTPException(status_code=404, detail="Image or tag not found")
    if tag not in image.tags:
        image.tags.append(tag)
        db.commit()
    return {"status": "success"}

@app.delete("/api/images/{image_id}/tags/{tag_id}")
def remove_tag_from_image(image_id: int, tag_id: int, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == image_id).first()
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not image or not tag:
        raise HTTPException(status_code=404, detail="Image or tag not found")
    if tag in image.tags:
        image.tags.remove(tag)
        db.commit()
    return {"status": "success"}

@app.get("/api/tags", response_model=List[TagSchema])
def get_tags(db: Session = Depends(get_db)):
    return db.query(Tag).all()

@app.post("/api/tags", response_model=TagSchema)
def create_tag(tag: TagSchema, db: Session = Depends(get_db)):
    existing = db.query(Tag).filter(Tag.name == tag.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tag already exists")
    db_tag = Tag(name=tag.name, color=tag.color)
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

@app.put("/api/tags/{tag_id}", response_model=TagSchema)
def update_tag(tag_id: int, tag: TagSchema, db: Session = Depends(get_db)):
    db_tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not db_tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db_tag.name = tag.name
    db_tag.color = tag.color
    db.commit()
    db.refresh(db_tag)
    return db_tag

@app.delete("/api/tags/{tag_id}")
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    db_tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not db_tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(db_tag)
    db.commit()
    return {"status": "success"}

@app.post("/api/upload")
async def upload_images(files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    uploaded = []
    for file in files:
        filename = f"{datetime.utcnow().timestamp()}_{file.filename}"
        filepath = UPLOAD_DIR / filename
        with open(filepath, "wb") as f:
            content = await file.read()
            f.write(content)
        db_image = Image(
            filename=filename,
            original_filename=file.filename,
            path=str(filepath)
        )
        db.add(db_image)
        db.commit()
        db.refresh(db_image)
        uploaded.append(ImageSchema.from_orm(db_image))
    return uploaded

@app.get("/api/images/{image_id}/download")
def download_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(
        image.path,
        filename=image.original_filename,
        media_type="image/jpeg"
    )

@app.post("/api/batch/tag")
def batch_tag_images(image_ids: List[int], tag_id: int, db: Session = Depends(get_db)):
    """Add a tag to multiple images"""
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
    """Remove a tag from multiple images"""
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

@app.post("/api/rescan")
def rescan_uploads(db: Session = Depends(get_db)):
    """Rescan uploads directory and register new files"""
    added = scan_and_register_files(db)
    return {"added": added, "message": f"Registered {added} new image files"}

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)