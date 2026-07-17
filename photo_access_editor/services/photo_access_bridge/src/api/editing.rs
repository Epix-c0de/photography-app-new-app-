use anyhow::Result;
use image::DynamicImage;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EditParams {
    pub exposure: f64,
    pub contrast: f64,
    pub highlights: f64,
    pub shadows: f64,
    pub whites: f64,
    pub blacks: f64,
    pub temperature: f64,
    pub tint: f64,
    pub vibrance: f64,
    pub saturation: f64,
    pub clarity: f64,
    pub texture: f64,
    pub dehaze: f64,
}

impl Default for EditParams {
    fn default() -> Self {
        Self {
            exposure: 0.0,
            contrast: 0.0,
            highlights: 0.0,
            shadows: 0.0,
            whites: 0.0,
            blacks: 0.0,
            temperature: 5500.0,
            tint: 0.0,
            vibrance: 0.0,
            saturation: 0.0,
            clarity: 0.0,
            texture: 0.0,
            dehaze: 0.0,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HistogramResult {
    pub red: Vec<i32>,
    pub green: Vec<i32>,
    pub blue: Vec<i32>,
    pub luminance: Vec<i32>,
}

/// Apply basic edits to image pixels (exposure, contrast, etc.)
/// Input: RGBA pixel data, Output: edited RGBA pixel data
pub fn apply_edits(
    pixels: Vec<u8>,
    width: u32,
    height: u32,
    params: EditParams,
) -> Result<Vec<u8>> {
    let img = DynamicImage::ImageRgba8(
        image::RgbaImage::from_raw(width, height, pixels)
            .ok_or_else(|| anyhow::anyhow!("Invalid pixel data"))?,
    );

    let basic = render_engine::adjustments::BasicAdjustments {
        exposure: params.exposure,
        contrast: params.contrast,
        highlights: params.highlights,
        shadows: params.shadows,
        whites: params.whites,
        blacks: params.blacks,
        texture: params.texture,
        clarity: params.clarity,
        dehaze: params.dehaze,
        vibrance: params.vibrance,
        saturation: params.saturation,
    };

    let edited = render_engine::preview::PreviewRenderer::apply_adjustments(&img, &basic)?;
    let rgba = edited.to_rgba8();
    Ok(rgba.into_raw())
}

/// Generate a histogram from RGBA pixel data
pub fn compute_histogram(pixels: Vec<u8>) -> Result<HistogramResult> {
    let mut red = vec![0i32; 256];
    let mut green = vec![0i32; 256];
    let mut blue = vec![0i32; 256];
    let mut luminance = vec![0i32; 256];

    for chunk in pixels.chunks_exact(4) {
        let r = chunk[0] as usize;
        let g = chunk[1] as usize;
        let b = chunk[2] as usize;
        red[r] += 1;
        green[g] += 1;
        blue[b] += 1;
        let lum = (0.299 * r as f64 + 0.587 * g as f64 + 0.114 * b as f64) as usize;
        let lum = lum.min(255);
        luminance[lum] += 1;
    }

    Ok(HistogramResult {
        red,
        green,
        blue,
        luminance,
    })
}
