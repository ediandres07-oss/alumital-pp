/**
 * Alumital SAS - Lógica Principal de la Aplicación
 * Administra el estado global, navegación, renderizado de SVG, tablas, optimización y presupuestos.
 */

// Estado global de la aplicación
window.STATE = window.STATE || {};
const STATE = window.STATE;
STATE.items = STATE.items || [];
STATE.precios = STATE.precios || { ...window.PRECIOS_DEFECTO };
STATE.activeTab = STATE.activeTab || 'configurador';
STATE.currentCalculation = STATE.currentCalculation || null;
STATE.sistemaPerfil = STATE.sistemaPerfil || 'PC7038_90';
STATE.acabadoAluminio = STATE.acabadoAluminio || 'plata';

// Cargar Skill Markdown para mostrar en la pestaña Claude
const SKILL_MARKDOWN = `# Claude Skill: Experto en Carpintería de Aluminio

Esta guía configura a Claude como un Maestro Carpintero de Aluminio para ayudarte en tus diseños.

---
## Sistemas de Perfiles y Holguras:
1. **Sistema 7030**:
   - Marco de 70 mm. Holgura vertical de hoja: -68 mm. Solape horizontal: +10 mm. Vidrio: Hoja -70 mm.
   - Ensamble a 90°: Deduce 66 mm de los perfiles horizontales.
2. **Sistema 8030**:
   - Marco de 80 mm. Holgura vertical de hoja: -76 mm. Solape horizontal: +12 mm. Vidrio: Hoja -80 mm.
   - Ensamble a 90°: Deduce 76 mm de los perfiles horizontales.

---
## Formato JSON para importar aberturas:
\`\`\`json
{
  "tipo": "corrediza",
  "ancho": 1500,
  "alto": 1200,
  "cantidad": 2,
  "sistemaPerfil": "7030_45",
  "nombre": "Ventana Living"
}
\`\`\`
*(Los valores para \`sistemaPerfil\` permitidos son: \`7030_45\`, \`7030_90\`, \`8030_45\`, \`8030_90\`)*`;

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initFormListeners();
  initBudgetSettings();
  initImportListeners();
  
  if (typeof inicializarInventario === 'function') inicializarInventario();
  if (typeof inicializarFacturacion === 'function') inicializarFacturacion();

  // Realizar primer cálculo por defecto
  actualizarCalculoConfigurador();
});

/* ==================== 1. NAVEGACIÓN ==================== */
function initNavigation() {
  const menuItems = document.querySelectorAll('.menu-item');
  const tabs = document.querySelectorAll('.panel-tab');

  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = item.getAttribute('data-tab');
      
      // Actualizar menú activo
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // Mostrar pestaña activa
      tabs.forEach(tab => {
        if (tab.id === `tab-${targetTab}`) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });

      STATE.activeTab = targetTab;
      
      // Acciones específicas al cambiar de pestaña
      if (targetTab === 'optimizador') {
        prepararOptimizador();
      } else if (targetTab === 'presupuesto') {
        renderizarPresupuesto();
      } else if (targetTab === 'skill') {
        renderizarClaudeSkill();
      } else if (targetTab === 'inventario') {
        if (typeof renderizarInventario === 'function') renderizarInventario();
      } else if (targetTab === 'facturacion') {
        if (typeof renderizarFacturaPreview === 'function') renderizarFacturaPreview();
      } else if (targetTab === 'produccion') {
        if (typeof renderizarDespiece === 'function') renderizarDespiece();
      } else if (targetTab === 'clientes') {
        if (typeof cargarClientes === 'function') cargarClientes();
      } else if (targetTab === 'historial') {
        if (typeof cargarHistorial === 'function') cargarHistorial();
        if (typeof cargarClientesDropdown === 'function') cargarClientesDropdown();
      }
    });
  });
}

/* ==================== 2. CONFIGURADOR & SVG ==================== */
function initFormListeners() {
  const inputs = ['config-categoria', 'config-cabina-tipo', 'config-tipo', 'config-ancho', 'config-alto', 'config-cantidad', 'config-nombre', 'config-ensamble', 'config-acabado', 'config-apertura'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', actualizarCalculoConfigurador);
      if (el.tagName === 'SELECT') {
        el.addEventListener('change', actualizarCalculoConfigurador);
      }
    }
  });

  const selectCategoria = document.getElementById('config-categoria');
  if (selectCategoria) {
    selectCategoria.addEventListener('change', () => {
      const heightInput = document.getElementById('config-alto');
      const widthInput = document.getElementById('config-ancho');
      const gridCabina = document.getElementById('form-grid-cabina');
      const category = selectCategoria.value;
      
      if (category === 'cabina_baño') {
        if (gridCabina) gridCabina.style.display = 'grid';
        if (heightInput.value === '1200' || heightInput.value === '2000') {
          heightInput.value = '1800';
        }
        if (widthInput.value === '1500') {
          widthInput.value = '1200';
        }
      } else {
        if (gridCabina) gridCabina.style.display = 'none';
        if (category === 'puerta') {
          if (heightInput.value === '1200' || heightInput.value === '1800') {
            heightInput.value = '2000';
          }
          if (widthInput.value === '1200') {
            widthInput.value = '1500';
          }
        } else if (category === 'ventana') {
          if (heightInput.value === '2000' || heightInput.value === '1800') {
            heightInput.value = '1200';
          }
          if (widthInput.value === '1200') {
            widthInput.value = '1500';
          }
        }
      }
      actualizarCalculoConfigurador();
    });
  }

  // Event listener para actualizar el estado cuando cambia el sistema de perfil
  const selectEnsamble = document.getElementById('config-ensamble');
  if (selectEnsamble) {
    selectEnsamble.addEventListener('change', () => {
      STATE.sistemaPerfil = selectEnsamble.value;
      actualizarCalculoConfigurador();
      
      const sysName = window.SISTEMAS_PERFIL[STATE.sistemaPerfil]?.nombre || 'Personalizado';
      showToast(`Línea de perfil cambiada a: ${sysName}`, 'success');
    });
  }

  // Inicializar el controlador de arrastre
  initDragResize();

  // Botón Agregar Ventana
  const btnAgregar = document.getElementById('btn-agregar-ventana');
  if (btnAgregar) {
    btnAgregar.addEventListener('click', agregarVentanaAlEstado);
  }
}

function actualizarCalculoConfigurador() {
  const categoria = document.getElementById('config-categoria').value || 'ventana';
  const estiloCabina = document.getElementById('config-cabina-tipo').value || 'con_perfil';
  const tipo = document.getElementById('config-tipo').value;
  const width = parseInt(document.getElementById('config-ancho').value) || 0;
  const height = parseInt(document.getElementById('config-alto').value) || 0;
  const cantidad = parseInt(document.getElementById('config-cantidad').value) || 1;
  const nombre = document.getElementById('config-nombre').value || 'Sin nombre';
  const sistemaId = document.getElementById('config-ensamble').value || '7030_45';
  const acabado = document.getElementById('config-acabado').value || 'negro';
  const apertura = parseInt(document.getElementById('config-apertura').value) || 0;

  if (width < 100 || height < 100) {
    return;
  }

  // Actualizar etiquetas y estado
  document.getElementById('apertura-val').textContent = apertura;
  STATE.sistemaPerfil = sistemaId;
  STATE.acabadoAluminio = acabado;
  STATE.aperturaPorcentaje = apertura;

  // Ejecutar cálculo geométrico
  const resultado = calcularVentana(tipo, width, height, STATE.sistemaPerfil, categoria, estiloCabina);
  STATE.currentCalculation = {
    tipo, width, height, cantidad, nombre, categoria, estiloCabina,
    sistemaPerfil: STATE.sistemaPerfil,
    acabadoAluminio: STATE.acabadoAluminio,
    aperturaPorcentaje: STATE.aperturaPorcentaje,
    perfiles: resultado.perfiles,
    vidrios: resultado.vidrios
  };

  // 1. Dibujar SVG interactivo fotorrealista
  dibujarSVG(tipo, width, height);

  // 2. Mostrar resultados en las tablas
  renderizarTablasResultado(resultado.perfiles, resultado.vidrios);

  // 3. Enlazar eventos interactivos bidireccionales
  enlazarEventosInteractivos();
}

