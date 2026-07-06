use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BasicAdjustments {
    pub exposure: f64,       // -5.0 to +5.0
    pub contrast: f64,       // -100 to +100
    pub highlights: f64,     // -100 to +100
    pub shadows: f64,        // -100 to +100
    pub whites: f64,         // -100 to +100
    pub blacks: f64,         // -100 to +100
    pub texture: f64,        // 0 to 100
    pub clarity: f64,        // -100 to +100
    pub dehaze: f64,         // -100 to +100
    pub vibrance: f64,       // -100 to +100
    pub saturation: f64,     // -100 to +100
}

impl BasicAdjustments {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn apply_exposure(&self, value: f64) -> f64 {
        value * 2.0_f64.powf(self.exposure)
    }

    pub fn apply_contrast(&self, value: f64) -> f64 {
        let factor = (100.0 + self.contrast) / 100.0;
        ((value - 0.5) * factor + 0.5).clamp(0.0, 1.0)
    }

    pub fn apply_highlights(&self, value: f64) -> f64 {
        if value > 0.5 {
            let factor = 1.0 - (self.highlights / 100.0).abs() * 0.5;
            0.5 + (value - 0.5) * factor
        } else {
            value
        }
    }

    pub fn apply_shadows(&self, value: f64) -> f64 {
        if value < 0.5 {
            let factor = 1.0 + (self.shadows / 100.0).abs() * 0.5;
            value * factor
        } else {
            value
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WhiteBalance {
    pub temperature: f64,  // 2000K to 50000K (default 5500K)
    pub tint: f64,         // -150 to +150
}

impl WhiteBalance {
    pub fn new() -> Self {
        Self {
            temperature: 5500.0,
            tint: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurvePoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CurvesAdjustment {
    pub rgb: Vec<CurvePoint>,
    pub red: Vec<CurvePoint>,
    pub green: Vec<CurvePoint>,
    pub blue: Vec<CurvePoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HslAdjustment {
    pub hue_red: f64,
    pub hue_orange: f64,
    pub hue_yellow: f64,
    pub hue_green: f64,
    pub hue_aqua: f64,
    pub hue_blue: f64,
    pub hue_purple: f64,
    pub hue_magenta: f64,
    pub sat_red: f64,
    pub sat_orange: f64,
    pub sat_yellow: f64,
    pub sat_green: f64,
    pub sat_aqua: f64,
    pub sat_blue: f64,
    pub sat_purple: f64,
    pub sat_magenta: f64,
    pub lum_red: f64,
    pub lum_orange: f64,
    pub lum_yellow: f64,
    pub lum_green: f64,
    pub lum_aqua: f64,
    pub lum_blue: f64,
    pub lum_purple: f64,
    pub lum_magenta: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorWheel {
    pub hue: f64,
    pub saturation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ColorGrading {
    pub shadows: ColorWheel,
    pub midtones: ColorWheel,
    pub highlights: ColorWheel,
    pub balance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LensCorrections {
    pub distortion: f64,
    pub vignetting: f64,
    pub chromatic_aberration: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CropSettings {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub rotation: f64,
    pub aspect_ratio: Option<String>,
}

impl Default for CropSettings {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            width: 1.0,
            height: 1.0,
            rotation: 0.0,
            aspect_ratio: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EditState {
    pub basic: BasicAdjustments,
    pub white_balance: WhiteBalance,
    pub curves: CurvesAdjustment,
    pub hsl: HslAdjustment,
    pub color_grading: ColorGrading,
    pub lens_corrections: LensCorrections,
    pub crop: CropSettings,
}

impl EditState {
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
