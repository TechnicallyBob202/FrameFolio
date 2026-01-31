# FrameTagger - GitHub Actions & Docker Hub Setup

## Step 1: Create Docker Hub Access Token

1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Name it: `frametagger-github`
4. Copy the token (you'll only see it once)

## Step 2: Add GitHub Secrets

1. Go to: https://github.com/TechnicallyBob202/FrameTagger/settings/secrets/actions
2. Click "New repository secret"
3. Add two secrets:

   **Secret 1:**
   - Name: `DOCKER_USERNAME`
   - Value: `technicallybob`

   **Secret 2:**
   - Name: `DOCKER_PASSWORD`
   - Value: (paste the access token from Step 1)

## Step 3: File Structure

You should have:

```
FrameTagger/
├── .github/
│   └── workflows/
│       └── build-and-push.yml (just created)
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── Dockerfile
├── docker-compose.yml (just created)
├── nginx.conf
├── README.md
└── .gitignore
```

## Step 4: Push to GitHub

```powershell
cd FrameTagger
git init
git add .
git commit -m "Initial commit: FrameTagger"
git branch -M main
git remote add origin https://github.com/TechnicallyBob202/FrameTagger.git
git push -u origin main
```

## Step 5: Verify Workflow

1. Go to: https://github.com/TechnicallyBob202/FrameTagger/actions
2. You should see the "Build and Push Docker Images" workflow running
3. Wait for it to complete (5-10 minutes first time)
4. Check Docker Hub: https://hub.docker.com/repositories/technicallybob
5. You should see:
   - `frametagger-backend` image
   - `frametagger-frontend` image

## Step 6: Deploy on Home Lab

Once the workflow completes and images are on Docker Hub:

```bash
# Clone the repo
git clone https://github.com/TechnicallyBob202/FrameTagger.git
cd FrameTagger

# Pull and run
docker-compose up
```

Access at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## How It Works Going Forward

1. **You make changes locally** on Windows
2. **Push to GitHub**: `git push`
3. **GitHub Actions automatically triggers**:
   - Builds new backend image
   - Builds new frontend image
   - Pushes both to Docker Hub with `latest` tag
4. **On your home lab**, pull the new images:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

New version deployed in seconds!

## Troubleshooting

**Images not building?**
- Check the Actions tab for error logs
- Verify secrets are set correctly (no typos)
- Verify Docker Hub token isn't expired

**Can't push to Docker Hub?**
- Verify DOCKER_PASSWORD is the access token, not your password
- Token needs push permissions

**docker-compose pull fails?**
- Make sure first GitHub Actions workflow completed successfully
- Verify images exist on Docker Hub dashboard

## Future Deployments

After the first setup, your workflow is:

1. Edit code locally
2. `git push` to GitHub
3. Workflow auto-builds (watch Actions tab)
4. SSH to home lab: `docker-compose pull && docker-compose up -d`
5. Done! New version live

No manual Docker builds. No file juggling. Clean CI/CD pipeline.
