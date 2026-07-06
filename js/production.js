/**
 * Alumital SAS - Módulo de Despiece y Producción
 */

function dibujarCorteSVG(corte, longitud) {
  const c = corte || '90°/90°';
  const parts = c.split('/');
  const leftAngle = parts[0] || '90°';
  const rightAngle = parts.length > 1 ? parts[1] : (parts[0] || '90°');
  
  let tl = 0, tr = 120, bl = 0, br = 120;
  
  if (leftAngle.includes('45')) tl = 20; 
  if (rightAngle.includes('45')) tr = 100;

  return `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: -4px;">
      <svg width="120" height="20" viewBox="0 0 120 20" style="overflow: visible; margin-bottom: 2px;">
        <polygon points="${tl},0 ${tr},0 ${br},20 ${bl},20" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5" />
        ${leftAngle.includes('45') ? `<line x1="0" y1="20" x2="${tl}" y2="0" stroke="#ef4444" stroke-width="2" stroke-dasharray="3,3" />` : ''}
        ${rightAngle.includes('45') ? `<line x1="120" y1="20" x2="${tr}" y2="0" stroke="#ef4444" stroke-width="2" stroke-dasharray="3,3" />` : ''}
      </svg>
      <div style="font-size: 11px; color: #64748b; font-weight: bold; letter-spacing: 0.5px; white-space: nowrap;">
        <span style="color:#ef4444">${leftAngle}</span> 
        <span style="margin: 0 10px; color:#1d4ed8; font-size: 13px;">L= ${longitud} mm</span> 
        <span style="color:#ef4444">${rightAngle}</span>
      </div>
    </div>
  `;
}

function renderizarDespiece() {
  const container = document.getElementById('produccion-container');
  if (!container) return;

  // Renderizar primero el historial
  renderizarHistorialProduccion();

  const items = window.STATE.items || [];
  
  if (items.length === 0) {
    container.innerHTML = `<div class="glass-panel" style="text-align:center; padding: 40px; color: #64748b;">
      <p>No hay aberturas en el proyecto. Agrega aberturas en el Configurador para ver el despiece.</p>
    </div>`;
    return;
  }

  let html = '';

  items.forEach((item, idx) => {
    // Título de la abertura
    html += `
      <div class="glass-panel" style="page-break-inside: avoid; border: 2px solid #e2e8f0; padding: 20px; border-radius: 12px;">
        <div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 16px;">
          <!-- SVG Window Thumbnail -->
          <div style="flex: 0 0 auto; width: 100%; max-width: 180px; text-align: center;">
            <svg id="prod-svg-${idx}" style="width: 100%; height: 180px; display: block; margin: 0 auto;"></svg>
          </div>
          
          <div style="flex: 1; min-width: 200px;">
            <h3 style="color: var(--accent-blue); margin-bottom: 8px;">
              ${idx + 1}. ${item.nombre || 'Abertura'} - ${item.cantidad} Unidad(es)
            </h3>
            <p style="font-size: 14px; color: #64748b; margin: 0 0 4px 0;">
              <strong>Dimensiones:</strong> ${item.width}mm x ${item.height}mm
            </p>
            <p style="font-size: 14px; color: #64748b; margin: 0;">
              <strong>Categoría:</strong> <span style="text-transform: capitalize;">${(item.categoria || 'Ventana').replace('_', ' ')}</span> | 
              <strong>Tipo:</strong> <span style="text-transform: capitalize;">${item.tipo}</span>
            </p>
          </div>
        </div>
    `;

    // Tabla de Perfiles
    if (item.perfiles && item.perfiles.length > 0) {
      html += `
        <h4 style="margin-bottom: 10px; color: #475569; font-size: 14px;">🪵 Perfiles de Aluminio</h4>
        <div class="table-container" style="margin-bottom: 20px;">
          <table class="data-table" style="width: 100%; border-collapse: collapse;">
            <thead style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
              <tr>
                <th style="text-align: left; padding: 10px;">Perfil</th>
                <th style="text-align: center; padding: 10px;">Ref/Código</th>
                <th style="text-align: center; padding: 10px;">Cortes (Ángulo)</th>
                <th style="text-align: center; padding: 10px;">Cantidad</th>
                <th style="text-align: right; padding: 10px;">Longitud de Corte (mm)</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      item.perfiles.forEach(p => {
        html += `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="text-align: left; padding: 10px;"><strong>${p.nombre}</strong></td>
            <td style="text-align: center; color: #64748b; padding: 10px;">${p.codigo || '-'}</td>
            <td style="text-align: center; padding: 10px;">${dibujarCorteSVG(p.corte, p.longitud)}</td>
            <td style="text-align: center; font-weight: bold; padding: 10px; font-size: 16px;">${p.cantidad * (item.cantidad || 1)}</td>
            <td style="text-align: right; color: var(--accent-blue); font-weight: 900; padding: 10px; font-size: 18px; letter-spacing: 0.5px;">${p.longitud} mm</td>
          </tr>
        `;
      });

      html += `</tbody></table></div>`;
    }

    // Tabla de Vidrios
    if (item.vidrios && item.vidrios.length > 0) {
      html += `
        <h4 style="margin-bottom: 10px; color: #475569; font-size: 14px;">🪟 Vidrios</h4>
        <div class="table-container">
          <table class="data-table" style="width: 100%; border-collapse: collapse;">
            <thead style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
              <tr>
                <th style="text-align: left; padding: 10px;">Tipo de Vidrio</th>
                <th style="text-align: center; padding: 10px;">Cantidad</th>
                <th style="text-align: right; padding: 10px;">Medida de Corte (Ancho x Alto mm)</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      item.vidrios.forEach(v => {
        html += `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="text-align: left; padding: 10px;"><strong>${v.nombre}</strong></td>
            <td style="text-align: center; font-weight: bold; padding: 10px; font-size: 16px;">${v.cantidad * (item.cantidad || 1)}</td>
            <td style="text-align: right; color: var(--accent-teal); font-weight: 900; padding: 10px; font-size: 18px; letter-spacing: 0.5px;">${v.ancho} <span style="color:#94a3b8;font-size:14px;font-weight:normal;">x</span> ${v.alto} mm</td>
          </tr>
        `;
      });

      html += `</tbody></table></div>`;
    }

    html += `</div>`; // Fin del glass-panel de este item
  });

  container.innerHTML = html;

  // Render SVG previews after DOM is updated
  if (typeof window.dibujarSVG === 'function') {
    items.forEach((item, idx) => {
      window.dibujarSVG(item.tipo, item.width, item.height, `prod-svg-${idx}`, item);
    });
  }
}

