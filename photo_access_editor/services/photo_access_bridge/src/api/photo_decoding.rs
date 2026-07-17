use anyhow::Result;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DecodedImage {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RawMetadataResponse {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub lens: Option<String>,
    pub iso: Option<i32>,
    pub aperture: Option<f64>,
    pub shutter_speed: Option<String>,
    pub focal_length: Option<f64>,
    pub capture_date: Option<String>,
    pub orientation: Option<i32>,
    pub bit_depth: Option<i32>,
}

#[flutter_rust_bridge::frb(opaque)]
pub struct DecodedImageWrapper {
    pub inner: DecodedImage,
}

impl DecodedImageWrapper {
    pub fn width(&self) -> u32 {
        self.inner.width
    }
    pub fn height(&self) -> u32 {
        self.inner.height
    }
    pub fn data(&self) -> Vec<u8> {
        self.inner.data.clone()
    }
}

/// Decode a photo file (RAW or standard) into RGBA pixel data
pub fn decode_photo(path: String) -> Result<DecodedImageWrapper> {
    let img = raw_engine::decoder::RawDecoder::decode(std::path::Path::new(&path))?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    Ok(DecodedImageWrapper {
        inner: DecodedImage {
            width: w,
            height: h,
            data: rgba.into_raw(),
        },
    })
}

/// Decode a photo at reduced resolution for thumbnails/previews
pub fn decode_photo_preview(path: String, max_size: u32) -> Result<DecodedImageWrapper> {
    let img = raw_engine::decoder::RawDecoder::decode_preview(
        std::path::Path::new(&path),
        max_size,
    )?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    Ok(DecodedImageWrapper {
        inner: DecodedImage {
            width: w,
            height: h,
            data: rgba.into_raw(),
        },
    })
}

/// Extract EXIF metadata from a photo file
pub fn extract_metadata(path: String) -> Result<RawMetadataResponse> {
    let meta = raw_engine::metadata::RawMetadata::extract(std::path::Path::new(&path))?;
    Ok(RawMetadataResponse {
        width: meta.width,
        height: meta.height,
        format: meta.format,
        camera_make: meta.camera_make,
        camera_model: meta.camera_model,
        lens: meta.lens,
        iso: meta.iso,
        aperture: meta.aperture,
        shutter_speed: meta.shutter_speed,
        focal_length: meta.focal_length,
        capture_date: meta.capture_date,
        orientation: meta.orientation,
        bit_depth: meta.bit_depth,
    })
}

/// Check if a file is a supported RAW format
pub fn is_raw_file(path: String) -> bool {
    raw_engine::decoder::RawDecoder::is_raw_file(std::path::Path::new(&path))
}

/// Get list of supported RAW file extensions
pub fn supported_raw_extensions() -> Vec<String> {
    raw_engine::decoder::RawDecoder::supported_extensions()
        .iter()
        .map(|s| s.to_string())
        .collect()
}
