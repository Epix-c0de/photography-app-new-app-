use anyhow::Result;

/// Upscale image using Real-ESRGAN via ONNX Runtime
pub fn upscale_image(
    pixels: &[u8],
    width: u32,
    height: u32,
    scale_factor: u32,
) -> Result<Vec<u8>> {
    #[cfg(feature = "onnx")]
    {
        upscale_image_onnx(pixels, width, height, scale_factor)
    }
    #[cfg(not(feature = "onnx"))]
    {
        // Stub: simple bilinear upscale when ONNX not compiled
        Ok(bilinear_upscale(pixels, width, height, scale_factor))
    }
}

#[cfg(feature = "onnx")]
fn upscale_image_onnx(
    pixels: &[u8],
    width: u32,
    height: u32,
    scale_factor: u32,
) -> Result<Vec<u8>> {
    use crate::inference::OnnxSession;
    use std::path::Path;

    let model_path = std::env::var("ESRGAN_MODEL")
        .unwrap_or_else(|_| "models/realesrgan_x4plus.onnx".to_string());

    if !Path::new(&model_path).exists() {
        return Ok(bilinear_upscale(pixels, width, height, scale_factor));
    }

    // Real-ESRGAN processes tiles of 480x480
    let tile_size = 480;
    let out_w = width * scale_factor;
    let out_h = height * scale_factor;
    let mut output = vec![0u8; (out_w * out_h * 4) as usize];

    // Process image in tiles
    for ty in (0..height).step_by(tile_size) {
        for tx in (0..width).step_by(tile_size) {
            let tile_w = (tile_size).min(width - tx);
            let tile_h = (tile_size).min(height - ty);

            // Extract tile
            let mut tile = Vec::with_capacity((tile_w * tile_h * 4) as usize);
            for y in ty..ty + tile_h {
                for x in tx..tx + tile_w {
                    let idx = ((y * width + x) * 4) as usize;
                    if idx + 3 < pixels.len() {
                        tile.extend_from_slice(&pixels[idx..idx + 4]);
                    }
                }
            }

            let input = crate::inference::prepare_input(&tile, tile_w, tile_h);
            let session = OnnxSession::new(&model_path)?;
            let out_tile = session.run(
                "input",
                &input,
                &[1, 3, tile_h as usize, tile_w as usize],
            )?;

            let out_tile_rgba = crate::inference::output_to_rgba(&out_tile, tile_w * scale_factor, tile_h * scale_factor);

            // Place tile in output
            for y in 0..tile_h * scale_factor {
                for x in 0..tile_w * scale_factor {
                    let src_idx = ((y * tile_w * scale_factor + x) * 4) as usize;
                    let dst_x = tx * scale_factor + x;
                    let dst_y = ty * scale_factor + y;
                    let dst_idx = ((dst_y * out_w + dst_x) * 4) as usize;

                    if src_idx + 3 < out_tile_rgba.len() && dst_idx + 3 < output.len() {
                        output[dst_idx..dst_idx + 4].copy_from_slice(&out_tile_rgba[src_idx..src_idx + 4]);
                    }
                }
            }
        }
    }

    Ok(output)
}

/// Simple bilinear upscaling fallback
fn bilinear_upscale(pixels: &[u8], width: u32, height: u32, scale: u32) -> Vec<u8> {
    let out_w = width * scale;
    let out_h = height * scale;
    let mut output = vec![0u8; (out_w * out_h * 4) as usize];

    for y in 0..out_h {
        for x in 0..out_w {
            let src_x = x as f32 / scale as f32;
            let src_y = y as f32 / scale as f32;

            let x0 = src_x as u32;
            let y0 = src_y as u32;
            let x1 = (x0 + 1).min(width - 1);
            let y1 = (y0 + 1).min(height - 1);

            let fx = src_x - x0 as f32;
            let fy = src_y - y0 as f32;

            let idx00 = ((y0 * width + x0) * 4) as usize;
            let idx10 = ((y0 * width + x1) * 4) as usize;
            let idx01 = ((y1 * width + x0) * 4) as usize;
            let idx11 = ((y1 * width + x1) * 4) as usize;
            let out_idx = ((y * out_w + x) * 4) as usize;

            for c in 0..3 {
                let v00 = pixels.get(idx00 + c).copied().unwrap_or(0) as f32;
                let v10 = pixels.get(idx10 + c).copied().unwrap_or(0) as f32;
                let v01 = pixels.get(idx01 + c).copied().unwrap_or(0) as f32;
                let v11 = pixels.get(idx11 + c).copied().unwrap_or(0) as f32;

                let v = v00 * (1.0 - fx) * (1.0 - fy)
                    + v10 * fx * (1.0 - fy)
                    + v01 * (1.0 - fx) * fy
                    + v11 * fx * fy;

                if out_idx + c < output.len() {
                    output[out_idx + c] = v.clamp(0.0, 255.0) as u8;
                }
            }
            if out_idx + 3 < output.len() {
                output[out_idx + 3] = 255;
            }
        }
    }

    output
}

/// Get output dimensions for upscale
pub fn upscale_dimensions(width: u32, height: u32, scale_factor: u32) -> (u32, u32) {
    (width * scale_factor, height * scale_factor)
}