/* ==================== SVG FOTORREALISTA E INTERACTIVO ==================== */

function crearDefinicionesSVG(svg) {
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);
  }
  defs.innerHTML = `
    <linearGradient id="metal-plata" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#94a3b8"/>
      <stop offset="30%" stop-color="#cbd5e1"/>
      <stop offset="50%" stop-color="#f8fafc"/>
      <stop offset="70%" stop-color="#cbd5e1"/>
      <stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
    <linearGradient id="metal-negro" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="35%" stop-color="#020617"/>
      <stop offset="50%" stop-color="#334155"/>
      <stop offset="65%" stop-color="#020617"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="metal-blanco" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#e2e8f0"/>
      <stop offset="40%" stop-color="#ffffff"/>
      <stop offset="60%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>
    <linearGradient id="metal-bronce" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2d1500"/>
      <stop offset="35%" stop-color="#542e0c"/>
      <stop offset="50%" stop-color="#a16207"/>
      <stop offset="65%" stop-color="#542e0c"/>
      <stop offset="100%" stop-color="#2d1500"/>
    </linearGradient>
    <linearGradient id="glass-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(14, 165, 233, 0.35)"/>
      <stop offset="35%" stop-color="rgba(14, 165, 233, 0.15)"/>
      <stop offset="46%" stop-color="rgba(255, 255, 255, 0.5)"/>
      <stop offset="54%" stop-color="rgba(255, 255, 255, 0.5)"/>
      <stop offset="65%" stop-color="rgba(14, 165, 233, 0.15)"/>
      <stop offset="100%" stop-color="rgba(2, 132, 199, 0.45)"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="2" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
    <pattern id="glass-back" x="0" y="0" width="1" height="1" patternContentUnits="objectBoundingBox">
      <image href="img/scenery_pc7038.jpg" x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice"/>
    </pattern>
  `;
}

