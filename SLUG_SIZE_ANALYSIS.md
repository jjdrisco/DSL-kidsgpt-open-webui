# Heroku Slug Size Analysis

**Date**: 2026-02-05  
**Current Slug Size**: 1.2GB  
**Heroku Limit**: 500MB (free/eco tier)

## Findings

### Already Optimized

- ✅ `.svelte-kit/` excluded (323MB saved)
- ✅ `static/video/` excluded (95MB saved)
- ✅ Heavy Python packages removed from root `requirements.txt`:
  - chromadb, transformers, sentence-transformers, accelerate
  - opencv-python-headless, onnxruntime, faster-whisper
  - playwright, av, colbert-ai
- ✅ Optional packages made lazy-import (azure, google-cloud, etc.)

### Current Contributors to Slug Size

1. **Python Packages** (~600-800MB estimated)
   - 91 active packages in `requirements.txt`
   - Heavy packages still included:
     - `unstructured==0.16.17` (document processing)
     - `langchain` + related packages (5 packages)
     - `pandas==2.2.3` (data processing)
     - `pillow==11.3.0` (image processing)
     - Multiple database clients (pymongo, elasticsearch, opensearch, pinecone, oracledb, pymilvus, qdrant)
     - `nltk==3.9.1` (NLP)
     - `pypdf`, `python-pptx`, `docx2txt` (document parsing)

2. **Build Artifacts** (~271MB)
   - `build/` directory (frontend build output)
   - Required for deployment

3. **Static Assets** (~180MB)
   - `static/pyodide/` (60MB) - Python packages for browser
   - `static/assets/` - images, fonts
   - Fonts: 63MB (NotoSans variants for CJK languages)

4. **Backend Code** (~69MB)
   - Application code and templates

5. **Other Source Files** (~100-200MB)
   - Source code, configuration files

## Options to Reduce Slug Size

### Option 1: Further Dependency Reduction (Complex)

- Make more packages lazy-import (unstructured, langchain, pandas)
- Remove unused database clients (keep only pgvector)
- Use lighter alternatives where possible
- **Risk**: May break features if not carefully tested

### Option 2: Upgrade Heroku Instance (Recommended)

Heroku slug size limits by tier:

- **Free/Eco**: 500MB
- **Basic**: 500MB
- **Standard-1X/2X**: 500MB
- **Performance-M/L**: 500MB
- **Private Spaces**: 500MB
- **Container Registry**: No hard limit (recommended for large apps)

**Note**: All Heroku dyno types have a 500MB slug limit. However, you can:

1. **Use Container Registry** (no slug size limit)
   - Already have `Dockerfile` and `heroku.yml`
   - Switch to container stack: `heroku stack:set container -a dsl-kidsgpt-pilot`
   - Container images can be much larger

2. **Use External Storage**
   - Move static assets to S3/CloudFront
   - Serve Pyodide from CDN
   - Reduce static files in slug

### Option 3: Hybrid Approach

- Keep essential packages
- Move heavy static assets to CDN
- Use Container Registry for deployment

## Recommendation

**Use Container Registry** (Option 2):

- Your project already has `Dockerfile` and `heroku.yml`
- No slug size limit
- More control over build process
- Better for apps with heavy dependencies

**Command to switch**:

```bash
heroku stack:set container -a dsl-kidsgpt-pilot
git push heroku cursor/heroku-build-memory-e9e1:main
```

## Current Status

- ✅ Node.js OOM issue fixed (NODE_OPTIONS added to build script)
- ✅ Build completes successfully
- ⚠️ Slug size exceeds limit (1.2GB > 500MB)
- ✅ `.svelte-kit/` excluded (323MB saved)
