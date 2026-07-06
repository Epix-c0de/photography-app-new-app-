use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawMetadata {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub lens: Option<String>,
    pub iso: Option<i32>,
    pub aperture: Option<f64>,
    pub shutter_speed: Option<String>,
    pub focal_length: Option<f64>,
    pub capture_date: Option<String>,
    pub gps: Option<String>,
    pub orientation: Option<i32>,
    pub color_space: Option<String>,
    pub bit_depth: Option<i32>,
}

impl RawMetadata {
    pub fn extract(path: &Path) -> Result<Self> {
        let img = image::open(path)?;
        let (width, height) = img.dimensions();
        
        let format = path.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("unknown")
            .to_uppercase();

        Ok(Self {
            width,
            height,
            format,
            camera_make: None,
            camera_model: None,
            lens: None,
            iso: None,
            aperture: None,
            shutter_speed: None,
            focal_length: None,
            capture_date: None,
            gps: None,
            orientation: None,
            color_space: None,
            bit_depth: None,
        })
    }
}
