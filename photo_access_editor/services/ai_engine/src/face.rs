use anyhow::Result;

/// Detected face with bounding box and landmarks
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DetectedFace {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub confidence: f32,
    pub landmarks: Vec<(f32, f32)>,
}

/// Face detection result
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FaceDetectionResult {
    pub faces: Vec<DetectedFace>,
    pub image_width: u32,
    pub image_height: u32,
}

/// Detect faces in image using InsightFace/MediaPipe via ONNX Runtime
pub fn detect_faces(_pixels: &[u8], width: u32, height: u32) -> Result<FaceDetectionResult> {
    #[cfg(feature = "onnx")]
    {
        detect_faces_onnx(pixels, width, height)
    }
    #[cfg(not(feature = "onnx"))]
    {
        // Stub: return empty when ONNX not compiled
        Ok(FaceDetectionResult {
            faces: vec![],
            image_width: width,
            image_height: height,
        })
    }
}

#[cfg(feature = "onnx")]
fn detect_faces_onnx(pixels: &[u8], width: u32, height: u32) -> Result<FaceDetectionResult> {
    use crate::inference::OnnxSession;
    use std::path::Path;

    // InsightFace retinaface model expects 640x640 input
    let input_size = 640;
    let input = crate::inference::prepare_input(pixels, width, height);

    // Resize input to model expected size (simplified — real impl would use letterbox)
    let _scale_x = width as f32 / input_size as f32;
    let _scale_y = height as f32 / input_size as f32;

    // Try to load model
    let model_path = std::env::var("FACE_DETECTION_MODEL")
        .unwrap_or_else(|_| "models/retinaface_mobile.onnx".to_string());

    if !Path::new(&model_path).exists() {
        return Ok(FaceDetectionResult {
            faces: vec![],
            image_width: width,
            image_height: height,
        });
    }

    let session = OnnxSession::new(&model_path)?;
    let output = session.run("input", &input, &[1, 3, input_size, input_size])?;

    // Parse retinaface output (simplified)
    let faces = parse_retinaface_output(&output, width, height, input_size);

    Ok(FaceDetectionResult {
        faces,
        image_width: width,
        image_height: height,
    })
}

#[allow(dead_code)]
fn parse_retinaface_output(output: &[f32], img_w: u32, img_h: u32, input_size: u32) -> Vec<DetectedFace> {
    let mut faces = Vec::new();
    let scale_x = img_w as f32 / input_size as f32;
    let scale_y = img_h as f32 / input_size as f32;

    // RetinaFace outputs: [batch, num_anchors, 15]
    // 15 = 4 (bbox) + 1 (confidence) + 10 (5 landmarks × 2)
    let stride = 15;
    let num_anchors = output.len() / stride;

    for i in 0..num_anchors {
        let offset = i * stride;
        let confidence = output[offset + 4];

        if confidence > 0.5 {
            let x1 = output[offset] * scale_x;
            let y1 = output[offset + 1] * scale_y;
            let x2 = output[offset + 2] * scale_x;
            let y2 = output[offset + 3] * scale_y;

            let mut landmarks = Vec::new();
            for j in 0..5 {
                let lx = output[offset + 5 + j * 2] * scale_x;
                let ly = output[offset + 6 + j * 2] * scale_y;
                landmarks.push((lx, ly));
            }

            faces.push(DetectedFace {
                x: x1,
                y: y1,
                width: x2 - x1,
                height: y2 - y1,
                confidence,
                landmarks,
            });
        }
    }

    faces
}

/// Create face mask for retouching
pub fn create_face_mask(
    faces: &[DetectedFace],
    width: u32,
    height: u32,
    padding: f32,
) -> Vec<u8> {
    let mut mask = vec![0u8; (width * height) as usize];

    for face in faces {
        let x1 = ((face.x - padding * face.width).max(0.0) as u32).min(width);
        let y1 = ((face.y - padding * face.height).max(0.0) as u32).min(height);
        let x2 = ((face.x + face.width + padding * face.width).min(width as f32) as u32).min(width);
        let y2 = ((face.y + face.height + padding * face.height).min(height as f32) as u32).min(height);

        for y in y1..y2 {
            for x in x1..x2 {
                mask[(y * width + x) as usize] = 255;
            }
        }
    }

    mask
}
