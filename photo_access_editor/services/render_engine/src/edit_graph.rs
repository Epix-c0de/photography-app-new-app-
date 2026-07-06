use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NodeType {
    Exposure,
    Contrast,
    Highlights,
    Shadows,
    Whites,
    Blacks,
    Temperature,
    Tint,
    Texture,
    Clarity,
    Dehaze,
    Vibrance,
    Saturation,
    Curves,
    Hsl,
    ColorGrading,
    Lut,
    Crop,
    Mask,
    Retouch,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditNode {
    pub node_id: String,
    pub node_type: NodeType,
    pub parameters: HashMap<String, f64>,
    pub dependencies: Vec<String>,
    pub enabled: bool,
    pub execution_order: i32,
}

impl EditNode {
    pub fn new(node_type: NodeType, execution_order: i32) -> Self {
        Self {
            node_id: uuid::Uuid::new_v4().to_string(),
            node_type,
            parameters: HashMap::new(),
            dependencies: Vec::new(),
            enabled: true,
            execution_order,
        }
    }

    pub fn set_param(&mut self, key: &str, value: f64) {
        self.parameters.insert(key.to_string(), value);
    }

    pub fn get_param(&self, key: &str) -> f64 {
        self.parameters.get(key).copied().unwrap_or(0.0)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditGraph {
    pub session_id: String,
    pub nodes: Vec<EditNode>,
}

impl EditGraph {
    pub fn new(session_id: String) -> Self {
        Self {
            session_id,
            nodes: Vec::new(),
        }
    }

    pub fn add_node(&mut self, node: EditNode) {
        self.nodes.push(node);
        self.nodes.sort_by_key(|n| n.execution_order);
    }

    pub fn remove_node(&mut self, node_id: &str) {
        self.nodes.retain(|n| n.node_id != node_id);
    }

    pub fn get_node(&self, node_id: &str) -> Option<&EditNode> {
        self.nodes.iter().find(|n| n.node_id == node_id)
    }

    pub fn get_node_mut(&mut self, node_id: &str) -> Option<&mut EditNode> {
        self.nodes.iter_mut().find(|n| n.node_id == node_id)
    }

    pub fn toggle_node(&mut self, node_id: &str, enabled: bool) {
        if let Some(node) = self.get_node_mut(node_id) {
            node.enabled = enabled;
        }
    }

    pub fn enabled_nodes(&self) -> Vec<&EditNode> {
        self.nodes.iter().filter(|n| n.enabled).collect()
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).unwrap_or_default()
    }

    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}
