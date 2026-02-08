/**
 * Results table rendering and row selection.
 */

let selectedRow = -1;
let onRowSelect = null;

const DECISION_COLORS = {
  agree: '#3fb950',
  trust_forward: '#d29922',
  trust_backward: '#d29922',
};

export function initTable(rowSelectCallback) {
  onRowSelect = rowSelectCallback;
}

export function renderTable(results) {
  const tbody = document.getElementById('results-body');
  tbody.innerHTML = '';
  selectedRow = -1;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const tr = document.createElement('tr');
    tr.dataset.index = i;

    const decisionColor = DECISION_COLORS[r.decision] || '#c9d1d9';

    tr.innerHTML =
      `<td>${r.index}</td>` +
      `<td>${r.date}</td>` +
      `<td>${r.distance}</td>` +
      `<td>${r.fwdDur.toFixed(2)}</td>` +
      `<td>${r.bwdDur.toFixed(2)}</td>` +
      `<td>${r.gap.toFixed(2)}</td>` +
      `<td style="color:${decisionColor}">${r.decision}</td>` +
      `<td>${r.finalDur.toFixed(2)}</td>`;

    tr.addEventListener('click', () => selectRow(i));
    tbody.appendChild(tr);
  }

  // Auto-select first row
  if (results.length > 0) {
    selectRow(0);
  }
}

function selectRow(index) {
  const tbody = document.getElementById('results-body');
  const rows = tbody.querySelectorAll('tr');

  if (selectedRow >= 0 && selectedRow < rows.length) {
    rows[selectedRow].classList.remove('selected');
  }

  selectedRow = index;
  if (index >= 0 && index < rows.length) {
    rows[index].classList.add('selected');
    rows[index].scrollIntoView({ block: 'nearest' });
  }

  if (onRowSelect) onRowSelect(index);
}

export function clearTable() {
  document.getElementById('results-body').innerHTML = '';
  selectedRow = -1;
}
