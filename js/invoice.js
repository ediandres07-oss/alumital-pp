/**
 * Alumital SAS - Módulo de Facturación y Cotizaciones Comerciales
 * Controla los datos del cliente, totales, descuentos, IVA, historial e impresión.
 */

// Inicializar el módulo de facturación
function inicializarFacturacion() {
  window.STATE = window.STATE || {};
  window.STATE.facturas = cargarHistorialFacturas();

  // Establecer fecha de hoy por defecto en el input
  const dateInput = document.getElementById('fac-fecha');
  if (dateInput) {
    const hoy = new Date();
    dateInput.value = hoy.toISOString().split('T')[0];
    document.getElementById('fac-preview-fecha-cabecera').textContent = `Fecha: ${formatearFecha(hoy.toISOString().split('T')[0])}`;
  }

  // Configurar listeners de sincronización en tiempo real
  const fields = [
    { id: 'fac-cliente-nombre', previewId: 'fac-preview-cliente-nombre', defaultVal: 'Consumidor Final', label: '' },
    { id: 'fac-cliente-nit', previewId: 'fac-preview-cliente-nit', defaultVal: 'NIT/C.C: S/N', label: 'NIT/C.C: ' },
    { id: 'fac-cliente-telefono', previewId: 'fac-preview-cliente-telefono', defaultVal: 'Teléfono: S/N', label: 'Teléfono: ' },
    { id: 'fac-observaciones', previewId: 'fac-preview-observaciones', defaultVal: 'Este documento es una cotización comercial formal. Los cortes de perfiles se inician una vez se abone el 60% de anticipo del total. Las fechas de entrega se coordinan con el instalador.', label: '' }
  ];

  fields.forEach(f => {
    const el = document.getElementById(f.id);
    if (el) {
      el.addEventListener('input', () => {
        const previewEl = document.getElementById(f.previewId);
        if (previewEl) {
          previewEl.textContent = el.value.trim() ? (f.label + el.value.trim()) : f.defaultVal;
        }
      });
    }
  });

  // Escuchar fecha
  if (dateInput) {
    dateInput.addEventListener('change', () => {
      document.getElementById('fac-preview-fecha-cabecera').textContent = `Fecha: ${formatearFecha(dateInput.value)}`;
    });
  }

  // Inputs numéricos de cálculos
  const calcInputs = ['fac-iva-porcentaje', 'fac-descuento-valor', 'fac-incluir-iva'];
  calcInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', renderizarFacturaPreview);
      el.addEventListener('change', renderizarFacturaPreview);
    }
  });

  // Botón Imprimir
  const btnPrint = document.getElementById('btn-imprimir-factura');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  // Botón Guardar
  const btnSave = document.getElementById('btn-guardar-factura');
  if (btnSave) {
    btnSave.addEventListener('click', guardarFacturaEnHistorial);
  }

  // Botón Exportar Siigo
  const btnExportSiigo = document.getElementById('btn-exportar-siigo');
  if (btnExportSiigo) {
    btnExportSiigo.addEventListener('click', mostrarModalSiigo);
  }

  // Botón Obtener Token
  const btnObtenerToken = document.getElementById('btn-obtener-token');
  if (btnObtenerToken) {
    btnObtenerToken.addEventListener('click', obtenerTokenSiigo);
  }

  // Cargar número de factura correlativo aleatorio si no existe
  const facNumeroEl = document.getElementById('fac-preview-numero');
  if (facNumeroEl) {
    facNumeroEl.textContent = `N° FACT-${obtenerSiguienteNumeroFactura()}`;
  }

  renderizarFacturaPreview();
  renderizarHistorialFacturas();
}