function dibujarSVG(tipo, width, height, targetSvgId = 'window-preview-svg', itemState = null) {
  const svg = document.getElementById(targetSvgId);
  if (!svg) return;

  const stateContext = itemState || STATE;
  const activeSys = window.SISTEMAS_PERFIL[stateContext.sistemaPerfil] || window.SISTEMAS_PERFIL['VC5020_90'];
  const ensamble = activeSys.ensamble;

  // Limpiar e inyectar defs
  svg.innerHTML = '';
  crearDefinicionesSVG(svg);

  // Proporciones del SVG
  const maxDim = 260;
  let svgW, svgH;
  if (width >= height) {
    svgW = maxDim;
    svgH = (height / width) * maxDim;
  } else {
    svgH = maxDim;
    svgW = (width / height) * maxDim;
  }

  // Márgenes para cotas
  const margin = 30;
  const viewW = svgW + margin * 2;
  const viewH = svgH + margin * 2;
  svg.setAttribute('viewBox', `0 0 ${viewW} ${viewH}`);

  // Grupo principal centrado
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${margin}, ${margin})`);
  svg.appendChild(g);

  // Determinar acabado
  const fillMetal = `url(#metal-${stateContext.acabadoAluminio})`;
  const strokeColor = stateContext.acabadoAluminio === 'blanco' ? '#94a3b8' : 'rgba(0,0,0,0.3)';

  // 1. Dibujar MARCO perimetral (ensamble dinámico 45° o 90°)
  const FT = 14; // Ancho visual del perfil de marco en px
  const isBañoSoloVidrio = stateContext.categoria === 'cabina_baño' && stateContext.estiloCabina === 'solo_vidrio';

  if (isBañoSoloVidrio) {
    // Cabina templada solo vidrio: Dibujamos perfil U muy fino de 3px a los costados
    dibujarRectangulo(g, 0, 0, 3, svgH, 'url(#metal-plata)', '#475569', 'svg-interactive-profile', 'PU-02');
    dibujarRectangulo(g, svgW - 3, 0, 3, svgH, 'url(#metal-plata)', '#475569', 'svg-interactive-profile', 'PU-02');
    dibujarRectangulo(g, 3, svgH - 3, svgW - 6, 3, 'url(#metal-plata)', '#475569', 'svg-interactive-profile', 'PU-02');

    // Riel superior tubular de acero inoxidable (si es corrediza)
    if (tipo.startsWith('corrediza')) {
      const tuboY = 22;
      dibujarRectangulo(g, 0, tuboY, svgW, 4, 'url(#metal-plata)', '#64748b', 'svg-interactive-profile', 'TU-01');
      // Soportes de tubo a pared (extremos)
      dibujarRectangulo(g, 0, tuboY - 2, 4, 8, '#475569', '#334155', '', '');
      dibujarRectangulo(g, svgW - 4, tuboY - 2, 4, 8, '#475569', '#334155', '', '');
    }
  } else {
    let codeTop, codeBottom, codeSides;

    if (tipo === 'corrediza' || tipo === 'corrediza3' || tipo === 'corrediza4') {
      codeTop = 'MD-02'; // Dintel
      codeBottom = 'MU-01'; // Umbral
      codeSides = 'MJ-03'; // Jamba
    } else if (tipo === 'abatible') {
      codeTop = 'MA-01';
      codeBottom = 'MA-01';
      codeSides = 'MA-02';
    } else {
      codeTop = 'MF-01';
      codeBottom = 'MF-01';
      codeSides = 'MF-02';
    }

    if (ensamble === '45') {
      // Top
      dibujarPoligono(g, `0,0 ${svgW},0 ${svgW - FT},${FT} ${FT},${FT}`, fillMetal, strokeColor, 'svg-interactive-profile', codeTop);
      // Bottom
      dibujarPoligono(g, `${FT},${svgH - FT} ${svgW - FT},${svgH - FT} ${svgW},${svgH} 0,${svgH}`, fillMetal, strokeColor, 'svg-interactive-profile', codeBottom);
      // Left
      dibujarPoligono(g, `0,0 ${FT},${FT} ${FT},${svgH - FT} 0,${svgH}`, fillMetal, strokeColor, 'svg-interactive-profile', codeSides);
      // Right
      dibujarPoligono(g, `${svgW - FT},${FT} ${svgW},0 ${svgW},${svgH} ${svgW - FT},${svgH - FT}`, fillMetal, strokeColor, 'svg-interactive-profile', codeSides);
    } else {
      // Junta recta 90°
      // Laterales (van completos)
      dibujarRectangulo(g, 0, 0, FT, svgH, fillMetal, strokeColor, 'svg-interactive-profile', codeSides);
      dibujarRectangulo(g, svgW - FT, 0, FT, svgH, fillMetal, strokeColor, 'svg-interactive-profile', codeSides);
      // Horizontales (van embutidos)
      dibujarRectangulo(g, FT, 0, svgW - FT * 2, FT, fillMetal, strokeColor, 'svg-interactive-profile', codeTop);
      dibujarRectangulo(g, FT, svgH - FT, svgW - FT * 2, FT, fillMetal, strokeColor, 'svg-interactive-profile', codeBottom);
    }
  }

  // 2. Dibujar HOJAS y VIDRIO según Tipología
  const ST = 10; // Espesor de la hoja en px

  if (tipo === 'fijo') {
    // Paño fijo: Vidrio embutido en el marco directamente
    dibujarVidrioConBrillo(g, FT, FT, svgW - FT * 2, svgH - FT * 2);
  } 
  else if (tipo === 'corrediza' || tipo === 'corrediza3' || tipo === 'corrediza4') {
    if (tipo === 'corrediza4') {
      // 4 Hojas corredizas: H1 (extrema izq, atrás), H2 (centro izq, adelante), H3 (centro der, adelante), H4 (extrema der, atrás)
      const sashW = (svgW - 20) / 4 + 3; // Ancho con solape
      const sashH = svgH - 20;

      // Cada hoja central desliza hacia los lados superponiéndose con su respectiva hoja lateral fija
      const maxSlide = sashW - 14;
      const aperturaVal = typeof stateContext.aperturaPorcentaje === 'number' ? stateContext.aperturaPorcentaje : (STATE.aperturaPorcentaje || 0);
      const dx = (aperturaVal / 100) * maxSlide;

      // H1 (Extremo izquierdo - atrás/fija)
      const gSash1 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.appendChild(gSash1);
      dibujarEstructuraHoja(gSash1, 10, 10, sashW, sashH, ST, ensamble, 'HJ-04', 'HC-06', 'HZ-05', fillMetal, strokeColor);

      // H4 (Extremo derecho - atrás/fija)
      const gSash4 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.appendChild(gSash4);
      dibujarEstructuraHoja(gSash4, 10 + sashW * 3 - 9, 10, sashW, sashH, ST, ensamble, 'HJ-04', 'HC-06', 'HZ-05', fillMetal, strokeColor);

      // H2 (Centro-izquierda - adelante, desliza a la izquierda)
      const gSash2 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gSash2.setAttribute('filter', 'url(#shadow)');
      gSash2.setAttribute('transform', `translate(${-dx}, 0)`);
      g.appendChild(gSash2);
      dibujarEstructuraHoja(gSash2, 10 + sashW - 3, 10, sashW, sashH, ST, ensamble, 'HJ-04', 'HC-06', 'HZ-05', fillMetal, strokeColor);
      // Manija H2 (central)
      const isPuerta3 = stateContext.categoria === 'puerta';
      const isBañoSoloVidrioHandle3 = stateContext.categoria === 'cabina_baño' && stateContext.estiloCabina === 'solo_vidrio';
      const handleY = isPuerta3 ? (sashH - (sashH * 0.45)) : (sashH / 2 + 2);
      const handleH = isPuerta3 ? 32 : 16;
      const handleW = isPuerta3 ? 4.5 : 3;
      if (isBañoSoloVidrioHandle3) {
        dibujarCirculo(gSash2, 10 + sashW * 2 - 8, handleY + 8, 3.5, '#cbd5e1', '#475569');
        dibujarCirculo(gSash2, 10 + sashW * 2 - 8, handleY + 8, 1.5, '#f8fafc', '#334155');
      } else {
        dibujarRectangulo(gSash2, 10 + sashW * 2 - (isPuerta3 ? 6.5 : 5), handleY, handleW, handleH, '#cbd5e1', '#475569', 'manija', '');
      }

      // H3 (Centro-derecha - adelante, desliza a la derecha)
      const gSash3 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gSash3.setAttribute('filter', 'url(#shadow)');
      gSash3.setAttribute('transform', `translate(${dx}, 0)`);
      g.appendChild(gSash3);
      dibujarEstructuraHoja(gSash3, 10 + sashW * 2 - 6, 10, sashW, sashH, ST, ensamble, 'HJ-04', 'HC-06', 'HZ-05', fillMetal, strokeColor);
      // Manija H3
      if (isBañoSoloVidrioHandle3) {
        dibujarCirculo(gSash3, 10 + sashW * 2 - 6, handleY + 8, 3.5, '#cbd5e1', '#475569');
        dibujarCirculo(gSash3, 10 + sashW * 2 - 6, handleY + 8, 1.5, '#f8fafc', '#334155');
      } else {
        dibujarRectangulo(gSash3, 10 + sashW * 2 - (isPuerta3 ? 4.5 : 3), handleY, handleW, handleH, '#cbd5e1', '#475569', 'manija', '');
      }

      // Flechas indicadoras de deslizamiento
      if (aperturaVal < 90) {
        dibujarFlechaDeslizar(g, 10 + sashW * 1.5 - dx, svgH / 2 + 10, -10, '#ffffff');
        dibujarFlechaDeslizar(g, 10 + sashW * 2.5 + dx, svgH / 2 + 10, 10, '#ffffff');
      }
    } else if (tipo === 'corrediza3') {
      // 3 Hojas corredizas: H1 (extrema izq, atrás), H2 (central, adelante), H3 (extrema der, atrás)
      const sashW = (svgW - 20) / 3 + 2; // Ancho con solape
      const sashH = svgH - 20;

      // La hoja del medio se desliza hacia la izquierda superponiéndose con H1
      const maxSlide = sashW - 14;
      const aperturaVal = typeof stateContext.aperturaPorcentaje === 'number' ? stateContext.aperturaPorcentaje : (STATE.aperturaPorcentaje || 0);
      const dx = (aperturaVal / 100) * maxSlide;

      // H1 (Extremo izquierdo - atrás/fija)
      const gSash1 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.appendChild(gSash1);
      dibujarEstructuraHoja(gSash1, 10, 10, sashW, sashH, ST, ensamble, 'HJ-04', 'HC-06', 'HZ-05', fillMetal, strokeColor);

      // H3 (Extremo derecho - atrás/fija)
      const gSash3 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.appendChild(gSash3);
      dibujarEstructuraHoja(gSash3, 10 + sashW * 2 - 4, 10, sashW, sashH, ST, ensamble, 'HJ-04', 'HC-06', 'HZ-05', fillMetal, strokeColor);

      // H2 (Hoja central - adelante, desliza a la izquierda)
      const gSash2 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gSash2.setAttribute('filter', 'url(#shadow)');
      gSash2.setAttribute('transform', `translate(${-dx}, 0)`);
      g.appendChild(gSash2);
      dibujarEstructuraHoja(gSash2, 10 + sashW - 2, 10, sashW, sashH, ST, ensamble, 'HJ-04', 'HC-06', 'HZ-05', fillMetal, strokeColor);
      
      // Manija interior hoja movil (derecha)
      const isPuerta = stateContext.categoria === 'puerta';
      const isBañoSoloVidrioHandle = stateContext.categoria === 'cabina_baño' && stateContext.estiloCabina === 'solo_vidrio';
      const handleY = isPuerta ? (sashH - (sashH * 0.45)) : (sashH / 2 + 2);
      const handleH = isPuerta ? 32 : 16;
      const handleW = isPuerta ? 4.5 : 3;
      
      if (isBañoSoloVidrioHandle) {
        dibujarCirculo(gSash2, 10 + sashW * 2 - 8, handleY + 8, 3.5, '#cbd5e1', '#475569');
        dibujarCirculo(gSash2, 10 + sashW * 2 - 8, handleY + 8, 1.5, '#f8fafc', '#334155');
      } else {
        dibujarRectangulo(gSash2, 10 + sashW * 2 - (isPuerta ? 4.5 : 3), handleY, handleW, handleH, '#cbd5e1', '#475569', 'manija', '');
      }

      // Flecha de deslizamiento
      if (aperturaVal < 90) {
        const arrowY = svgH / 2 + 10;
        dibujarFlechaDeslizar(g, 10 + sashW * 1.5 - dx, arrowY, -10, '#ffffff');
      }
    } else {
      // Ventana corrediza estándar de 2 hojas
      const sashW = (svgW - 20) / 2 + 5;
      const sashH = svgH - 20;
      
      const maxSlide = (svgW - 20) / 2 - 7;
      const aperturaVal = typeof stateContext.aperturaPorcentaje === 'number' ? stateContext.aperturaPorcentaje : (STATE.aperturaPorcentaje || 0);
      const dx = (aperturaVal / 100) * maxSlide;

      const gSash1 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.appendChild(gSash1);
      dibujarEstructuraHoja(gSash1, 10, 10, sashW, sashH, ST, ensamble, 'HJ-04', 'HC-06', 'HZ-05', fillMetal, strokeColor);

      const gSash2 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gSash2.setAttribute('filter', 'url(#shadow)');
      gSash2.setAttribute('transform', `translate(${-dx}, 0)`);
      g.appendChild(gSash2);
      
      dibujarEstructuraHoja(gSash2, svgW / 2 - 5, 10, sashW, sashH, ST, ensamble, 'HJ-04', 'HC-06', 'HZ-05', fillMetal, strokeColor);
      
      const isPuerta = STATE.currentCalculation && STATE.currentCalculation.categoria === 'puerta';
      const isBañoSoloVidrio = STATE.currentCalculation && STATE.currentCalculation.categoria === 'cabina_baño' && STATE.currentCalculation.estiloCabina === 'solo_vidrio';
      const handleY = isPuerta ? (sashH - (sashH * 0.45)) : (sashH / 2 + 2);
      const handleH = isPuerta ? 32 : 16;
      const handleW = isPuerta ? 4.5 : 4;
      if (isBañoSoloVidrio) {
        dibujarCirculo(gSash2, svgW / 2 - 3, handleY + 8, 3.5, '#cbd5e1', '#475569');
        dibujarCirculo(gSash2, svgW / 2 - 3, handleY + 8, 1.5, '#f8fafc', '#334155');
      } else {
        dibujarRectangulo(gSash2, svgW / 2 - (isPuerta ? 1.5 : 1), handleY, handleW, handleH, '#cbd5e1', '#475569', 'manija', '');
      }

      if (STATE.aperturaPorcentaje < 90) {
        const arrowY = svgH / 2 + 10;
        dibujarFlechaDeslizar(g, svgW - 35 - dx, arrowY, -12, '#ffffff');
      }
    }
  } 
  else if (tipo === 'abatible') {
    // Hoja abatible: abre pivotando en el lateral izquierdo
    const sashW = svgW - 20;
    const sashH = svgH - 20;

    // Ángulo/escala de apertura simulando perspectiva 3D
    const scaleX = 1 - (STATE.aperturaPorcentaje / 100) * 0.75;

    // Líneas punteadas de apertura (se dibujan antes del grupo escalado para que no se deformen)
    const openedW = sashW * scaleX;
    const pathApertura = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathApertura.setAttribute('d', `M 10 10 L ${10 + openedW} ${svgH / 2} L 10 ${svgH - 10}`);
    pathApertura.setAttribute('stroke', 'rgba(255, 255, 255, 0.45)');
    pathApertura.setAttribute('stroke-width', '1.5');
    pathApertura.setAttribute('stroke-dasharray', '4,4');
    pathApertura.setAttribute('fill', 'none');
    g.appendChild(pathApertura);

    // Grupo de la hoja abatible
    const gSash = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gSash.setAttribute('transform', `translate(10, 0) scale(${scaleX}, 1) translate(-10, 0)`);
    if (STATE.aperturaPorcentaje > 0) {
      gSash.setAttribute('filter', 'url(#shadow)');
    }
    g.appendChild(gSash);

    // Estructura
    dibujarEstructuraHoja(gSash, 10, 10, sashW, sashH, ST, ensamble, 'HA-04', 'HA-03', 'HA-03', fillMetal, strokeColor);

    // Manija realista en el lateral derecho de la hoja
    const isPuerta = STATE.currentCalculation && STATE.currentCalculation.categoria === 'puerta';
    const isBañoSoloVidrio = STATE.currentCalculation && STATE.currentCalculation.categoria === 'cabina_baño' && STATE.currentCalculation.estiloCabina === 'solo_vidrio';
    const manijaX = 10 + sashW - 8;
    const handleY = isPuerta ? (sashH - (sashH * 0.45)) : (sashH / 2 - 4);
    if (isBañoSoloVidrio) {
      // Toallero H de acero inoxidable
      const toalleroY = handleY - 15;
      dibujarRectangulo(gSash, manijaX - 4, toalleroY + 5, 5, 2, 'url(#metal-plata)', '#475569', '', '');
      dibujarRectangulo(gSash, manijaX - 4, toalleroY + 35, 5, 2, 'url(#metal-plata)', '#475569', '', '');
      dibujarRectangulo(gSash, manijaX - 6, toalleroY, 3, 40, 'url(#metal-plata)', '#475569', 'manija', '');
    } else if (isPuerta) {
      // Placa de manija de puerta
      dibujarRectangulo(gSash, manijaX - 1.5, handleY - 6, 6, 28, '#475569', '#1e293b', 'manija-placa', '');
      // Manubrio horizontal
      dibujarRectangulo(gSash, manijaX - 7, handleY, 11, 4, '#cbd5e1', '#64748b', 'manija-manubrio', '');
      // Bocallave/Cerradura
      dibujarCirculo(gSash, manijaX + 1.5, handleY + 16, 1.5, '#020617', 'none');
      dibujarPoligono(gSash, `${manijaX+1},${handleY+16} ${manijaX+2},${handleY+16} ${manijaX+2.5},${handleY+21} ${manijaX+0.5},${handleY+21}`, '#020617', 'none', 'keyhole-tail');
    } else {
      dibujarRectangulo(gSash, manijaX, handleY, 3, 20, '#cbd5e1', '#475569', 'manija', '');
      dibujarCirculo(gSash, manijaX + 1.5, handleY + 10, 2, '#94a3b8', 'rgba(0,0,0,0.2)');
    }
  }

  // 3. Dibujar COTAS de Dimensiones
  // Cota Horizontal (Ancho)
  dibujarCotaHorizontal(g, 0, svgH + 15, svgW, `${width} mm`);

  // Cota Vertical (Alto)
  dibujarCotaVertical(g, svgW + 15, 0, svgH, `${height} mm`);

  // 4. Dibujar tirador de arrastre interactivo (drag handle) en el marco exterior
  const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  handle.setAttribute('cx', svgW);
  handle.setAttribute('cy', svgH);
  handle.setAttribute('r', '7');
  handle.setAttribute('class', 'resize-handle');
  handle.setAttribute('id', 'drag-handle');
  g.appendChild(handle);
}

