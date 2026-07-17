use anyhow::Result;

/// Portrait enhancement using GFPGAN/CodeFormer via ONNX Runtime
pub fn enhance_portrait(
    pixels: &[u8],
    _width: u32,
    _height: u32,
    _strength: f32,
) -> Result<Vec<u8>> {
    #[cfg(feature = "onnx")]
    {
        enhance_portrait_onnx(pixels, width, height, strength)
    }
    #[cfg(not(feature = "onnx"))]
    {
        // Stub: return original pixels when ONNX not compiled
        Ok(pixels.to_vec())
    }
}

#[cfg(feature = "onnx")]
fn enhance_portrait_onnx(
    pixels: &[u8],
    width: u32,
    height: u32,
    strength: f32,
) -> Result<Vec<u8>> {
    use crate::inference::OnnxSession;
    use std::path::Path;

    let model_path = std::env::var("GFPGAN_MODEL")
        .unwrap_or_else(|_| "models/gfpgan_v1.4.onnx".to_string());

    if !Path::new(&model_path).exists() {
        return Ok(pixels.to_vec());
    }

    // GFPGAN expects 512x512 face crops
    let input_size = 512;
    let input = crate::inference::prepare_input(pixels, width, height);

    let session = OnnxSession::new(&model_path)?;
    let output = session.run("input", &input, &[1, 3, input_size, input_size])?;

    let enhanced = crate::inference::output_to_rgba(&output, width, height);

    // Blend with original based on strength
    let mut result = Vec::with_capacity(pixels.len());
    for i in (0..pixels.len()).step_by(4) {
        let blend = strength;
        result.push((pixels[i] as f32 * (1.0 - blend) + enhanced[i] as f32 * blend) as u8);
        result.push((pixels[i + 1] as f32 * (1.0 - blend) + enhanced[i + 1] as f32 * blend) as u8);
        result.push((pixels[i + 2] as f32 * (1.0 - blend) + enhanced[i + 2] as f32 * blend) as u8);
        result.push(255);
    }

    Ok(result)
}

/// Smooth skin using face mask
pub fn smooth_skin(
    pixels: &[u8],
    width: u32,
    height: u32,
    mask: &[u8],
    strength: f32,
) -> Result<Vec<u8>> {
    let mut result = pixels.to_vec();
    let radius = (strength * 5.0) as i32;

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            if mask[(y * width + x) as usize] == 0 {
                continue;
            }

            let mut r_sum = 0.0f32;
            let mut g_sum = 0.0f32;
            let mut b_sum = 0.0f32;
            let mut count = 0.0f32;

            for dy in -radius..=radius {
                for dx in -radius..=radius {
                    let nx = x as i32 + dx;
                    let ny = y as i32 + dy;
                    if nx >= 0 && nx < width as i32 && ny >= 0 && ny < height as i32 {
                        let nidx = ((ny as u32 * width as u32 + nx as u32) * 4) as usize;
                        if nidx + 2 < pixels.len() {
                            r_sum += pixels[nidx] as f32;
                            g_sum += pixels[nidx + 1] as f32;
                            b_sum += pixels[nidx + 2] as f32;
                            count += 1.0;
                        }
                    }
                }
            }

            if count > 0.0 {
                let blend = strength * 0.5;
                result[idx] = (pixels[idx] as f32 * (1.0 - blend) + (r_sum / count) * blend) as u8;
                result[idx + 1] = (pixels[idx + 1] as f32 * (1.0 - blend) + (g_sum / count) * blend) as u8;
                result[idx + 2] = (pixels[idx + 2] as f32 * (1.0 - blend) + (b_sum / count) * blend) as u8;
            }
        }
    }

    Ok(result)
}

/// Whiten teeth using face landmarks
pub fn whiten_teeth(
    pixels: &[u8],
    width: u32,
    height: u32,
    mouth_region: (f32, f32, f32, f32),
    strength: f32,
) -> Result<Vec<u8>> {
    let mut result = pixels.to_vec();
    let (mx, my, mw, mh) = mouth_region;

    let x1 = (mx.max(0.0) as u32).min(width);
    let y1 = (my.max(0.0) as u32).min(height);
    let x2 = ((mx + mw).min(width as f32) as u32).min(width);
    let y2 = ((my + mh).min(height as f32) as u32).min(height);

    for y in y1..y2 {
        for x in x1..x2 {
            let idx = ((y * width + x) * 4) as usize;
            if idx + 2 < result.len() {
                let r = result[idx] as f32;
                let g = result[idx + 1] as f32;
                let b = result[idx + 2] as f32;

                // Reduce yellow, increase brightness
                let gray = 0.299 * r + 0.587 * g + 0.114 * b;
                let new_r = r + (gray - r) * strength * 0.3;
                let new_g = g + (gray - g) * strength * 0.2;
                let new_b = b + (gray - b) * strength * 0.1 + strength * 20.0;

                result[idx] = new_r.clamp(0.0, 255.0) as u8;
                result[idx + 1] = new_g.clamp(0.0, 255.0) as u8;
                result[idx + 2] = new_b.clamp(0.0, 255.0) as u8;
            }
        }
    }

    Ok(result)
}

/// Whiten eyes using eye landmarks
pub fn whiten_eyes(
    pixels: &[u8],
    width: u32,
    height: u32,
    eye_regions: &[(f32, f32, f32, f32)],
    strength: f32,
) -> Result<Vec<u8>> {
    let mut result = pixels.to_vec();

    for (ex, ey, ew, eh) in eye_regions {
        let x1 = (*ex as u32).min(width);
        let y1 = (*ey as u32).min(height);
        let x2 = ((ex + ew).min(width as f32) as u32).min(width);
        let y2 = ((ey + eh).min(height as f32) as u32).min(height);

        for y in y1..y2 {
            for x in x1..x2 {
                let idx = ((y * width + x) * 4) as usize;
                if idx + 2 < result.len() {
                    let r = result[idx] as f32;
                    let g = result[idx + 1] as f32;
                    let b = result[idx + 2] as f32;

                    // Increase brightness, reduce red/yellow
                    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    let new_r = r + (gray - r) * strength * 0.4;
                    let new_g = g + (gray - g) * strength * 0.3;
                    let new_b = b + (gray - b) * strength * 0.2 + strength * 15.0;

                    result[idx] = new_r.clamp(0.0, 255.0) as u8;
                    result[idx + 1] = new_g.clamp(0.0, 255.0) as u8;
                    result[idx + 2] = new_b.clamp(0.0, 255.0) as u8;
                }
            }
        }
    }

    Ok(result)
}