// Obtener el Access Token de Siigo automáticamente usando las credenciales del formulario
async function obtenerTokenSiigo() {
  const btnObtener = document.getElementById('btn-obtener-token');
  const statusEl = document.getElementById('siigo-token-status');
  const tokenField = document.getElementById('siigo-access-token');

  const username = (document.getElementById('siigo-username') || {}).value || '';
  const accessKey = (document.getElementById('siigo-access-key-input') || {}).value || '';

  if (!username || !accessKey) {
    statusEl.style.display = 'block';
    statusEl.style.background = 'rgba(239,68,68,0.1)';
    statusEl.style.color = '#dc2626';
    statusEl.textContent = '❌ Completa el usuario y la Access Key primero.';
    return;
  }

  if (btnObtener) { btnObtener.disabled = true; btnObtener.textContent = '⏳ Conectando con Siigo...'; }
  if (statusEl) statusEl.style.display = 'none';

  try {
    const res = await fetch('/proxy/siigo/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), access_key: accessKey.trim() })
    });
    const data = await res.json();

    if (res.ok && data.access_token) {
      // Guardar token y credenciales en localStorage
      const expiry = Date.now() + (data.expires_in * 1000) - 300000; // 5 min de margen
      localStorage.setItem('siigo_access_token', data.access_token);
      localStorage.setItem('siigo_token_expiry', expiry);
      localStorage.setItem('siigo_username', username);
      localStorage.setItem('siigo_access_key', accessKey);

      // Éxito: llenar el campo del token automáticamente
      if (tokenField) tokenField.value = data.access_token;
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(22,163,74,0.1)';
      statusEl.style.color = '#15803d';
      const mins = Math.round(data.expires_in / 60);
      statusEl.textContent = `✅ Token obtenido y guardado. Válido por ${mins} minutos.`;
      if (typeof showToast === 'function') showToast('Token de Siigo obtenido exitosamente', 'success');
    } else {
      const errMsg = (data.errors || data.Errors || []).map(e => e.message || e.Message).join(', ') || JSON.stringify(data);
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(239,68,68,0.1)';
      statusEl.style.color = '#dc2626';
      statusEl.textContent = `❌ Error (${res.status}): ${errMsg}`;
    }
  } catch (err) {
    statusEl.style.display = 'block';
    statusEl.style.background = 'rgba(239,68,68,0.1)';
    statusEl.style.color = '#dc2626';
    statusEl.textContent = `❌ Error de red: ${err.message}`;
  } finally {
    if (btnObtener) { btnObtener.disabled = false; btnObtener.textContent = '⚡ Obtener Token Automáticamente'; }
  }
}