/* ==================== DIBUJADO DE ELEMENTOS DE HOJAS Y VIDRIO ==================== */

function dibujarEstructuraHoja(parentG, x, y, w, h, ST, ensamble, codeV, codeTop, codeBottom, fillMetal, strokeColor) {
  const isPuerta = STATE.currentCalculation && STATE.currentCalculation.categoria === 'puerta';
  const isBañoSoloVidrio = STATE.currentCalculation && STATE.currentCalculation.categoria === 'cabina_baño' && STATE.currentCalculation.estiloCabina === 'solo_vidrio';
  const bottomST = isPuerta ? ST * 2.2 : ST;

  if (isBañoSoloVidrio) {
    // Vidrio templado completo (sin marcos de aluminio)
    dibujarVidrioConBrillo(parentG, x, y, w, h);

    const isCorrediza = STATE.currentCalculation.tipo.startsWith('corrediza');
    if (isCorrediza) {
      // Herrajes de rodachinas de acero inoxidable en el tubo superior
      const rollerY = 22; // Eje de la barra cilíndrica superior
      // Rodachina izquierda
      dibujarCirculo(parentG, x + 15, rollerY, 4, 'url(#metal-plata)', '#475569');
      dibujarRectangulo(parentG, x + 13.5, rollerY, 3, 10, 'url(#metal-plata)', '#475569', '', '');
      // Rodachina derecha
      dibujarCirculo(parentG, x + w - 15, rollerY, 4, 'url(#metal-plata)', '#475569');
      dibujarRectangulo(parentG, x + w - 16.5, rollerY, 3, 10, 'url(#metal-plata)', '#475569', '', '');
    } else if (STATE.currentCalculation.tipo === 'abatible') {
      // Bisagras de acero de fijación a pared
      dibujarRectangulo(parentG, x - 2, y + 25, 4, 10, 'url(#metal-plata)', '#475569', '', '');
      dibujarRectangulo(parentG, x - 2, y + h - 35, 4, 10, 'url(#metal-plata)', '#475569', '', '');
    }
    return;
  }

  // Vidrio embutido
  dibujarVidrioConBrillo(parentG, x + ST, y + ST, w - ST * 2, h - ST - bottomST);

  // Burletes/Gomas negras alrededor del vidrio (perfil de estanqueidad)
  dibujarRectangulo(parentG, x + ST - 1.5, y + ST - 1.5, w - ST * 2 + 3, h - ST - bottomST + 3, 'none', '#090d16', '', '', '2.5');

  // Perfiles de la hoja
  if (ensamble === '45') {
    // Izquierdo
    dibujarPoligono(parentG, `${x},${y} ${x + ST},${y + ST} ${x + ST},${y + h - bottomST} ${x},${y + h}`, fillMetal, strokeColor, 'svg-interactive-profile', codeV);
    // Derecho
    dibujarPoligono(parentG, `${x + w - ST},${y + ST} ${x + w},${y} ${x + w},${y + h} ${x + w - ST},${y + h - bottomST}`, fillMetal, strokeColor, 'svg-interactive-profile', codeV);
    // Superior
    dibujarPoligono(parentG, `${x},${y} ${x + w},${y} ${x + w - ST},${y + ST} ${x + ST},${y + ST}`, fillMetal, strokeColor, 'svg-interactive-profile', codeTop);
    // Inferior
    dibujarPoligono(parentG, `${x + ST},${y + h - bottomST} ${x + w - ST},${y + h - bottomST} ${x + w},${y + h} ${x},${y + h}`, fillMetal, strokeColor, 'svg-interactive-profile', codeBottom);
  } else {
    // 90° Junta recta
    // Hojas verticales completas
    dibujarRectangulo(parentG, x, y, ST, h, fillMetal, strokeColor, 'svg-interactive-profile', codeV);
    dibujarRectangulo(parentG, x + w - ST, y, ST, h, fillMetal, strokeColor, 'svg-interactive-profile', codeV);
    // Hojas horizontales embutidas
    dibujarRectangulo(parentG, x + ST, y, w - ST * 2, ST, fillMetal, strokeColor, 'svg-interactive-profile', codeTop);
    dibujarRectangulo(parentG, x + ST, y + h - bottomST, w - ST * 2, bottomST, fillMetal, strokeColor, 'svg-interactive-profile', codeBottom);
  }

  // Biseles metálicos brillantes / Reflejos especulares 3D
  dibujarRectangulo(parentG, x + 0.8, y + 0.8, w - 1.6, h - 1.6, 'none', 'rgba(255, 255, 255, 0.22)', '', '', '0.8');
  dibujarRectangulo(parentG, x + ST - 0.8, y + ST - 0.8, w - ST * 2 + 1.6, h - ST - bottomST + 1.6, 'none', 'rgba(255, 255, 255, 0.15)', '', '', '0.8');
}

