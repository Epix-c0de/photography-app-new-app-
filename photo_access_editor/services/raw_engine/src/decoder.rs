use anyhow::Result;
use image::DynamicImage;
use std::path::Path;
use log::info;

use crate::metadata::RawMetadata;

/// Supported RAW file extensions
const RAW_EXTENSIONS: &[&str] = &[
    "cr2", "cr3",  // Canon
    "nef", "nrw",  // Nikon
    "arw", "srf",  // Sony
    "raf",         // Fujifilm
    "dng",         // Adobe DNG
    "orf",         // Olympus
    "rw2",         // Panasonic
    "pef",         // Pentax
    "srw",         // Samsung
    "3fr",         // Hasselblad
    "kdc",         // Kodak
    "mrw",         // Minolta
    "raw",         // Generic
];

pub struct RawDecoder;

impl RawDecoder {
    /// Check if a file is a supported RAW format
    pub fn is_raw_file(path: &Path) -> bool {
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| RAW_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
            .unwrap_or(false)
    }

    /// Get list of supported extensions
    pub fn supported_extensions() -> &'static [&'static str] {
        RAW_EXTENSIONS
    }

    /// Decode a RAW file into a DynamicImage
    /// 
    /// Currently uses the `image` crate as fallback.
    /// For production, integrate LibRaw via FFI:
    /// - rawloader for raw data decoding
    /// - LibRaw bindings for camera-specific processing
    pub fn decode(path: &Path) -> Result<DynamicImage> {
        info!("Decoding file: {}", path.display());
        
        // Try standard image decoding first (works for DNG and some formats)
        let img = image::open(path)?;
        Ok(img)
    }

    /// Decode a RAW file and extract metadata
    pub fn decode_with_metadata(path: &Path) -> Result<(DynamicImage, RawMetadata)> {
        let img = Self::decode(path)?;
        let metadata = RawMetadata::extract(path)?;
        Ok((img, metadata))
    }

    /// Decode a specific region of a RAW file (for tile-based rendering)
    pub fn decode_region(
        path: &Path,
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    ) -> Result<DynamicImage> {
        let img = Self::decode(path)?;
        let cropped = img.crop(x, y, width, height);
        Ok(cropped)
    }

    /// Decode a RAW file at reduced resolution (for previews)
    pub fn decode_preview(path: &Path, max_size: u32) -> Result<DynamicImage> {
        let img = Self::decode(path)?;
        let (w, h) = (img.width(), img.height());
        
        if w <= max_size && h <= max_size {
            return Ok(img);
        }
        
        let ratio = (max_size as f64 / w as f64).min(max_size as f64 / h as f64);
        let new_w = (w as f64 * ratio) as u32;
        let new_h = (h as f64 * ratio) as u32;
        
        let resized = img.resize(new_w, new_h, image::imageops::FilterType::Lanczos3);
        Ok(resized)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_raw_file() {
        assert!(RawDecoder::is_raw_file(Path::new("photo.CR2")));
        assert!(RawDecoder::is_raw_file(Path::new("photo.nef")));
        assert!(RawDecoder::is_raw_file(Path::new("photo.ARW")));
        assert!(RawDecoder::is_raw_file(Path::new("photo.dng")));
        assert!(!RawDecoder::is_raw_file(Path::new("photo.jpg")));
        assert!(!RawDecoder::is_raw_file(Path::new("photo.png")));
    }
}