// Formatear fecha de AAAA-MM-DD a DD/MM/AAAA
function formatearFecha(fechaStr) {
  if (!fechaStr) return '';
  const partes = fechaStr.split('-');
  if (partes.length !== 3) return fechaStr;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// Obtener un número secuencial simple de factura
function obtenerSiguienteNumeroFactura() {
  const facturas = window.STATE.facturas || [];
  const num = facturas.length + 1014;
  return num.toString().padStart(6, '0');
}

// Cargar facturas de LocalStorage
function cargarHistorialFacturas() {
  const facs = localStorage.getItem('alumital_facturas');
  if (facs) {
    try {
      return JSON.parse(facs);
    } catch (e) {
      console.error(e);
    }
  }
  return [];
}

// Renderizar la previsualización de cobro y aberturas
function renderizarFacturaPreview() {
  const tbody = document.getElementById('fac-preview-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!window.STATE.items || window.STATE.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">
      No hay aberturas en el proyecto. Agrega aberturas en el Configurador para generar la factura.
    </td></tr>`;
    actualizarTotalesFactura(0, 0, 0, 0);
    return;
  }

  // Calcular usando budget.js
  const pres = calcularPresupuesto(window.STATE.items, window.STATE.precios);
  
  // Agregar filas
  pres.detalles.forEach(d => {
    let catLabel = 'Ventana';
    if (d.categoria === 'puerta') {
      catLabel = 'Puerta';
    } else if (d.categoria === 'cabina_baño') {
      catLabel = d.estiloCabina === 'solo_vidrio' ? 'Cabina Templada' : 'Cabina con Perfil';
    }

    // El precio de venta al cliente de esta abertura individual se obtiene aplicando la mano de obra e indirectos
    const costoMaterial = d.costoMateriales;
    const manoObra = costoMaterial * (window.STATE.precios.manoObraPorcentaje / 100);
    const prod = costoMaterial + manoObra;
    const ganancia = prod * (window.STATE.precios.margenGanancia / 100);
    const precioVentaUnitario = Math.round(prod + ganancia);
    const precioVentaTotal = precioVentaUnitario * d.cantidad;

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #f1f5f9';
    tr.innerHTML = `
      <td style="padding: 12px 5px;">
        <strong>${catLabel} (${d.tipo.toUpperCase()})</strong><br>
        <span style="font-size: 11px; color: #64748b;">Medida: ${d.ancho}x${d.alto} mm | Vidrio: ${d.tipoVidrio.toUpperCase()} ${d.espesorVidrio}mm (${d.colorVidrio.toUpperCase()}) | Peso: ${d.pesoVidrioKg} kg</span>
      </td>
      <td style="padding: 12px 5px; text-align: center;">${d.cantidad}</td>
      <td style="padding: 12px 5px; text-align: right;">$${precioVentaUnitario.toLocaleString('es-CO')}</td>
      <td style="padding: 12px 5px; text-align: right; font-weight: 600;">$${precioVentaTotal.toLocaleString('es-CO')}</td>
    `;
    tbody.appendChild(tr);
  });

  // Calcular totales comerciales — pres devuelve .precioVentaFinal directamente
  const subtotal = Math.round(pres.precioVentaFinal);
  const descValor = parseFloat(document.getElementById('fac-descuento-valor').value) || 0;
  
  const subtotalConDescuento = Math.max(0, subtotal - descValor);
  
  const cobrarIva = document.getElementById('fac-incluir-iva').checked;
  const ivaPorc = parseFloat(document.getElementById('fac-iva-porcentaje').value) || 19;
  
  const iva = cobrarIva ? Math.round(subtotalConDescuento * (ivaPorc / 100)) : 0;
  const total = subtotalConDescuento + iva;

  actualizarTotalesFactura(subtotal, descValor, iva, total, ivaPorc, cobrarIva);
  
  // Guardar totales en STATE para que Siigo los tome siempre actualizados
  window.STATE._facturaActual = { subtotal, descValor, iva, total, cobrarIva, ivaPorc };
}

// Escribir los totales en las etiquetas de la factura
function actualizarTotalesFactura(subtotal, descuento, iva, total, ivaPorc = 19, cobrarIva = true) {
  document.getElementById('fac-preview-subtotal').textContent = `$${subtotal.toLocaleString('es-CO')} COP`;
  
  const descRow = document.getElementById('fac-preview-descuento-row');
  if (descRow) {
    if (descuento > 0) {
      descRow.style.display = 'flex';
      document.getElementById('fac-preview-descuento').textContent = `-$${descuento.toLocaleString('es-CO')} COP`;
    } else {
      descRow.style.display = 'none';
    }
  }

  document.getElementById('fac-preview-label-iva').textContent = `IVA (${ivaPorc}%):`;
  document.getElementById('fac-preview-iva').textContent = `$${iva.toLocaleString('es-CO')} COP`;
  document.getElementById('fac-preview-total').textContent = `$${total.toLocaleString('es-CO')} COP`;
}

// Guardar factura en LocalStorage e Historial
function guardarFacturaEnHistorial() {
  if (!window.STATE.items || window.STATE.items.length === 0) {
    if (typeof showToast === 'function') showToast('No hay items en el proyecto para facturar', 'error');
    return;
  }

  const facNumeroEl = document.getElementById('fac-preview-numero');
  const numFact = facNumeroEl ? facNumeroEl.textContent.replace('N° ', '') : 'FACT-000000';
  const cliente = document.getElementById('fac-cliente-nombre').value.trim() || 'Consumidor Final';
  const fecha = document.getElementById('fac-fecha').value || new Date().toISOString().split('T')[0];
  
  // Total a pagar
  const totalText = document.getElementById('fac-preview-total').textContent;
  const totalVal = totalText;

  const fact = {
    id: numFact,
    cliente,
    fecha: formatearFecha(fecha),
    itemsCount: window.STATE.items.reduce((acc, item) => acc + (item.cantidad || 1), 0),
    total: totalVal
  };

  const historial = window.STATE.facturas || [];
  // Evitar duplicados
  if (historial.some(f => f.id === numFact)) {
    if (typeof showToast === 'function') showToast('Esta factura ya fue guardada previamente', 'warning');
    return;
  }

  historial.unshift(fact); // Agregar al principio
  window.STATE.facturas = historial;
  localStorage.setItem('alumital_facturas', JSON.stringify(historial));

  renderizarHistorialFacturas();
  if (typeof showToast === 'function') showToast('Factura guardada en el historial', 'success');

  // Generar siguiente número para evitar colisiones en la próxima
  if (facNumeroEl) {
    facNumeroEl.textContent = `N° FACT-${obtenerSiguienteNumeroFactura()}`;
  }
}

// Renderizar la tabla de facturas guardadas en la base
function renderizarHistorialFacturas() {
  const tbody = document.getElementById('fac-historial-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  const historial = window.STATE.facturas || [];

  if (historial.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 16px;">
      No hay facturas archivadas en el historial local.
    </td></tr>`;
    return;
  }

  historial.forEach((f, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${f.id}</strong></td>
      <td>${f.cliente}</td>
      <td>${f.fecha}</td>
      <td>${f.itemsCount} aberturas</td>
      <td><strong style="color: var(--accent-orange);">${f.total}</strong></td>
      <td>
        <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px; color: var(--danger); border-color: rgba(220, 38, 38, 0.2);" onclick="eliminarFacturaHistorial(${idx})">
          🗑️ Eliminar
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Eliminar factura del historial local
function eliminarFacturaHistorial(index) {
  if (confirm('¿Estás seguro de eliminar esta factura del historial permanente?')) {
    const historial = window.STATE.facturas || [];
    historial.splice(index, 1);
    window.STATE.facturas = historial;
    localStorage.setItem('alumital_facturas', JSON.stringify(historial));
    renderizarHistorialFacturas();
    if (typeof showToast === 'function') showToast('Factura eliminada del historial', 'success');
  }
}
window.eliminarFacturaHistorial = eliminarFacturaHistorial;

// Genera el payload JSON compatible con la API de Siigo Nube (POST /v1/invoices)
function generarSiigoJSON() {
  const clienteNombre = document.getElementById('fac-cliente-nombre').value.trim() || 'Consumidor Final';
  const clienteNit = document.getElementById('fac-cliente-nit').value.trim() || '222222222';
  const dateVal = document.getElementById('fac-fecha').value || new Date().toISOString().split('T')[0];
  const cobrarIva = document.getElementById('fac-incluir-iva').checked;

  const pres = calcularPresupuesto(window.STATE.items, window.STATE.precios);
  
  // Mapear items del presupuesto para el formato de API de Siigo
  const itemsMapeados = pres.detalles.map((d, idx) => {
    let catLabel = 'Ventana';
    if (d.categoria === 'puerta') {
      catLabel = 'Puerta';
    } else if (d.categoria === 'cabina_baño') {
      catLabel = d.estiloCabina === 'solo_vidrio' ? 'Cabina Templada' : 'Cabina con Perfil';
    }

    const costoMaterial = d.costoMateriales;
    const manoObra = costoMaterial * (window.STATE.precios.manoObraPorcentaje / 100);
    const prod = costoMaterial + manoObra;
    const ganancia = prod * (window.STATE.precios.margenGanancia / 100);
    const precioVentaUnitario = Math.round(prod + ganancia);

    const itemPayload = {
      code: 'VSTMDD', // Código de servicio genérico en catálogo Alumital (Visita/Servicio)
      description: `${catLabel} ${d.tipo.toUpperCase()} ${d.ancho}x${d.alto} mm (Vidrio: ${d.tipoVidrio.toUpperCase()} ${d.espesorVidrio}mm ${d.colorVidrio.toUpperCase()})`,
      quantity: d.cantidad,
      price: precioVentaUnitario,
      discount: 0,
      taxes: []
    };

    if (cobrarIva) {
      itemPayload.taxes.push({
        id: 33902, // "IVA 19%" real de Alumital SAS en Siigo Nube
        value: 19
      });
    }

    return itemPayload;
  });

  // Distribuir el descuento global (si hay) proporcionalmente en los items
  const descValor = parseFloat(document.getElementById('fac-descuento-valor').value) || 0;
  if (descValor > 0 && itemsMapeados.length > 0) {
    const totalSub = itemsMapeados.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    let descAcumulado = 0;
    itemsMapeados.forEach((item, idx) => {
      if (idx === itemsMapeados.length - 1) {
        item.discount = Math.max(0, Math.round((descValor - descAcumulado) * 100) / 100);
      } else {
        const prop = (item.price * item.quantity) / totalSub;
        const d = Math.round((descValor * prop) * 100) / 100;
        item.discount = d;
        descAcumulado += d;
      }
    });
  }

  // Calcular el total EXACTO que Siigo espera (suma de items + impuestos - descuentos)
  let calculatedTotal = 0;
  itemsMapeados.forEach(item => {
    const base = (item.price * item.quantity) - (item.discount || 0);
    let taxesVal = 0;
    if (item.taxes) {
      item.taxes.forEach(t => {
        taxesVal += base * (t.value / 100);
      });
    }
    calculatedTotal += (base + taxesVal);
  });
  // Siigo usa hasta 2 decimales
  calculatedTotal = Math.round(calculatedTotal * 100) / 100;

  // Armar el payload completo — IDs reales de Alumital SAS (Siigo Nube)
  const siigoPayload = {
    document: {
      id: 61984   // "FE" Factura Electrónica Bello (activa)
    },
    date: dateVal, // Formato ISO AAAA-MM-DD — Siigo v1 acepta este formato
    customer: {
      identification: clienteNit.replace(/[^\d]/g, '') || '222222222',
      branch_office: 0
    },
    seller: 22189, // Angela Maria Giraldo Garcia (usuario API)
    items: itemsMapeados,
    payments: [
      {
        id: 16679, // "Cuenta Corriente" (contado, sin vencimiento)
        value: calculatedTotal,
        due_date: dateVal
      }
    ]
  };

  // Agregar Centro de Costos si se ingresó uno (Siigo v1 a nivel de documento)
  const costCenterVal = document.getElementById('fac-cost-center')?.value;
  if (costCenterVal) {
    siigoPayload.cost_center = parseInt(costCenterVal, 10);
  }

  return siigoPayload;
}

// Mostrar modal e inyectar JSON de Siigo
function mostrarModalSiigo() {
  if (!window.STATE.items || window.STATE.items.length === 0) {
    if (typeof showToast === 'function') showToast('No hay items en el proyecto para exportar', 'error');
    return;
  }

  const modal = document.getElementById('modal-siigo');
  const preview = document.getElementById('siigo-json-preview');

  if (modal && preview) {
    const payload = generarSiigoJSON();
    preview.textContent = JSON.stringify(payload, null, 2);
    modal.style.display = 'flex';

    // Cargar credenciales y token guardado
    const savedUsername = localStorage.getItem('siigo_username');
    const savedAccessKey = localStorage.getItem('siigo_access_key');
    if (savedUsername) document.getElementById('siigo-username').value = savedUsername;
    if (savedAccessKey) document.getElementById('siigo-access-key-input').value = savedAccessKey;

    const savedToken = localStorage.getItem('siigo_access_token');
    const tokenExpiry = localStorage.getItem('siigo_token_expiry');
    const tokenField = document.getElementById('siigo-access-token');
    const statusEl = document.getElementById('siigo-token-status');

    // Limpiar status previo de envío
    const envioStatusEl = document.getElementById('siigo-envio-status');
    if (envioStatusEl) envioStatusEl.style.display = 'none';

    if (savedToken && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
      if (tokenField) tokenField.value = savedToken;
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.background = 'rgba(22,163,74,0.1)';
        statusEl.style.color = '#15803d';
        const minsLeft = Math.round((parseInt(tokenExpiry) - Date.now()) / 60000);
        statusEl.textContent = `✅ Token activo cargado automáticamente. Expira en ${minsLeft} minutos.`;
      }
    } else {
      if (tokenField) tokenField.value = '';
      if (savedAccessKey) {
        // Si hay una key guardada pero el token expiró, obtener uno nuevo automáticamente
        obtenerTokenSiigo();
      } else {
        if (statusEl) statusEl.style.display = 'none';
      }
    }

    // Bindeo de cierre
    const btnClose = document.getElementById('btn-close-siigo-modal');
    if (btnClose) {
      btnClose.onclick = () => { modal.style.display = 'none'; };
    }

    // Copiar JSON
    const btnCopyJson = document.getElementById('btn-copy-siigo-json');
    if (btnCopyJson) {
      btnCopyJson.onclick = () => {
        navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
          .then(() => { if (typeof showToast === 'function') showToast('JSON copiado al portapapeles', 'success'); })
          .catch(() => { if (typeof showToast === 'function') showToast('Error al copiar JSON', 'error'); });
      };
    }

    // Copiar cURL
    const btnCopyCurl = document.getElementById('btn-copy-siigo-curl');
    if (btnCopyCurl) {
      btnCopyCurl.onclick = () => {
        const curlCmd = `curl --location 'https://api.siigo.com/v1/invoices' \\\n--header 'Content-Type: application/json' \\\n--header 'Authorization: Bearer TU_ACCESS_TOKEN' \\\n--data-raw '${JSON.stringify(payload)}'`;
        navigator.clipboard.writeText(curlCmd)
          .then(() => { if (typeof showToast === 'function') showToast('Comando cURL copiado al portapapeles', 'success'); })
          .catch(() => { if (typeof showToast === 'function') showToast('Error al copiar comando', 'error'); });
      };
    }

    // Envío automático a Siigo
    const btnEnviar = document.getElementById('btn-enviar-siigo');
    if (btnEnviar) {
      btnEnviar.onclick = () => enviarASiigo(payload);
    }
  }
}

// Enviar la factura directamente a la API de Siigo Nube
async function enviarASiigo(payload) {
  const btnEnviar = document.getElementById('btn-enviar-siigo');
  const statusEl = document.getElementById('siigo-envio-status');

  // Leer credenciales del formulario de configuración
  const token = (document.getElementById('siigo-access-token') || {}).value || '';
  if (!token) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
      statusEl.style.borderColor = '#ef4444';
      statusEl.style.color = '#dc2626';
      statusEl.innerHTML = '❌ <strong>Falta el Access Token.</strong> Completa el campo "Token de Siigo" antes de enviar.';
    }
    return;
  }

  // UI: Loading
  if (btnEnviar) { btnEnviar.disabled = true; btnEnviar.textContent = '⏳ Enviando...'; }
  if (statusEl) { statusEl.style.display = 'none'; }

  try {
    const response = await fetch('/proxy/siigo/v1/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.trim()}`,
        'Partner-Id': 'AlumitalSAS'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (statusEl) {
      statusEl.style.display = 'block';
      if (response.ok) {
        statusEl.style.background = 'rgba(22, 163, 74, 0.1)';
        statusEl.style.borderColor = '#16a34a';
        statusEl.style.color = '#15803d';
        statusEl.innerHTML = `✅ <strong>Factura enviada a Siigo con éxito.</strong><br>
          Número: <code>${data.id || data.name || '—'}</code> &nbsp;|
          Estado: <code>${data.stamp?.status || response.status}</code>`;
        // Guardar en historial también
        guardarFacturaEnHistorial();
        if (typeof showToast === 'function') showToast('¡Factura sincronizada con Siigo Nube!', 'success');
      } else {
        const errMsg = data.Errors ? data.Errors.map(e => e.Message).join(', ') : JSON.stringify(data);
        statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
        statusEl.style.borderColor = '#ef4444';
        statusEl.style.color = '#dc2626';
        statusEl.innerHTML = `❌ <strong>Error Siigo (${response.status}):</strong> ${errMsg}`;
        if (typeof showToast === 'function') showToast('Error al enviar a Siigo: ' + response.status, 'error');
      }
    }
  } catch (err) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
      statusEl.style.borderColor = '#ef4444';
      statusEl.style.color = '#dc2626';
      statusEl.innerHTML = `❌ <strong>Error de red:</strong> ${err.message}. Verifica tu conexión o el token.`;
    }
    if (typeof showToast === 'function') showToast('Error de red al conectar con Siigo', 'error');
  } finally {
    if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.textContent = '🚀 Enviar a Siigo Nube'; }
  }
}