function dibujarVidrioConBrillo(parentG, x, y, w, h) {
  // 1. Fondo de jardín fotorrealista (desenfocado, a través del vidrio)
  const bgImage = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgImage.setAttribute('x', x);
  bgImage.setAttribute('y', y);
  bgImage.setAttribute('width', w);
  bgImage.setAttribute('height', h);
  bgImage.setAttribute('fill', 'url(#glass-back)');
  bgImage.setAttribute('class', 'svg-interactive-profile');
  bgImage.setAttribute('data-codigo', 'GLASS');
  parentG.appendChild(bgImage);

  // 2. Perfil intercalario metálico (espaciador del doble acristalamiento DVH)
  dibujarRectangulo(parentG, x + 1.5, y + 1.5, w - 3, h - 3, 'none', 'rgba(100, 116, 139, 0.65)', '', '', '2');

  // 3. Capa de vidrio tintada con gradiente de reflexión
  const vidrioOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  vidrioOverlay.setAttribute('x', x);
  vidrioOverlay.setAttribute('y', y);
  vidrioOverlay.setAttribute('width', w);
  vidrioOverlay.setAttribute('height', h);
  vidrioOverlay.setAttribute('fill', 'url(#glass-grad)');
  vidrioOverlay.setAttribute('stroke', 'rgba(14, 165, 233, 0.25)');
  vidrioOverlay.setAttribute('stroke-width', '0.5');
  vidrioOverlay.setAttribute('style', 'mix-blend-mode: normal; opacity: 0.94; pointer-events: none;');
  parentG.appendChild(vidrioOverlay);

  // 4. Diagonales de brillo especular
  const brillo1 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  brillo1.setAttribute('points', `${x + w * 0.15},${y} ${x},${y + h * 0.15} ${x},${y + h * 0.3} ${x + w * 0.3},${y}`);
  brillo1.setAttribute('fill', 'rgba(255, 255, 255, 0.15)');
  brillo1.setAttribute('style', 'pointer-events: none;');
  parentG.appendChild(brillo1);

  const brillo2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  brillo2.setAttribute('points', `${x + w * 0.55},${y} ${x},${y + h * 0.55} ${x},${y + h * 0.65} ${x + w * 0.65},${y}`);
  brillo2.setAttribute('fill', 'rgba(255, 255, 255, 0.1)');
  brillo2.setAttribute('style', 'pointer-events: none;');
  parentG.appendChild(brillo2);
}

/* ==================== ELEMENTOS AUXILIARES SVG ==================== */

function dibujarPoligono(parentG, points, fill, stroke, className, code) {
  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  poly.setAttribute('points', points);
  poly.setAttribute('fill', fill);
  poly.setAttribute('stroke', stroke);
  poly.setAttribute('stroke-width', '1');
  if (className) poly.setAttribute('class', className);
  if (code) poly.setAttribute('data-codigo', code);
  parentG.appendChild(poly);
}

function dibujarRectangulo(parentG, x, y, w, h, fill, stroke, className, code, strokeWidth = '1') {
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('width', w);
  rect.setAttribute('height', h);
  rect.setAttribute('fill', fill);
  rect.setAttribute('stroke', stroke);
  rect.setAttribute('stroke-width', strokeWidth);
  if (className) rect.setAttribute('class', className);
  if (code) rect.setAttribute('data-codigo', code);
  parentG.appendChild(rect);
}

function dibujarCirculo(parentG, cx, cy, r, fill, stroke) {
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', cx);
  c.setAttribute('cy', cy);
  c.setAttribute('r', r);
  c.setAttribute('fill', fill);
  c.setAttribute('stroke', stroke);
  parentG.appendChild(c);
}

function dibujarFlechaDeslizar(parentG, x, y, dx, color) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', `M ${x} ${y} L ${x + dx} ${y} M ${x + dx + 4} ${y - 4} L ${x + dx} ${y} L ${x + dx + 4} ${y + 4}`);
  path.setAttribute('stroke', color);
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('fill', 'none');
  path.setAttribute('style', 'pointer-events: none;');
  parentG.appendChild(path);
}

function dibujarCotaHorizontal(parentG, x, y, w, texto) {
  // Línea principal
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x); line.setAttribute('y1', y);
  line.setAttribute('x2', x + w); line.setAttribute('y2', y);
  line.setAttribute('stroke', '#64748b');
  line.setAttribute('stroke-width', '0.8');
  parentG.appendChild(line);

  // Delimitadores extremos
  const limit1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  limit1.setAttribute('x1', x); limit1.setAttribute('y1', y - 4);
  limit1.setAttribute('x2', x); limit1.setAttribute('y2', y + 4);
  limit1.setAttribute('stroke', '#64748b');
  limit1.setAttribute('stroke-width', '0.8');
  parentG.appendChild(limit1);

  const limit2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  limit2.setAttribute('x1', x + w); limit2.setAttribute('y1', y - 4);
  limit2.setAttribute('x2', x + w); limit2.setAttribute('y2', y + 4);
  limit2.setAttribute('stroke', '#64748b');
  limit2.setAttribute('stroke-width', '0.8');
  parentG.appendChild(limit2);

  // Texto
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', x + w / 2);
  text.setAttribute('y', y + 12);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('class', 'dimension-label');
  text.textContent = texto;
  parentG.appendChild(text);
}

function dibujarCotaVertical(parentG, x, y, h, texto) {
  // Línea principal
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x); line.setAttribute('y1', y);
  line.setAttribute('x2', x); line.setAttribute('y2', y + h);
  line.setAttribute('stroke', '#64748b');
  line.setAttribute('stroke-width', '0.8');
  parentG.appendChild(line);

  // Delimitadores
  const limit1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  limit1.setAttribute('x1', x - 4); limit1.setAttribute('y1', y);
  limit1.setAttribute('x2', x + 4); limit1.setAttribute('y2', y);
  limit1.setAttribute('stroke', '#64748b');
  limit1.setAttribute('stroke-width', '0.8');
  parentG.appendChild(limit1);

  const limit2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  limit2.setAttribute('x1', x - 4); limit2.setAttribute('y1', y + h);
  limit2.setAttribute('x2', x + 4); limit2.setAttribute('y2', y + h);
  limit2.setAttribute('stroke', '#64748b');
  limit2.setAttribute('stroke-width', '0.8');
  parentG.appendChild(limit2);

  // Texto
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', x + 8);
  text.setAttribute('y', y + h / 2 + 4);
  text.setAttribute('class', 'dimension-label');
  text.textContent = texto;
  parentG.appendChild(text);
}

/* ==================== ARRASTRE PARA REDIMENSIONAR (DRAG & RESIZE) ==================== */

let isDragging = false;
let startX = 0;
let startY = 0;
let startWidth = 1500;
let startHeight = 1200;

