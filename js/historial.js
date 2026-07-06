/**
 * historial.js — Alumital SAS Quotation History Module
 * Manages cotizaciones: save, load, view, duplicate, delete
 * Version 3.0.0
 */

(function () {
  'use strict';

  /**
   * Loads cotizaciones from the API with optional filters.
   * @param {Object} filtros - Optional filters: {cliente_id, estado}
   */
  async function cargarHistorial(filtros) {
    filtros = filtros || {};
    const tbody = document.getElementById('historial-tabla-body');
    if (!tbody) return;

    try {
      // Build query params
      var params = [];
      if (filtros.cliente_id) params.push('cliente_id=' + encodeURIComponent(filtros.cliente_id));
      if (filtros.estado) params.push('estado=' + encodeURIComponent(filtros.estado));
      var queryString = params.length > 0 ? '?' + params.join('&') : '';

      const res = await fetch('/api/cotizaciones' + queryString, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...window.getAuthHeader()
        }
      });

      if (!res.ok) throw new Error('Error al cargar historial: ' + res.status);

      const cotizaciones = await res.json();

      if (!cotizaciones || cotizaciones.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px;">No hay cotizaciones guardadas.</td></tr>';
        return;
      }

      tbody.innerHTML = cotizaciones.map(function (cot, index) {
        var fecha = _formatearFecha(cot.fecha || cot.created_at);
        var total = _formatearMoneda(cot.total || 0);
        var estadoBadge = _crearBadgeEstado(cot.estado || 'borrador');
        var clienteNombre = cot.cliente_nombre || cot.cliente || '—';

        return '<tr>' +
          '<td style="font-weight:700;color:var(--accent-blue);">' + (cot.id || (index + 1)) + '</td>' +
          '<td>' + _escapeHtml(fecha) + '</td>' +
          '<td style="font-weight:600;">' + _escapeHtml(clienteNombre) + '</td>' +
          '<td style="font-weight:700;">' + total + '</td>' +
          '<td>' + estadoBadge + '</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn-secondary" onclick="verCotizacion(' + cot.id + ')" style="padding:5px 8px;font-size:11px;margin-right:3px;" title="Ver / Cargar">👁️</button>' +
            '<button class="btn btn-secondary" onclick="duplicarCotizacion(' + cot.id + ')" style="padding:5px 8px;font-size:11px;margin-right:3px;" title="Duplicar">📋</button>' +
            '<select onchange="if(this.value){cambiarEstadoCotizacion(' + cot.id + ',this.value);this.value=\'\'}" style="padding:4px 6px;font-size:11px;border-radius:4px;border:1px solid var(--border-color);background:var(--bg-panel);cursor:pointer;margin-right:3px;">' +
              '<option value="">Estado...</option>' +
              '<option value="borrador">Borrador</option>' +
              '<option value="enviada">Enviada</option>' +
              '<option value="aprobada">Aprobada</option>' +
              '<option value="rechazada">Rechazada</option>' +
            '</select>' +
            '<button class="btn btn-danger" onclick="eliminarCotizacion(' + cot.id + ')" style="padding:5px 8px;font-size:11px;" title="Eliminar">🗑️</button>' +
          '</td>' +
        '</tr>';
      }).join('');

    } catch (err) {
      console.error('[Historial] Error:', err);
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--danger);padding:40px;">Error al cargar el historial.</td></tr>';
    }
  }

  /**
   * Saves the current configurator state as a new cotización.
   */
  async function guardarCotizacionActual() {
    // Get selected client
    var clienteSelect = document.getElementById('cot-cliente-select');
    var clienteId = clienteSelect ? clienteSelect.value : '';

    // Get current STATE from the app (STATE is the global app state object)
    var items = (typeof STATE !== 'undefined' && STATE.items) ? STATE.items : [];
    var precios = (typeof STATE !== 'undefined' && STATE.precios) ? STATE.precios : {};

    if (items.length === 0) {
      alert('No hay ventanas/aberturas configuradas para guardar. Agrega al menos una en el Configurador.');
      return;
    }

    // Calculate total from budget if available
    var totalEl = document.getElementById('tot-venta-final');
    var totalText = totalEl ? totalEl.textContent : '$0';
    var total = parseFloat(totalText.replace(/[^0-9.-]/g, '')) || 0;

    var cotizacion = {
      cliente_id: clienteId || null,
      items_json: JSON.stringify(items),
      precios_json: JSON.stringify(precios),
      total: total,
      estado: 'borrador',
      fecha: new Date().toISOString()
    };

    try {
      const res = await fetch('/api/cotizaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...window.getAuthHeader()
        },
        body: JSON.stringify(cotizacion)
      });

      if (!res.ok) {
        var errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.error || 'Error al guardar cotización');
      }

      if (typeof window.showToast === 'function') {
        window.showToast('Cotización guardada correctamente ✓', 'success');
      } else {
        alert('Cotización guardada correctamente.');
      }

      // Reload historial table
      await cargarHistorial();

    } catch (err) {
      console.error('[Historial] Error al guardar:', err);
      alert('Error al guardar la cotización: ' + err.message);
    }
  }

  /**
   * Loads a cotización into the configurator for viewing/editing.
   * @param {number} id - Cotización ID
   */
  async function verCotizacion(id) {
    try {
      const res = await fetch('/api/cotizaciones/' + id, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...window.getAuthHeader()
        }
      });

      if (!res.ok) throw new Error('Error al cargar cotización');

      const cot = await res.json();

      // Load items and precios into STATE
      if (typeof STATE !== 'undefined') {
        if (cot.items_json) {
          STATE.items = typeof cot.items_json === 'string' ? JSON.parse(cot.items_json) : cot.items_json;
        }
        if (cot.precios_json) {
          STATE.precios = typeof cot.precios_json === 'string' ? JSON.parse(cot.precios_json) : cot.precios_json;
        }
      }

      // Switch to Configurador tab
      var menuItem = document.getElementById('menu-configurador');
      if (menuItem) menuItem.click();

      // Recalculate if the function exists
      if (typeof window.recalcularTodo === 'function') {
        window.recalcularTodo();
      } else if (typeof window.renderizarItems === 'function') {
        window.renderizarItems();
      }

      if (typeof window.showToast === 'function') {
        window.showToast('Cotización #' + id + ' cargada en el Configurador', 'success');
      }

    } catch (err) {
      console.error('[Historial] Error al ver:', err);
      alert('Error al cargar la cotización.');
    }
  }

  /**
   * Duplicates an existing cotización.
   * @param {number} id - Cotización ID to duplicate
   */
  async function duplicarCotizacion(id) {
    try {
      // Load original
      const res = await fetch('/api/cotizaciones/' + id, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...window.getAuthHeader()
        }
      });

      if (!res.ok) throw new Error('Error al cargar cotización');

      const original = await res.json();

      // Create copy with new date
      var copia = {
        cliente_id: original.cliente_id || null,
        items_json: original.items_json,
        precios_json: original.precios_json,
        total: original.total,
        estado: 'borrador',
        fecha: new Date().toISOString()
      };

      const resPost = await fetch('/api/cotizaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...window.getAuthHeader()
        },
        body: JSON.stringify(copia)
      });

      if (!resPost.ok) throw new Error('Error al duplicar');

      await cargarHistorial();

      if (typeof window.showToast === 'function') {
        window.showToast('Cotización duplicada ✓', 'success');
      }

    } catch (err) {
      console.error('[Historial] Error al duplicar:', err);
      alert('Error al duplicar la cotización.');
    }
  }

  /**
   * Deletes a cotización after user confirmation.
   * @param {number} id - Cotización ID
   */
  async function eliminarCotizacion(id) {
    if (!confirm('¿Estás seguro de eliminar esta cotización? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const res = await fetch('/api/cotizaciones/' + id, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...window.getAuthHeader()
        }
      });

      if (!res.ok) throw new Error('Error al eliminar');

      await cargarHistorial();

      if (typeof window.showToast === 'function') {
        window.showToast('Cotización eliminada', 'success');
      }

    } catch (err) {
      console.error('[Historial] Error al eliminar:', err);
      alert('Error al eliminar la cotización.');
    }
  }

  /**
   * Changes the status of a cotización.
   * @param {number} id - Cotización ID
   * @param {string} nuevoEstado - New status value
   */
  async function cambiarEstadoCotizacion(id, nuevoEstado) {
    try {
      const res = await fetch('/api/cotizaciones/' + id, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...window.getAuthHeader()
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });

      if (!res.ok) throw new Error('Error al cambiar estado');

      await cargarHistorial();

      if (typeof window.showToast === 'function') {
        window.showToast('Estado actualizado a "' + nuevoEstado + '" ✓', 'success');
      }

    } catch (err) {
      console.error('[Historial] Error al cambiar estado:', err);
      alert('Error al cambiar el estado de la cotización.');
    }
  }

  /**
   * Loads client list for dropdown selects in the historial panel.
   */
  async function cargarClientesDropdown() {
    try {
      const res = await fetch('/api/clientes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...window.getAuthHeader()
        }
      });

      if (!res.ok) return;

      const clientes = await res.json();

      // Populate both dropdowns
      var selects = ['cot-cliente-select', 'filtro-cliente'];
      selects.forEach(function (selectId) {
        var sel = document.getElementById(selectId);
        if (!sel) return;

        // Keep the first "— Todos —" option
        var firstOption = sel.querySelector('option');
        sel.innerHTML = '';
        if (firstOption) sel.appendChild(firstOption);

        // Add client options
        (clientes || []).forEach(function (c) {
          var opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.nombre + (c.nit ? ' (' + c.nit + ')' : '');
          sel.appendChild(opt);
        });
      });

    } catch (err) {
      console.warn('[Historial] Error al cargar clientes para dropdown:', err);
    }
  }

  // ========================
  // Helpers
  // ========================

  /**
   * Formats a date string into a readable Spanish format.
   * @param {string} dateStr - ISO date string
   * @returns {string} Formatted date
   */
  function _formatearFecha(dateStr) {
    if (!dateStr) return '—';
    try {
      var d = new Date(dateStr);
      return d.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  }

  /**
   * Formats a number as COP currency.
   * @param {number} valor - Amount
   * @returns {string} Formatted currency string
   */
  function _formatearMoneda(valor) {
    if (typeof valor !== 'number') valor = parseFloat(valor) || 0;
    return '$' + valor.toLocaleString('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) + ' COP';
  }

  /**
   * Creates an HTML badge for the cotización estado.
   * @param {string} estado - borrador, enviada, aprobada, rechazada
   * @returns {string} HTML badge string
   */
  function _crearBadgeEstado(estado) {
    var colores = {
      borrador: 'background:rgba(100,116,139,0.15);color:#64748b;border:1px solid rgba(100,116,139,0.3)',
      enviada: 'background:rgba(0,34,204,0.1);color:#0022cc;border:1px solid rgba(0,34,204,0.3)',
      aprobada: 'background:rgba(22,163,74,0.12);color:#16a34a;border:1px solid rgba(22,163,74,0.3)',
      rechazada: 'background:rgba(220,38,38,0.1);color:#dc2626;border:1px solid rgba(220,38,38,0.3)'
    };

    var estilo = colores[estado] || colores.borrador;
    return '<span class="badge estado-badge" style="' + estilo + ';padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700;text-transform:capitalize;">' + _escapeHtml(estado) + '</span>';
  }

  /**
   * Escapes HTML to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  function _escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ========================
  // Export to window
  // ========================
  window.cargarHistorial = cargarHistorial;
  window.guardarCotizacionActual = guardarCotizacionActual;
  window.verCotizacion = verCotizacion;
  window.duplicarCotizacion = duplicarCotizacion;
  window.eliminarCotizacion = eliminarCotizacion;
  window.cambiarEstadoCotizacion = cambiarEstadoCotizacion;
  window.cargarClientesDropdown = cargarClientesDropdown;

})();
