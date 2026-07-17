use anyhow::Result;

/// Core ONNX Runtime inference engine
#[cfg(feature = "onnx")]
pub struct OnnxSession {
    session: ort::Session,
}

#[cfg(feature = "onnx")]
impl OnnxSession {
    pub fn new(model_path: &str) -> Result<Self> {
        use ort::{SessionBuilder, GraphOptimizationLevel};
        let session = SessionBuilder::new()?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .with_intra_threads(4)?
            .commit_from_file(model_path)?;
        Ok(Self { session })
    }

    pub fn run(&self, input_name: &str, input_data: &[f32], shape: &[usize]) -> Result<Vec<f32>> {
        use ort::Value;
        let tensor = Value::try_from_tensor(input_name, input_data, shape)?;
        let outputs = self.session.run(ort::inputs![tensor]?)?;
        let output = outputs[0].try_extract_tensor::<f32>()?;
        Ok(output.as_slice().unwrap_or_default().to_vec())
    }
}

/// Prepare RGBA pixel data for ONNX input (normalize to 0-1, NCHW format)
pub fn prepare_input(pixels: &[u8], width: u32, height: u32) -> Vec<f32> {
    let mut input = Vec::with_capacity((3 * width * height) as usize);
    for chunk in pixels.chunks_exact(4) {
        input.push(chunk[0] as f32 / 255.0);
        input.push(chunk[1] as f32 / 255.0);
        input.push(chunk[2] as f32 / 255.0);
    }
    input
}

/// Convert model output back to RGBA pixels
pub fn output_to_rgba(output: &[f32], width: u32, height: u32) -> Vec<u8> {
    let mut pixels = Vec::with_capacity((width * height * 4) as usize);
    for pixel in output.chunks(3) {
        let r = (pixel[0].clamp(0.0, 1.0) * 255.0) as u8;
        let g = pixel.get(1).map_or(r, |v| (v.clamp(0.0, 1.0) * 255.0) as u8);
        let b = pixel.get(2).map_or(r, |v| (v.clamp(0.0, 1.0) * 255.0) as u8);
        pixels.extend_from_slice(&[r, g, b, 255]);
    }
    pixels
}

/// Load image as RGBA pixel vector
pub fn load_image_rgba(path: &str) -> Result<(Vec<u8>, u32, u32)> {
    let img = image::open(path)?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    Ok((rgba.into_raw(), w, h))
}