function initDragResize() {
  const svg = document.getElementById('window-preview-svg');
  if (!svg) return;

  // Evento ratón abajo
  svg.addEventListener('mousedown', (e) => {
    if (e.target.id === 'drag-handle') {
      e.preventDefault();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = parseInt(document.getElementById('config-ancho').value) || 1500;
      startHeight = parseInt(document.getElementById('config-alto').value) || 1200;
      e.target.classList.add('active');
    }
  });

  // Movimiento del ratón
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const rect = svg.getBoundingClientRect();
    const viewW = parseFloat(svg.getAttribute('viewBox').split(' ')[2]);
    const mmPerPixel = viewW / rect.width;

    const dx = (e.clientX - startX) * mmPerPixel;
    const dy = (e.clientY - startY) * mmPerPixel;

    // Límites de la abertura: 400 mm a 4000 mm
    const newWidth = Math.max(400, Math.min(4000, Math.round((startWidth + dx) / 10) * 10));
    const newHeight = Math.max(400, Math.min(4000, Math.round((startHeight + dy) / 10) * 10));

    document.getElementById('config-ancho').value = newWidth;
    document.getElementById('config-alto').value = newHeight;

    actualizarCalculoConfigurador();
  });

  // Soltar ratón
  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      const handle = document.getElementById('drag-handle');
      if (handle) handle.classList.remove('active');
      showToast(`Dimensiones fijadas en: ${document.getElementById('config-ancho').value} x ${document.getElementById('config-alto').value} mm`, 'success');
    }
  });

  // Soporte pantallas táctiles (Touch)
  svg.addEventListener('touchstart', (e) => {
    if (e.target.id === 'drag-handle') {
      e.preventDefault();
      isDragging = true;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startWidth = parseInt(document.getElementById('config-ancho').value) || 1500;
      startHeight = parseInt(document.getElementById('config-alto').value) || 1200;
      e.target.classList.add('active');
    }
  });

  window.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const rect = svg.getBoundingClientRect();
    const viewW = parseFloat(svg.getAttribute('viewBox').split(' ')[2]);
    const mmPerPixel = viewW / rect.width;

    const dx = (touch.clientX - startX) * mmPerPixel;
    const dy = (touch.clientY - startY) * mmPerPixel;

    const newWidth = Math.max(400, Math.min(4000, Math.round((startWidth + dx) / 10) * 10));
    const newHeight = Math.max(400, Math.min(4000, Math.round((startHeight + dy) / 10) * 10));

    document.getElementById('config-ancho').value = newWidth;
    document.getElementById('config-alto').value = newHeight;

    actualizarCalculoConfigurador();
  });

  window.addEventListener('touchend', () => {
    if (isDragging) {
      isDragging = false;
      const handle = document.getElementById('drag-handle');
      if (handle) handle.classList.remove('active');
    }
  });
}

/* ==================== RESALTADO Y HOVER SINCRONIZADO ==================== */

function enlazarEventosInteractivos() {
  const tableRows = document.querySelectorAll('.profile-table-row');
  const svgProfiles = document.querySelectorAll('.svg-interactive-profile');

  // 1. Hover sobre filas de las tablas -> Resalta elemento en SVG
  tableRows.forEach(row => {
    row.addEventListener('mouseenter', () => {
      const codigo = row.getAttribute('data-codigo');
      row.classList.add('highlighted-row');
      
      const svgEls = document.querySelectorAll(`.svg-interactive-profile[data-codigo="${codigo}"]`);
      svgEls.forEach(el => el.classList.add('svg-highlight'));
    });

    row.addEventListener('mouseleave', () => {
      const codigo = row.getAttribute('data-codigo');
      row.classList.remove('highlighted-row');
      
      const svgEls = document.querySelectorAll(`.svg-interactive-profile[data-codigo="${codigo}"]`);
      svgEls.forEach(el => el.classList.remove('svg-highlight'));
    });
  });

  // 2. Hover/Clic sobre perfiles del SVG -> Resalta filas y abre tooltip
  svgProfiles.forEach(el => {
    const codigo = el.getAttribute('data-codigo');
    if (!codigo) return;

    el.addEventListener('mouseenter', (e) => {
      el.classList.add('svg-highlight');
      
      const rows = document.querySelectorAll(`.profile-table-row[data-codigo="${codigo}"]`);
      rows.forEach(r => r.classList.add('highlighted-row'));

      mostrarTooltipCard(e, codigo);
    });

    el.addEventListener('mousemove', (e) => {
      moverTooltipCard(e);
    });

    el.addEventListener('mouseleave', () => {
      el.classList.remove('svg-highlight');
      
      const rows = document.querySelectorAll(`.profile-table-row[data-codigo="${codigo}"]`);
      rows.forEach(r => r.classList.remove('highlighted-row'));

      ocultarTooltipCard();
    });

    el.addEventListener('click', () => {
      const targetRow = document.querySelector(`.profile-table-row[data-codigo="${codigo}"]`);
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        targetRow.style.transition = 'background 0s';
        targetRow.style.backgroundColor = 'rgba(168, 85, 247, 0.35)'; // resalte violeta temporal
        setTimeout(() => {
          targetRow.style.transition = 'background var(--transition-normal)';
          targetRow.style.backgroundColor = '';
        }, 1200);
      }
    });
  });
}

/* ==================== TARJETA DE INFORMACIÓN FLOTANTE (TOOLTIP) ==================== */

function getOrCreateTooltipCard() {
  const container = document.querySelector('.visualizer-card');
  if (!container) return null;

  let card = container.querySelector('.svg-tooltip-card');
  if (!card) {
    card = document.createElement('div');
    card.className = 'svg-tooltip-card';
    container.appendChild(card);
  }
  return card;
}

function mostrarTooltipCard(e, codigo) {
  const card = getOrCreateTooltipCard();
  if (!card || !STATE.currentCalculation) return;

  let infoHtml = '';

  if (codigo === 'GLASS') {
    const vidrio = STATE.currentCalculation.vidrios[0];
    if (!vidrio) return;
    infoHtml = `
      <h4>Vidrio de Hoja</h4>
      <p>Dimensiones: <strong>${vidrio.ancho} x ${vidrio.alto} mm</strong></p>
      <p>Área: <strong>${vidrio.area} m²</strong></p>
      <p>Cantidad: <strong>${vidrio.cantidad} u</strong></p>
      <p style="color: var(--text-muted); font-size:10px; margin-top:6px;">Inspección de Vidrio Templado</p>
    `;
  } else {
    const perfil = STATE.currentCalculation.perfiles.find(p => p.codigo === codigo);
    if (!perfil) return;
    infoHtml = `
      <h4>${perfil.nombre}</h4>
      <p>Código: <strong class="badge badge-profile">${perfil.codigo}</strong></p>
      <p>Longitud: <strong>${perfil.longitud} mm</strong></p>
      <p>Ángulo de corte: <strong>${perfil.corte}</strong></p>
      <p>Piezas en abertura: <strong>${perfil.cantidad} u</strong></p>
    `;
  }

  card.innerHTML = infoHtml;
  card.style.display = 'block';
  moverTooltipCard(e);
}

function moverTooltipCard(e) {
  const card = getOrCreateTooltipCard();
  if (!card) return;

  const container = document.querySelector('.visualizer-card');
  const rect = container.getBoundingClientRect();

  // Posicionar relativo al contenedor de la vista previa
  const x = e.clientX - rect.left + 15;
  const y = e.clientY - rect.top + 15;

  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
}

function ocultarTooltipCard() {
  const card = getOrCreateTooltipCard();
  if (card) {
    card.style.display = 'none';
  }
}

/* ==================== TABLAS DE RESULTADOS ==================== */

