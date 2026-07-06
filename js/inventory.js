/**
 * Alumital SAS - Control de Inventario de Materias Primas
 * Gestiona el stock disponible, ajustes manuales y consumo automático de proyectos.
 */

// Listado de claves y descripciones para materiales del inventario
const INVENTARIO_MATERIALES = {
  aluminioMetro: { nombre: 'Perfil Aluminio Ventana', unidad: 'm', inicial: 180, costo: 25000 },
  aluminioPuertaMetro: { nombre: 'Perfil Aluminio Puerta (Pesada)', unidad: 'm', inicial: 120, costo: 32000 },
  aluminioCabinaMetro: { nombre: 'Perfil Aluminio Cabina Baño', unidad: 'm', inicial: 100, costo: 22000 },
  tuboAceroCabinaMetro: { nombre: 'Tubo Soporte Acero Inoxidable', unidad: 'm', inicial: 60, costo: 45000 },
  vidrioM2: { nombre: 'Vidrio Templado (4-6mm)', unidad: 'm²', inicial: 80, costo: 80000 },
  vidrioTempladoCabinaM2: { nombre: 'Vidrio Templado Ducha (8-10mm)', unidad: 'm²', inicial: 40, costo: 120000 },
  accesoriosCorrediza: { nombre: 'Kit Accesorios Ventana Corrediza', unidad: 'Ud', inicial: 30, costo: 35000 },
  accesoriosPuertaCorrediza: { nombre: 'Kit Accesorios Puerta Corrediza', unidad: 'Ud', inicial: 15, costo: 65000 },
  accesoriosCabinaPerfil: { nombre: 'Kit Accesorios Cabina Enmarcada', unidad: 'Ud', inicial: 10, costo: 40000 },
  accesoriosCabinaTemplada: { nombre: 'Kit Accesorios Cabina Templada', unidad: 'Ud', inicial: 8, costo: 180000 },
  accesoriosAbatible: { nombre: 'Kit Accesorios Ventana Batiente', unidad: 'Ud', inicial: 20, costo: 45000 },
  accesoriosPuertaAbatible: { nombre: 'Kit Accesorios Puerta Batiente', unidad: 'Ud', inicial: 12, costo: 75000 },
  accesoriosFijo: { nombre: 'Kit Accesorios Paño Fijo', unidad: 'Ud', inicial: 40, costo: 10000 },
  selladorMetro: { nombre: 'Silicona & Sellador de Estanqueidad', unidad: 'm', inicial: 300, costo: 4000 }
};

// Cargar inventario del LocalStorage o crear por defecto
function cargarInventario() {
  let inv = localStorage.getItem('alumital_inventario');
  if (inv) {
    try {
      return JSON.parse(inv);
    } catch (e) {
      console.error('Error parseando inventario, restaurando defaults', e);
    }
  }
  
  // Crear stock inicial
  const stockInicial = {};
  for (let key in INVENTARIO_MATERIALES) {
    stockInicial[key] = INVENTARIO_MATERIALES[key].inicial;
  }
  localStorage.setItem('alumital_inventario', JSON.stringify(stockInicial));
  return stockInicial;
}

// Guardar inventario actual
function guardarInventario(stock) {
  localStorage.setItem('alumital_inventario', JSON.stringify(stock));
}

// Inicializar el módulo de Inventario
function inicializarInventario() {
  window.STATE = window.STATE || {};
  window.STATE.inventario = cargarInventario();

  // Poblar select del panel de ajuste manual
  const selectMaterial = document.getElementById('inv-select-material');
  if (selectMaterial) {
    selectMaterial.innerHTML = '';
    for (let key in INVENTARIO_MATERIALES) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = INVENTARIO_MATERIALES[key].nombre;
      selectMaterial.appendChild(option);
    }
  }

  // Bindear botones
  const btnAjustar = document.getElementById('btn-ajustar-stock');
  if (btnAjustar) {
    btnAjustar.addEventListener('click', procesarAjusteStock);
  }

  const btnReset = document.getElementById('btn-reset-inventario');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('¿Estás seguro de restaurar el inventario a los valores por defecto de fábrica?')) {
        localStorage.removeItem('alumital_inventario');
        window.STATE.inventario = cargarInventario();
        renderizarInventario();
        if (typeof showToast === 'function') showToast('Inventario restaurado con éxito', 'success');
      }
    });
  }

  const btnConsumir = document.getElementById('btn-consumir-inventario');
  if (btnConsumir) {
    btnConsumir.addEventListener('click', consumirMaterialesProyecto);
  }

  renderizarInventario();
}

