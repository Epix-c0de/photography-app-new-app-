use anyhow::Result;

// ─── Face Detection ──────────────────────────────────────

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

/// Detect faces in an image
pub fn detect_faces(
    pixels: Vec<u8>,
    width: u32,
    height: u32,
) -> Result<FaceDetectionResult> {
    let result = ai_engine::face::detect_faces(&pixels, width, height)?;
    Ok(FaceDetectionResult {
        faces: result.faces.into_iter().map(|f| DetectedFace {
            x: f.x, y: f.y, width: f.width, height: f.height,
            confidence: f.confidence, landmarks: f.landmarks,
        }).collect(),
        image_width: result.image_width,
        image_height: result.image_height,
    })
}

/// Create face mask for retouching
pub fn create_face_mask(
    pixels: Vec<u8>,
    width: u32,
    height: u32,
    face_x: f32,
    face_y: f32,
    face_w: f32,
    face_h: f32,
    confidence: f32,
    landmarks: Vec<(f32, f32)>,
    padding: f32,
) -> Result<Vec<u8>> {
    let face = ai_engine::face::DetectedFace {
        x: face_x, y: face_y, width: face_w, height: face_h,
        confidence, landmarks,
    };
    let mask = ai_engine::face::create_face_mask(&[face], width, height, padding);
    Ok(mask)
}

// ─── Portrait Enhancement ────────────────────────────────

/// Portrait enhancement using GFPGAN/CodeFormer
pub fn enhance_portrait(
    pixels: Vec<u8>,
    width: u32,
    height: u32,
    strength: f32,
) -> Result<Vec<u8>> {
    ai_engine::enhance::enhance_portrait(&pixels, width, height, strength)
}

/// Smooth skin using face mask
pub fn smooth_skin(
    pixels: Vec<u8>,
    width: u32,
    height: u32,
    mask: Vec<u8>,
    strength: f32,
) -> Result<Vec<u8>> {
    ai_engine::enhance::smooth_skin(&pixels, width, height, &mask, strength)
}

/// Whiten teeth using face landmarks
pub fn whiten_teeth_ai(
    pixels: Vec<u8>,
    width: u32,
    height: u32,
    mouth_x: f32,
    mouth_y: f32,
    mouth_w: f32,
    mouth_h: f32,
    strength: f32,
) -> Result<Vec<u8>> {
    ai_engine::enhance::whiten_teeth(&pixels, width, height, (mouth_x, mouth_y, mouth_w, mouth_h), strength)
}

/// Whiten eyes using eye landmarks
pub fn whiten_eyes_ai(
    pixels: Vec<u8>,
    width: u32,
    height: u32,
    eye_regions: Vec<(f32, f32, f32, f32)>,
    strength: f32,
) -> Result<Vec<u8>> {
    ai_engine::enhance::whiten_eyes(&pixels, width, height, &eye_regions, strength)
}

// ─── Image Upscaling ────────────────────────────────────

/// Upscale image using Real-ESRGAN
pub fn upscale_image(
    pixels: Vec<u8>,
    width: u32,
    height: u32,
    scale_factor: u32,
) -> Result<Vec<u8>> {
    ai_engine::upscale::upscale_image(&pixels, width, height, scale_factor)
}

/// Get output dimensions for upscale
pub fn upscale_dimensions(width: u32, height: u32, scale_factor: u32) -> (u32, u32) {
    ai_engine::upscale::upscale_dimensions(width, height, scale_factor)
}

// ─── Auto Masking ────────────────────────────────────────

/// Mask type for segmentation
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub enum MaskTypeBridge {
    Subject,
    Background,
    Sky,
    Face,
    Custom,
}

/// Auto-generated mask result
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AutoMaskResult {
    pub mask: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub confidence: f32,
    pub mask_type: String,
}