function renderizarTablasResultado(perfiles, vidrios) {
  const tbodyPerfiles = document.getElementById('table-perfiles-body');
  const tbodyVidrios = document.getElementById('table-vidrios-body');

  if (tbodyPerfiles) {
    tbodyPerfiles.innerHTML = '';
    perfiles.forEach(p => {
      const tr = document.createElement('tr');
      tr.className = 'profile-table-row';
      tr.setAttribute('data-codigo', p.codigo);
      tr.innerHTML = `
        <td><span class="badge badge-profile">${p.codigo}</span></td>
        <td><strong>${p.nombre}</strong></td>
        <td>${p.cantidad}</td>
        <td><strong>${p.longitud} mm</strong></td>
        <td>${p.corte}</td>
      `;
      tbodyPerfiles.appendChild(tr);
    });
  }

  if (tbodyVidrios) {
    tbodyVidrios.innerHTML = '';
    vidrios.forEach(v => {
      const tr = document.createElement('tr');
      tr.className = 'profile-table-row';
      tr.setAttribute('data-codigo', 'GLASS');
      tr.innerHTML = `
        <td><span class="badge badge-glass">VIDRIO</span></td>
        <td><strong>${v.nombre}</strong></td>
        <td>${v.cantidad}</td>
        <td><strong>${v.ancho} x ${v.alto} mm</strong></td>
        <td>${v.area} m²</td>
      `;
      tbodyVidrios.appendChild(tr);
    });
  }
}


function agregarVentanaAlEstado() {
  if (!STATE.currentCalculation) return;

  const item = {
    id: Date.now(),
    ...STATE.currentCalculation
  };

  STATE.items.push(item);
  showToast(`Ventana "${item.nombre}" agregada al proyecto.`, 'success');

  // Limpiar/reiniciar algunos campos del formulario para facilitar otra entrada
  document.getElementById('config-nombre').value = 'Ventana ' + (STATE.items.length + 1);

  // Actualizar listas en las otras pantallas
  actualizarContadorSidebar();
  actualizarCalculoConfigurador();
}

function actualizarContadorSidebar() {
  const contador = document.getElementById('items-count-badge');
  if (contador) {
    contador.textContent = STATE.items.length;
    contador.style.display = STATE.items.length > 0 ? 'inline-block' : 'none';
  }
  
  // Actualizar módulos dependientes
  if (typeof renderizarInventario === 'function') renderizarInventario();
  if (typeof renderizarFacturaPreview === 'function') renderizarFacturaPreview();
}

