use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MaskType {
    Subject,
    Sky,
    Background,
    Face,
    Hair,
    Body,
    Clothing,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaskData {
    pub mask_id: String,
    pub mask_type: MaskType,
    pub width: u32,
    pub height: u32,
    pub pixels: Vec<u8>,
}

impl MaskData {
    pub fn new(mask_type: MaskType, width: u32, height: u32) -> Self {
        Self {
            mask_id: uuid::Uuid::new_v4().to_string(),
            mask_type,
            width,
            height,
            pixels: vec![0u8; (width * height) as usize],
        }
    }

    pub fn invert(&mut self) {
        for pixel in self.pixels.iter_mut() {
            *pixel = 255 - *pixel;
        }
    }

    pub fn combine_add(&mut self, other: &MaskData) {
        for (a, b) in self.pixels.iter_mut().zip(other.pixels.iter()) {
            *a = (*a).max(*b);
        }
    }

    pub fn combine_subtract(&mut self, other: &MaskData) {
        for (a, b) in self.pixels.iter_mut().zip(other.pixels.iter()) {
            *a = (*a).min(255 - *b);
        }
    }

    pub fn combine_intersect(&mut self, other: &MaskData) {
        for (a, b) in self.pixels.iter_mut().zip(other.pixels.iter()) {
            *a = (*a).min(*b);
        }
    }
}
