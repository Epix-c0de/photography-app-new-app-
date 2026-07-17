use anyhow::Result;

/// Mask types for subject/background/sky segmentation
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub enum MaskType {
    Subject,
    Background,
    Sky,
    Face,
    Custom,
}

/// Auto-generated mask from SAM2
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AutoMask {
    pub mask: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub confidence: f32,
    pub mask_type: MaskType,
}

/// Generate automatic mask using SAM2 via ONNX Runtime
pub fn auto_mask(
    _pixels: &[u8],
    width: u32,
    height: u32,
    mask_type: MaskType,
) -> Result<AutoMask> {
    #[cfg(feature = "onnx")]
    {
        auto_mask_onnx(pixels, width, height, mask_type)
    }
    #[cfg(not(feature = "onnx"))]
    {
        // Stub: generate gradient mask when ONNX not compiled
        Ok(gradient_mask(width, height, mask_type))
    }
}

#[cfg(feature = "onnx")]
fn auto_mask_onnx(
    pixels: &[u8],
    width: u32,
    height: u32,
    mask_type: MaskType,
) -> Result<AutoMask> {
    use crate::inference::OnnxSession;
    use std::path::Path;

    let model_path = match mask_type {
        MaskType::Subject | MaskType::Background => {
            std::env::var("SAM2_MODEL").unwrap_or_else(|_| "models/sam2_hiera_tiny.onnx".to_string())
        }
        MaskType::Sky => {
            std::env::var("SKY_SEGMENTATION_MODEL")
                .unwrap_or_else(|_| "models/deeplabv3.onnx".to_string())
        }
        _ => {
            return Ok(gradient_mask(width, height, mask_type));
        }
    };

    if !Path::new(&model_path).exists() {
        return Ok(gradient_mask(width, height, mask_type));
    }

    let input_size = 1024;
    let input = crate::inference::prepare_input(pixels, width, height);

    let session = OnnxSession::new(&model_path)?;
    let output = session.run("input", &input, &[1, 3, input_size, input_size])?;

    // Convert model output to mask
    let mut mask = vec![0u8; (width * height) as usize];
    let out_w = width.min(output.len() as u32 / 3 / height);
    let out_h = height.min(output.len() as u32 / 3 / out_w);

    for y in 0..out_h {
        for x in 0..out_w {
            let idx = (y * out_w + x) as usize;
            if idx < output.len() {
                let val = (output[idx] * 255.0).clamp(0.0, 255.0) as u8;
                let dst_x = (x as f32 * width as f32 / out_w as f32) as u32;
                let dst_y = (y as f32 * height as f32 / out_h as f32) as u32;
                if dst_x < width && dst_y < height {
                    mask[(dst_y * width + dst_x) as usize] = val;
                }
            }
        }
    }

    let confidence = output.iter().map(|v| v.abs()).sum::<f32>() / output.len() as f32;

    Ok(AutoMask {
        mask,
        width,
        height,
        confidence,
        mask_type,
    })
}

fn gradient_mask(width: u32, height: u32, mask_type: MaskType) -> AutoMask {
    let mut mask = vec![0u8; (width * height) as usize];
    let mid_y = height / 2;

    for y in 0..height {
        for x in 0..width {
            let val = match mask_type {
                MaskType::Sky => {
                    if y < mid_y {
                        255
                    } else {
                        ((mid_y as f32 / y as f32 * 255.0) as u8).min(255)
                    }
                }
                MaskType::Subject => {
                    let cx = width / 2;
                    let cy = height / 2;
                    let dist = ((x as f32 - cx as f32).powi(2) + (y as f32 - cy as f32).powi(2)).sqrt();
                    let max_dist = ((width * width + height * height) as f32).sqrt() / 2.0;
                    ((1.0 - dist / max_dist) * 255.0) as u8
                }
                _ => 128,
            };
            mask[(y * width + x) as usize] = val;
        }
    }

    AutoMask {
        mask,
        width,
        height,
        confidence: 0.5,
        mask_type,
    }
}

/// Combine multiple masks
pub fn combine_masks(masks: &[AutoMask], operation: &str) -> Result<AutoMask> {
    if masks.is_empty() {
        anyhow::bail!("No masks to combine");
    }

    let first = &masks[0];
    let mut result = vec![0u8; (first.width * first.height) as usize];

    for y in 0..first.height {
        for x in 0..first.width {
            let idx = (y * first.width + x) as usize;
            let val = match operation {
                "add" | "union" => {
                    masks.iter().map(|m| m.mask.get(idx).copied().unwrap_or(0) as u16).sum::<u16>().min(255) as u8
                }
                "multiply" | "intersect" => {
                    masks.iter().map(|m| m.mask.get(idx).copied().unwrap_or(0) as u16).product::<u16>().min(255) as u8
                }
                "subtract" => {
                    let first_val = masks[0].mask.get(idx).copied().unwrap_or(0) as i16;
                    let rest: i16 = masks[1..].iter().map(|m| m.mask.get(idx).copied().unwrap_or(0) as i16).sum();
                    (first_val - rest).max(0).min(255) as u8
                }
                _ => masks[0].mask.get(idx).copied().unwrap_or(0),
            };
            result[idx] = val;
        }
    }

    Ok(AutoMask {
        mask: result,
        width: first.width,
        height: first.height,
        confidence: first.confidence,
        mask_type: first.mask_type,
    })
}

/// Feather mask edges for smooth blending
pub fn feather_mask(mask: &mut [u8], width: u32, height: u32, radius: u32) {
    let temp = mask.to_vec();

    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) as usize;
            if idx >= mask.len() { continue; }

            if temp[idx] > 0 && temp[idx] < 255 {
                // Edge pixel — feather it
                let mut sum = 0u32;
                let mut count = 0u32;

                for dy in -(radius as i32)..=(radius as i32) {
                    for dx in -(radius as i32)..=(radius as i32) {
                        let nx = x as i32 + dx;
                        let ny = y as i32 + dy;
                        if nx >= 0 && nx < width as i32 && ny >= 0 && ny < height as i32 {
                            let nidx = (ny as u32 * width + nx as u32) as usize;
                            if nidx < temp.len() {
                                sum += temp[nidx] as u32;
                                count += 1;
                            }
                        }
                    }
                }

                if count > 0 {
                    mask[idx] = (sum / count) as u8;
                }
            }
        }
    }
}