/* ==================== 3. OPTIMIZADOR DE CORTES ==================== */
function prepararOptimizador() {
  const listContainer = document.getElementById('optimizador-input-list');
  if (!listContainer) return;

  listContainer.innerHTML = '';

  if (STATE.items.length === 0) {
    listContainer.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 20px;">
      Primero agrega ventanas en la sección de Configurador o importa un diseño JSON.
    </p>`;
    return;
  }

  // Agrupar todos los perfiles de todas las aberturas ingresadas
  const perfilesAgrupados = {};

  STATE.items.forEach(item => {
    item.perfiles.forEach(p => {
      const key = `${p.codigo}_${p.longitud}`;
      if (!perfilesAgrupados[key]) {
        perfilesAgrupados[key] = {
          nombre: p.nombre,
          longitud: p.longitud,
          codigo: p.codigo,
          cantidad: 0
        };
      }
      perfilesAgrupados[key].cantidad += (p.cantidad * item.cantidad);
    });
  });

  // Renderizar filas de insumos a optimizar
  Object.values(perfilesAgrupados).forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'cut-input-row';
    row.innerHTML = `
      <input type="text" class="form-input" value="${p.nombre} (${p.codigo})" readonly>
      <input type="number" class="form-input" id="opt-len-${idx}" value="${p.longitud}" readonly>
      <input type="number" class="form-input opt-qty" id="opt-qty-${idx}" value="${p.cantidad}" min="1">
      <span style="font-size: 11px; color: var(--text-muted); text-align: right;">pzs</span>
    `;
    // Guardar referencia técnica en atributos de la cantidad
    const qtyInput = row.querySelector('.opt-qty');
    qtyInput.dataset.nombre = p.nombre;
    qtyInput.dataset.longitud = p.longitud;
    qtyInput.dataset.codigo = p.codigo;

    listContainer.appendChild(row);
  });

  // Listener para el botón "Ejecutar Optimización"
  const btnOpt = document.getElementById('btn-ejecutar-optimizacion');
  if (btnOpt) {
    btnOpt.onclick = ejecutarOptimizadorFront;
  }
}

function ejecutarOptimizadorFront() {
  const largoStock = parseInt(document.getElementById('opt-largo-stock').value) || 6000;
  const espesorDisco = parseInt(document.getElementById('opt-espesor-sierra').value) || 4;

  const qtyInputs = document.querySelectorAll('.opt-qty');
  const cortes = [];

  qtyInputs.forEach(input => {
    const cant = parseInt(input.value) || 0;
    if (cant > 0) {
      cortes.push({
        nombre: input.dataset.nombre,
        longitud: parseInt(input.dataset.longitud),
        grupo: input.dataset.codigo,
        cantidad: cant
      });
    }
  });

  if (cortes.length === 0) {
    showToast('No hay cortes válidos para optimizar', 'error');
    return;
  }

  // Ejecutar algoritmo de optimizer.js
  const resultados = optimizarCortes(cortes, largoStock, espesorDisco);

  // Renderizar estadísticas de optimización
  document.getElementById('opt-stat-barras').textContent = resultados.totalBarras;
  document.getElementById('opt-stat-eficiencia').textContent = `${resultados.eficienciaGeneral}%`;
  document.getElementById('opt-stat-utilizado').textContent = `${resultados.longitudUtilizadaM} m`;
  document.getElementById('opt-stat-desperdicio').textContent = `${resultados.desperdicioTotalM} m`;

  // Renderizar las barras visuales
  renderizarBarrasOptimizadas(resultados, largoStock, espesorDisco);
  showToast('Optimización completada con éxito', 'success');
}

function renderizarBarrasOptimizadas(resultados, largoStock, espesorDisco) {
  const container = document.getElementById('opt-barras-visualizador');
  if (!container) return;

  container.innerHTML = '';

  // Colores para las piezas
  const coloresSegmento = [
    '#0ea5e9', // celeste
    '#14b8a6', // verde azulado
    '#a855f7', // violeta
    '#f97316', // naranja
    '#3b82f6', // azul royal
    '#10b981', // esmeralda
    '#f59e0b'  // ambar
  ];

  let colorIdx = 0;
  const mapaColores = {}; // CódigoPerfil -> Color

  // Iterar sobre cada grupo de perfiles
  for (const [codigoGrupo, info] of Object.entries(resultados.grupos)) {
    const groupHeader = document.createElement('h3');
    groupHeader.style.margin = '20px 0 10px 0';
    groupHeader.style.fontSize = '16px';
    groupHeader.style.color = 'var(--text-primary)';
    groupHeader.innerHTML = `${info.nombre} <span style="color: var(--accent-blue); font-size:12px;">[Perfil ${codigoGrupo} - Eficiencia: ${info.eficiencia}%]</span>`;
    container.appendChild(groupHeader);

    if (!mapaColores[codigoGrupo]) {
      mapaColores[codigoGrupo] = coloresSegmento[colorIdx % coloresSegmento.length];
      colorIdx++;
    }
    const colorPieza = mapaColores[codigoGrupo];

    // Dibujar cada barra de este grupo
    info.barras.forEach(bar => {
      const row = document.createElement('div');
      row.className = 'bar-row';
      row.style.marginBottom = '12px';

      const header = document.createElement('div');
      header.className = 'bar-header';
      header.innerHTML = `
        <span>Barra #${bar.id} de stock (6.0m)</span>
        <span class="efficiency">Eficiencia: ${bar.eficiencia}%</span>
      `;
      row.appendChild(header);

      const progress = document.createElement('div');
      progress.className = 'bar-progress';

      // Dibujar las piezas dentro de la barra
      bar.piezas.forEach(pieza => {
        const pct = (pieza.longitud / largoStock) * 100;
        const seg = document.createElement('div');
        seg.className = 'cut-segment';
        seg.style.width = `${pct}%`;
        seg.style.backgroundColor = colorPieza;
        seg.textContent = `${pieza.longitud}`;
        
        // Tooltip
        const tooltip = document.createElement('span');
        tooltip.className = 'tooltip';
        tooltip.textContent = `${pieza.nombre}: ${pieza.longitud} mm`;
        seg.appendChild(tooltip);

        progress.appendChild(seg);

        // Si hay espacio para el disco de corte y no es la última pieza, dibujar marca de corte
        // (Visualmente lo simplificamos metiendo el corte en el cálculo o ignorándolo en el progreso visual)
      });

      // Dibujar sobrante/desperdicio en la barra
      if (bar.espacioLibre > 0) {
        const pctLibre = (bar.espacioLibre / largoStock) * 100;
        const segLibre = document.createElement('div');
        segLibre.className = 'cut-segment waste-segment';
        segLibre.style.width = `${pctLibre}%`;
        segLibre.textContent = `${bar.espacioLibre}`;

        const tooltip = document.createElement('span');
        tooltip.className = 'tooltip';
        tooltip.textContent = `Desperdicio / Retal: ${bar.espacioLibre} mm`;
        segLibre.appendChild(tooltip);

        progress.appendChild(segLibre);
      }

      row.appendChild(progress);
      container.appendChild(row);
    });
  }
}

/* ==================== 4. PRESUPUESTO & EXPORTACIÓN ==================== */
function initBudgetSettings() {
  // Configurar valores por defecto en los inputs de precios
  const keys = [
    { id: 'price-aluminio', key: 'aluminioMetro' },
    { id: 'price-aluminio-puerta', key: 'aluminioPuertaMetro' },
    { id: 'price-aluminio-cabina', key: 'aluminioCabinaMetro' },
    { id: 'price-tubo-cabina', key: 'tuboAceroCabinaMetro' },
    { id: 'price-vidrio', key: 'vidrioM2' },
    { id: 'price-vidrio-cabina', key: 'vidrioTempladoCabinaM2' },
    { id: 'price-acc-corrediza', key: 'accesoriosCorrediza' },
    { id: 'price-acc-puerta-corrediza', key: 'accesoriosPuertaCorrediza' },
    { id: 'price-acc-cabina-perfil', key: 'accesoriosCabinaPerfil' },
    { id: 'price-acc-cabina-templada', key: 'accesoriosCabinaTemplada' },
    { id: 'price-acc-abatible', key: 'accesoriosAbatible' },
    { id: 'price-acc-puerta-abatible', key: 'accesoriosPuertaAbatible' },
    { id: 'price-acc-fijo', key: 'accesoriosFijo' },
    { id: 'price-sellador', key: 'selladorMetro' },
    { id: 'price-tornilleria', key: 'tornilleriaUnidad' },
    { id: 'price-empaquetadura', key: 'empaquetaduraMetro' },
    { id: 'price-mano-obra', key: 'manoObraPorcentaje' },
    { id: 'price-ganancia', key: 'margenGanancia' }
  ];

  keys.forEach(k => {
    const el = document.getElementById(k.id);
    if (el) {
      el.value = STATE.precios[k.key];
      el.addEventListener('input', () => {
        STATE.precios[k.key] = parseFloat(el.value) || 0;
        renderizarPresupuesto(); // Recalcular presupuesto inmediatamente
      });
    }
  });

  const btnPrint = document.getElementById('btn-imprimir-presupuesto');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  const btnToInvoice = document.getElementById('btn-presupuesto-a-factura');
  if (btnToInvoice) {
    btnToInvoice.addEventListener('click', () => {
      const menuFacturacion = document.getElementById('menu-facturacion');
      if (menuFacturacion) {
        menuFacturacion.click();
      }
    });
  }
}

function renderizarPresupuesto() {
  const tbody = document.getElementById('table-presupuesto-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (STATE.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 20px;">
      No hay aberturas en el proyecto. Agrega aberturas en el Configurador para calcular el costo.
    </td></tr>`;
    
    // Limpiar totales
    document.getElementById('tot-materiales').textContent = formatearMoneda(0);
    document.getElementById('tot-mano-obra').textContent = formatearMoneda(0);
    document.getElementById('tot-produccion').textContent = formatearMoneda(0);
    document.getElementById('tot-ganancia').textContent = formatearMoneda(0);
    document.getElementById('tot-venta-final').textContent = formatearMoneda(0);
    return;
  }

  // Calcular usando budget.js
  const pres = calcularPresupuesto(STATE.items, STATE.precios);

  // Renderizar filas detalladas
  pres.detalles.forEach(d => {
    let catLabel = 'Ventana';
    if (d.categoria === 'puerta') {
      catLabel = 'Puerta';
    } else if (d.categoria === 'cabina_baño') {
      catLabel = d.estiloCabina === 'solo_vidrio' ? 'Cabina Templada' : 'Cabina con Perfil';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${catLabel} #${d.id} (${d.tipo.toUpperCase()})</strong></td>
      <td>${d.ancho}x${d.alto} mm</td>
      <td>${d.cantidad}</td>
      <td>${d.aluminioM} m</td>
      <td>${d.vidrioM2} m²</td>
      <td>${d.selladoresM} m</td>
      <td><strong>${formatearMoneda(d.costoMateriales)}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  // Renderizar totales acumulados
  document.getElementById('tot-materiales').textContent = formatearMoneda(pres.totalMateriales);
  document.getElementById('tot-mano-obra').textContent = formatearMoneda(pres.manoObra);
  document.getElementById('tot-produccion').textContent = formatearMoneda(pres.costoProduccion);
  document.getElementById('tot-ganancia').textContent = formatearMoneda(pres.ganancia);
  document.getElementById('tot-venta-final').textContent = formatearMoneda(pres.precioVentaFinal);
}

/* ==================== 5. CLAUDE SKILL & INTEGRACIÓN ==================== */
function renderizarClaudeSkill() {
  const codeContainer = document.getElementById('skill-code-block');
  if (codeContainer) {
    // Intentar leer de un textarea estático o directamente del JS
    codeContainer.textContent = SKILL_MARKDOWN;
  }

  const btnCopy = document.getElementById('btn-copy-skill');
  if (btnCopy) {
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(SKILL_MARKDOWN)
        .then(() => showToast('Skill copiado al portapapeles', 'success'))
        .catch(() => showToast('Error al copiar', 'error'));
    };
  }
}

function initImportListeners() {
  const btnImport = document.getElementById('btn-importar-json');
  if (btnImport) {
    btnImport.addEventListener('click', () => {
      const textarea = document.getElementById('import-json-textarea');
      if (!textarea) return;

      const rawVal = textarea.value.trim();
      if (!rawVal) {
        showToast('Pega un JSON válido primero', 'error');
        return;
      }

      try {
        const parsed = JSON.parse(rawVal);
        
        // Verificar que sea un objeto simple o una lista
        const items = Array.isArray(parsed) ? parsed : [parsed];
        
        items.forEach(data => {
          if (!data.tipo || !data.ancho || !data.alto) {
            throw new Error('El JSON no tiene la estructura requerida (tipo, ancho, alto)');
          }

          // Realizar el cálculo geométrico de perfiles
          const calcResult = calcularVentana(data.tipo, data.ancho, data.alto);
          
          STATE.items.push({
            id: Date.now() + Math.random(),
            nombre: data.nombre || `Ventana ${data.tipo} (Importada)`,
            tipo: data.tipo,
            width: data.ancho,
            height: data.alto,
            cantidad: data.cantidad || 1,
            perfiles: calcResult.perfiles,
            vidrios: calcResult.vidrios
          });
        });

        actualizarContadorSidebar();
        textarea.value = '';
        showToast(`Importación exitosa: ${items.length} aberturas añadidas.`, 'success');
        
        // Redirigir al configurador
        document.querySelector('[data-tab="configurador"]').click();
        actualizarCalculoConfigurador();
      } catch (err) {
        showToast(`Error de importación: ${err.message}`, 'error');
      }
    });
  }
}

/* ==================== UTILS & NOTIFICACIONES ==================== */
function showToast(message, type = 'success') {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function varCss(variable) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

/**
 * Dibuja líneas diagonales de inglete en las esquinas de un perfil para simular el corte a 45°.
 */
function dibujarLineasInglete(g, x, y, w, h, thickness) {
  const color = 'rgba(255, 255, 255, 0.35)';
  const t = thickness;
  const lines = [
    // Top-Left
    `M ${x} ${y} L ${x + t} ${y + t}`,
    // Top-Right
    `M ${x + w} ${y} L ${x + w - t} ${y + t}`,
    // Bottom-Left
    `M ${x} ${y + h} L ${x + t} ${y + h - t}`,
    // Bottom-Right
    `M ${x + w} ${y + h} L ${x + w - t} ${y + h - t}`
  ];
  
  lines.forEach(d => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round');
    g.appendChild(path);
  });
}
