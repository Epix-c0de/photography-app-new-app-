use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RetouchType {
    SkinSmoothing,
    BlemishRemoval,
    PoreRefinement,
    ShineReduction,
    EyeBrightening,
    IrisEnhancement,
    CatchlightEnhancement,
    TeethWhitening,
    TeethBrightness,
    HairFlyawayRemoval,
    HairFrizzReduction,
    BodySkinSmoothing,
    BodyToneBalancing,
    ClothingWrinkleReduction,
    ClothingFabricCleanup,
    BackgroundBlur,
    Healing,
    Clone,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RetouchSettings {
    pub skin_smoothing: f64,
    pub blemish_removal: f64,
    pub pore_refinement: f64,
    pub shine_reduction: f64,
    pub eye_brightening: f64,
    pub iris_enhancement: f64,
    pub catchlight_enhancement: f64,
    pub teeth_whitening: f64,
    pub teeth_brightness: f64,
    pub hair_flyaway_removal: f64,
    pub hair_frizz_reduction: f64,
    pub body_skin_smoothing: f64,
    pub body_tone_balancing: f64,
    pub clothing_wrinkle_reduction: f64,
    pub clothing_fabric_cleanup: f64,
    pub background_blur_strength: f64,
    pub background_blur_preset: Option<String>,
}

impl RetouchSettings {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).unwrap_or_default()
    }

    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetouchOperation {
    pub operation_id: String,
    pub retouch_type: RetouchType,
    pub strength: f64,
    pub parameters: serde_json::Value,
}

impl RetouchOperation {
    pub fn new(retouch_type: RetouchType, strength: f64) -> Self {
        Self {
            operation_id: uuid::Uuid::new_v4().to_string(),
            retouch_type,
            strength,
            parameters: serde_json::Value::Object(serde_json::Map::new()),
        }
    }
}
