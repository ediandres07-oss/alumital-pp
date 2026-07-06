/**
 * clientes.js — Alumital SAS Client Management Module
 * CRUD operations for clients
 * Version 3.0.0
 */

(function () {
  'use strict';

  // Track editing state
  window._editandoClienteId = null;

  /**
   * Loads clients from the API and renders them into the table.
   * @param {string} query - Optional search query
   */
  async function cargarClientes(query) {
    query = query || '';
    const tbody = document.getElementById('clientes-tabla-body');
    if (!tbody) return;

    try {
      const params = query ? '?q=' + encodeURIComponent(query) : '';
      const res = await fetch('/api/clientes' + params, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...window.getAuthHeader()
        }
      });

      if (!res.ok) {
        throw new Error('Error al cargar clientes: ' + res.status);
      }

      const clientes = await res.json();

      if (!clientes || clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px;">No hay clientes registrados.</td></tr>';
        return;
      }

      tbody.innerHTML = clientes.map(function (c) {
        return '<tr>' +
          '<td style="font-weight:600;">' + _escapeHtml(c.nombre || '') + '</td>' +
          '<td>' + _escapeHtml(c.nit || '—') + '</td>' +
          '<td>' + _escapeHtml(c.telefono || '—') + '</td>' +
          '<td>' + _escapeHtml(c.email || '—') + '</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn-secondary" onclick="editarCliente(' + c.id + ')" style="padding:6px 10px;font-size:12px;margin-right:4px;">✏️ Editar</button>' +
            '<button class="btn btn-danger" onclick="eliminarCliente(' + c.id + ')" style="padding:6px 10px;font-size:12px;">🗑️ Eliminar</button>' +
          '</td>' +
        '</tr>';
      }).join('');

    } catch (err) {
      console.error('[Clientes] Error:', err);
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:40px;">Error al cargar clientes. Verifica la conexión.</td></tr>';
    }
  }

  /**
   * Saves a new client or updates an existing one.
   */
  async function guardarCliente() {
    const nombre = document.getElementById('cli-nombre');
    const nit = document.getElementById('cli-nit');
    const telefono = document.getElementById('cli-telefono');
    const email = document.getElementById('cli-email');
    const direccion = document.getElementById('cli-direccion');

    // Validate required field
    if (!nombre || !nombre.value.trim()) {
      alert('El nombre del cliente es obligatorio.');
      return;
    }

    const datos = {
      nombre: nombre.value.trim(),
      nit: nit ? nit.value.trim() : '',
      telefono: telefono ? telefono.value.trim() : '',
      email: email ? email.value.trim() : '',
      direccion: direccion ? direccion.value.trim() : ''
    };

    try {
      var url, method;

      if (window._editandoClienteId) {
        // Update existing
        url = '/api/clientes/' + window._editandoClienteId;
        method = 'PUT';
      } else {
        // Create new
        url = '/api/clientes';
        method = 'POST';
      }

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...window.getAuthHeader()
        },
        body: JSON.stringify(datos)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(function () { return {}; });
        throw new Error(errorData.error || 'Error al guardar el cliente');
      }

      // Success - reload table and clear form
      limpiarFormCliente();
      await cargarClientes();

      // Show success toast if the app has a toast function
      if (typeof window.showToast === 'function') {
        window.showToast(window._editandoClienteId ? 'Cliente actualizado ✓' : 'Cliente creado ✓', 'success');
      }

    } catch (err) {
      console.error('[Clientes] Error al guardar:', err);
      alert('Error al guardar el cliente: ' + err.message);
    }
  }

  /**
   * Loads a client's data into the form for editing.
   * @param {number} id - Client ID
   */
  async function editarCliente(id) {
    try {
      const res = await fetch('/api/clientes/' + id, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...window.getAuthHeader()
        }
      });

      if (!res.ok) throw new Error('Error al cargar cliente');

      const c = await res.json();

      // Populate form fields
      var el;
      el = document.getElementById('cli-nombre');
      if (el) el.value = c.nombre || '';
      el = document.getElementById('cli-nit');
      if (el) el.value = c.nit || '';
      el = document.getElementById('cli-telefono');
      if (el) el.value = c.telefono || '';
      el = document.getElementById('cli-email');
      if (el) el.value = c.email || '';
      el = document.getElementById('cli-direccion');
      if (el) el.value = c.direccion || '';

      // Set editing state
      window._editandoClienteId = id;

      // Update form title
      var titleEl = document.getElementById('cli-form-title');
      if (titleEl) titleEl.textContent = 'Editando Cliente #' + id;

      // Scroll form into view on mobile
      var formPanel = document.getElementById('cli-nombre');
      if (formPanel) formPanel.focus();

    } catch (err) {
      console.error('[Clientes] Error al editar:', err);
      alert('Error al cargar los datos del cliente.');
    }
  }

  /**
   * Deletes a client after user confirmation.
   * @param {number} id - Client ID
   */
  async function eliminarCliente(id) {
    if (!confirm('¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const res = await fetch('/api/clientes/' + id, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...window.getAuthHeader()
        }
      });

      if (!res.ok) throw new Error('Error al eliminar');

      await cargarClientes();

      if (typeof window.showToast === 'function') {
        window.showToast('Cliente eliminado', 'success');
      }

    } catch (err) {
      console.error('[Clientes] Error al eliminar:', err);
      alert('Error al eliminar el cliente.');
    }
  }

  /**
   * Clears the client form and resets editing state.
   */
  function limpiarFormCliente() {
    var fields = ['cli-nombre', 'cli-nit', 'cli-telefono', 'cli-email', 'cli-direccion'];
    fields.forEach(function (fieldId) {
      var el = document.getElementById(fieldId);
      if (el) el.value = '';
    });

    window._editandoClienteId = null;

    var titleEl = document.getElementById('cli-form-title');
    if (titleEl) titleEl.textContent = 'Nuevo Cliente';
  }

  /**
   * Escapes HTML to prevent XSS in table rendering.
   * @param {string} str - String to escape
   * @returns {string} Escaped HTML string
   */
  function _escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ========================
  // Export to window
  // ========================
  window.cargarClientes = cargarClientes;
  window.guardarCliente = guardarCliente;
  window.editarCliente = editarCliente;
  window.eliminarCliente = eliminarCliente;
  window.limpiarFormCliente = limpiarFormCliente;

})();
