use anyhow::{Context, Result};
use image::GenericImageView;
use log::debug;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RawMetadata {
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
    pub gps: Option<String>,
    pub orientation: Option<i32>,
    pub color_space: Option<String>,
    pub bit_depth: Option<i32>,
}

impl RawMetadata {
    pub fn extract(path: &Path) -> Result<Self> {
        let img = image::open(path)
            .with_context(|| format!("Failed to open image for metadata: {}", path.display()))?;
        let (width, height) = img.dimensions();

        let format = path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("unknown")
            .to_uppercase();

        let exif_data = Self::extract_exif(path);

        let bit_depth = if Self::is_raw_format(&format) {
            Self::extract_raw_bit_depth(path)
        } else {
            None
        };

        let metadata = Self {
            width,
            height,
            format,
            camera_make: exif_data.as_ref().and_then(|e| e.camera_make.clone()),
            camera_model: exif_data.as_ref().and_then(|e| e.camera_model.clone()),
            lens: exif_data.as_ref().and_then(|e| e.lens.clone()),
            iso: exif_data.as_ref().and_then(|e| e.iso),
            aperture: exif_data.as_ref().and_then(|e| e.aperture),
            shutter_speed: exif_data.as_ref().and_then(|e| e.shutter_speed.clone()),
            focal_length: exif_data.as_ref().and_then(|e| e.focal_length),
            capture_date: exif_data.as_ref().and_then(|e| e.capture_date.clone()),
            gps: exif_data.as_ref().and_then(|e| e.gps.clone()),
            orientation: exif_data.as_ref().and_then(|e| e.orientation),
            color_space: exif_data.as_ref().and_then(|e| e.color_space.clone()),
            bit_depth,
        };

        debug!("Extracted metadata: {:?}", metadata);
        Ok(metadata)
    }

    fn is_raw_format(format: &str) -> bool {
        matches!(
            format,
            "CR2" | "CR3" | "NEF" | "NRW" | "ARW" | "SRF" | "RAF" | "DNG" | "ORF"
                | "RW2" | "PEF" | "SRW" | "3FR" | "KDC" | "MRW" | "RAW"
        )
    }

    fn extract_exif(path: &Path) -> Option<ExifData> {
        let file = File::open(path).ok()?;
        let mut bufreader = BufReader::new(file);
        let exif = exif::Reader::new()
            .read_from_container(&mut bufreader)
            .ok()?;

        let mut data = ExifData::default();

        // Camera make
        if let Some(field) = exif.get_field(exif::Tag::Make, exif::In::PRIMARY) {
            data.camera_make = Some(field.display_value().to_string());
        }

        // Camera model
        if let Some(field) = exif.get_field(exif::Tag::Model, exif::In::PRIMARY) {
            data.camera_model = Some(field.display_value().to_string());
        }

        // Lens model
        if let Some(field) = exif.get_field(exif::Tag::LensModel, exif::In::PRIMARY) {
            data.lens = Some(field.display_value().to_string());
        } else if let Some(field) = exif.get_field(exif::Tag::LensMake, exif::In::PRIMARY) {
            data.lens = Some(field.display_value().to_string());
        }

        // ISO
        if let Some(field) = exif.get_field(exif::Tag::ISOSpeed, exif::In::PRIMARY) {
            data.iso = field.value.get_uint(0).map(|v| v as i32);
        }

        // Aperture (FNumber) — display_value gives "f/2.8" format
        if let Some(field) = exif.get_field(exif::Tag::FNumber, exif::In::PRIMARY) {
            let s = field.display_value().to_string();
            data.aperture = s.trim_start_matches("f/").parse::<f64>().ok();
        }

        // Shutter speed (ExposureTime)
        if let Some(field) = exif.get_field(exif::Tag::ExposureTime, exif::In::PRIMARY) {
            data.shutter_speed = Some(field.display_value().to_string());
        }

        // Focal length — display_value gives "50 mm" format
        if let Some(field) = exif.get_field(exif::Tag::FocalLength, exif::In::PRIMARY) {
            let s = field.display_value().to_string();
            data.focal_length = s.trim_end_matches(" mm").trim().parse::<f64>().ok();
        }

        // Date/time original
        if let Some(field) = exif.get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY) {
            data.capture_date = Some(field.display_value().to_string());
        } else if let Some(field) = exif.get_field(exif::Tag::DateTime, exif::In::PRIMARY) {
            data.capture_date = Some(field.display_value().to_string());
        }

        // Orientation
        if let Some(field) = exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY) {
            data.orientation = field.value.get_uint(0).map(|v| v as i32);
        }

        // Color space
        if let Some(field) = exif.get_field(exif::Tag::ColorSpace, exif::In::PRIMARY) {
            data.color_space = Some(field.display_value().to_string());
        }

        Some(data)
    }

    fn extract_raw_bit_depth(path: &Path) -> Option<i32> {
        let loader = rawloader::RawLoader::new();
        let _raw_image = loader.decode_file(path).ok()?;
        // rawloader always outputs 16-bit integer data (or 32-bit float for some DNGs)
        // We report 16 as the effective bit depth
        Some(16)
    }
}

#[derive(Default)]
struct ExifData {
    camera_make: Option<String>,
    camera_model: Option<String>,
    lens: Option<String>,
    iso: Option<i32>,
    aperture: Option<f64>,
    shutter_speed: Option<String>,
    focal_length: Option<f64>,
    capture_date: Option<String>,
    gps: Option<String>,
    orientation: Option<i32>,
    color_space: Option<String>,
}
