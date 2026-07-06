use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ─── Catalog ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Catalog {
    pub catalog_id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub status: String,
}

impl Catalog {
    pub fn new(name: String) -> Self {
        let now = Utc::now();
        Self {
            catalog_id: uuid::Uuid::new_v4().to_string(),
            name,
            description: None,
            version: Some("1.0".to_string()),
            created_at: now,
            updated_at: now,
            status: "active".to_string(),
        }
    }
}

// ─── Photo ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Photo {
    pub photo_id: String,
    pub catalog_id: String,
    pub filename: String,
    pub file_path: String,
    pub file_hash: Option<String>,
    pub capture_date: Option<DateTime<Utc>>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub lens: Option<String>,
    pub iso: Option<i32>,
    pub aperture: Option<f64>,
    pub shutter_speed: Option<String>,
    pub focal_length: Option<f64>,
    pub rating: i32,
    pub flag: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Photo {
    pub fn new(catalog_id: String, filename: String, file_path: String) -> Self {
        let now = Utc::now();
        Self {
            photo_id: uuid::Uuid::new_v4().to_string(),
            catalog_id,
            filename,
            file_path,
            file_hash: None,
            capture_date: None,
            camera_make: None,
            camera_model: None,
            lens: None,
            iso: None,
            aperture: None,
            shutter_speed: None,
            focal_length: None,
            rating: 0,
            flag: "none".to_string(),
            created_at: now,
            updated_at: now,
        }
    }
}

// ─── Photo Metadata ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoMetadata {
    pub metadata_id: String,
    pub photo_id: String,
    pub gps: Option<String>,
    pub copyright: Option<String>,
    pub author: Option<String>,
    pub description: Option<String>,
    pub keywords_json: Option<String>,
}

// ─── Album ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Album {
    pub album_id: String,
    pub catalog_id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

impl Album {
    pub fn new(catalog_id: String, name: String) -> Self {
        Self {
            album_id: uuid::Uuid::new_v4().to_string(),
            catalog_id,
            name,
            created_at: Utc::now(),
        }
    }
}

// ─── Collection ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub collection_id: String,
    pub catalog_id: String,
    pub name: String,
    pub collection_type: String,
    pub created_at: DateTime<Utc>,
}

// ─── Edit Session ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditSession {
    pub session_id: String,
    pub photo_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub status: String,
}

impl EditSession {
    pub fn new(photo_id: String) -> Self {
        let now = Utc::now();
        Self {
            session_id: uuid::Uuid::new_v4().to_string(),
            photo_id,
            created_at: now,
            updated_at: now,
            status: "active".to_string(),
        }
    }
}

// ─── Edit Operation ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditOperation {
    pub operation_id: String,
    pub session_id: String,
    pub operation_type: String,
    pub parameter_json: String,
    pub execution_order: i32,
    pub created_at: DateTime<Utc>,
}

// ─── Layer ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Layer {
    pub layer_id: String,
    pub photo_id: String,
    pub layer_type: String,
    pub name: String,
    pub opacity: f64,
    pub visible: bool,
    pub created_at: DateTime<Utc>,
}

// ─── Mask ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mask {
    pub mask_id: String,
    pub photo_id: String,
    pub layer_id: Option<String>,
    pub mask_type: String,
    pub mask_path: String,
    pub created_at: DateTime<Utc>,
}

// ─── Preset ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preset {
    pub preset_id: String,
    pub name: String,
    pub category: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ─── Thumbnail ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Thumbnail {
    pub thumbnail_id: String,
    pub photo_id: String,
    pub size: i32,
    pub file_path: String,
    pub updated_at: DateTime<Utc>,
}

// ─── Export ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportRecord {
    pub export_id: String,
    pub photo_id: String,
    pub format: String,
    pub resolution: Option<String>,
    pub quality: Option<i32>,
    pub output_path: String,
    pub exported_at: DateTime<Utc>,
}

// ─── AI Profile ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProfile {
    pub profile_id: String,
    pub name: String,
    pub model_version: Option<String>,
    pub training_count: i32,
    pub accuracy_score: f64,
    pub updated_at: DateTime<Utc>,
}

// ─── AI Prediction ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiPrediction {
    pub prediction_id: String,
    pub photo_id: String,
    pub prediction_type: String,
    pub confidence: f64,
    pub result_json: String,
    pub created_at: DateTime<Utc>,
}

// ─── Face ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Face {
    pub face_id: String,
    pub photo_id: String,
    pub bounding_box: String,
    pub embedding_path: Option<String>,
    pub confidence: Option<f64>,
    pub group_id: Option<String>,
}

// ─── Face Group ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaceGroup {
    pub group_id: String,
    pub name: String,
    pub cover_face_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ─── History Entry ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub history_id: String,
    pub session_id: String,
    pub action_type: String,
    pub timestamp: DateTime<Utc>,
}

// ─── Snapshot ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub snapshot_id: String,
    pub photo_id: String,
    pub name: String,
    pub graph_state: String,
    pub created_at: DateTime<Utc>,
}

// ─── Query Filters ─────────────────────────────────────────

#[derive(Debug, Clone, Default)]
pub struct PhotoFilter {
    pub catalog_id: Option<String>,
    pub rating: Option<i32>,
    pub flag: Option<String>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub date_from: Option<DateTime<Utc>>,
    pub date_to: Option<DateTime<Utc>>,
    pub keyword: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}
