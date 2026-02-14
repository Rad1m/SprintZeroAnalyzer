use wasm_bindgen::prelude::*;

mod types;
mod parsing;
mod detection;
mod signal;
mod biomechanics;

// Phase 0: Verify WASM loads correctly
#[wasm_bindgen]
pub fn ping() -> String {
    "falcata-wasm ready".to_string()
}

// Phase 1: Parse .falcata file
#[wasm_bindgen]
pub fn parse_falcata(json_str: &str) -> Result<JsValue, JsError> {
    let sprints = parsing::falcata::parse(json_str)
        .map_err(|e| JsError::new(&e.to_string()))?;
    serde_wasm_bindgen::to_value(&sprints)
        .map_err(|e| JsError::new(&e.to_string()))
}

// Phase 2: Analyze a single sprint
#[wasm_bindgen]
pub fn analyze_sprint(sprint_json: &str) -> Result<JsValue, JsError> {
    let sprint: types::ParsedSprint = serde_json::from_str(sprint_json)
        .map_err(|e| JsError::new(&e.to_string()))?;
    let result = detection::bidirectional::analyze(&sprint)
        .map_err(|e| JsError::new(&e.to_string()))?;
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsError::new(&e.to_string()))
}

// Combined: parse file + analyze all sprints in one call
#[wasm_bindgen]
pub fn parse_and_analyze(json_str: &str) -> Result<JsValue, JsError> {
    let sprints = parsing::falcata::parse(json_str)
        .map_err(|e| JsError::new(&e.to_string()))?;

    let mut results = Vec::new();
    for sprint in &sprints {
        match detection::bidirectional::analyze(sprint) {
            Ok(result) => results.push(result),
            Err(_) => continue,
        }
    }

    serde_wasm_bindgen::to_value(&results)
        .map_err(|e| JsError::new(&e.to_string()))
}
