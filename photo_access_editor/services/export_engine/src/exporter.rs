use anyhow::Result;
use image::DynamicImage;
use std::path::Path;
use log::info;

use super::profiles::ExportProfile;

pub struct ImageExporter;

impl ImageExporter {
    /// Export image with profile settings
    pub fn export(
        img: &DynamicImage,
        output_path: &Path,
        profile: &ExportProfile,
    ) -> Result<()> {
        info!("Exporting to: {}", output_path.display());
        
        // Apply resize if needed
        let img = if let Some((w, h)) = profile.resize {
            img.resize(w, h, image::imageops::FilterType::Lanczos3)
        } else {
            img.clone()
        };
        
        // Determine format from extension
        let format = match output_path.extension().and_then(|e| e.to_str()) {
            Some("jpg") | Some("jpeg") => image::ImageFormat::Jpeg,
            Some("png") => image::ImageFormat::Png,
            Some("tiff") | Some("tif") => image::ImageFormat::Tiff,
            Some("webp") => image::ImageFormat::WebP,
            _ => image::ImageFormat::Jpeg,
        };
        
        // Save with quality settings
        match format {
            image::ImageFormat::Jpeg => {
                let rgb = img.to_rgb8();
                let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
                    std::fs::File::create(output_path)?,
                    profile.quality.unwrap_or(85) as u8,
                );
                encoder.encode_image(&rgb)?;
            }
            image::ImageFormat::Png => {
                img.save_with_format(output_path, format)?;
            }
            image::ImageFormat::WebP => {
                // WebP encoding via image crate
                img.save_with_format(output_path, format)?;
            }
            _ => {
                img.save_with_format(output_path, format)?;
            }
        }
        
        info!("Export complete: {}", output_path.display());
        Ok(())
    }

    /// Batch export multiple images
    pub fn batch_export(
        images: &[(DynamicImage, String)],
        output_dir: &Path,
        profile: &ExportProfile,
    ) -> Result<Vec<String>> {
        std::fs::create_dir_all(output_dir)?;
        let mut exported = Vec::new();
        
        for (img, filename) in images {
            let output_path = output_dir.join(filename);
            Self::export(img, &output_path, profile)?;
            exported.push(output_path.to_string_lossy().to_string());
        }
        
        info!("Batch exported {} images", exported.len());
        Ok(exported)
    }
}
