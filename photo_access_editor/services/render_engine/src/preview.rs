use anyhow::Result;
use image::{DynamicImage, ImageBuffer, Rgb, RgbImage};
use std::path::Path;
use log::info;

use crate::adjustments::BasicAdjustments;

pub const PREVIEW_SIZES: &[u32] = &[256, 512, 1024];

pub struct PreviewRenderer;

impl PreviewRenderer {
    /// Generate preview at specified size
    pub fn render_preview(
        img: &DynamicImage,
        max_size: u32,
    ) -> Result<DynamicImage> {
        let (w, h) = (img.width(), img.height());
        
        if w <= max_size && h <= max_size {
            return Ok(img.clone());
        }
        
        let ratio = (max_size as f64 / w as f64).min(max_size as f64 / h as f64);
        let new_w = (w as f64 * ratio) as u32;
        let new_h = (h as f64 * ratio) as u32;
        
        let resized = img.resize(new_w, new_h, image::imageops::FilterType::Lanczos3);
        Ok(resized)
    }

    /// Apply basic adjustments to a preview image
    pub fn apply_adjustments(
        img: &DynamicImage,
        adjustments: &BasicAdjustments,
    ) -> Result<DynamicImage> {
        let rgb = img.to_rgb8();
        let (width, height) = rgb.dimensions();
        let mut output: RgbImage = ImageBuffer::new(width, height);
        
        for y in 0..height {
            for x in 0..width {
                let pixel = rgb.get_pixel(x, y);
                let r = pixel[0] as f64 / 255.0;
                let g = pixel[1] as f64 / 255.0;
                let b = pixel[2] as f64 / 255.0;
                
                // Apply exposure
                let mut r = adjustments.apply_exposure(r);
                let mut g = adjustments.apply_exposure(g);
                let mut b = adjustments.apply_exposure(b);
                
                // Apply contrast
                r = adjustments.apply_contrast(r);
                g = adjustments.apply_contrast(g);
                b = adjustments.apply_contrast(b);
                
                // Apply highlights/shadows
                let luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                r = adjustments.apply_highlights(r);
                g = adjustments.apply_highlights(g);
                b = adjustments.apply_highlights(b);
                r = adjustments.apply_shadows(r);
                g = adjustments.apply_shadows(g);
                b = adjustments.apply_shadows(b);
                
                // Apply saturation
                let sat_factor = 1.0 + adjustments.saturation / 100.0;
                let gray = 0.299 * r + 0.587 * g + 0.114 * b;
                r = gray + (r - gray) * sat_factor;
                g = gray + (g - gray) * sat_factor;
                b = gray + (b - gray) * sat_factor;
                
                // Clamp and convert
                let r = (r.clamp(0.0, 1.0) * 255.0) as u8;
                let g = (g.clamp(0.0, 1.0) * 255.0) as u8;
                let b = (b.clamp(0.0, 1.0) * 255.0) as u8;
                
                output.put_pixel(x, y, Rgb([r, g, b]));
            }
        }
        
        Ok(DynamicImage::ImageRgb8(output))
    }

    /// Generate before/after comparison
    pub fn generate_comparison(
        original: &DynamicImage,
        edited: &DynamicImage,
        split_position: f64,
    ) -> Result<DynamicImage> {
        let (w, h) = (original.width(), original.height());
        let split_x = (w as f64 * split_position) as u32;
        
        let mut output: RgbImage = ImageBuffer::new(w, h);
        
        let orig_rgb = original.to_rgb8();
        let edit_rgb = edited.to_rgb8();
        
        for y in 0..h {
            for x in 0..w {
                let pixel = if x < split_x {
                    orig_rgb.get_pixel(x, y).clone()
                } else {
                    edit_rgb.get_pixel(x, y).clone()
                };
                output.put_pixel(x, y, pixel);
            }
        }
        
        Ok(DynamicImage::ImageRgb8(output))
    }
}
