/**
 * Orchestration: drag-drop, file read, wiring.
 */

import { analyzeData } from './detection.js';
import { initTable, renderTable, clearTable } from './table.js';
import { initCharts, renderAccelChart, renderGyroChart, clearCharts } from './chart.js';
import { renderDetail, clearDetail } from './detail.js';

let currentResults = [];

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

function handleFile(file) {
  const uploadZone = document.getElementById('upload-zone');
  const fileInfo = document.getElementById('file-info');
  const fileName = document.getElementById('file-name');

  setStatus(`Reading ${file.name}...`);

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      setStatus(`Analyzing ${file.name}...`);

      currentResults = analyzeData(data);

      if (currentResults.length === 0) {
        setStatus(`No sprints with sensor data found in ${file.name}`);
        clearTable();
        clearDetail();
        clearCharts();
        return;
      }

      renderTable(currentResults);
      setStatus(`${file.name} — ${currentResults.length} sprint(s)`);

      // Collapse upload zone, show file badge
      uploadZone.classList.add('collapsed');
      fileName.textContent = file.name;
      fileInfo.classList.add('visible');
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      clearTable();
      clearDetail();
      clearCharts();
    }
  };
  reader.onerror = () => setStatus('Error reading file');
  reader.readAsText(file);
}

function onRowSelect(index) {
  if (index >= 0 && index < currentResults.length) {
    const result = currentResults[index];
    renderDetail(result);
    renderAccelChart(result);
    renderGyroChart(result);
  }
}

function init() {
  initTable(onRowSelect);
  initCharts();

  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const fileInfo = document.getElementById('file-info');

  // Drag and drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  // Click to browse
  uploadZone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  // Allow re-uploading by clicking file badge
  fileInfo.addEventListener('click', () => {
    fileInput.click();
  });

  setStatus('Drop a .sprintzero file to begin');
}

document.addEventListener('DOMContentLoaded', init);