// Calcular qué necesita el proyecto activo
function calcularConsumoProyecto() {
  const consumo = {
    aluminioMetro: 0,
    aluminioPuertaMetro: 0,
    aluminioCabinaMetro: 0,
    tuboAceroCabinaMetro: 0,
    vidrioM2: 0,
    vidrioTempladoCabinaM2: 0,
    accesoriosCorrediza: 0,
    accesoriosPuertaCorrediza: 0,
    accesoriosCabinaPerfil: 0,
    accesoriosCabinaTemplada: 0,
    accesoriosAbatible: 0,
    accesoriosPuertaAbatible: 0,
    accesoriosFijo: 0,
    selladorMetro: 0
  };

  if (!window.STATE.items || window.STATE.items.length === 0) {
    return consumo;
  }

  window.STATE.items.forEach(item => {
    const qty = item.cantidad || 1;
    const isPuerta = item.categoria === 'puerta';
    const isCabina = item.categoria === 'cabina_baño';

    // 1. Aluminio / Perfiles
    item.perfiles.forEach(p => {
      const metros = (p.longitud * p.cantidad) / 1000;
      const totalMetros = metros * qty;

      if (isCabina) {
        if (p.codigo === 'TU-01') {
          consumo.tuboAceroCabinaMetro += totalMetros;
        } else {
          consumo.aluminioCabinaMetro += totalMetros;
        }
      } else if (p.codigo.endsWith('-P') || (p.tipo === 'hoja' && isPuerta)) {
        consumo.aluminioPuertaMetro += totalMetros;
      } else {
        consumo.aluminioMetro += totalMetros;
      }
    });

    // 2. Vidrios
    item.vidrios.forEach(v => {
      const m2 = ((v.ancho * v.alto) / 1000000) * v.cantidad;
      const totalM2 = m2 * qty;

      if (isCabina) {
        consumo.vidrioTempladoCabinaM2 += totalM2;
      } else {
        consumo.vidrioM2 += totalM2;
      }
    });

    // 3. Accesorios
    if (item.tipo === 'corrediza' || item.tipo === 'corrediza3' || item.tipo === 'corrediza4') {
      const numH = item.tipo === 'corrediza4' ? 4 : (item.tipo === 'corrediza3' ? 3 : 2);
      const kits = numH * qty;
      if (isCabina) {
        if (item.estiloCabina === 'solo_vidrio') {
          consumo.accesoriosCabinaTemplada += kits;
        } else {
          consumo.accesoriosCabinaPerfil += kits;
        }
      } else if (isPuerta) {
        consumo.accesoriosPuertaCorrediza += kits;
      } else {
        consumo.accesoriosCorrediza += kits;
      }
    } else if (item.tipo === 'abatible') {
      const kits = 1 * qty;
      if (isCabina) {
        if (item.estiloCabina === 'solo_vidrio') {
          consumo.accesoriosCabinaTemplada += kits;
        } else {
          consumo.accesoriosCabinaPerfil += kits;
        }
      } else if (isPuerta) {
        consumo.accesoriosPuertaAbatible += kits;
      } else {
        consumo.accesoriosAbatible += kits;
      }
    } else {
      // Paño Fijo
      const kits = 1 * qty;
      if (isCabina) {
        if (item.estiloCabina === 'solo_vidrio') {
          consumo.accesoriosCabinaTemplada += kits;
        } else {
          consumo.accesoriosCabinaPerfil += kits;
        }
      } else {
        consumo.accesoriosFijo += kits;
      }
    }

    // 4. Selladores
    item.vidrios.forEach(v => {
      const metros = (((v.ancho + v.alto) * 2) / 1000) * v.cantidad;
      consumo.selladorMetro += metros * qty;
    });
  });

  // Redondear a decimales razonables
  for (let key in consumo) {
    consumo[key] = parseFloat(consumo[key].toFixed(2));
  }

  return consumo;
}

