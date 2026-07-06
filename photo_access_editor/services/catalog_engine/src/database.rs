use anyhow::Result;
use rusqlite::{Connection, params};
use std::path::Path;
use log::info;

pub struct CatalogDatabase {
    conn: Connection,
}

impl CatalogDatabase {
    pub fn open(db_path: &Path) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Self { conn };
        db.initialize()?;
        Ok(db)
    }

    pub fn open_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.initialize()?;
        Ok(db)
    }

    fn initialize(&self) -> Result<()> {
        self.conn.execute_batch("PRAGMA journal_mode=WAL;")?;
        self.conn.execute_batch("PRAGMA foreign_keys=ON;")?;
        self.create_tables()?;
        info!("Database initialized successfully");
        Ok(())
    }

    fn create_tables(&self) -> Result<()> {
        self.conn.execute_batch(SCHEMA)?;
        Ok(())
    }

    pub fn connection(&self) -> &Connection {
        &self.conn
    }
}

const SCHEMA: &str = r#"
-- Catalogs
CREATE TABLE IF NOT EXISTS catalogs (
    catalog_id    TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT,
    version       TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    status        TEXT DEFAULT 'active'
);

-- Photos
CREATE TABLE IF NOT EXISTS photos (
    photo_id        TEXT PRIMARY KEY,
    catalog_id      TEXT NOT NULL REFERENCES catalogs(catalog_id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_photos_file_hash ON photos(file_hash);
CREATE INDEX IF NOT EXISTS idx_photos_capture_date ON photos(capture_date);
CREATE INDEX IF NOT EXISTS idx_photos_rating ON photos(rating);
CREATE INDEX IF NOT EXISTS idx_photos_catalog ON photos(catalog_id);
CREATE INDEX IF NOT EXISTS idx_photos_flag ON photos(flag);

-- Photo Metadata
CREATE TABLE IF NOT EXISTS photo_metadata (
    metadata_id     TEXT PRIMARY KEY,
    photo_id        TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    gps             TEXT,
    copyright       TEXT,
    author          TEXT,
    description     TEXT,
    keywords_json   TEXT
);

-- Albums
CREATE TABLE IF NOT EXISTS albums (
    album_id    TEXT PRIMARY KEY,
    catalog_id  TEXT NOT NULL REFERENCES catalogs(catalog_id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

-- Album Photos
CREATE TABLE IF NOT EXISTS album_photos (
    album_id    TEXT NOT NULL REFERENCES albums(album_id) ON DELETE CASCADE,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    sort_order  INTEGER DEFAULT 0,
    PRIMARY KEY (album_id, photo_id)
);

-- Collections
CREATE TABLE IF NOT EXISTS collections (
    collection_id   TEXT PRIMARY KEY,
    catalog_id      TEXT NOT NULL REFERENCES catalogs(catalog_id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL DEFAULT 'manual',
    created_at      TEXT NOT NULL
);

-- Collection Photos
CREATE TABLE IF NOT EXISTS collection_photos (
    collection_id   TEXT NOT NULL REFERENCES collections(collection_id) ON DELETE CASCADE,
    photo_id        TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    PRIMARY KEY (collection_id, photo_id)
);

-- Keywords
CREATE TABLE IF NOT EXISTS keywords (
    keyword_id  TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE
);

-- Photo Keywords
CREATE TABLE IF NOT EXISTS photo_keywords (
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    keyword_id  TEXT NOT NULL REFERENCES keywords(keyword_id) ON DELETE CASCADE,
    PRIMARY KEY (photo_id, keyword_id)
);

-- Face Groups
CREATE TABLE IF NOT EXISTS face_groups (
    group_id        TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    cover_face_id   TEXT,
    created_at      TEXT NOT NULL
);

-- Faces
CREATE TABLE IF NOT EXISTS faces (
    face_id         TEXT PRIMARY KEY,
    photo_id        TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    bounding_box    TEXT NOT NULL,
    embedding_path  TEXT,
    confidence      REAL,
    group_id        TEXT REFERENCES face_groups(group_id)
);

CREATE INDEX IF NOT EXISTS idx_faces_photo_id ON faces(photo_id);
CREATE INDEX IF NOT EXISTS idx_faces_group_id ON faces(group_id);

-- Edit Sessions
CREATE TABLE IF NOT EXISTS edit_sessions (
    session_id  TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    status      TEXT DEFAULT 'active'
);

-- Edit Operations
CREATE TABLE IF NOT EXISTS edit_operations (
    operation_id    TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES edit_sessions(session_id) ON DELETE CASCADE,
    operation_type  TEXT NOT NULL,
    parameter_json  TEXT NOT NULL,
    execution_order INTEGER NOT NULL,
    created_at      TEXT NOT NULL
);

-- Edit Graph Nodes
CREATE TABLE IF NOT EXISTS edit_graph_nodes (
    node_id            TEXT PRIMARY KEY,
    session_id         TEXT NOT NULL REFERENCES edit_sessions(session_id) ON DELETE CASCADE,
    node_type          TEXT NOT NULL,
    dependency_node    TEXT,
    enabled            INTEGER DEFAULT 1,
    parameters_json    TEXT,
    execution_order    INTEGER NOT NULL
);

-- History
CREATE TABLE IF NOT EXISTS history (
    history_id  TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES edit_sessions(session_id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    timestamp   TEXT NOT NULL
);

-- Snapshots
CREATE TABLE IF NOT EXISTS snapshots (
    snapshot_id     TEXT PRIMARY KEY,
    photo_id        TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    graph_state     TEXT NOT NULL,
    created_at      TEXT NOT NULL
);

-- Layers
CREATE TABLE IF NOT EXISTS layers (
    layer_id    TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    layer_type  TEXT NOT NULL,
    name        TEXT NOT NULL,
    opacity     REAL DEFAULT 1.0,
    visible     INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL
);

-- Layer Groups
CREATE TABLE IF NOT EXISTS layer_groups (
    group_id    TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

-- Layer Members
CREATE TABLE IF NOT EXISTS layer_members (
    group_id    TEXT NOT NULL REFERENCES layer_groups(group_id) ON DELETE CASCADE,
    layer_id    TEXT NOT NULL REFERENCES layers(layer_id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, layer_id)
);

-- Masks
CREATE TABLE IF NOT EXISTS masks (
    mask_id     TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    layer_id    TEXT REFERENCES layers(layer_id),
    mask_type   TEXT NOT NULL,
    mask_path   TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

-- Mask Versions
CREATE TABLE IF NOT EXISTS mask_versions (
    version_id      TEXT PRIMARY KEY,
    mask_id         TEXT NOT NULL REFERENCES masks(mask_id) ON DELETE CASCADE,
    version_number  INTEGER NOT NULL,
    mask_path       TEXT NOT NULL,
    created_at      TEXT NOT NULL
);

-- Retouch Operations
CREATE TABLE IF NOT EXISTS retouch_operations (
    retouch_id      TEXT PRIMARY KEY,
    photo_id        TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    retouch_type    TEXT NOT NULL,
    strength        REAL DEFAULT 0.5,
    parameters_json TEXT,
    created_at      TEXT NOT NULL
);

-- Crop Operations
CREATE TABLE IF NOT EXISTS crop_operations (
    crop_id     TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    x           REAL NOT NULL,
    y           REAL NOT NULL,
    width       REAL NOT NULL,
    height      REAL NOT NULL,
    rotation    REAL DEFAULT 0,
    created_at  TEXT NOT NULL
);

-- Presets
CREATE TABLE IF NOT EXISTS presets (
    preset_id   TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT,
    author      TEXT,
    version     TEXT,
    created_at  TEXT NOT NULL
);

-- Preset Operations
CREATE TABLE IF NOT EXISTS preset_operations (
    preset_operation_id  TEXT PRIMARY KEY,
    preset_id            TEXT NOT NULL REFERENCES presets(preset_id) ON DELETE CASCADE,
    operation_type       TEXT NOT NULL,
    parameter_json       TEXT NOT NULL
);

-- Exports
CREATE TABLE IF NOT EXISTS exports (
    export_id   TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    format      TEXT NOT NULL,
    resolution  TEXT,
    quality     INTEGER,
    output_path TEXT NOT NULL,
    exported_at TEXT NOT NULL
);

-- Export Profiles
CREATE TABLE IF NOT EXISTS export_profiles (
    profile_id      TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    settings_json   TEXT NOT NULL
);

-- AI Profiles
CREATE TABLE IF NOT EXISTS ai_profiles (
    profile_id      TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    model_version   TEXT,
    training_count  INTEGER DEFAULT 0,
    accuracy_score  REAL DEFAULT 0,
    updated_at      TEXT NOT NULL
);

-- AI Training Samples
CREATE TABLE IF NOT EXISTS ai_training_samples (
    sample_id   TEXT PRIMARY KEY,
    profile_id  TEXT NOT NULL REFERENCES ai_profiles(profile_id) ON DELETE CASCADE,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    scene_type  TEXT,
    accepted    INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL
);

-- AI Predictions
CREATE TABLE IF NOT EXISTS ai_predictions (
    prediction_id   TEXT PRIMARY KEY,
    photo_id        TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    prediction_type TEXT NOT NULL,
    confidence      REAL NOT NULL,
    result_json     TEXT NOT NULL,
    created_at      TEXT NOT NULL
);

-- AI Feedback
CREATE TABLE IF NOT EXISTS ai_feedback (
    feedback_id      TEXT PRIMARY KEY,
    prediction_id    TEXT NOT NULL REFERENCES ai_predictions(prediction_id) ON DELETE CASCADE,
    accepted         INTEGER NOT NULL,
    difference_score REAL,
    created_at       TEXT NOT NULL
);

-- AI Scene Analysis
CREATE TABLE IF NOT EXISTS ai_scene_analysis (
    analysis_id TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    scene_type  TEXT NOT NULL,
    confidence  REAL NOT NULL,
    created_at  TEXT NOT NULL
);

-- AI Face Embeddings
CREATE TABLE IF NOT EXISTS ai_face_embeddings (
    embedding_id    TEXT PRIMARY KEY,
    face_id         TEXT NOT NULL REFERENCES faces(face_id) ON DELETE CASCADE,
    embedding_path  TEXT NOT NULL,
    model_version   TEXT
);

-- AI Job Queue
CREATE TABLE IF NOT EXISTS ai_job_queue (
    job_id       TEXT PRIMARY KEY,
    job_type     TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    priority     INTEGER DEFAULT 0,
    started_at   TEXT,
    completed_at TEXT
);

-- Thumbnails
CREATE TABLE IF NOT EXISTS thumbnails (
    thumbnail_id TEXT PRIMARY KEY,
    photo_id     TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    size         INTEGER NOT NULL,
    file_path    TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

-- Previews
CREATE TABLE IF NOT EXISTS previews (
    preview_id  TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    resolution  TEXT NOT NULL,
    file_path   TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Render Cache
CREATE TABLE IF NOT EXISTS render_cache (
    cache_id    TEXT PRIMARY KEY,
    photo_id    TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    cache_type  TEXT NOT NULL,
    cache_path  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Plugin Registry
CREATE TABLE IF NOT EXISTS plugin_registry (
    plugin_id    TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    version      TEXT,
    author       TEXT,
    enabled      INTEGER DEFAULT 1,
    installed_at TEXT NOT NULL
);

-- Plugin Permissions
CREATE TABLE IF NOT EXISTS plugin_permissions (
    permission_id   TEXT PRIMARY KEY,
    plugin_id       TEXT NOT NULL REFERENCES plugin_registry(plugin_id) ON DELETE CASCADE,
    permission_type TEXT NOT NULL,
    granted         INTEGER DEFAULT 0
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id      TEXT PRIMARY KEY,
    event_type  TEXT NOT NULL,
    severity    TEXT DEFAULT 'info',
    message     TEXT,
    created_at  TEXT NOT NULL
);

-- Backups
CREATE TABLE IF NOT EXISTS backups (
    backup_id   TEXT PRIMARY KEY,
    catalog_id  TEXT NOT NULL REFERENCES catalogs(catalog_id) ON DELETE CASCADE,
    backup_path TEXT NOT NULL,
    backup_type TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
"#;