// Función para imprimir solo la orden de producción
function imprimirOrdenProduccion() {
  window.print();
}

// ================= HISTORIAL DE ÓRDENES DE PRODUCCIÓN =================

function obtenerHistorialProduccion() {
  const data = localStorage.getItem('alumital_ordenes_produccion');
  return data ? JSON.parse(data) : [];
}

function guardarOrdenProduccion() {
  const items = window.STATE.items || [];
  if (items.length === 0) {
    if (typeof showToast === 'function') showToast('No hay aberturas para guardar.', 'error');
    else alert('No hay aberturas para guardar.');
    return;
  }

  const referencia = prompt('Ingresa el nombre del cliente, proyecto o referencia para esta orden de producción:');
  if (!referencia || referencia.trim() === '') return;

  const nuevaOrden = {
    id: 'ORD-' + Date.now(),
    referencia: referencia.trim(),
    fecha: new Date().toLocaleDateString('es-CO') + ' ' + new Date().toLocaleTimeString('es-CO'),
    items: JSON.parse(JSON.stringify(items)) // Clon profunda
  };

  const historial = obtenerHistorialProduccion();
  historial.push(nuevaOrden);
  localStorage.setItem('alumital_ordenes_produccion', JSON.stringify(historial));

  if (typeof showToast === 'function') showToast('Orden de Producción guardada exitosamente.', 'success');
  
  // Limpiar la orden actual
  window.STATE.items = [];
  renderizarDespiece();
  
  // Actualizar contador en la barra lateral
  const badge = document.getElementById('items-count-badge');
  if (badge) {
    badge.textContent = '0';
    badge.style.display = 'none';
  }
  
  renderizarHistorialProduccion();
}

function renderizarHistorialProduccion() {
  const historial = obtenerHistorialProduccion();
  const section = document.getElementById('historial-produccion-section');
  const tbody = document.getElementById('historial-produccion-body');
  
  if (!section || !tbody) return;

  if (historial.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  let html = '';

  historial.slice().reverse().forEach(orden => {
    html += `
      <tr>
        <td style="font-weight: 600;">${orden.referencia}</td>
        <td>${orden.fecha}</td>
        <td style="text-align: center;">${orden.items.length}</td>
        <td>
          <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px; margin-right: 5px;" onclick="window.cargarOrdenProduccion('${orden.id}')">👁️ Ver</button>
          <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px; margin-right: 5px;" onclick="window.ocultarOrdenProduccion()">❌ Cerrar</button>
          <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px; border-color: #ef4444; color: #ef4444;" onclick="window.eliminarOrdenProduccion('${orden.id}')">🗑️ Eliminar</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function cargarOrdenProduccion(id) {
  const historial = obtenerHistorialProduccion();
  const orden = historial.find(o => o.id === id);
  if (orden) {
    // Reemplazar el estado actual con la orden guardada
    window.STATE.items = orden.items;
    
    // Actualizar UI
    if (typeof showToast === 'function') showToast(`Orden "${orden.referencia}" cargada.`, 'success');
    
    // Re-renderizar despiece
    renderizarDespiece();
    
    // También actualizar contador del presupuesto si existe
    const badge = document.getElementById('items-count-badge');
    if (badge) {
      badge.textContent = window.STATE.items.length;
      badge.style.display = window.STATE.items.length > 0 ? 'inline-block' : 'none';
    }
  }
}

function ocultarOrdenProduccion() {
  window.STATE.items = [];
  renderizarDespiece();
  
  // Actualizar contador en la barra lateral
  const badge = document.getElementById('items-count-badge');
  if (badge) {
    badge.textContent = '0';
    badge.style.display = 'none';
  }
}

function eliminarOrdenProduccion(id) {
  if (!confirm('¿Estás seguro de eliminar esta orden de producción guardada?')) return;
  
  let historial = obtenerHistorialProduccion();
  historial = historial.filter(o => o.id !== id);
  localStorage.setItem('alumital_ordenes_produccion', JSON.stringify(historial));
  
  renderizarHistorialProduccion();
  if (typeof showToast === 'function') showToast('Orden eliminada.', 'success');
}

window.renderizarDespiece = renderizarDespiece;
window.imprimirOrdenProduccion = imprimirOrdenProduccion;
window.guardarOrdenProduccion = guardarOrdenProduccion;
window.cargarOrdenProduccion = cargarOrdenProduccion;
window.eliminarOrdenProduccion = eliminarOrdenProduccion;
window.ocultarOrdenProduccion = ocultarOrdenProduccion;
