# FrameTagger - Simplified Single-Container Design

A tag-based image management system inspired by Radarr's simplicity. One container, one port, zero nginx complications.

## Architecture

**Before (Overcomplicated):**
- Backend container (FastAPI, port 8000)
- Frontend container (React dev server, port 5173)
- Nginx container (proxy, port 80)
- CORS issues, API routing headaches, 3 moving parts

**Now (Simple & Clean):**
- Single Backend container (FastAPI + React static files, port 8003)
- MariaDB container (database)
- No nginx, no frontend container, no routing issues
- Frontend built once during Docker build, served as static files by FastAPI

## Quick Start

### Local Development

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8003
```

**Frontend (separate terminal):**
```bash
cd frontend
npm install
npm run dev
```

Then access at `http://localhost:5173` (Vite dev server proxies /api to backend)

### Docker Deployment

```bash
docker-compose up
```

Access at `http://localhost:8765` (mapped from 8003)

## File Structure

```
frametagger/
├── backend/
│   ├── main.py           # FastAPI: serves API + static React app
│   ├── requirements.txt   # Python dependencies
│   └── Dockerfile        # Multi-stage: builds React, packages backend
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Main React component
│   │   ├── App.css       # Styling
│   │   └── main.jsx      # React entry
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
├── docker-compose.yml    # Just DB + backend
├── .gitignore
└── README.md
```

## How It Works

### Build Process (Docker)
1. **Stage 1**: Node 18 builds React frontend
   - `npm install` dependencies
   - `npm run build` outputs to `dist/`
2. **Stage 2**: Python 3.11 builds backend
   - Copy built React `dist/` → `backend/static/`
   - Install Python dependencies
   - Run FastAPI on port 8003

### At Runtime
- FastAPI serves `/api/*` endpoints (database operations)
- FastAPI serves all other routes as static React files via `StaticFiles(directory="static", html=True)`
- React frontend makes API calls to `/api/*` (same origin, no CORS)
- Single port, single container, single point of failure (but it works!)

## API Endpoints

All endpoints return JSON. All POST/PUT/DELETE endpoints expect `Content-Type: application/json`.

### Folders
- `GET /api/folders` - List configured folders
- `POST /api/folders` - Add folder to scan
- `DELETE /api/folders/{id}` - Remove folder

### Images
- `GET /api/images` - List images (supports `tag_ids=1,2,3` filter)
- `GET /api/images/{id}` - Get image details
- `GET /api/images/{id}/download` - Download original file
- `POST /api/images/{id}/tags` - Add tag (body: `{tag_id: 1}`)
- `DELETE /api/images/{id}/tags/{tag_id}` - Remove tag

### Tags
- `GET /api/tags` - List tags (hierarchical)
- `POST /api/tags` - Create tag (body: `{name: "Portrait", color: "#6366f1", parent_id: null}`)
- `PUT /api/tags/{id}` - Update tag (name, color, parent_id)
- `DELETE /api/tags/{id}` - Delete tag (cascades to children)

### Batch Operations
- `POST /api/batch/tag` - Add tag to multiple images
- `DELETE /api/batch/untag` - Remove tag from multiple images

### Admin
- `POST /api/rescan` - Rescan all configured folders
- `GET /api/health` - Health check

### Filesystem
- `GET /api/fs/home` - Get user's home directory
- `GET /api/fs/browse?path=/mnt&max_items=1000` - Browse filesystem

## Configuration

### Environment Variables
Set in `docker-compose.yml`:

```yaml
backend:
  environment:
    DATABASE_URL: mysql+pymysql://user:pass@host:3306/db
    PUID: 1000                   # Unraid permission
    PGID: 10                     # Unraid permission
    TZ: America/New_York
```

### Storage Locations
- **Database**: `/opt/docker/config/frametagger/db` (mounted from host)
- **Images**: `/mnt/media/` (mounted from host)
- **App data**: `/mnt/docker/frametagger/data` (future use)

### Frontend API Base
Hardcoded in `frontend/src/App.jsx`:
```javascript
const API_BASE = '/api';
```

This uses relative paths, so it works regardless of domain/IP.

## Development Workflow

1. **Edit React code** → Live reload on `http://localhost:5173`
2. **Edit backend code** → Server reloads with `--reload` flag
3. **Test production build locally**:
   ```bash
   docker build -t frametagger-test .
   docker run -p 8003:8003 frametagger-test
   ```
4. **Push to registry**:
   ```bash
   docker build -f backend/Dockerfile -t your-registry/frametagger:latest .
   docker push your-registry/frametagger:latest
   ```

## Why This Design?

✅ **Simple**: One container, one port, one concern per service
✅ **Fast**: No nginx overhead, no CORS issues, no routing complexity
✅ **Familiar**: Like Radarr, Sonarr, Lidarr - proven pattern
✅ **Scalable**: FastAPI handles async I/O efficiently
✅ **Maintainable**: When something breaks, there are fewer moving parts

## Future Improvements

- [ ] Image upload endpoint
- [ ] AI auto-tagging via image recognition
- [ ] Export to JSON/CSV
- [ ] API authentication (if exposed publicly)
- [ ] Tag import/export
- [ ] Batch rename with templates

## License

MIT
