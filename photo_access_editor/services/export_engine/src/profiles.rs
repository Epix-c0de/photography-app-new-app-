use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportProfile {
    pub name: String,
    pub format: String,
    pub quality: Option<u32>,
    pub resize: Option<(u32, u32)>,
    pub color_space: Option<String>,
    pub include_metadata: bool,
}

impl ExportProfile {
    pub fn web() -> Self {
        Self {
            name: "Web".to_string(),
            format: "jpg".to_string(),
            quality: Some(85),
            resize: Some((2048, 2048)),
            color_space: Some("sRGB".to_string()),
            include_metadata: true,
        }
    }

    pub fn print() -> Self {
        Self {
            name: "Print".to_string(),
            format: "tiff".to_string(),
            quality: Some(100),
            resize: None,
            color_space: Some("AdobeRGB".to_string()),
            include_metadata: true,
        }
    }

    pub fn social() -> Self {
        Self {
            name: "Social".to_string(),
            format: "jpg".to_string(),
            quality: Some(80),
            resize: Some((1080, 1080)),
            color_space: Some("sRGB".to_string()),
            include_metadata: false,
        }
    }

    pub fn archive() -> Self {
        Self {
            name: "Archive".to_string(),
            format: "tiff".to_string(),
            quality: Some(100),
            resize: None,
            color_space: Some("ProPhoto".to_string()),
            include_metadata: true,
        }
    }
}

pub fn default_profiles() -> Vec<ExportProfile> {
    vec![
        ExportProfile::web(),
        ExportProfile::print(),
        ExportProfile::social(),
        ExportProfile::archive(),
    ]
}
