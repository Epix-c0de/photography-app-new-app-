# Photo Access AI Editor — Master Specification

**Version:** 1.0
**Classification:** Enterprise Architecture Blueprint
**Date:** July 2026
**Sources:** Parts 1–17

---

# Table of Contents

1. [Project Vision](#1-project-vision)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Repository Strategy](#4-repository-strategy)
5. [Dashboard Integration](#5-dashboard-integration)
6. [Database Architecture](#6-database-architecture)
7. [Library Module](#7-library-module)
8. [Culling Module](#8-culling-module)
9. [Develop Module](#9-develop-module)
10. [Masking Module](#10-masking-module)
11. [Retouch Module](#11-retouch-module)
12. [AI Engine](#12-ai-engine)
13. [Style Learning System](#13-style-learning-system)
14. [RAW Processing Engine](#14-raw-processing-engine)
15. [Rendering Engine](#15-rendering-engine)
16. [Export Engine](#16-export-engine)
17. [Plugin SDK](#17-plugin-sdk)
18. [UI/UX Specification](#18-uiux-specification)
19. [Keyboard Shortcuts](#19-keyboard-shortcuts)
20. [Performance Targets](#20-performance-targets)
21. [Security & Privacy](#21-security--privacy)
22. [Phased Implementation Plan](#22-phased-implementation-plan)
23. [Testing Strategy](#23-testing-strategy)
24. [CI/CD & Packaging](#24-cicd--packaging)
25. [Release Roadmap](#25-release-roadmap)
26. [Acceptance Criteria](#26-acceptance-criteria)

---

# 1. Project Vision

## 1.1 What Is Photo Access Editor?

Photo Access Editor is a professional desktop photo editing application designed specifically for photographers using the Photo Access ecosystem.

The editor is **not** a standalone product. It operates as a connected desktop application that integrates directly with the Photo Access Dashboard.

## 1.2 Division of Responsibility

| System | Manages |
|--------|---------|
| **Dashboard** | Authentication, subscriptions, clients, bookings, galleries, delivery |
| **Editor** | Photo importing, catalogs, culling, editing, retouching, AI learning, exporting, gallery publishing |

**Core Principle:** The dashboard manages business operations. The editor manages photo production. The editor should never attempt to replace dashboard functionality.

## 1.3 Design Goals

- Fast like **Capture One**
- Organized like **Lightroom**
- Flexible like **Photoshop**
- AI-assisted like **Aftershoot** and **Evoto**

## 1.4 Target Users

| User Type | Description |
|-----------|-------------|
| Super Admin | Platform-wide management |
| Studio Admin | Studio-level management |
| Photographer | Primary editor user |
| Editor | Assistant editor (limited access) |
| Retoucher | Portrait retouching specialist |
| Client | Gallery viewer (user app) |

## 1.5 Product Workflow

```
Booking Created
    ↓
Shoot Completed
    ↓
Import Photos
    ↓
Cull Images
    ↓
Edit Images
    ↓
Retouch Images
    ↓
AI Suggestions
    ↓
Export
    ↓
Publish Gallery
    ↓
Client Receives Gallery
```

---

# 2. System Architecture

## 2.1 Ecosystem Overview

```
+------------------------------------------------------+
|                   PHOTO ACCESS ECOSYSTEM              |
+------------------------------------------------------+
|                                                      |
|  +----------------+     +-------------------+       |
|  | Web Admin      |     | Photographer      |       |
|  | Dashboard      |     | Portal (Web)      |       |
|  | (Next.js)      |     | (Next.js)         |       |
|  +-------+--------+     +--------+----------+       |
|          |                       |                   |
|          +-----------+-----------+                   |
|                      |                               |
|              +-------v--------+                      |
|              |  Supabase      |                      |
|              |  (Auth, DB,    |                      |
|              |   Functions)   |                      |
|              +-------+--------+                      |
|                      |                               |
|          +-----------+-----------+                   |
|          |                       |                   |
|  +-------v--------+     +--------v----------+       |
|  | User App       |     | Desktop Editor    |       |
|  | (React Native) |     | (Flutter Desktop) |       |
|  +----------------+     +-------------------+       |
|                                                      |
+------------------------------------------------------+
```

## 2.2 Shared Infrastructure

All systems share:

- **Single identity system** (Supabase Auth)
- **Same Supabase project** (`gghqurnamjdxoriuuopf.supabase.co`)
- **Platform settings** (`platform_settings` table)
- **User profiles** (`user_profiles` table)

## 2.3 Editor Local Architecture

```
+------------------------------------------------------+
|                   DESKTOP EDITOR                      |
+------------------------------------------------------+
|                                                      |
|  +----------------+     +-------------------+       |
|  | Flutter UI     |<--->| Rust Services     |       |
|  | (Dart)         | FRB | (Performance)     |       |
|  +----------------+     +--------+----------+       |
|                                  |                   |
|                         +--------v----------+       |
|                         | AI Engine         |       |
|                         | (Python + ONNX)   |       |
|                         +-------------------+       |
|                                                      |
|  +----------------+     +-------------------+       |
|  | SQLite         |     | File System       |       |
|  | (Catalog)      |     | (RAW, Masks, AI)  |       |
|  +----------------+     +-------------------+       |
|                                                      |
+------------------------------------------------------+
```

## 2.4 Communication Pattern

```
Flutter UI
    ↓
flutter_rust_bridge
    ↓
Rust Service (raw_engine, render_engine, mask_engine, etc.)
    ↓
Result
    ↓
Flutter UI Update
```

---

# 3. Technology Stack

## 3.1 Frontend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| UI Framework | **Flutter Desktop** | Cross-platform desktop UI |
| Language | **Dart** | Application logic |
| State Management | **Riverpod** | Scalable, testable state |
| Navigation | **GoRouter** | Desktop routing, deep linking |
| Bridge | **flutter_rust_bridge** | Flutter ↔ Rust communication |

## 3.2 Backend Services

| Service | Language | Purpose |
|---------|----------|---------|
| raw_engine | **Rust** | RAW decoding, demosaicing |
| render_engine | **Rust** | GPU rendering, preview generation |
| mask_engine | **Rust** | SAM2 integration, mask operations |
| retouch_engine | **Rust** | Portrait retouching, healing, clone |
| catalog_engine | **Rust** | SQLite operations, indexing |
| export_engine | **Rust** | JPEG/PNG/TIFF/WEBP export |
| ai_engine | **Python** | ONNX inference, model loading |

## 3.3 AI Runtime

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Inference | **ONNX Runtime** | Local AI execution |
| Face Detection | **MediaPipe** | Face landmarks, eye detection |
| Face Recognition | **InsightFace** | Face parsing, grouping, embeddings |
| Universal Masking | **SAM2** | Subject/sky/background/clothing masks |
| Portrait Restoration | **GFPGAN** | Face restoration |
| Portrait Enhancement | **CodeFormer** | Face enhancement |
| Upscaling | **Real-ESRGAN** | Super resolution |
| Computer Vision | **OpenCV** | Blur detection, histograms, analysis |
| Color Management | **OpenColorIO** | ICC, LUT, color transforms |
| RAW Decoding | **LibRaw** | CR3, NEF, ARW, RAF, DNG support |

## 3.4 Database

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Local DB | **SQLite** | Catalog, edits, masks, AI data |
| ORM | **Drift** | Type-safe Flutter queries |
| Cloud (Future) | **PostgreSQL** | Sync, collaboration |

## 3.5 Training

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Training | **PyTorch** | Model creation |
| Experimentation | **scikit-learn** | Style learning |

---

# 4. Repository Strategy

## 4.1 Classification System

| Category | Description | Action |
|----------|-------------|--------|
| **A** | Core Dependencies | Required — integrate as libraries |
| **B** | Reference Implementations | Study architecture only |
| **C** | AI Models | Inference only |
| **D** | Research Projects | Optional study |

## 4.2 Repository Inventory

### Category A — Core Dependencies (Required)

| Repository | Purpose | URL |
|-----------|---------|-----|
| LibRaw | RAW decoding | https://github.com/LibRaw/LibRaw |
| OpenCV | Computer vision | https://github.com/opencv/opencv |
| ONNX Runtime | AI inference | https://github.com/microsoft/onnxruntime |
| MediaPipe | Face landmarks | https://github.com/google-ai-edge/mediapipe |
| InsightFace | Face recognition | https://github.com/deepinsight/insightface |
| SAM2 | Universal masking | https://github.com/facebookresearch/sam2 |
| GFPGAN | Portrait restoration | https://github.com/TencentARC/GFPGAN |
| CodeFormer | Face enhancement | https://github.com/sczhou/CodeFormer |
| Real-ESRGAN | Upscaling | https://github.com/xinntao/Real-ESRGAN |
| OpenColorIO | Color management | https://github.com/AcademySoftwareFoundation/OpenColorIO |
| LittleCMS | ICC processing | https://github.com/mm2/Little-CMS |
| SQLite | Catalog database | https://github.com/sqlite/sqlite |
| Drift | Flutter ORM | https://github.com/simolus3/drift |
| flutter_rust_bridge | Flutter ↔ Rust | https://github.com/fzyzcjy/flutter_rust_bridge |
| Flutter | Desktop framework | https://github.com/flutter/flutter |
| Riverpod | State management | https://github.com/rrousselGit/riverpod |
| GoRouter | Navigation | https://github.com/flutter/packages |

### Category B — Reference Implementations (Study Only)

| Repository | Study | URL |
|-----------|-------|-----|
| RawTherapee | Processing pipeline, color tools | https://github.com/RawTherapee/RawTherapee |
| darktable | Catalog, edit history, masks | https://github.com/darktable-org/darktable |
| digiKam | Catalog architecture, face workflows | https://github.com/KDE/digikam |
| PhotoPrism | AI cataloging, search | https://github.com/photoprism/photoprism |
| GIMP | Layer system, brush engine, plugins | https://github.com/GNOME/gimp |
| Krita | Rendering engine, layer management | https://github.com/KDE/krita |
| ImageMagick | Batch export workflows | https://github.com/ImageMagick/ImageMagick |

### Category C — AI Models (Inference Only)

| Repository | Purpose | URL |
|-----------|---------|-----|
| BiSeNet | Face parsing (skin, eyes, hair, lips) | https://github.com/xuebinqin/BiSeNet |
| SegFormer | Scene segmentation | https://github.com/NVlabs/SegFormer |
| U-2-Net | Background removal | https://github.com/xuebinqin/U-2-Net |

### Category D — Training (Future)

| Repository | Purpose | URL |
|-----------|---------|-----|
| PyTorch | Model training | https://github.com/pytorch/pytorch |
| scikit-learn | Style learning experiments | https://github.com/scikit-learn/scikit-learn |

## 4.3 Integration Rule

**NEVER** fork 20 repositories and attempt to merge them.

**Correct approach:**
1. Create your own architecture
2. Use repositories as: Libraries, References, Models, Inspiration
3. The editor itself remains your own product

## 4.4 Clone Priority

| Priority | Repositories |
|----------|-------------|
| **1** | Flutter, LibRaw, SQLite, OpenCV, ONNX Runtime, flutter_rust_bridge |
| **2** | MediaPipe, InsightFace, SAM2, GFPGAN, CodeFormer, Real-ESRGAN |
| **3** | RawTherapee, darktable, digiKam, Krita, GIMP, PhotoPrism |
| **4** | PyTorch, scikit-learn (advanced training) |

---

# 5. Dashboard Integration

## 5.1 Integration Principle

The editor connects to the dashboard API. The editor does **not** directly access database tables. All communication occurs through secured API endpoints.

## 5.2 Integration Points

### Integration 1: Authentication

```
Login
    ↓
API Validation
    ↓
JWT Token Issued
    ↓
Local Session Created
    ↓
Editor Opens
```

**Startup Flow:**
1. Photographer enters credentials
2. Credentials verified through Photo Access API
3. Authentication token issued
4. Session stored locally
5. Editor unlocks

### Integration 2: Subscription Verification

```
Editor Launch
    ↓
Subscription Check
    ↓
Valid? → Editor opens normally
Invalid → Restricted mode + renewal request
```

**Checks:**
- Account status
- Subscription status
- Device authorization

### Integration 3: Client Retrieval

Fetch photographer clients for publishing workflow.

**Display:**
- Client name
- Contact details
- Existing galleries

### Integration 4: Booking Retrieval

```
Wedding Booking (Dashboard)
    ↓
Import into Editor
    ↓
Create Editing Project
    ↓
Link Photos To Booking
```

### Integration 5: Gallery Publishing (Most Important)

```
Finish Editing
    ↓
Select Photos
    ↓
Publish Gallery
    ↓
Choose Existing Gallery OR Create New Gallery
    ↓
Upload Exports
    ↓
Gallery Updated in Dashboard
    ↓
Client Receives Access Code
```

### Integration 6: Preset Sync

```
Create Preset (Editor)
    ↓
Upload Preset to Dashboard
    ↓
Store in Dashboard
    ↓
Available on Reinstall
```

**Only presets sync.** No RAW files. No AI datasets.

### Integration 7: Software Updates

```
Editor Starts
    ↓
Check Update Endpoint
    ↓
New Version Available?
    ↓
Yes → Download → Install → Restart
```

## 5.3 Account Creation Flow

```
Admin Creates Photographer (Dashboard)
    ↓
System Generates Account
    ↓
System Generates License
    ↓
Photographer Receives Email
    ↓
Downloads Desktop Editor
    ↓
Logs In
    ↓
Device Registered
```

## 5.4 Device Registration

Every device stores:
- Device ID
- Machine Fingerprint
- OS Version
- App Version
- Last Login
- Status

## 5.5 License System

| License Type | Features |
|-------------|----------|
| Free | Basic editing |
| Starter | Standard editing |
| Professional | RAW editing, AI culling, AI masks |
| Studio | Advanced retouch, AI learning, team features |
| Enterprise | Full platform access |

## 5.6 Feature Control

| Feature | Free | Professional | Studio | Enterprise |
|---------|------|-------------|--------|------------|
| Basic Editing | ✓ | ✓ | ✓ | ✓ |
| RAW Editing | - | ✓ | ✓ | ✓ |
| AI Culling | - | ✓ | ✓ | ✓ |
| AI Masks | - | ✓ | ✓ | ✓ |
| Advanced Retouch | - | - | ✓ | ✓ |
| AI Learning | - | - | ✓ | ✓ |
| Team Features | - | - | ✓ | ✓ |
| Plugin Marketplace | - | - | - | ✓ |

---

# 6. Database Architecture

## 6.1 Database Strategy

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Primary | **SQLite** | Local catalog, fast editing, offline operation |
| Future Cloud | **PostgreSQL** | Synchronization, team collaboration |

**Rule:** Editing must never depend on cloud availability.

## 6.2 Storage Principles

1. Never modify original files
2. All edits are instructions
3. All AI results are reproducible
4. Every edit is reversible
5. Every catalog can be backed up

## 6.3 Folder Structure

```
PhotoAccess/
├── Catalogs/
│   └── [CatalogName]/
│       ├── Database/
│       │   └── catalog.db
│       ├── Photos/
│       ├── Previews/
│       ├── Thumbnails/
│       ├── Masks/
│       ├── AI/
│       ├── Exports/
│       ├── Presets/
│       ├── Backups/
│       └── Logs/
├── Projects/
├── Exports/
├── Presets/
├── AI/
│   ├── Models/
│   ├── Masks/
│   ├── Cache/
│   └── Database/
└── Logs/
```

## 6.4 Complete Schema

### catalogs

```sql
CREATE TABLE catalogs (
    catalog_id    TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT,
    version       TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    status        TEXT DEFAULT 'active'
);
```

### photos

```sql
CREATE TABLE photos (
    photo_id        TEXT PRIMARY KEY,
    catalog_id      TEXT NOT NULL REFERENCES catalogs(catalog_id),
    filename        TEXT NOT NULL,
    file_path       TEXT NOT NULL,
    file_hash       TEXT,
    capture_date    TEXT,
    camera_make     TEXT,
    camera_model    TEXT,
    lens            TEXT,
    iso             INTEGER,
    aperture        REAL,
    shutter_speed   TEXT,
    focal_length    REAL,
    rating          INTEGER DEFAULT 0,
    flag            TEXT DEFAULT 'none',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX idx_photos_file_hash ON photos(file_hash);
CREATE INDEX idx_photos_capture_date ON photos(capture_date);
CREATE INDEX idx_photos_rating ON photos(rating);
CREATE INDEX idx_photos_catalog ON photos(catalog_id);
```

### photo_metadata

```sql
CREATE TABLE photo_metadata (
    metadata_id     TEXT PRIMARY KEY,
    photo_id        TEXT NOT NULL REFERENCES photos(photo_id),
    gps             TEXT,
    copyright       TEXT,
    author          TEXT,
    description     TEXT,
    keywords_json   TEXT
);
```

### albums

```sql
CREATE TABLE albums (
    album_id    TEXT PRIMARY KEY,
    catalog_id  TEXT NOT NULL REFERENCES catalogs(catalog_id),
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
```

### album_photos

```sql
CREATE TABLE album_photos (
    album_id    TEXT NOT NULL REFERENCES albums(album_id),
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id),
    sort_order  INTEGER DEFAULT 0,
    PRIMARY KEY (album_id, photo_id)
);
```

### collections

```sql
CREATE TABLE collections (
    collection_id   TEXT PRIMARY KEY,
    catalog_id      TEXT NOT NULL REFERENCES catalogs(catalog_id),
    name            TEXT NOT NULL,
    type            TEXT NOT NULL DEFAULT 'manual',
    created_at      TEXT NOT NULL
);
```

### collection_photos

```sql
CREATE TABLE collection_photos (
    collection_id   TEXT NOT NULL REFERENCES collections(collection_id),
    photo_id        TEXT NOT NULL REFERENCES photos(photo_id),
    PRIMARY KEY (collection_id, photo_id)
);
```

### keywords

```sql
CREATE TABLE keywords (
    keyword_id  TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE
);
```

### photo_keywords

```sql
CREATE TABLE photo_keywords (
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id),
    keyword_id  TEXT NOT NULL REFERENCES keywords(keyword_id),
    PRIMARY KEY (photo_id, keyword_id)
);
```

### face_groups

```sql
CREATE TABLE face_groups (
    group_id        TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    cover_face_id   TEXT,
    created_at      TEXT NOT NULL
);
```

### faces

```sql
CREATE TABLE faces (
    face_id         TEXT PRIMARY KEY,
    photo_id        TEXT NOT NULL REFERENCES photos(photo_id),
    bounding_box    TEXT NOT NULL,
    embedding_path  TEXT,
    confidence      REAL,
    group_id        TEXT REFERENCES face_groups(group_id)
);

CREATE INDEX idx_faces_photo_id ON faces(photo_id);
CREATE INDEX idx_faces_group_id ON faces(group_id);
```

### edit_sessions

```sql
CREATE TABLE edit_sessions (
    session_id  TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    status      TEXT DEFAULT 'active'
);
```

### edit_operations

```sql
CREATE TABLE edit_operations (
    operation_id    TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES edit_sessions(session_id),
    operation_type  TEXT NOT NULL,
    parameter_json  TEXT NOT NULL,
    execution_order INTEGER NOT NULL,
    created_at      TEXT NOT NULL
);
```

### edit_graph_nodes

```sql
CREATE TABLE edit_graph_nodes (
    node_id            TEXT PRIMARY KEY,
    session_id         TEXT NOT NULL REFERENCES edit_sessions(session_id),
    node_type          TEXT NOT NULL,
    dependency_node    TEXT,
    enabled            INTEGER DEFAULT 1,
    parameters_json    TEXT,
    execution_order    INTEGER NOT NULL
);
```

### history

```sql
CREATE TABLE history (
    history_id  TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES edit_sessions(session_id),
    action_type TEXT NOT NULL,
    timestamp   TEXT NOT NULL
);
```

### snapshots

```sql
CREATE TABLE snapshots (
    snapshot_id     TEXT PRIMARY KEY,
    photo_id        TEXT NOT NULL REFERENCES photos(photo_id),
    name            TEXT NOT NULL,
    graph_state     TEXT NOT NULL,
    created_at      TEXT NOT NULL
);
```

### layers

```sql
CREATE TABLE layers (
    layer_id    TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id),
    layer_type  TEXT NOT NULL,
    name        TEXT NOT NULL,
    opacity     REAL DEFAULT 1.0,
    visible     INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL
);
```

### layer_groups

```sql
CREATE TABLE layer_groups (
    group_id    TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
```

### layer_members

```sql
CREATE TABLE layer_members (
    group_id    TEXT NOT NULL REFERENCES layer_groups(group_id),
    layer_id    TEXT NOT NULL REFERENCES layers(layer_id),
    PRIMARY KEY (group_id, layer_id)
);
```

### masks

```sql
CREATE TABLE masks (
    mask_id     TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id),
    layer_id    TEXT REFERENCES layers(layer_id),
    mask_type   TEXT NOT NULL,
    mask_path   TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
```

### mask_versions

```sql
CREATE TABLE mask_versions (
    version_id      TEXT PRIMARY KEY,
    mask_id         TEXT NOT NULL REFERENCES masks(mask_id),
    version_number  INTEGER NOT NULL,
    mask_path       TEXT NOT NULL,
    created_at      TEXT NOT NULL
);
```

### retouch_operations

```sql
CREATE TABLE retouch_operations (
    retouch_id      TEXT PRIMARY KEY,
    photo_id        TEXT NOT NULL REFERENCES photos(photo_id),
    retouch_type    TEXT NOT NULL,
    strength        REAL DEFAULT 0.5,
    parameters_json TEXT,
    created_at      TEXT NOT NULL
);
```

### crop_operations

```sql
CREATE TABLE crop_operations (
    crop_id     TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id),
    x           REAL NOT NULL,
    y           REAL NOT NULL,
    width       REAL NOT NULL,
    height      REAL NOT NULL,
    rotation    REAL DEFAULT 0,
    created_at  TEXT NOT NULL
);
```

### presets

```sql
CREATE TABLE presets (
    preset_id   TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT,
    author      TEXT,
    version     TEXT,
    created_at  TEXT NOT NULL
);
```

### preset_operations

```sql
CREATE TABLE preset_operations (
    preset_operation_id  TEXT PRIMARY KEY,
    preset_id            TEXT NOT NULL REFERENCES presets(preset_id),
    operation_type       TEXT NOT NULL,
    parameter_json       TEXT NOT NULL
);
```

### exports

```sql
CREATE TABLE exports (
    export_id   TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id),
    format      TEXT NOT NULL,
    resolution  TEXT,
    quality     INTEGER,
    output_path TEXT NOT NULL,
    exported_at TEXT NOT NULL
);
```

### export_profiles

```sql
CREATE TABLE export_profiles (
    profile_id      TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    settings_json   TEXT NOT NULL
);
```

### ai_profiles

```sql
CREATE TABLE ai_profiles (
    profile_id      TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    model_version   TEXT,
    training_count  INTEGER DEFAULT 0,
    accuracy_score  REAL DEFAULT 0,
    updated_at      TEXT NOT NULL
);
```

### ai_training_samples

```sql
CREATE TABLE ai_training_samples (
    sample_id   TEXT PRIMARY KEY,
    profile_id  TEXT NOT NULL REFERENCES ai_profiles(profile_id),
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id),
    scene_type  TEXT,
    accepted    INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL
);
```

### ai_predictions

```sql
CREATE TABLE ai_predictions (
    prediction_id   TEXT PRIMARY KEY,
    photo_id        TEXT NOT NULL REFERENCES photos(photo_id),
    prediction_type TEXT NOT NULL,
    confidence      REAL NOT NULL,
    result_json     TEXT NOT NULL,
    created_at      TEXT NOT NULL
);
```

### ai_feedback

```sql
CREATE TABLE ai_feedback (
    feedback_id      TEXT PRIMARY KEY,
    prediction_id    TEXT NOT NULL REFERENCES ai_predictions(prediction_id),
    accepted         INTEGER NOT NULL,
    difference_score REAL,
    created_at       TEXT NOT NULL
);
```

### ai_scene_analysis

```sql
CREATE TABLE ai_scene_analysis (
    analysis_id TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id),
    scene_type  TEXT NOT NULL,
    confidence  REAL NOT NULL,
    created_at  TEXT NOT NULL
);
```

### ai_face_embeddings

```sql
CREATE TABLE ai_face_embeddings (
    embedding_id    TEXT PRIMARY KEY,
    face_id         TEXT NOT NULL REFERENCES faces(face_id),
    embedding_path  TEXT NOT NULL,
    model_version   TEXT
);
```

### ai_job_queue

```sql
CREATE TABLE ai_job_queue (
    job_id      TEXT PRIMARY KEY,
    job_type    TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    priority    INTEGER DEFAULT 0,
    started_at  TEXT,
    completed_at TEXT
);
```

### thumbnails

```sql
CREATE TABLE thumbnails (
    thumbnail_id TEXT PRIMARY KEY,
    photo_id     TEXT NOT NULL REFERENCES photos(photo_id),
    size         INTEGER NOT NULL,
    file_path    TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);
```

### previews

```sql
CREATE TABLE previews (
    preview_id  TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id),
    resolution  TEXT NOT NULL,
    file_path   TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
```

### render_cache

```sql
CREATE TABLE render_cache (
    cache_id    TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id),
    cache_type  TEXT NOT NULL,
    cache_path  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
```

### plugin_registry

```sql
CREATE TABLE plugin_registry (
    plugin_id    TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    version      TEXT,
    author       TEXT,
    enabled      INTEGER DEFAULT 1,
    installed_at TEXT NOT NULL
);
```

### plugin_permissions

```sql
CREATE TABLE plugin_permissions (
    permission_id   TEXT PRIMARY KEY,
    plugin_id       TEXT NOT NULL REFERENCES plugin_registry(plugin_id),
    permission_type TEXT NOT NULL,
    granted         INTEGER DEFAULT 0
);
```

### audit_logs

```sql
CREATE TABLE audit_logs (
    log_id      TEXT PRIMARY KEY,
    event_type  TEXT NOT NULL,
    severity    TEXT DEFAULT 'info',
    message     TEXT,
    created_at  TEXT NOT NULL
);
```

### backups

```sql
CREATE TABLE backups (
    backup_id   TEXT PRIMARY KEY,
    catalog_id  TEXT NOT NULL REFERENCES catalogs(catalog_id),
    backup_path TEXT NOT NULL,
    backup_type TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
```

### photographers (dashboard sync)

```sql
CREATE TABLE photographers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    status      TEXT DEFAULT 'active',
    subscription TEXT,
    created_at  TEXT NOT NULL
);
```

### devices

```sql
CREATE TABLE devices (
    id                  TEXT PRIMARY KEY,
    photographer_id     TEXT NOT NULL REFERENCES photographers(id),
    device_name         TEXT NOT NULL,
    device_fingerprint  TEXT NOT NULL,
    last_seen           TEXT NOT NULL,
    status              TEXT DEFAULT 'active'
);
```

### licenses

```sql
CREATE TABLE licenses (
    id              TEXT PRIMARY KEY,
    photographer_id TEXT NOT NULL REFERENCES photographers(id),
    license_type    TEXT NOT NULL,
    expiry_date     TEXT,
    device_limit    INTEGER DEFAULT 1,
    status          TEXT DEFAULT 'active'
);
```

## 6.5 Index Strategy

| Table | Column | Purpose |
|-------|--------|---------|
| photos | file_hash | Duplicate detection |
| photos | capture_date | Timeline queries |
| photos | rating | Filter by rating |
| photos | catalog_id | Catalog isolation |
| faces | photo_id | Face lookup |
| faces | group_id | Group lookup |
| keywords | name | Keyword search |
| ai_predictions | photo_id | Prediction lookup |
| exports | photo_id | Export history |

## 6.6 Query Performance Goals

| Operation | Target |
|-----------|--------|
| Search | < 1 second |
| Open Catalog | < 3 seconds |
| Load Photo | < 100ms |
| Face Lookup | < 1 second |

## 6.7 Migration System

Every release requires:
- Migration Script
- Validation Script
- Rollback Script

## 6.8 Backup Strategy

| Type | Schedule | Contents |
|------|----------|----------|
| Automatic | Daily | Database, masks, presets, AI profiles |
| Manual | On Demand | Full catalog snapshot |

## 6.9 Sidecar Format

Extension: `.pae` (Photo Access Edit)

Stores:
- Edit graph
- Layers
- Masks
- Retouch data
- AI suggestions

## 6.10 Data Integrity Rules

1. Never delete original photos
2. Never modify originals
3. Always store edit instructions
4. Always keep history
5. All editing operations work offline

---

# 7. Library Module

## 7.1 Purpose

Manage large image collections.

## 7.2 Layout

```
+------------------------------------------------------+
| Left Panel    | Center Grid      | Right Panel       |
| Catalogs      | Grid View        | Metadata          |
| Albums        | Masonry View     | Keywords          |
| Collections   | Timeline View    | Ratings           |
| Smart Coll.   |                  | Flags             |
+------------------------------------------------------+
| Bottom Filmstrip                                     |
+------------------------------------------------------+
```

## 7.3 Grid View Options

| Thumbnail Size | Information Displayed |
|---------------|----------------------|
| Tiny | Rating, Flag only |
| Small | Rating, Flag, Filename |
| Medium | Rating, Flag, Filename, Camera |
| Large | Rating, Flag, Filename, Camera, Lens, ISO, Date |

## 7.4 Search System

Search by:
- Filename
- Camera
- Lens
- Rating
- Flag
- Keyword
- Date
- Face Group

## 7.5 Actions

- Import photos
- Delete photos
- Move photos
- Rate (1-5 stars)
- Flag (Pick/Reject/Review)
- Keyword assignment
- Album management
- Collection management

## 7.6 Smart Collections

Auto-populated based on rules:
- Rating >= 4
- Camera = "Canon R5"
- Date range
- Keyword contains

---

# 8. Culling Module

## 8.1 Purpose

Fast image selection.

## 8.2 Layout

```
+------------------------------------------------------+
| Left: Session  | Center: Comparison  | Right: AI     |
| Filters       | View                | Scores        |
|               |                     | Selection     |
+------------------------------------------------------+
```

## 8.3 Comparison View Modes

| Mode | Description |
|------|-------------|
| Single | One image full screen |
| 2 Up | Side-by-side comparison |
| 4 Up | Quad view |
| 8 Up | Grid comparison |

## 8.4 Capabilities

- Zoom Sync between views
- Pan Sync between views
- Side-by-side review

## 8.5 AI Culling Panel

| Score | Description |
|-------|-------------|
| Blur Score | Sharpness analysis |
| Eye Score | Open/closed eye detection |
| Composition Score | Rule of thirds, framing |
| Duplicate Score | Perceptual similarity |

## 8.6 Actions

- **Pick** — Mark as selected
- **Reject** — Mark as rejected
- **Review** — Mark for later review

## 8.7 AI Assistance

- Best shot recommendation
- Sharpness scoring
- Face quality scoring
- Closed-eye detection
- Burst comparison

---

# 9. Develop Module

## 9.1 Purpose

Professional RAW editing.

## 9.2 Layout

```
+------------------------------------------------------+
| Left: Presets  | Center: Photo Viewer | Right: Tools  |
| History       |                      | Histogram     |
| Snapshots     |                      | Adjustments   |
|               |                      | WB, Curves    |
+------------------------------------------------------+
| Bottom: Filmstrip                                    |
+------------------------------------------------------+
```

## 9.3 Viewer

| Capability | Description |
|-----------|-------------|
| Zoom 100% | Pixel-level view |
| Zoom Fit | Fit to screen |
| Zoom Fill | Fill screen |
| Compare Before/After | Split view |

**Rendering:** GPU accelerated

## 9.4 Histogram Panel

- RGB Histogram
- Luminance Histogram
- Clipping Warnings (Highlight/Shadow)

## 9.5 Basic Adjustments

| Control | Range |
|---------|-------|
| Exposure | -5.0 to +5.0 |
| Contrast | -100 to +100 |
| Highlights | -100 to +100 |
| Shadows | -100 to +100 |
| Whites | -100 to +100 |
| Blacks | -100 to +100 |
| Texture | 0 to 100 |
| Clarity | -100 to +100 |
| Dehaze | -100 to +100 |
| Vibrance | -100 to +100 |
| Saturation | -100 to +100 |

## 9.6 White Balance

| Control | Range |
|---------|-------|
| Temperature | 2000K to 50000K |
| Tint | -150 to +150 |

**Tool:** WB Picker (click on neutral area)

## 9.7 Curves Panel

| Channel | Description |
|---------|-------------|
| RGB | Combined curve |
| Red | Red channel |
| Green | Green channel |
| Blue | Blue channel |

**Capabilities:**
- Control points (add/remove/drag)
- Curve presets

## 9.8 HSL Panel

| Control | Colors |
|---------|--------|
| Hue | Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta |
| Saturation | Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta |
| Luminance | Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta |

## 9.9 Color Grading

| Wheel | Controls |
|-------|----------|
| Shadows | Hue, Saturation |
| Midtones | Hue, Saturation |
| Highlights | Hue, Saturation |
| Balance | Global balance |

## 9.10 LUT Panel

| Feature | Description |
|---------|-------------|
| Import LUT | Load .cube, .3dl files |
| Enable LUT | Toggle on/off |
| Blend Amount | 0-100% opacity |

## 9.11 Lens Corrections

- Distortion correction
- Vignetting correction
- Chromatic aberration removal

## 9.12 Crop Tool

| Ratio | Description |
|-------|-------------|
| Free | Any aspect ratio |
| 1:1 | Square |
| 4:5 | Portrait |
| 16:9 | Landscape |
| Custom | User-defined |

---

# 10. Masking Module

## 10.1 Purpose

Localized adjustments.

## 10.2 AI-Powered Masks

| Mask Type | AI Model |
|-----------|----------|
| Subject | SAM2 |
| Sky | SAM2 |
| Background | SAM2 |
| Face | InsightFace |
| Hair | InsightFace |
| Body | SAM2 |
| Clothing | SAM2 |

## 10.3 Manual Tools

- Brush
- Eraser
- Gradient
- Refine Edge

## 10.4 Mask Operations

- **Add** — Combine masks
- **Subtract** — Remove from mask
- **Intersect** — Overlap only
- **Invert** — Flip mask

## 10.5 Mask Panel

```
+------------------------------------------------------+
| AI Masks:                                            |
| [Subject] [Sky] [Background] [Face] [Hair]          |
|                                                      |
| Manual:                                              |
| [Brush] [Eraser] [Gradient]                         |
|                                                      |
| Operations:                                          |
| [Add] [Subtract] [Intersect] [Invert]               |
+------------------------------------------------------+
```

---

# 11. Retouch Module

## 11.1 Purpose

Portrait and fashion retouching.

## 11.2 Philosophy

Every retouch operation must:
- Be non-destructive
- Be layer-based
- Support undo/redo
- Support batch processing
- Support AI learning

**Original pixels are never modified.**

## 11.3 Layout

```
+------------------------------------------------------+
| Left: Retouch    | Center: Image    | Right: Retouch  |
| Categories       | Viewer          | Controls        |
+------------------------------------------------------+
```

## 11.4 Face Retouch Panel

| Tool | Description |
|------|-------------|
| Skin Smoothing | Reduce skin texture |
| Blemish Removal | Remove spots/acne |
| Pore Refinement | Minimize pores |
| Shine Reduction | Reduce oily areas |

| Control | Description |
|---------|-------------|
| Strength | 0-100% |
| Texture Preservation | Keep natural texture |

## 11.5 Eye Panel

| Tool | Description |
|------|-------------|
| Eye Brightening | Lighten eye area |
| Iris Enhancement | Enhance iris color/detail |
| Catchlight Enhancement | Add/enhance catchlights |

## 11.6 Teeth Panel

| Tool | Description |
|------|-------------|
| Whitening | Remove yellow tones |
| Brightness | Lighten teeth |
| Stain Reduction | Remove specific stains |

## 11.7 Hair Panel

| Tool | Description |
|------|-------------|
| Flyaway Removal | Remove stray hairs |
| Frizz Reduction | Smooth frizzy hair |
| Hair Enhancement | Improve texture/shine |

**AI Detection:**
- Hair boundary
- Stray hairs
- Hair texture

## 11.8 Body Panel

| Tool | Description |
|------|-------------|
| Body Skin Smoothing | Smooth body skin |
| Tone Balancing | Even skin tone |
| Shine Reduction | Reduce body shine |

**Mask Regions:**
- Arms
- Legs
- Hands
- Neck
- Shoulders

## 11.9 Clothing Panel

| Tool | Description |
|------|-------------|
| Wrinkle Reduction | Remove wrinkles |
| Fabric Cleanup | Remove lint/fuzz |
| Collar Straightening | Fix collar alignment |

**Future:** Garment Symmetry

## 11.10 Background Panel

| Tool | Description |
|------|-------------|
| Lens Blur | Simulate shallow DOF |
| Subject Isolation | Separate subject from BG |

**Presets:**
- f/1.2
- f/1.4
- f/2.0
- f/2.8
- f/4.0

| Control | Description |
|---------|-------------|
| Strength | Blur amount |
| Edge Protection | Clean subject edges |
| Depth Amount | Depth simulation |

## 11.11 Healing Tool

| Capability | Description |
|-----------|-------------|
| Spot Healing | Click to remove spots |
| Dust Removal | Remove sensor dust |
| Acne Removal | Remove blemishes |

| Control | Description |
|---------|-------------|
| Brush Size | Adjust brush diameter |
| Feather | Soft/hard edge |
| Opacity | Strength of effect |

## 11.12 Clone Tool

| Capability | Description |
|-----------|-------------|
| Source Point | Select clone source |
| Target Painting | Paint with source |
| Blend Controls | Seamless blending |

## 11.13 Frequency Separation

| Layer | Contains |
|-------|----------|
| Low Frequency | Color, Tone |
| High Frequency | Texture |

**Benefits:**
- Smooth skin while preserving texture
- Professional retouching workflow

## 11.14 Retouch Layer System

| Layer Type | Purpose |
|-----------|---------|
| Face Layer | Face retouching |
| Skin Layer | Skin smoothing |
| Body Layer | Body retouching |
| Hair Layer | Hair cleanup |
| Clothing Layer | Clothing cleanup |
| Blur Layer | Background blur |
| Healing Layer | Spot healing |
| Clone Layer | Clone operations |

**Operations:**
- Reorder
- Opacity control
- Visibility toggle
- Copy/Paste

## 11.15 AI Auto Retouch

```
Photo
    ↓
Face Detection (MediaPipe)
    ↓
Segmentation (InsightFace)
    ↓
Style Profile (Local)
    ↓
Retouch Recommendation
    ↓
Preview
    ↓
User Approval
```

**Outputs:**
- Skin smoothing settings
- Eye settings
- Teeth settings
- Hair settings
- Blur settings

---

# 12. AI Engine

## 12.1 Philosophy

The editor must function without internet access. All critical AI capabilities must run locally. Cloud services are optional enhancements.

## 12.2 AI Layer Architecture

```
Flutter UI
    ↓
AI Manager
    ↓
Model Manager
    ↓
Inference Engine (ONNX Runtime)
    ↓
Model Execution
    ↓
Results
```

## 12.3 AI Manager

**Responsibilities:**
- Schedule jobs
- Monitor jobs
- Prioritize jobs
- Cancel jobs

**Job Types:**
| Type | Description |
|------|-------------|
| Cull | AI scoring for selection |
| Mask | Automatic mask generation |
| Retouch | Portrait enhancement |
| Learning | Style training |
| Export | Batch processing |

## 12.4 AI Job Queue States

```
Pending → Running → Completed
                  → Failed
         → Paused
         → Cancelled
```

## 12.5 Model Manager

**Responsibilities:**
- Register models
- Update models
- Verify models
- Load models

**Metadata:**
- Name
- Version
- Size
- Checksum

## 12.6 Model Registry

| Model | Purpose |
|-------|---------|
| Face Detection | Locate faces in image |
| Face Parsing | Segment face regions |
| Hair Parsing | Segment hair region |
| Body Segmentation | Segment body regions |
| Subject Detection | Detect main subject |
| Background Removal | Remove/replace background |
| Scene Classification | Identify scene type |
| Retouch Prediction | Predict retouch settings |
| Crop Prediction | Predict crop suggestions |

## 12.7 GPU Strategy

| Priority | API | Platform |
|----------|-----|----------|
| 1 | DirectML | Windows |
| 1 | CUDA | Windows/Linux |
| 1 | Metal | macOS |
| 2 | Vulkan | Cross-platform |
| 3 | CPU | Fallback |

## 12.8 Memory Management

**Goals:**
- Support 100MP+ images
- Support large catalogs
- Support long sessions
- Avoid crashes

**Memory Pools:**
- Image Pool
- Mask Pool
- Preview Pool
- AI Pool

## 12.9 AI Culling Engine

| Input | Output |
|-------|--------|
| Photo | Sharpness Score |
| Metadata | Eye Score |
| Preview | Composition Score |
| | Duplicate Score |
| | Overall Score |

### Duplicate Detection Methods

1. Perceptual Hashing
2. Feature Embeddings
3. Similarity Search

## 12.10 Scene Analysis

| Scene Type | Description |
|-----------|-------------|
| Wedding | Wedding ceremony/reception |
| Portrait | Individual/group portrait |
| Studio | Controlled lighting |
| Landscape | Outdoor scenery |
| Sports | Athletic events |
| Indoor | Indoor events |
| Outdoor | Outdoor events |
| Night | Low-light photography |
| Event | General events |
| Fashion | Fashion photography |
| Product | Product photography |
| Wildlife | Animal photography |
| Architecture | Building/structure |

## 12.11 Face Detection Pipeline

```
Image
    ↓
MediaPipe
    ↓
Face Regions
    ↓
Face Database (SQLite)
```

## 12.12 Face Recognition Pipeline

```
Image
    ↓
InsightFace
    ↓
Embedding
    ↓
Face Matching
    ↓
Face Group
```

## 12.13 Face Parsing Pipeline

```
Image
    ↓
InsightFace / BiSeNet
    ↓
Skin Mask
    ↓
Hair Mask
    ↓
Eye Mask
    ↓
Lip Mask
    ↓
Teeth Mask
```

## 12.14 Subject Mask Pipeline

```
Image
    ↓
SAM2
    ↓
Subject Mask
    ↓
Mask Storage (SQLite + PNG)
```

## 12.15 Background Mask Pipeline

```
Image
    ↓
SAM2
    ↓
Background Mask
    ↓
Storage
```

## 12.16 Clothing Segmentation Pipeline

```
Image
    ↓
SAM2
    ↓
Clothing Mask
    ↓
Retouch Engine
```

## 12.17 Body Segmentation Pipeline

```
Image
    ↓
SAM2
    ↓
Body Regions (Arms, Legs, Hands, Neck, Shoulders)
    ↓
Retouch Engine
```

## 12.18 Hair Segmentation Pipeline

```
Image
    ↓
InsightFace
    ↓
Hair Mask
    ↓
Hair Retouch
```

## 12.19 Batch AI Processing

| Operation | Description |
|-----------|-------------|
| Batch Culling | Score all images |
| Batch Masking | Generate masks for all |
| Batch Retouching | Apply retouch to all |
| Batch Face Detection | Detect faces in all |
| Batch Scene Analysis | Analyze all scenes |

## 12.20 AI Cache

**Stores:**
- Inference results
- Embeddings
- Predictions
- Masks

**Purpose:** Speed — avoid recomputation.

## 12.21 Model Versioning

| Field | Description |
|-------|-------------|
| Version | Model version number |
| Date | Training date |
| Accuracy | Validation accuracy |
| Training Count | Number of training samples |
| Compatibility | Editor version requirement |

## 12.22 Performance Targets

| Operation | Target |
|-----------|--------|
| Face Detection | < 100ms |
| Mask Generation | < 1 second |
| Auto Retouch | < 2 seconds |
| Scene Analysis | < 500ms |
| Catalog Face Scan | Background task |

---

# 13. Style Learning System

## 13.1 Vision

Transform the editor from a traditional photo editor into an intelligent photography assistant. Unlike traditional presets, the system learns how each photographer edits.

**Goal:** Reduce editing time by 70-90%.

## 13.2 Core Philosophy

The AI never replaces the photographer. The AI should: Observe → Learn → Suggest → Improve. The photographer always remains in control.

## 13.3 Learning Domains

| Domain | What It Learns |
|--------|---------------|
| Editing Style | Exposure, WB, contrast, curves, HSL, color grading, LUTs |
| Retouch Style | Skin smoothing, blemish removal, hair cleanup, teeth whitening |
| Mask Style | Subject, background, sky, hair, face, clothing masks |
| Crop Style | Aspect ratios, position, tightness, subject placement |
| Culling Style | What photographer picks/rejects, composition preferences |
| Export Preferences | Sizes, watermarks, naming, color spaces, compression |

## 13.4 Photographer Profile

Each photographer receives:
- Editing Profile
- Retouch Profile
- Crop Profile
- Mask Profile
- Culling Profile
- Export Profile

## 13.5 Studio Profiles

| Profile Type | Use Case |
|-------------|----------|
| Individual | Single photographer |
| Studio Shared | Wedding studio |
| Team | Multi-photographer agency |
| Department | Large organization |

## 13.6 Dataset Architecture

```
Dataset/
├── images/
├── masks/
├── retouch/
├── exports/
├── metadata/
├── training/
└── models/
```

## 13.7 Training Sample Structure

| Component | Description |
|-----------|-------------|
| Input | Original image + metadata + camera info + scene analysis + face info |
| Output | Final edit + final retouch + final crop + final export |

## 13.8 Feature Categories

### Metadata Features
- Capture date, camera make/model, lens, ISO, aperture, shutter speed, focal length

### Scene Features
- Scene type (wedding, portrait, studio, sports, landscape, night, event, fashion, product, wildlife, architecture)

### Face Features
- Face count, eye position, head pose, smile probability, skin/hair/body area

### Image Features
- Brightness, contrast, dynamic range, color distribution, histogram, noise level, sharpness, texture density

### Editing Features
- Exposure, contrast, highlights, shadows, whites, blacks, temperature, tint, texture, clarity, dehaze, vibrance, saturation, curves, color wheels, LUTs

### Retouch Features
- Skin smoothing, pore reduction, acne removal, hair cleanup, eye enhancement, teeth whitening, body skin cleanup, clothing cleanup, background blur

### Crop Features
- Aspect ratio, crop coordinates, rotation, subject position, headroom, rule of thirds

### Mask Features
- Mask type, size, location, intensity, adjustments

## 13.9 Learning Pipeline

```
Original Image
    ↓
Scene Analysis
    ↓
Feature Extraction
    ↓
Edit Recording
    ↓
Dataset Generation
    ↓
Training
    ↓
Prediction Model
    ↓
Recommendations
```

## 13.10 Style Learning Workflow

```
Photographer Edits 100 Images
    ↓
System Extracts Features
    ↓
Creates Dataset
    ↓
Trains Profile
    ↓
Generates Predictions
    ↓
Photographer Reviews
    ↓
System Learns Again
```

## 13.11 Auto Models

### Auto Edit Model

| Input | Output |
|-------|--------|
| Scene | Exposure recommendation |
| Metadata | Color recommendation |
| Image Features | Mask recommendation |
| Profile | Crop recommendation |
| | Retouch recommendation |

### Auto Retouch Model

| Input | Output |
|-------|--------|
| Face Analysis | Retouch settings |
| Body Analysis | Strength values |
| Profile | Mask recommendations |

### Auto Crop Model

| Input | Output |
|-------|--------|
| Composition | Suggested crop |
| Faces | Confidence score |
| Profile | |

### Auto Mask Model

| Input | Output |
|-------|--------|
| Image | Mask recommendations |
| Scene | Adjustment recommendations |
| Profile | |

### Auto Cull Model

| Input | Output |
|-------|--------|
| Sharpness | Pick / Reject / Review |
| Eyes | |
| Smile | |
| Composition | |
| Profile | |

## 13.12 Feedback System

Every prediction is tracked:
- Accepted
- Modified
- Rejected

### Difference Analysis

```
Prediction
    ↓
Final User Result
    ↓
Difference Calculation
    ↓
Training Sample
```

## 13.13 Confidence System

| Score | Action |
|-------|--------|
| 95+ | Auto Apply |
| 80+ | Recommend |
| 60+ | Review Required |
| Below 60 | Hide Suggestion |

## 13.14 Success Metrics

| Timeframe | Target Acceptance |
|-----------|------------------|
| After 1 month | 70% |
| After 6 months | 85% |
| After large dataset | 90%+ |

## 13.15 Continuous Learning

```
Prediction
    ↓
User Adjustment
    ↓
Dataset Update
    ↓
Retraining
    ↓
Improved Prediction
```

## 13.16 Training Frequency

| Mode | Description |
|------|-------------|
| Manual | On-demand |
| Daily | Scheduled |
| Weekly | Scheduled |
| Nightly | Recommended |
| Background Continuous | Ideal |

## 13.17 Local vs Cloud Training

| Feature | Local | Cloud |
|---------|-------|-------|
| Technology | ONNX Runtime | PyTorch |
| Privacy | ✓ | Requires upload |
| Offline | ✓ | ✗ |
| Speed | Fast | Varies |
| Dataset Size | Limited | Unlimited |
| Team Learning | ✗ | ✓ |

## 13.18 Privacy Architecture

1. User owns data
2. No mandatory upload
3. Local first
4. Exportable datasets
5. Delete anytime

## 13.19 Model Packaging

```
model.onnx
metadata.json
version.json
accuracy.json
```

---

# 14. RAW Processing Engine

## 14.1 Purpose

Professional RAW editing engine that powers the editor.

## 14.2 Core Libraries

| Library | Purpose |
|---------|---------|
| LibRaw | RAW decoding, metadata extraction, camera support |
| RawTherapee | Reference for demosaicing, noise reduction, white balance, color science |
| OpenColorIO | Color management, LUT processing |

## 14.3 Processing Pipeline

```
RAW File
    ↓
Decode (LibRaw)
    ↓
Demosaic
    ↓
Color Transform (OpenColorIO)
    ↓
Preview Generation
    ↓
Adjustment Graph
    ↓
Render Engine
    ↓
Export
```

## 14.4 Supported RAW Formats

| Format | Camera Brands |
|--------|--------------|
| CR3 | Canon |
| NEF | Nikon |
| ARW | Sony |
| RAF | Fujifilm |
| DNG | Adobe/Various |

## 14.5 Adjustment Graph Operations

- Exposure
- Contrast
- Highlights
- Shadows
- Whites
- Blacks
- Temperature
- Tint
- Vibrance
- Saturation
- Curves
- HSL
- LUTs

**Requirements:** Non-destructive, layer-aware, GPU accelerated

## 14.6 Preview Engine

| Goal | Target |
|------|--------|
| Fast rendering | Real-time sliders |
| Progressive updates | Load quality progressively |
| Preview refresh | < 100ms |
| 4K support | Required |

## 14.7 Color Management

| Feature | Description |
|---------|-------------|
| ICC Profiles | Input/output color profiles |
| Camera Profiles | Camera-specific color |
| Display Profiles | Monitor calibration |
| Export Profiles | Output color space |

### Supported Color Spaces

- sRGB
- Adobe RGB
- ProPhoto RGB
- Display P3

## 14.8 LUT Engine

| Format | Support |
|--------|---------|
| .cube | Full |
| .3dl | Full |

**Capabilities:**
- Stack LUTs
- Adjust intensity
- Save LUT presets

## 14.9 Noise Reduction

| Type | Controls |
|------|----------|
| Luminance | Strength, Detail, Contrast |
| Color | Strength, Detail |
| AI Denoise | Future |

## 14.10 Sharpening

| Control | Description |
|---------|-------------|
| Amount | Sharpening strength |
| Radius | Edge radius |
| Detail | Detail preservation |
| Masking | Edge masking |

## 14.11 Lens Corrections

- Distortion correction
- Vignetting correction
- Chromatic aberration removal

## 14.12 Export Formats

| Format | Use Case |
|--------|----------|
| JPEG | Web, sharing |
| PNG | Transparency |
| TIFF | Print, archive |
| WebP | Web optimized |

---

# 15. Rendering Engine

## 15.1 Core Principles

1. Non-destructive editing
2. GPU-first rendering
3. CPU fallback
4. Real-time previews
5. Scalable architecture
6. Large catalog support

## 15.2 Processing Philosophy

```
Original Image + Edit Instructions = Rendered Result
```

The original image is never modified.

## 15.3 Render Pipeline

```
RAW
    ↓
Decode
    ↓
Demosaic
    ↓
Color Transform
    ↓
Edit Graph
    ↓
Layer Compositor
    ↓
Preview Renderer
    ↓
Display
```

## 15.4 Edit Graph Architecture

Every adjustment becomes a node:

| Node Type | Parameters |
|-----------|-----------|
| Exposure | Amount |
| Contrast | Amount |
| Curves | Control points |
| HSL | Per-color adjustments |
| Mask | Mask data + adjustments |
| Retouch | Retouch settings |
| Crop | x, y, width, height |
| Export | Format, quality, size |

### Node Structure

| Field | Description |
|-------|-------------|
| Node ID | Unique identifier |
| Node Type | Adjustment type |
| Parameters | JSON parameters |
| Dependencies | Required preceding nodes |
| Execution Order | Sequential order |
| Enabled State | On/off toggle |

### Node Execution Flow

```
Image → Node 1 → Node 2 → Node 3 → Output
```

## 15.5 Layer Architecture

### Layer Types

| Type | Purpose |
|------|---------|
| Adjustment | Color/tone adjustments |
| Mask | Localized adjustments |
| Retouch | Portrait retouching |
| Healing | Spot removal |
| Clone | Content duplication |
| AI | AI-generated effects |

### Layer Stack Order

```
Top Layer
    ↓
Retouch
    ↓
Mask
    ↓
Color Grade
    ↓
Basic Adjustments
    ↓
Image (Bottom)
```

### Layer Operations

- Opacity control
- Visibility toggle
- Reordering
- Grouping
- Duplication
- Merge preview

## 15.6 Mask Compositor

**Combines:**
- Subject Masks
- Background Masks
- Face Masks
- Hair Masks
- Body Masks
- Clothing Masks

**Operations:**
- Add
- Subtract
- Intersect
- Invert

## 15.7 Retouch Compositor

**Combines:**
- Skin Retouch
- Hair Retouch
- Clothing Cleanup
- Healing
- Clone Operations

## 15.8 Healing Engine

```
Target Area
    ↓
Reference Sampling
    ↓
Blend Operation
    ↓
Result Layer
```

## 15.9 Clone Engine

```
Source Area
    ↓
Target Area
    ↓
Blend
    ↓
Output Layer
```

## 15.10 Render Scheduler

**Responsibilities:**
- Dependency analysis
- Parallel execution
- Cache reuse
- Priority scheduling

## 15.11 Tile-Based Rendering

**Purpose:** Large image support.

```
Image
    ↓
Tiles
    ↓
Process Tiles (parallel)
    ↓
Merge Tiles
```

**Benefits:**
- Low memory usage
- Faster previews

## 15.12 GPU Rendering

| Priority | API | Platform |
|----------|-----|----------|
| 1 | Vulkan | Cross-platform |
| 1 | DirectX | Windows |
| 1 | Metal | macOS |
| 2 | OpenGL | Fallback |

### Shader System

Used for:
- Exposure
- Curves
- Color Grading
- Masks
- Blur
- Preview Rendering

## 15.13 CPU Renderer

**Purpose:** Fallback when GPU unavailable.

**Requirement:** Feature parity with GPU renderer.

## 15.14 Preview Engine

```
Edit Change
    ↓
Invalidate Cache
    ↓
Partial Re-render
    ↓
Display Update
```

### Preview Levels

| Level | Resolution |
|-------|-----------|
| Small | 256px |
| Medium | 512px |
| Large | 1024px |
| Full | Original |

### Smart Re-rendering

Only changed regions re-render. Benefits: Speed, responsiveness.

## 15.15 Histogram Engine

- RGB Histogram
- Luminance Histogram
- Clipping Indicators
- Real-time updates

## 15.16 Cache Architecture

| Cache Type | Purpose |
|-----------|---------|
| Thumbnail Cache | Fast browsing (128, 256, 512, 1024px) |
| Preview Cache | Fast editing |
| Render Cache | Avoid duplicate processing |
| AI Cache | Embeddings, masks, predictions |

## 15.17 Memory Management

**Memory Pools:**
- Image Pool
- Mask Pool
- Preview Pool
- AI Pool

**Resource Monitoring:**
- CPU usage
- GPU usage
- RAM usage
- VRAM usage
- Disk cache

## 15.18 Background Processing

| Job | Thread |
|-----|--------|
| Preview Generation | Render thread |
| Thumbnail Generation | Background |
| Face Detection | AI thread |
| Mask Generation | AI thread |
| AI Learning | Background |
| Exporting | Export thread |

## 15.19 Undo/Redo Engine

**Stores:**
- Edit operations
- Layer operations
- Mask operations
- Retouch operations

**Capabilities:**
- Unlimited history
- Session recovery

## 15.20 Snapshot System

Stores complete edit state.

**Use Cases:**
- Before Retouch
- Before Color Grade
- Final Version

## 15.21 Future Modules

| Module | Requirements |
|--------|-------------|
| HDR Support | HDR rendering, HDR export, HDR preview |
| Panorama | Alignment, stitching, blending |
| Focus Stacking | Image alignment, sharp region detection, merge |
| Video Compatibility | Render graph, mask system, AI system for video frames |

---

# 16. Export Engine

## 16.1 Formats

| Format | Use Case | Quality Controls |
|--------|----------|-----------------|
| JPEG | Web, sharing | Compression, quality 1-100 |
| PNG | Transparency | Compression level |
| TIFF | Print, archive | Bit depth, compression |
| WebP | Web optimized | Quality, lossless option |

## 16.2 Options

| Option | Description |
|--------|-------------|
| Resize | Scale to target dimensions |
| Watermark | Add text/image watermark |
| Rename | Custom naming rules |
| Metadata | Include/exclude EXIF |
| Color Space | sRGB, Adobe RGB, ProPhoto |
| Batch Export | Export multiple images |

## 16.3 Batch Export

```
Select Photos
    ↓
Choose Export Profile
    ↓
Set Options
    ↓
Queue Export
    ↓
Progress Monitoring
    ↓
Complete
```

## 16.4 Export Profiles

| Profile | Settings |
|---------|----------|
| Web | JPEG, sRGB, 2048px, 85% quality |
| Print | TIFF, Adobe RGB, 300dpi, 16-bit |
| Social | JPEG, sRGB, 1080px, 80% quality |
| Archive | TIFF, ProPhoto, Full resolution |

---

# 17. Plugin SDK

## 17.1 Philosophy

```
Core Editor + Plugin System = Expandable Platform
```

Every major feature should be capable of becoming a plugin.

## 17.2 Plugin Categories

| Category | Description |
|----------|-------------|
| Editing | New adjustments, filters, effects |
| Retouch | Custom retouching tools |
| AI | New detection/segmentation models |
| Import | New import formats |
| Export | New export formats |
| Preset | Preset collections |
| Color | Custom color pipelines |
| Utility | File renaming, metadata cleanup |

## 17.3 Plugin Manager

**Responsibilities:**
- Install plugins
- Remove plugins
- Enable plugins
- Disable plugins
- Update plugins

## 17.4 Plugin Registry

| Field | Description |
|-------|-------------|
| Plugin ID | Unique identifier |
| Plugin Name | Display name |
| Version | Semantic version |
| Author | Plugin author |
| Description | What it does |
| Compatibility | Required editor version |
| Signature | Security signature |
| Permissions | Required permissions |

## 17.5 Plugin Folder Structure

```
Plugins/
└── Plugin_Name/
    ├── manifest.json
    ├── assets/
    ├── models/
    ├── scripts/
    ├── ui/
    └── docs/
```

## 17.6 Plugin Manifest

```json
{
  "name": "Plugin Name",
  "id": "com.example.plugin",
  "version": "1.0.0",
  "author": "Author Name",
  "requiredEditorVersion": ">=1.0.0",
  "permissions": ["ui", "catalog"],
  "capabilities": ["panel", "tool"]
}
```

## 17.7 Plugin Lifecycle

```
Install → Validate → Register → Load → Initialize → Execute → Shutdown
```

## 17.8 Plugin API Capabilities

| API | Description |
|-----|-------------|
| Register Menu | Add menu items |
| Register Panel | Add UI panels |
| Register Tool | Add editing tools |
| Register AI Model | Add AI models |
| Register Export Format | Add export formats |
| Register Preset Pack | Add preset collections |

## 17.9 Security Model

All plugins must declare:
- File Access
- Database Access
- Network Access
- AI Access
- GPU Access

### Permission Levels

| Level | Access |
|-------|--------|
| Low Risk | UI only |
| Medium Risk | Catalog access |
| High Risk | File system, network |

## 17.10 Sandboxing

- Plugins execute in isolated environments
- Plugin failure → Plugin disabled → Editor continues
- Crash protection

## 17.11 Marketplace (Future)

| Feature | Description |
|---------|-------------|
| Browse | Discover plugins |
| Install | One-click install |
| Rate | User ratings |
| Update | Automatic updates |
| Purchase | Paid plugins |

---

# 18. UI/UX Specification

## 18.1 Primary Navigation

Five primary workspaces:

| Workspace | Shortcut | Purpose |
|-----------|----------|---------|
| Library | G | Manage collections |
| Cull | C | Fast selection |
| Develop | D | RAW editing |
| Retouch | R | Portrait enhancement |
| Export | E | Output files |

## 18.2 Global Layout

```
+------------------------------------------------------+
| Top Bar                                              |
+------------------------------------------------------+
| Left Panel | Main Workspace | Right Tool Panels      |
+------------------------------------------------------+
| Bottom Filmstrip                                     |
+------------------------------------------------------+
```

**Requirements:**
- Dockable panels
- Collapsible panels
- Multi-monitor support
- Workspace presets
- Custom layouts

## 18.3 Top Bar

| Section | Items |
|---------|-------|
| File | Import, Open Catalog, New Catalog |
| Edit | Undo, Redo, Preferences |
| View | Zoom, Panels, Workspace |
| AI | AI Status, Auto Edit, Auto Retouch |
| Help | Documentation, Updates |

**Indicators:**
- GPU active
- AI active
- Background jobs
- Export queue

## 18.4 Workspace Presets

| Preset | Layout |
|--------|--------|
| Wedding Editing | Library + Develop + Filmstrip |
| Portrait Retouching | Retouch + Face panels |
| Sports Workflow | Cull + Quick edit |

Users can save custom layouts.

## 18.5 Screen Inventory

| Screen | Purpose |
|--------|---------|
| Startup Dashboard | Quick access to catalogs |
| Library | Photo management |
| Import Wizard | Photo import |
| Cull | Image selection |
| Develop | RAW editing |
| Mask Manager | Mask creation |
| Layers Panel | Layer management |
| Retouch | Portrait retouching |
| Face Retouch Panel | Skin, blemish, shine |
| Eye Enhancement | Brightening, iris |
| Teeth Enhancement | Whitening, brightness |
| Hair Enhancement | Flyaway, frizz |
| Body Retouch | Skin, tone, shine |
| Clothing Cleanup | Wrinkles, fabric |
| Background Blur | Lens blur, isolation |
| AI Assistant | AI dashboard |
| Preset Manager | Preset management |
| Face Manager | Face organization |
| Batch Processing | Bulk operations |
| Export | Output settings |
| Plugin Manager | Plugin management |
| Settings | Application settings |
| Catalog Health | Database status |
| AI Training Center | Training monitoring |
| Workspace Manager | Layout management |

---

# 19. Keyboard Shortcuts

## 19.1 Workspace Shortcuts

| Key | Action |
|-----|--------|
| G | Library |
| C | Cull |
| D | Develop |
| R | Retouch |
| E | Export |

## 19.2 Edit Shortcuts

| Key | Action |
|-----|--------|
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+S | Save |
| Ctrl+O | Open |
| Ctrl+N | New Catalog |
| Ctrl+I | Import |

## 19.3 View Shortcuts

| Key | Action |
|-----|--------|
| Space | Toggle zoom |
| F | Fullscreen |
| Tab | Toggle panels |
| 1 | Zoom 100% |
| 0 | Zoom Fit |

## 19.4 Tool Shortcuts

| Key | Action |
|-----|--------|
| B | Brush |
| E | Eraser |
| G | Gradient |
| H | Healing |
| C | Clone |

---

# 20. Performance Targets

## 20.1 Core Targets

| Operation | Target |
|-----------|--------|
| Import 1000 Photos | < 60 seconds |
| Preview Refresh | < 100ms |
| Mask Generation | < 1 second |
| Auto Retouch | < 2 seconds |
| Scene Analysis | < 500ms |
| Face Detection | < 100ms |
| Database Open | < 3 seconds |
| Search | < 1 second |

## 20.2 Scale Targets

| Metric | Target |
|--------|--------|
| Catalog Size | 100,000+ photos |
| Image Resolution | 100MP+ |
| Session Duration | 8+ hours without issues |
| Memory Usage | Stable under load |

## 20.3 Display Support

- 4K displays
- Multi-monitor setups
- High DPI scaling
- Smooth scrolling

---

# 21. Security & Privacy

## 21.1 Data Principles

1. All editing happens locally
2. No mandatory cloud uploads
3. User owns all data
4. AI training data stays local
5. Exportable datasets
6. Delete anytime

## 21.2 Authentication

- JWT tokens
- Device fingerprinting
- License validation
- Session management

## 21.3 Plugin Security

- Permission declarations
- Sandboxed execution
- Signature verification
- Crash isolation

## 21.4 File Security

- Validate file imports
- Scan for malicious content
- Safe model downloads
- Database migration validation

---

# 22. Phased Implementation Plan

## Phase 1: Foundation (Months 1-2)

**Goal:** Working app that opens RAW files and lets you edit them.

### Month 1: Project Setup + Database

| Task | Details |
|------|---------|
| Create Flutter Desktop project | Scaffolding, routing, workspace tabs |
| Set up Rust service layer | raw_engine, render_engine |
| Write SQLite schema (Part 13) | All core tables |
| Implement Drift ORM | Type-safe queries, migrations |
| Build catalog engine | CRUD operations |
| Set up flutter_rust_bridge | Flutter ↔ Rust communication |

### Month 2: RAW Engine + Basic UI

| Task | Details |
|------|---------|
| Clone LibRaw | Rust FFI bindings |
| Implement RAW decoding | CR3, NEF, ARW, RAF, DNG |
| Generate thumbnails | Background processing |
| Build Library workspace | Grid view, metadata panel, filmstrip |
| Build Import wizard | File selection, metadata extraction |
| Build Develop workspace | Photo viewer, histogram, basic sliders |

**Deliverable:** Can import RAW files, browse library, adjust exposure/contrast/WB, export JPEG.

---

## Phase 2: Editing Engine (Months 3-4)

**Goal:** Full non-destructive editing with layers and masks.

### Month 3: Edit Graph + Advanced Tools

| Task | Details |
|------|---------|
| Implement node-based edit graph | Non-destructive pipeline |
| Add all basic adjustment nodes | Highlights, shadows, whites, blacks, etc. |
| Implement Curves panel | RGB + individual channels |
| Implement HSL panel | Per-color hue/sat/luminance |
| Implement Color Grading | Shadows/midtones/highlights wheels |
| Implement LUT engine | Import .cube/.3dl files |
| Build undo/redo system | Full history |

### Month 4: Masking + Layers

| Task | Details |
|------|---------|
| Integrate SAM2 | Subject/background/sky masks |
| Build mask editor | Brush, eraser, gradient |
| Implement mask operations | Add, subtract, intersect, invert |
| Build layers panel | Adjustment, mask, retouch layers |
| Implement layer compositor | Stack, opacity, visibility |
| Add lens corrections | Distortion, vignetting, chromatic aberration |
| Add crop tool | Free, 1:1, 4:5, 16:9, custom |

**Deliverable:** Full editing workflow with layers, masks, and non-destructive pipeline.

---

## Phase 3: AI Integration (Months 5-6)

**Goal:** AI-powered culling, masking, and retouching.

### Month 5: AI Culling + Face Detection

| Task | Details |
|------|---------|
| Integrate OpenCV | Blur detection, sharpness analysis |
| Implement AI culling | Sharpness, eye, composition, duplicate scores |
| Build Cull workspace | Comparison view, 2/4/8 up |
| Integrate MediaPipe | Face landmarks, eye detection |
| Integrate InsightFace | Face recognition, grouping |
| Build Face Manager | Merge, rename, search faces |
| Implement scene analysis | Wedding, portrait, studio, etc. |

### Month 6: AI Retouch + Auto Edit

| Task | Details |
|------|---------|
| Integrate GFPGAN | Portrait restoration |
| Integrate CodeFormer | Face enhancement |
| Build Retouch workspace | Face, eyes, teeth, hair, body, clothing |
| Implement healing tool | Spot healing, dust removal |
| Implement clone tool | Source selection, target painting |
| Build background blur | Lens blur presets (f/1.2 - f/4.0) |
| Build AI Assistant panel | Auto edit, auto retouch, auto crop |

**Deliverable:** AI-powered selection, face detection, portrait retouching.

---

## Phase 4: Style Learning (Months 7-8)

**Goal:** AI learns photographer's editing style.

### Month 7: Training System

| Task | Details |
|------|---------|
| Build dataset engine | Record edits, retouch, crops, masks |
| Implement feature extraction | Metadata, scene, face, image features |
| Build AI profile system | Per-photographer profiles |
| Implement training pipeline | Local ONNX training |
| Build feedback loop | Track accepted/modified/rejected |
| Implement confidence system | 0-100 scoring |

### Month 8: Auto Models

| Task | Details |
|------|---------|
| Implement Auto Edit model | Predict exposure, color, crop |
| Implement Auto Retouch model | Predict retouch settings |
| Implement Auto Crop model | Predict crop suggestions |
| Implement Auto Mask model | Predict mask needs |
| Build batch processing | Apply AI to entire gallery |
| Build preset system | Create, import, export presets |

**Deliverable:** AI learns from edits, suggests improvements, batch automation.

---

## Phase 5: Export & Polish (Months 9-10)

**Goal:** Professional export, dashboard integration, polish.

### Month 9: Export + Dashboard Integration

| Task | Details |
|------|---------|
| Build export engine | JPEG, PNG, TIFF, WebP |
| Implement batch export | Queue management |
| Implement export profiles | Web, print, social, archive |
| Integrate Photo Access API | Auth, subscription, clients |
| Implement gallery publishing | Select photos → publish to gallery |
| Implement preset sync | Upload/download presets |
| Build update system | Check, download, install |

### Month 10: Polish + Performance

| Task | Details |
|------|---------|
| Optimize rendering | GPU acceleration, tile rendering |
| Optimize memory | Pools, monitoring, cleanup |
| Optimize caching | Thumbnail, preview, render, AI |
| Implement workspace presets | Save/load custom layouts |
| Multi-monitor support | Detach panels |
| Keyboard shortcuts | All shortcuts from spec |
| Accessibility | Screen readers, high contrast |

**Deliverable:** Production-ready editor with full workflow.

---

## Phase 6: Plugin System (Months 11-12)

**Goal:** Extensible platform with marketplace.

### Month 11: Plugin SDK

| Task | Details |
|------|---------|
| Build plugin manager | Install, enable, disable, remove |
| Build plugin registry | Metadata, versions, signatures |
| Implement plugin API | Register panels, tools, models |
| Implement sandboxing | Isolated execution, crash protection |
| Build permission system | Low/medium/high risk levels |

### Month 12: Beta Release

| Task | Details |
|------|---------|
| Build marketplace UI | Browse, install, rate |
| Packaging | Windows MSIX, macOS DMG, Linux AppImage |
| CI/CD pipeline | GitHub Actions |
| Documentation | Architecture, API, user guide |
| Beta testing | Photographer feedback |
| Bug fixes | Critical issues |

**Deliverable:** Beta release with plugin support.

---

## Phase 7: Production Release (Months 13-14)

| Task | Details |
|------|---------|
| Performance profiling | Identify bottlenecks |
| Large catalog testing | 100K+ photos |
| Security audit | Validate all inputs |
| Documentation | Complete user guide |
| Marketing materials | Screenshots, videos |
| Production release | v1.0 |
| Support system | Email, docs, FAQ |

---

# 23. Testing Strategy

## 23.1 Testing Levels

| Level | Description |
|-------|-------------|
| Unit | Individual functions/components |
| Integration | Module interactions |
| Performance | Speed and resource usage |
| AI Validation | Accuracy of AI features |
| UI Testing | User interface correctness |

## 23.2 Flutter Unit Tests

- Widgets
- State management
- Navigation
- Forms
- Validation

## 23.3 Rust Unit Tests

- RAW engine
- Masks
- Layers
- Rendering
- Database

## 23.4 Integration Tests

- Import workflow
- Edit workflow
- Mask workflow
- Retouch workflow
- Export workflow

## 23.5 AI Validation Tests

| Test | Validation |
|------|-----------|
| Face Detection | Accuracy, speed |
| Mask Quality | Clean edges, accuracy |
| Retouch Quality | Natural appearance |
| Crop Accuracy | Composition quality |
| Prediction Accuracy | User acceptance rate |

## 23.6 Performance Tests

| Metric | Target |
|--------|--------|
| Import Speed | 1000 photos < 60s |
| Preview Speed | < 100ms refresh |
| Render Speed | Real-time sliders |
| Export Speed | Batch < 5min for 100 |
| AI Speed | Mask < 1s, Retouch < 2s |

---

# 24. CI/CD & Packaging

## 24.1 CI/CD Pipeline

```
Code Push
    ↓
Build
    ↓
Test
    ↓
Lint
    ↓
Package
    ↓
Release
```

## 24.2 Git Branch Strategy

| Branch | Purpose |
|--------|---------|
| main | Production releases |
| develop | Integration branch |
| feature/* | Feature development |
| release/* | Release preparation |
| hotfix/* | Critical fixes |

## 24.3 Pull Request Rules

Every PR requires:
- Tests passing
- Code review
- Documentation updated
- CI passing

## 24.4 Packaging

| Platform | Format | Future |
|----------|--------|--------|
| Windows | MSIX, EXE Installer | Microsoft Store |
| macOS | DMG | App Store |
| Linux | AppImage, DEB, RPM | Flatpak |

## 24.5 Release Stages

| Stage | Description |
|-------|-------------|
| Alpha | Internal testing |
| Beta | External testing |
| Release Candidate | Pre-production |
| Production | Public release |

---

# 25. Release Roadmap

| Version | Features |
|---------|----------|
| **v0.1** | Library, Develop, Export (MVP) |
| **v0.2** | AI Culling, Face Detection, Basic Masking |
| **v0.3** | Retouching, Healing, Clone, Background Blur |
| **v0.4** | Style Learning, AI Profiles, Auto Edit |
| **v0.5** | Advanced AI Retouch, Batch AI, Face Grouping |
| **v1.0** | Professional Release (all features) |
| **v2.0** | Studio Edition (team features, shared profiles) |
| **v3.0** | Cloud Features (sync, marketplace) |

---

# 26. Acceptance Criteria

## 26.1 Core

- [ ] Professional RAW editing
- [ ] Non-destructive edit graph
- [ ] Layer compositor
- [ ] Mask compositor
- [ ] Retouch compositor
- [ ] Tile-based rendering
- [ ] GPU rendering with CPU fallback
- [ ] Smart cache system
- [ ] Multi-threading
- [ ] 100,000+ photo catalog support

## 26.2 AI

- [ ] AI culling
- [ ] AI masking (subject, sky, background, face, hair, clothing)
- [ ] AI retouching
- [ ] AI face recognition
- [ ] AI style learning
- [ ] AI scene analysis
- [ ] AI auto edit
- [ ] AI auto crop
- [ ] Local AI (offline)
- [ ] GPU acceleration
- [ ] Model versioning

## 26.3 Retouching

- [ ] Face retouching (skin, blemish, pores, shine)
- [ ] Eye enhancement (brightening, iris, catchlight)
- [ ] Teeth whitening
- [ ] Hair cleanup (flyaway, frizz)
- [ ] Body retouching (skin, tone, shine)
- [ ] Clothing cleanup (wrinkles, fabric, collar)
- [ ] Background blur (lens profiles)
- [ ] Healing tool
- [ ] Clone tool
- [ ] Frequency separation
- [ ] AI auto retouch

## 26.4 Integration

- [ ] Dashboard authentication
- [ ] Subscription validation
- [ ] Client retrieval
- [ ] Booking retrieval
- [ ] Gallery publishing
- [ ] Preset sync
- [ ] Software updates

## 26.5 Platform

- [ ] Offline-first architecture
- [ ] Plugin system
- [ ] Marketplace ready
- [ ] Cross-platform (Windows, macOS, Linux)
- [ ] 4K display support
- [ ] Multi-monitor support
- [ ] Keyboard shortcuts
- [ ] Dark mode / Light mode
- [ ] Accessibility

---

# Appendix A: Document Sources

| Part | Title | Focus |
|------|-------|-------|
| 1 | Repository Integration Master Spec | Repositories, AI architecture, workflow |
| 2 | Editor Only Spec Part 2 | Modules, retouch, AI learning |
| 3 | RAW Processing & Rendering Engine | LibRaw, color management, pipeline |
| 4 | AI Retouching Architecture | Face, body, hair, clothing retouching |
| 5 | Style Learning & AI Automation | Learning pipeline, auto edit |
| 6 | Complete Desktop UI/UX Spec | All screens, panels, interactions |
| 7 | Database Architecture | SQLite schema, storage, catalog |
| 8 | AI Engine & Model Orchestration | AI pipeline, models, inference |
| 9 | Plugin SDK & Extension System | Plugin architecture, marketplace |
| 10 | Enterprise Editing Engine Internals | Render graph, layers, cache, GPU |
| 11 | Enterprise Roadmap & Blueprint | Dev phases, testing, packaging |
| 12 | Screen-by-Screen PRD | Functional requirements per screen |
| 13 | Production SQLite Schema | Complete database design |
| 14 | AI Training & Dataset Engineering | Learning system, profiles, feedback |
| 15 | Engineering Implementation Guide | Tech stack, project structure, build |
| 16 | GitHub Repository Inventory | All repos, clone strategy |
| 17 | Dashboard & Desktop Integration | Auth, subscriptions, publishing |

---

*End of Master Specification*
