use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LayerType {
    Adjustment,
    Mask,
    Retouch,
    Healing,
    Clone,
    Ai,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Layer {
    pub layer_id: String,
    pub name: String,
    pub layer_type: LayerType,
    pub opacity: f64,
    pub visible: bool,
    pub order: i32,
}

impl Layer {
    pub fn new(name: String, layer_type: LayerType, order: i32) -> Self {
        Self {
            layer_id: uuid::Uuid::new_v4().to_string(),
            name,
            layer_type,
            opacity: 1.0,
            visible: true,
            order,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayerCompositor {
    pub layers: Vec<Layer>,
}

impl LayerCompositor {
    pub fn new() -> Self {
        Self {
            layers: Vec::new(),
        }
    }

    pub fn add_layer(&mut self, layer: Layer) {
        self.layers.push(layer);
        self.layers.sort_by_key(|l| l.order);
    }

    pub fn remove_layer(&mut self, layer_id: &str) {
        self.layers.retain(|l| l.layer_id != layer_id);
    }

    pub fn get_layer(&self, layer_id: &str) -> Option<&Layer> {
        self.layers.iter().find(|l| l.layer_id == layer_id)
    }

    pub fn toggle_visibility(&mut self, layer_id: &str) {
        if let Some(layer) = self.layers.iter_mut().find(|l| l.layer_id == layer_id) {
            layer.visible = !layer.visible;
        }
    }

    pub fn set_opacity(&mut self, layer_id: &str, opacity: f64) {
        if let Some(layer) = self.layers.iter_mut().find(|l| l.layer_id == layer_id) {
            layer.opacity = opacity.clamp(0.0, 1.0);
        }
    }

    pub fn visible_layers(&self) -> Vec<&Layer> {
        self.layers.iter().filter(|l| l.visible).collect()
    }
}

impl Default for LayerCompositor {
    fn default() -> Self {
        Self::new()
    }
}