/// Generate automatic mask using SAM2
pub fn auto_mask(
    pixels: Vec<u8>,
    width: u32,
    height: u32,
    mask_type: MaskTypeBridge,
) -> Result<AutoMaskResult> {
    let mt = match mask_type {
        MaskTypeBridge::Subject => ai_engine::mask::MaskType::Subject,
        MaskTypeBridge::Background => ai_engine::mask::MaskType::Background,
        MaskTypeBridge::Sky => ai_engine::mask::MaskType::Sky,
        MaskTypeBridge::Face => ai_engine::mask::MaskType::Face,
        MaskTypeBridge::Custom => ai_engine::mask::MaskType::Custom,
    };
    let result = ai_engine::mask::auto_mask(&pixels, width, height, mt)?;
    Ok(AutoMaskResult {
        mask: result.mask,
        width: result.width,
        height: result.height,
        confidence: result.confidence,
        mask_type: format!("{:?}", result.mask_type),
    })
}

/// Feather mask edges for smooth blending
pub fn feather_mask(mask: Vec<u8>, width: u32, height: u32, radius: u32) -> Vec<u8> {
    let mut m = mask;
    ai_engine::mask::feather_mask(&mut m, width, height, radius);
    m
}

// ─── Photo Scoring (Culling) ────────────────────────────

/// Culling score for a photo
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CullingScoreBridge {
    pub overall: f32,
    pub sharpness: f32,
    pub exposure: f32,
    pub color: f32,
    pub composition: f32,
    pub face_quality: f32,
}

/// Score a photo for culling
pub fn score_photo(
    pixels: Vec<u8>,
    width: u32,
    height: u32,
) -> Result<CullingScoreBridge> {
    let score = ai_engine::cull::score_photo(&pixels, width, height)?;
    Ok(CullingScoreBridge {
        overall: score.overall,
        sharpness: score.sharpness,
        exposure: score.exposure,
        color: score.color,
        composition: score.composition,
        face_quality: score.face_quality,
    })
}

/// Batch score multiple photos
pub fn batch_score_photos(
    photos: Vec<(Vec<u8>, u32, u32)>,
) -> Result<Vec<CullingScoreBridge>> {
    let refs: Vec<(&[u8], u32, u32)> = photos.iter()
        .map(|(p, w, h)| (p.as_slice(), *w, *h))
        .collect();
    let scores = ai_engine::cull::batch_score(&refs)?;
    Ok(scores.into_iter().map(|s| CullingScoreBridge {
        overall: s.overall,
        sharpness: s.sharpness,
        exposure: s.exposure,
        color: s.color,
        composition: s.composition,
        face_quality: s.face_quality,
    }).collect())
}

/// Get recommended photos above threshold
pub fn recommend_photos(
    scores: Vec<CullingScoreBridge>,
    threshold: f32,
) -> Vec<usize> {
    let internal_scores: Vec<ai_engine::cull::CullingScore> = scores.into_iter().map(|s| {
        ai_engine::cull::CullingScore {
            overall: s.overall,
            sharpness: s.sharpness,
            exposure: s.exposure,
            color: s.color,
            composition: s.composition,
            face_quality: s.face_quality,
        }
    }).collect();
    ai_engine::cull::recommend_photos(&internal_scores, threshold)
}

// ─── Core Inference ──────────────────────────────────────

/// Run ONNX model inference on pixel data
pub fn run_inference(
    model_path: String,
    input_pixels: Vec<u8>,
    width: u32,
    height: u32,
) -> Result<Vec<f32>> {
    #[cfg(feature = "ai")]
    {
        use ort::{Session, SessionBuilder, inputs};
        use std::path::Path;

        let session = SessionBuilder::new()?
            .commit_from_file(Path::new(&model_path))?;

        let tensor_data = ai_engine::inference::prepare_input(&input_pixels, width, height);
        let input_shape = [1, 3, height as usize, width as usize];
        let input_tensor = ort::Value::try_from_tensor("input", &tensor_data, &input_shape)?;
        let outputs = session.run(inputs![input_tensor]?)?;
        let output = outputs[0].try_extract_tensor::<f32>()?;
        Ok(output.as_slice().unwrap_or_default().to_vec())
    }

    #[cfg(not(feature = "ai"))]
    {
        let _ = (&model_path, &input_pixels, width, height);
        anyhow::bail!("AI features not compiled. Build with --features ai to enable.")
    }
}
