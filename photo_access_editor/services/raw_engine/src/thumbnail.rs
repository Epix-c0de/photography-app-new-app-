use anyhow::Result;
use image::{DynamicImage, imageops::FilterType};
use std::path::{Path, PathBuf};
use log::info;

/// Thumbnail sizes matching the spec
pub const THUMB_SIZES: &[u32] = &[128, 256, 512, 1024];

pub struct ThumbnailGenerator;

impl ThumbnailGenerator {
    /// Generate all thumbnail sizes for an image
    pub fn generate_all(
        source_path: &Path,
        output_dir: &Path,
        photo_id: &str,
    ) -> Result<Vec<(u32, PathBuf)>> {
        std::fs::create_dir_all(output_dir)?;
        
        let img = image::open(source_path)?;
        let mut results = Vec::new();
        
        for &size in THUMB_SIZES {
            let path = Self::generate_one(&img, output_dir, photo_id, size)?;
            results.push((size, path));
        }
        
        info!("Generated {} thumbnails for {}", results.len(), photo_id);
        Ok(results)
    }

    /// Generate a single thumbnail
    pub fn generate_one(
        img: &DynamicImage,
        output_dir: &Path,
        photo_id: &str,
        size: u32,
    ) -> Result<PathBuf> {
        let filename = format!("{}_{}.jpg", photo_id, size);
        let path = output_dir.join(&filename);
        
        let resized = img.resize(size, size, FilterType::Lanczos3);
        resized.save_with_format(&path, image::ImageFormat::Jpeg)?;
        
        Ok(path)
    }

    /// Generate thumbnail from path
    pub fn generate_from_path(
        source_path: &Path,
        output_dir: &Path,
        photo_id: &str,
        size: u32,
    ) -> Result<PathBuf> {
        let img = image::open(source_path)?;
        Self::generate_one(&img, output_dir, photo_id, size)
    }

    /// Generate a filmstrip thumbnail (wide aspect ratio)
    pub fn generate_filmstrip(
        source_path: &Path,
        output_dir: &Path,
        photo_id: &str,
        width: u32,
        height: u32,
    ) -> Result<PathBuf> {
        std::fs::create_dir_all(output_dir)?;
        
        let img = image::open(source_path)?;
        let filename = format!("{}_filmstrip.jpg", photo_id);
        let path = output_dir.join(&filename);
        
        let resized = img.resize(width, height, FilterType::Lanczos3);
        resized.save_with_format(&path, image::ImageFormat::Jpeg)?;
        
        Ok(path)
    }
}
