use anyhow::Result;

/// Culling score for a photo
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CullingScore {
    pub overall: f32,
    pub sharpness: f32,
    pub exposure: f32,
    pub color: f32,
    pub composition: f32,
    pub face_quality: f32,
}

/// Score a photo for culling using AI analysis
pub fn score_photo(pixels: &[u8], width: u32, height: u32) -> Result<CullingScore> {
    let sharpness = compute_sharpness(pixels, width, height);
    let exposure = compute_exposure(pixels, width, height);
    let color = compute_color_quality(pixels, width, height);
    let composition = compute_composition(width, height);
    let face_quality = 0.5; // Placeholder — needs face detection

    let overall = (sharpness * 0.3 + exposure * 0.2 + color * 0.2 + composition * 0.15 + face_quality * 0.15)
        .clamp(0.0, 1.0);

    Ok(CullingScore {
        overall,
        sharpness,
        exposure,
        color,
        composition,
        face_quality,
    })
}

/// Compute sharpness using Laplacian variance
fn compute_sharpness(pixels: &[u8], width: u32, height: u32) -> f32 {
    if width < 3 || height < 3 {
        return 0.5;
    }

    let mut laplacian_sum = 0.0f64;
    let mut count = 0u64;

    for y in 1..height - 1 {
        for x in 1..width - 1 {
            let idx = (y * width + x) as usize;
            if idx * 4 + 2 >= pixels.len() { continue; }

            let center = pixels[idx * 4] as f64;
            let top = pixels[((y - 1) * width + x) as usize * 4] as f64;
            let bottom = pixels[((y + 1) * width + x) as usize * 4] as f64;
            let left = pixels[(y * width + x - 1) as usize * 4] as f64;
            let right = pixels[(y * width + x + 1) as usize * 4] as f64;

            let laplacian = (4.0 * center - top - bottom - left - right).abs();
            laplacian_sum += laplacian;
            count += 1;
        }
    }

    if count == 0 {
        return 0.5;
    }

    let variance = laplacian_sum / count as f64;
    // Normalize: typical sharp photos have variance > 100
    (variance / 200.0).clamp(0.0, 1.0) as f32
}

/// Compute exposure quality
fn compute_exposure(pixels: &[u8], width: u32, height: u32) -> f32 {
    let total = width * height;
    if total == 0 {
        return 0.5;
    }

    let mut histogram = vec![0u32; 256];

    for chunk in pixels.chunks_exact(4) {
        let lum = (0.299 * chunk[0] as f64 + 0.587 * chunk[1] as f64 + 0.114 * chunk[2] as f64) as u8;
        histogram[lum as usize] += 1;
    }

    // Check for clipping
    let highlights = histogram[240..256].iter().sum::<u32>() as f32 / total as f32;
    let shadows = histogram[0..16].iter().sum::<u32>() as f32 / total as f32;

    // Good exposure: not too clipped
    let clip_penalty = (highlights + shadows).min(1.0);
    (1.0 - clip_penalty * 0.8).max(0.0)
}

/// Compute color quality (saturation distribution)
fn compute_color_quality(pixels: &[u8], _width: u32, _height: u32) -> f32 {
    if pixels.len() < 4 {
        return 0.5;
    }

    let mut saturation_sum = 0.0f64;
    let mut count = 0u64;

    for chunk in pixels.chunks_exact(4) {
        let r = chunk[0] as f64;
        let g = chunk[1] as f64;
        let b = chunk[2] as f64;

        let max = r.max(g).max(b);
        let min = r.min(g).min(b);
        let sat = if max > 0.0 { (max - min) / max } else { 0.0 };

        saturation_sum += sat;
        count += 1;
    }

    if count == 0 {
        return 0.5;
    }

    let avg_sat = saturation_sum / count as f64;
    // Good color: moderate saturation (0.2-0.6 is ideal)
    let score = 1.0 - (avg_sat - 0.4).abs() * 2.0;
    score.clamp(0.0, 1.0) as f32
}

/// Compute composition score based on rule of thirds
fn compute_composition(_width: u32, _height: u32) -> f32 {
    // Simple rule of thirds score
    // Photos with subjects near thirds lines score higher
    // This is a simplified version — real impl would use saliency detection
    0.7 // Default moderate score
}

/// Batch score multiple photos for culling
pub fn batch_score(photos: &[(Vec<u8>, u32, u32)]) -> Result<Vec<CullingScore>> {
    photos
        .iter()
        .map(|(pixels, w, h)| score_photo(pixels, *w, *h))
        .collect()
}

/// Get recommended photos (score > threshold)
pub fn recommend_photos(
    scores: &[CullingScore],
    threshold: f32,
) -> Vec<usize> {
    scores
        .iter()
        .enumerate()
        .filter(|(_, s)| s.overall >= threshold)
        .map(|(i, _)| i)
        .collect()
}
