use anyhow::Result;
use image::DynamicImage;

/// Export an image to a specific format
pub fn export_image(
    pixels: Vec<u8>,
    width: u32,
    height: u32,
    output_path: String,
    format: String,
    _quality: u32,
) -> Result<()> {
    let img = DynamicImage::ImageRgba8(
        image::RgbaImage::from_raw(width, height, pixels)
            .ok_or_else(|| anyhow::anyhow!("Invalid pixel data"))?,
    );

    let path = std::path::Path::new(&output_path);
    let ext = if format.is_empty() {
        path.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("jpg")
            .to_string()
    } else {
        format
    };

    match ext.to_lowercase().as_str() {
        "jpg" | "jpeg" => {
            let rgb = img.to_rgb8();
            let mut file = std::fs::File::create(path)?;
            rgb.write_to(&mut file, image::ImageFormat::Jpeg)?;
        }
        "png" => {
            let mut file = std::fs::File::create(path)?;
            img.write_to(&mut file, image::ImageFormat::Png)?;
        }
        "tiff" | "tif" => {
            let mut file = std::fs::File::create(path)?;
            img.write_to(&mut file, image::ImageFormat::Tiff)?;
        }
        "webp" => {
            let mut file = std::fs::File::create(path)?;
            img.write_to(&mut file, image::ImageFormat::WebP)?;
        }
        _ => {
            anyhow::bail!("Unsupported export format: {}", ext);
        }
    }

    Ok(())
}
