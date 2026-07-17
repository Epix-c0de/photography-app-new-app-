use anyhow::{Context, Result};
use image::DynamicImage;
use log::{debug, info};
use std::path::Path;

use crate::metadata::RawMetadata;

const RAW_EXTENSIONS: &[&str] = &[
    "cr2", "cr3", "nef", "nrw", "arw", "srf", "raf", "dng",
    "orf", "rw2", "pef", "srw", "3fr", "kdc", "mrw", "raw",
];

pub struct RawDecoder;

impl RawDecoder {
    pub fn is_raw_file(path: &Path) -> bool {
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| RAW_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
            .unwrap_or(false)
    }

    pub fn supported_extensions() -> &'static [&'static str] {
        RAW_EXTENSIONS
    }

    pub fn decode(path: &Path) -> Result<DynamicImage> {
        info!("Decoding file: {}", path.display());

        if Self::is_raw_file(path) {
            Self::decode_raw(path)
        } else {
            let img = image::open(path)
                .with_context(|| format!("Failed to open image: {}", path.display()))?;
            Ok(img)
        }
    }

    fn decode_raw(path: &Path) -> Result<DynamicImage> {
        debug!("Using rawloader for: {}", path.display());

        let loader = rawloader::RawLoader::new();
        let raw_image = loader
            .decode_file(path)
            .map_err(|e| anyhow::anyhow!("rawloader decode failed: {}", e))?;

        let width = raw_image.width;
        let height = raw_image.height;

        debug!("RAW decoded: {}x{}, cpp={}", width, height, raw_image.cpp);

        // Extract u16 or f32 data from RawImageData
        let img_data = match &raw_image.data {
            rawloader::RawImageData::Integer(data) => {
                // Demosaic bayer data to RGB
                Self::demosaic_bayer(data, width, height, &raw_image)
            }
            rawloader::RawImageData::Float(data) => {
                // Float data — scale to u16 range
                let max_val = data.iter().cloned().fold(0.0f32, f32::max);
                let scale = if max_val > 0.0 { 65535.0 / max_val } else { 1.0 };
                let u16_data: Vec<u16> = data.iter().map(|&v| (v * scale).min(65535.0) as u16).collect();
                Self::demosaic_bayer(&u16_data, width, height, &raw_image)
            }
        };

        Ok(img_data)
    }

    /// Simple bayer demosaic — converts single-channel bayer pattern to RGB
    fn demosaic_bayer(data: &[u16], width: usize, height: usize, raw: &rawloader::RawImage) -> DynamicImage {
        let mut img = image::RgbImage::new(width as u32, height as u32);

        // Get CFA pattern offsets from crops
        let crop_top = raw.crops[0];
        let crop_left = raw.crops[3];

        for y in 0..height {
            for x in 0..width {
                let src_idx = y * width + x;
                if src_idx >= data.len() {
                    continue;
                }

                let val = data[src_idx];
                // Map 16-bit to 8-bit
                let v8 = (val >> 8) as u8;

                // Simple nearest-neighbor demosaic based on CFA position
                let cfa_y = y + crop_top;
                let cfa_x = x + crop_left;
                let (r, g, b) = match raw.cfa.color_at(cfa_y, cfa_x) {
                    0 => (v8, 0, 0),       // Red
                    1 => (0, v8, 0),       // Green
                    2 => (0, 0, v8),       // Blue
                    _ => (v8, v8, v8),     // Fallback
                };

                img.put_pixel(x as u32, y as u32, image::Rgb([r, g, b]));
            }
        }

        DynamicImage::ImageRgb8(img)
    }

    pub fn decode_with_metadata(path: &Path) -> Result<(DynamicImage, RawMetadata)> {
        let img = Self::decode(path)?;
        let metadata = RawMetadata::extract(path)?;
        Ok((img, metadata))
    }

    pub fn decode_region(
        path: &Path,
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    ) -> Result<DynamicImage> {
        let mut img = Self::decode(path)?;
        let cropped = img.crop(x, y, width, height);
        Ok(cropped)
    }

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