// Renderizar la tabla de stock e inventario en pantalla
function renderizarInventario() {
  const tbody = document.getElementById('table-inventario-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  const stock = window.STATE.inventario;
  const proyectoConsumo = calcularConsumoProyecto();
  let hayFaltantes = false;
  const listadoFaltantes = [];

  for (let key in INVENTARIO_MATERIALES) {
    const mat = INVENTARIO_MATERIALES[key];
    const cantStock = stock[key] !== undefined ? stock[key] : 0;
    const cantProyecto = proyectoConsumo[key] || 0;
    const balance = cantStock - cantProyecto;
    
    let balanceClass = '';
    let alertText = '';
    if (cantProyecto > 0) {
      if (balance < 0) {
        balanceClass = 'style="color: var(--danger); font-weight: bold;"';
        alertText = ` <span style="font-size: 11px; padding: 2px 6px; background: rgba(239, 68, 68, 0.15); color: var(--danger); border-radius: 4px; margin-left: 8px;">Falta ${Math.abs(balance).toFixed(1)}</span>`;
        hayFaltantes = true;
        listadoFaltantes.push(`${mat.nombre} (Falta ${Math.abs(balance).toFixed(1)} ${mat.unidad})`);
      } else {
        alertText = ` <span style="font-size: 11px; padding: 2px 6px; background: rgba(22, 163, 74, 0.15); color: var(--success); border-radius: 4px; margin-left: 8px;">✓ OK</span>`;
      }
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${key}</code></td>
      <td><strong>${mat.nombre}</strong></td>
      <td ${balanceClass}>${cantStock.toFixed(1)} / Req: ${cantProyecto.toFixed(1)}${alertText}</td>
      <td><span class="badge" style="background: rgba(148, 163, 184, 0.15); color: var(--text-primary);">${mat.unidad}</span></td>
      <td>$${mat.costo.toLocaleString('es-CO')}</td>
      <td>
        <div style="display: flex; gap: 4px;">
          <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="ajustarExistenciaRapida('${key}', 10)">+10</button>
          <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="ajustarExistenciaRapida('${key}', -10)">-10</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Renderizar alerta de inventario
  const alertaPanel = document.getElementById('inventario-alerta-panel');
  const alertaTitulo = document.getElementById('inventario-alerta-titulo');
  const alertaTexto = document.getElementById('inventario-alerta-texto');

  if (alertaPanel && alertaTitulo && alertaTexto) {
    if (window.STATE.items.length === 0) {
      alertaPanel.style.display = 'none';
    } else {
      alertaPanel.style.display = 'block';
      if (hayFaltantes) {
        alertaPanel.style.borderLeft = '4px solid var(--danger)';
        alertaTitulo.style.color = 'var(--danger)';
        alertaTitulo.textContent = '⚠️ Existencias Insuficientes';
        alertaTexto.innerHTML = `Para fabricar el proyecto de aberturas actual, necesitas reabastecer:<br><ul style="margin-left: 20px; margin-top: 8px;"><li>${listadoFaltantes.join('</li><li>')}</li></ul>`;
      } else {
        alertaPanel.style.borderLeft = '4px solid var(--success)';
        alertaTitulo.style.color = 'var(--success)';
        alertaTitulo.textContent = '✓ Existencias Suficientes';
        alertaTexto.textContent = 'Tienes suficiente material en stock en tu almacén de Alumital SAS para fabricar el proyecto activo.';
      }
    }
  }
}

// Sumar o restar stock rápidamente desde el botón de la fila
function ajustarExistenciaRapida(key, cantidad) {
  const stock = window.STATE.inventario;
  stock[key] = Math.max(0, (stock[key] || 0) + cantidad);
  guardarInventario(stock);
  renderizarInventario();
  if (typeof showToast === 'function') showToast('Stock actualizado rápidamente', 'success');
}

// Procesar el ajuste de stock manual del formulario
function procesarAjusteStock() {
  const key = document.getElementById('inv-select-material').value;
  const cantStr = document.getElementById('inv-ajuste-cantidad').value;
  const operacion = document.getElementById('inv-ajuste-operacion').value;

  const cantidad = parseFloat(cantStr);
  if (isNaN(cantidad) || cantidad <= 0) {
    if (typeof showToast === 'function') showToast('Ingresa una cantidad numérica válida', 'error');
    return;
  }

  const stock = window.STATE.inventario;
  if (operacion === 'sumar') {
    stock[key] = (stock[key] || 0) + cantidad;
  } else if (operacion === 'restar') {
    stock[key] = Math.max(0, (stock[key] || 0) - cantidad);
  } else {
    stock[key] = cantidad;
  }

  guardarInventario(stock);
  renderizarInventario();
  if (typeof showToast === 'function') showToast('Ajuste de stock guardado', 'success');
}

// Descontar consumo del proyecto activo del inventario
function consumirMaterialesProyecto() {
  if (!window.STATE.items || window.STATE.items.length === 0) {
    if (typeof showToast === 'function') showToast('No hay aberturas en el proyecto para consumir', 'error');
    return;
  }

  const consumo = calcularConsumoProyecto();
  const stock = window.STATE.inventario;

  // Realizar resta
  for (let key in consumo) {
    stock[key] = Math.max(0, (stock[key] || 0) - consumo[key]);
  }

  guardarInventario(stock);
  renderizarInventario();
  if (typeof showToast === 'function') showToast('¡Materiales descontados con éxito del inventario!', 'success');
}
