/**
 * Alumital SAS - Calculador de Presupuestos
 * Gestiona los precios unitarios, costos de materiales, mano de obra y márgenes de ganancia.
 */

// Lista de precios por defecto (editable por el usuario en la interfaz)
const PRECIOS_DEFECTO = {
  aluminioMetro: 25000,             // COP por metro (ventana standard)
  aluminioPuertaMetro: 32000,       // COP por metro (puerta pesada)
  aluminioCabinaMetro: 22000,       // COP por metro (cabina aluminio)
  tuboAceroCabinaMetro: 45000,      // COP por metro (tubo acero inox)
  vidrioMonoliticoM2: 50000,        // COP por m² de vidrio monolítico
  vidrioTempladoM2: 80000,          // COP por m² de vidrio templado
  vidrioLaminadoM2: 120000,         // COP por m² de vidrio laminado
  vidrioDvhM2: 180000,              // COP por m² de vidrio DVH
  accesoriosCorrediza: 35000,        // COP por kit ventana corrediza
  accesoriosPuertaCorrediza: 65000, // COP por kit puerta corrediza
  accesoriosCabinaPerfil: 40000,    // COP por kit accesorios cabina con perfil
  accesoriosCabinaTemplada: 180000, // COP por kit accesorios cabina solo vidrio
  accesoriosAbatible: 45000,         // COP por kit ventana abatible
  accesoriosPuertaAbatible: 75000,   // COP por kit puerta abatible
  accesoriosFijo: 10000,             // COP por kit fijo
  selladorMetro: 4000,               // COP por metro
  tornilleriaUnidad: 15000,          // COP por ventana/puerta/cabina
  empaquetaduraMetro: 2500,          // COP por metro lineal de goma/empaque
  manoObraPorcentaje: 30,            // % mano de obra
  margenGanancia: 40                 // % ganancia
};

/**
 * Calcula el desglose detallado de costos para una lista de ventanas.
 * @param {Array} itemsVentanas - Lista de ventanas configuradas { tipo, width, height, cantidad, perfiles, vidrios }
 * @param {Object} preciosConfig - Configuración de precios personalizada (opcional)
 * @returns {Object} Desglose completo de materiales y costos finales
 */
function calcularPresupuesto(itemsVentanas, preciosConfig = PRECIOS_DEFECTO) {
  let costoAluminio = 0;
  let costoVidrio = 0;
  let costoAccesorios = 0;
  let costoSelladores = 0;
  let costoTornilleria = 0;
  let costoEmpaquetadura = 0;

  let totalMetrosAluminio = 0;
  let totalM2Vidrio = 0;
  let totalKitsAccesorios = 0;
  let totalMetrosSellador = 0;
  let totalUnidadesTornilleria = 0;
  let totalMetrosEmpaquetadura = 0;
  let totalPesoVidrio = 0;

  const desgloseDetallado = [];

  itemsVentanas.forEach((item, index) => {
    const qty = item.cantidad || 1;
    let costoItemAluminio = 0;
    let costoItemVidrio = 0;
    let costoItemAccesorios = 0;
    let costoItemSelladores = 0;
    let costoItemTornilleria = 0;
    let costoItemEmpaquetadura = 0;

    // 1. Aluminio (Costo diferenciado por categoría: ventana, puerta o cabina)
    let metrosAluminioItem = 0;
    item.perfiles.forEach(p => {
      const metros = (p.longitud * p.cantidad) / 1000;
      metrosAluminioItem += metros;
      
      let precioMetro = preciosConfig.aluminioMetro;
      if (item.categoria === 'cabina_baño') {
        precioMetro = (p.codigo === 'TU-01') 
                      ? (preciosConfig.tuboAceroCabinaMetro || 45000) 
                      : (preciosConfig.aluminioCabinaMetro || 22000);
      } else if (p.codigo.endsWith('-P') || (p.tipo === 'hoja' && item.categoria === 'puerta')) {
        precioMetro = preciosConfig.aluminioPuertaMetro || 32000;
      }
      
      costoItemAluminio += metros * qty * precioMetro;
    });

    const metrosAluminioTotal = metrosAluminioItem * qty;

    // 2. Vidrio (Costo diferenciado por Tipo de Vidrio y Color)
    let m2VidrioItem = 0;
    item.vidrios.forEach(v => {
      const m2 = ((v.ancho * v.alto) / 1000000) * v.cantidad;
      m2VidrioItem += m2;

      // Obtener el precio base según el tipo de vidrio
      let precioBase = 80000;
      if (item.categoria === 'cabina_baño' && item.estiloCabina === 'solo_vidrio') {
        precioBase = preciosConfig.vidrioTempladoM2 || 80000; // cabina solo vidrio usa templado
      } else {
        if (v.tipo === 'monolitico') {
          precioBase = preciosConfig.vidrioMonoliticoM2 || 50000;
        } else if (v.tipo === 'templado') {
          precioBase = preciosConfig.vidrioTempladoM2 || 80000;
        } else if (v.tipo === 'laminado') {
          precioBase = preciosConfig.vidrioLaminadoM2 || 120000;
        } else if (v.tipo === 'dvh') {
          precioBase = preciosConfig.vidrioDvhM2 || 180000;
        }
      }

      // Aplicar recargo por color
      let factorColor = 1.0;
      if (v.color === 'bronce' || v.color === 'gris') {
        factorColor = 1.15; // 15% recargo
      } else if (v.color === 'opalizado' || v.color === 'azul') {
        factorColor = 1.25; // 25% recargo
      } else if (v.color === 'reflectivo') {
        factorColor = 1.40; // 40% recargo
      }

      costoItemVidrio += m2 * qty * precioBase * factorColor;
    });
    const m2VidrioTotal = m2VidrioItem * qty;

    // 3. Accesorios (Kit diferenciado para cabinas y puertas)
    let kitsAccesoriosItem = 0;
    const isPuerta = item.categoria === 'puerta';
    const isCabina = item.categoria === 'cabina_baño';

    if (item.tipo === 'corrediza' || item.tipo === 'corrediza3' || item.tipo === 'corrediza4') {
      const numH = item.tipo === 'corrediza4' ? 4 : (item.tipo === 'corrediza3' ? 3 : 2);
      kitsAccesoriosItem = numH;
      let precioAcc = preciosConfig.accesoriosCorrediza;
      if (isCabina) {
        precioAcc = (item.estiloCabina === 'solo_vidrio') 
                    ? (preciosConfig.accesoriosCabinaTemplada || 180000) 
                    : (preciosConfig.accesoriosCabinaPerfil || 40000);
      } else if (isPuerta) {
        precioAcc = preciosConfig.accesoriosPuertaCorrediza || 65000;
      }
      costoItemAccesorios = kitsAccesoriosItem * qty * precioAcc;
    } else if (item.tipo === 'abatible') {
      kitsAccesoriosItem = 1;
      let precioAcc = preciosConfig.accesoriosAbatible;
      if (isCabina) {
        precioAcc = (item.estiloCabina === 'solo_vidrio') 
                    ? (preciosConfig.accesoriosCabinaTemplada || 180000) 
                    : (preciosConfig.accesoriosCabinaPerfil || 40000);
      } else if (isPuerta) {
        precioAcc = preciosConfig.accesoriosPuertaAbatible || 75000;
      }
      costoItemAccesorios = kitsAccesoriosItem * qty * precioAcc;
    } else {
      // Paño Fijo
      kitsAccesoriosItem = 1;
      let precioAcc = preciosConfig.accesoriosFijo;
      if (isCabina) {
        precioAcc = (item.estiloCabina === 'solo_vidrio') 
                    ? (preciosConfig.accesoriosCabinaTemplada || 180000) 
                    : (preciosConfig.accesoriosCabinaPerfil || 40000);
      }
      costoItemAccesorios = kitsAccesoriosItem * qty * precioAcc;
    }
    const kitsAccesoriosTotal = kitsAccesoriosItem * qty;

    // 4. Selladores/Burletes (perímetro del vidrio para sellar)
    let metrosSelladorItem = 0;
    item.vidrios.forEach(v => {
      // Perímetro del vidrio * 2 (por ambos lados o canal de goma)
      metrosSelladorItem += (((v.ancho + v.alto) * 2) / 1000) * v.cantidad;
    });
    const metrosSelladorTotal = metrosSelladorItem * qty;
    costoItemSelladores = metrosSelladorTotal * preciosConfig.selladorMetro;

    // 5. Tornillería y Empaquetadura
    // Tornillería por unidad (cantidad de ventanas en este ítem)
    costoItemTornilleria = qty * (preciosConfig.tornilleriaUnidad || 15000);
    const unidadesTornilleriaTotal = qty;

    // Empaquetadura: se asume similar al perímetro del vidrio
    costoItemEmpaquetadura = metrosSelladorTotal * (preciosConfig.empaquetaduraMetro || 2500);
    const metrosEmpaquetaduraTotal = metrosSelladorTotal;

    // Calcular peso total de vidrio del ítem
    let pesoVidrioItem = 0;
    item.vidrios.forEach(v => {
      pesoVidrioItem += (v.pesoKg || 0);
    });
    const pesoVidrioTotal = pesoVidrioItem * qty;
    totalPesoVidrio += pesoVidrioTotal;

    // Sumar a totales globales
    totalMetrosAluminio += metrosAluminioTotal;
    totalM2Vidrio += m2VidrioTotal;
    totalKitsAccesorios += kitsAccesoriosTotal;
    totalMetrosSellador += metrosSelladorTotal;
    totalUnidadesTornilleria += unidadesTornilleriaTotal;
    totalMetrosEmpaquetadura += metrosEmpaquetaduraTotal;

    costoAluminio += costoItemAluminio;
    costoVidrio += costoItemVidrio;
    costoAccesorios += costoItemAccesorios;
    costoSelladores += costoItemSelladores;
    costoTornilleria += costoItemTornilleria;
    costoEmpaquetadura += costoItemEmpaquetadura;

    const subtotalItemMat = costoItemAluminio + costoItemVidrio + costoItemAccesorios + costoItemSelladores + costoItemTornilleria + costoItemEmpaquetadura;

    desgloseDetallado.push({
      id: index + 1,
      categoria: item.categoria || 'ventana',
      estiloCabina: item.estiloCabina || 'con_perfil',
      tipo: item.tipo,
      ancho: item.width,
      alto: item.height,
      cantidad: qty,
      aluminioM: parseFloat(metrosAluminioTotal.toFixed(2)),
      vidrioM2: parseFloat(m2VidrioTotal.toFixed(2)),
      pesoVidrioKg: parseFloat(pesoVidrioTotal.toFixed(2)),
      costoVidrio: parseFloat(costoItemVidrio.toFixed(2)),
      tipoVidrio: item.tipoVidrio || 'monolitico',
      espesorVidrio: item.espesorVidrio || '4',
      colorVidrio: item.colorVidrio || 'claro',
      accesoriosCant: kitsAccesoriosTotal,
      selladoresM: parseFloat(metrosSelladorTotal.toFixed(2)),
      costoMateriales: parseFloat(subtotalItemMat.toFixed(2))
    });
  });

  // Costo Total de Materiales
  const totalMateriales = costoAluminio + costoVidrio + costoAccesorios + costoSelladores + costoTornilleria + costoEmpaquetadura;

  // Mano de Obra
  const manoObra = totalMateriales * (preciosConfig.manoObraPorcentaje / 100);

  // Costo Total de Producción
  const costoProduccion = totalMateriales + manoObra;

  // Margen de Ganancia
  const ganancia = costoProduccion * (preciosConfig.margenGanancia / 100);

  // Precio de Venta al Cliente
  const precioVentaFinal = costoProduccion + ganancia;

  return {
    detalles: desgloseDetallado,
    totalPesoVidrio: parseFloat(totalPesoVidrio.toFixed(2)),
    materiales: {
      aluminio: { cant: parseFloat(totalMetrosAluminio.toFixed(2)), costo: parseFloat(costoAluminio.toFixed(2)) },
      vidrio: { cant: parseFloat(totalM2Vidrio.toFixed(2)), costo: parseFloat(costoVidrio.toFixed(2)) },
      accesorios: { cant: totalKitsAccesorios, costo: parseFloat(costoAccesorios.toFixed(2)) },
      sellador: { cant: parseFloat(totalMetrosSellador.toFixed(2)), costo: parseFloat(costoSelladores.toFixed(2)) },
      tornilleria: { cant: totalUnidadesTornilleria, costo: parseFloat(costoTornilleria.toFixed(2)) },
      empaquetadura: { cant: parseFloat(totalMetrosEmpaquetadura.toFixed(2)), costo: parseFloat(costoEmpaquetadura.toFixed(2)) }
    },
    totalMateriales: parseFloat(totalMateriales.toFixed(2)),
    manoObra: parseFloat(manoObra.toFixed(2)),
    costoProduccion: parseFloat(costoProduccion.toFixed(2)),
    ganancia: parseFloat(ganancia.toFixed(2)),
    precioVentaFinal: parseFloat(precioVentaFinal.toFixed(2))
  };
}

/**
 * Formatea un valor a formato moneda local.
 * @param {number} valor - El monto numérico
 * @returns {string} Valor formateado, e.g. "$1,250.00"
 */
function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(valor);
}

// Exportación global
window.calcularPresupuesto = calcularPresupuesto;
window.PRECIOS_DEFECTO = PRECIOS_DEFECTO;
window.formatearMoneda = formatearMoneda;
