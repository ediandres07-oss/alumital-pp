/**
 * Alumital SAS - Calculador de Carpintería de Aluminio
 * Contiene las fórmulas geométricas para calcular los perfiles y vidrios.
 */

// Configuración de Sistemas de Perfiles del catálogo Alumina
const SISTEMAS_PERFIL = {
  'VC5020_90': {
    nombre: 'Sistema VC5020 - 90° (Junta Recta)',
    ensamble: '90',
    marcoEspesor: 50,
    holguraHojaVertical: 32,
    traslapeHojaHorizontal: 16,
    descuentoVidrioAncho: 48,
    descuentoVidrioAlto: 48,
    descuentoHojaHorizontal90: 52 // Descuento horizontal de la nave para el ensamble a 90°
  },
  'VP3831_45': {
    nombre: 'Sistema VP3831 - 45° (Inglete)',
    ensamble: '45',
    marcoEspesor: 38,
    holguraHojaVertical: 38,
    traslapeHojaHorizontal: 10,
    descuentoVidrioAncho: 60,
    descuentoVidrioAlto: 60,
    descuentoHojaHorizontal90: 0
  },
  'PC8025_45': {
    nombre: 'Sistema PC8025 - 45° (Inglete)',
    ensamble: '45',
    marcoEspesor: 80,
    holguraHojaVertical: 60,
    traslapeHojaHorizontal: 20,
    descuentoVidrioAncho: 60,
    descuentoVidrioAlto: 60,
    descuentoHojaHorizontal90: 0
  },
  'PC8025_90': {
    nombre: 'Sistema PC8025 - 90° (Junta Recta)',
    ensamble: '90',
    marcoEspesor: 80,
    holguraHojaVertical: 60,
    traslapeHojaHorizontal: 20,
    descuentoVidrioAncho: 60,
    descuentoVidrioAlto: 60,
    descuentoHojaHorizontal90: 54 // Descuento horizontal de la nave para ensamble recto
  },
  'PC7038_45': {
    nombre: 'Sistema PC7038 - 45° (Inglete)',
    ensamble: '45',
    marcoEspesor: 70,
    holguraHojaVertical: 70,
    traslapeHojaHorizontal: 24,
    descuentoVidrioAncho: 80,
    descuentoVidrioAlto: 80,
    descuentoHojaHorizontal90: 0
  },
  'PC7038_90': {
    nombre: 'Sistema PC7038 - 90° (Junta Recta)',
    ensamble: '90',
    marcoEspesor: 70,
    holguraHojaVertical: 70,
    traslapeHojaHorizontal: 24,
    descuentoVidrioAncho: 80,
    descuentoVidrioAlto: 80,
    descuentoHojaHorizontal90: 76 // Descuento horizontal de la nave para ensamble recto
  }
};

/**
 * Calcula los perfiles y vidrios requeridos para una ventana.
 * @param {string} tipo - 'corrediza' | 'abatible' | 'fijo'
 * @param {number} width - Ancho total en mm
 * @param {number} height - Alto total en mm
 * @param {string} sistemaId - ID de configuración del sistema (ej: 'VC5020_90')
 * @returns {object} { perfiles: Array, vidrios: Array }
 */
function calcularVentana(tipo, width, height, sistemaId = 'VC5020_90', categoria = 'ventana', estiloCabina = 'con_perfil', tipoVidrio = 'monolitico', espesorVidrio = '4', colorVidrio = 'claro') {
  const perfiles = [];
  const vidrios = [];

  if (categoria === 'cabina_baño') {
    const numHojas = tipo === 'corrediza4' ? 4 : (tipo === 'corrediza3' ? 3 : 2);
    
    if (estiloCabina === 'solo_vidrio') {
      // 1. Cabina Templada (Solo Vidrio)
      if (tipo === 'corrediza' || tipo === 'corrediza3' || tipo === 'corrediza4') {
        // Tubo de acero superior
        perfiles.push({
          nombre: 'Tubo Superior Acero Inoxidable (Riel)',
          cantidad: 1,
          longitud: width,
          corte: '90°/90°',
          codigo: 'TU-01',
          tipo: 'marco'
        });
        // Perfil U de silicona/acoplamiento a pared si aplica
        perfiles.push({
          nombre: 'Perfil U Inox (Jamba Pared)',
          cantidad: 2,
          longitud: height,
          corte: '90°/90°',
          codigo: 'PU-02',
          tipo: 'marco'
        });

        // Vidrios templados (8mm / 10mm)
        const anchoHoja = Math.round((width + 40 * (numHojas - 1)) / numHojas); // 40mm de traslape
        const altoVidrio = height - 40; // Descuento de altura para el herraje colgante del tubo

        vidrios.push({
          nombre: 'Vidrio Templado de Cabina (8mm)',
          cantidad: numHojas,
          ancho: anchoHoja,
          alto: altoVidrio,
          area: parseFloat(((anchoHoja * altoVidrio * numHojas) / 1000000).toFixed(3))
        });
      } else if (tipo === 'abatible') {
        // Bisagras de acero (accesorios). Perfil U de pared.
        perfiles.push({
          nombre: 'Perfil U Inox (Jamba Pared)',
          cantidad: 1,
          longitud: height,
          corte: '90°/90°',
          codigo: 'PU-02',
          tipo: 'marco'
        });

        // Vidrio: 1 hoja abatible o 1 fijo + 1 puerta
        const anchoFijo = Math.round(width * 0.4);
        const anchoPuerta = width - anchoFijo;

        vidrios.push({
          nombre: 'Vidrio Fijo Templado Cabina (8mm)',
          cantidad: 1,
          ancho: anchoFijo,
          alto: height,
          area: parseFloat(((anchoFijo * height) / 1000000).toFixed(3))
        });
        vidrios.push({
          nombre: 'Vidrio Puerta Templada Cabina (8mm)',
          cantidad: 1,
          ancho: anchoPuerta - 10, // Descuento holgura de bisagra
          alto: height - 10,
          area: parseFloat((((anchoPuerta - 10) * (height - 10)) / 1000000).toFixed(3))
        });
      } else {
        // Paño Fijo Templado
        perfiles.push({
          nombre: 'Perfil U Inox (Perímetro)',
          cantidad: 1,
          longitud: width + height * 2,
          corte: '90°/90°',
          codigo: 'PU-02',
          tipo: 'marco'
        });
        vidrios.push({
          nombre: 'Vidrio Fijo Templado Cabina (8mm)',
          cantidad: 1,
          ancho: width - 10,
          alto: height - 10,
          area: parseFloat((((width - 10) * (height - 10)) / 1000000).toFixed(3))
        });
      }
    } else {
      // 2. Cabina Con Perfil de Aluminio (Enmarcada)
      if (tipo === 'corrediza' || tipo === 'corrediza3' || tipo === 'corrediza4') {
        // Marco superior/inferior/jambas
        perfiles.push({
          nombre: 'Cabezal Guía Superior de Cabina',
          cantidad: 1,
          longitud: width,
          corte: '90°/90°',
          codigo: 'CB-01',
          tipo: 'marco'
        });
        perfiles.push({
          nombre: 'Riel Sillar Inferior de Cabina',
          cantidad: 1,
          longitud: width,
          corte: '90°/90°',
          codigo: 'CB-02',
          tipo: 'marco'
        });
        perfiles.push({
          nombre: 'Jamba Lateral de Cabina (Pared)',
          cantidad: 2,
          longitud: height,
          corte: '90°/90°',
          codigo: 'CB-03',
          tipo: 'marco'
        });

        // Hojas
        const altoHoja = height - 50; // Holgura de rieles
        const anchoHoja = Math.round((width + 25 * (numHojas - 1)) / numHojas); // 25mm traslape

        perfiles.push({
          nombre: 'Hoja Jamba Cabina (Verticales)',
          cantidad: numHojas * 2,
          longitud: altoHoja,
          corte: '90°/90°',
          codigo: 'CB-04',
          tipo: 'hoja'
        });
        perfiles.push({
          nombre: 'Hoja Zócalo/Cabezal Cabina (Horizontales)',
          cantidad: numHojas * 2,
          longitud: anchoHoja - 40, // Embutido entre parantes
          corte: '90°/90°',
          codigo: 'CB-05',
          tipo: 'hoja'
        });

        // Vidrios (1 por hoja)
        const anchoVidrio = anchoHoja - 50;
        const altoVidrio = altoHoja - 50;
        vidrios.push({
          nombre: 'Vidrio Templado Cabina (Enmarcado)',
          cantidad: numHojas,
          ancho: anchoVidrio,
          alto: altoVidrio,
          area: parseFloat(((anchoVidrio * altoVidrio * numHojas) / 1000000).toFixed(3))
        });
      } else {
        perfiles.push({
          nombre: 'Marco Perimetral Cabina',
          cantidad: 1,
          longitud: width * 2 + height * 2,
          corte: '45°/45°',
          codigo: 'CB-03',
          tipo: 'marco'
        });
        if (tipo === 'abatible') {
          perfiles.push({
            nombre: 'Hoja Vertical Cabina',
            cantidad: 2,
            longitud: height - 30,
            corte: '45°/45°',
            codigo: 'CB-04',
            tipo: 'hoja'
          });
          perfiles.push({
            nombre: 'Hoja Horizontal Cabina',
            cantidad: 2,
            longitud: width - 30,
            corte: '45°/45°',
            codigo: 'CB-05',
            tipo: 'hoja'
          });
          vidrios.push({
            nombre: 'Vidrio Cabina Enmarcado',
            cantidad: 1,
            ancho: width - 90,
            alto: height - 90,
            area: parseFloat((((width - 90) * (height - 90)) / 1000000).toFixed(3))
          });
        } else {
          vidrios.push({
            nombre: 'Vidrio Cabina Enmarcado',
            cantidad: 1,
            ancho: width - 40,
            alto: height - 40,
            area: parseFloat((((width - 40) * (height - 40)) / 1000000).toFixed(3))
          });
        }
      }
    }
    
    return { perfiles, vidrios };
  }

  const sys = SISTEMAS_PERFIL[sistemaId] || SISTEMAS_PERFIL['7030_45'];
  const ensamble = sys.ensamble;

  if (tipo === 'corrediza' || tipo === 'corrediza3' || tipo === 'corrediza4') {
    const numHojas = tipo === 'corrediza4' ? 4 : (tipo === 'corrediza3' ? 3 : 2);
    // Cálculo de hojas
    const altoHoja = height - sys.holguraHojaVertical;
    const anchoHoja = Math.round((width + sys.traslapeHojaHorizontal * (numHojas - 1)) / numHojas);

    // Perfiles de Marco
    perfiles.push({
      nombre: 'Marco Umbral (Inferior)',
      cantidad: 1,
      longitud: width,
      corte: '90°/90°',
      codigo: 'MU-01',
      tipo: 'marco'
    });
    perfiles.push({
      nombre: 'Marco Dintel (Superior)',
      cantidad: 1,
      longitud: width,
      corte: '90°/90°',
      codigo: 'MD-02',
      tipo: 'marco'
    });
    perfiles.push({
      nombre: 'Marco Jamba (Lateral)',
      cantidad: 2,
      longitud: height,
      corte: '90°/90°',
      codigo: 'MJ-03',
      tipo: 'marco'
    });

    // Perfiles de Hojas
    if (ensamble === '45') {
      perfiles.push({
        nombre: 'Hoja Jamba (Lados de Hoja)',
        cantidad: numHojas * 2,
        longitud: altoHoja,
        corte: '45°/45°',
        codigo: 'HJ-04',
        tipo: 'hoja'
      });
      perfiles.push({
        nombre: categoria === 'puerta' ? 'Hoja Zócalo Alto (Inferior de Puerta)' : 'Hoja Zócalo (Inferior de Hoja)',
        cantidad: numHojas,
        longitud: anchoHoja,
        corte: '45°/45°',
        codigo: categoria === 'puerta' ? 'HZ-05-P' : 'HZ-05',
        tipo: 'hoja'
      });
      perfiles.push({
        nombre: 'Hoja Cabezal (Superior de Hoja)',
        cantidad: numHojas,
        longitud: anchoHoja,
        corte: '45°/45°',
        codigo: 'HC-06',
        tipo: 'hoja'
      });
    } else {
      // Corte a 90° (Junta Recta). Jamba de hoja va entera.
      perfiles.push({
        nombre: 'Hoja Jamba (Lados de Hoja)',
        cantidad: numHojas * 2,
        longitud: altoHoja,
        corte: '90°/90°',
        codigo: 'HJ-04',
        tipo: 'hoja'
      });
      // Zócalo y cabezal van embutidos entre las jambas (descuento del espesor del perfil jamba de este sistema)
      const longitudHorizontal90 = anchoHoja - sys.descuentoHojaHorizontal90;
      perfiles.push({
        nombre: categoria === 'puerta' ? 'Hoja Zócalo Alto (Inferior de Puerta)' : 'Hoja Zócalo (Inferior de Hoja)',
        cantidad: numHojas,
        longitud: longitudHorizontal90,
        corte: '90°/90°',
        codigo: categoria === 'puerta' ? 'HZ-05-P' : 'HZ-05',
        tipo: 'hoja'
      });
      perfiles.push({
        nombre: 'Hoja Cabezal (Superior de Hoja)',
        cantidad: numHojas,
        longitud: longitudHorizontal90,
        corte: '90°/90°',
        codigo: 'HC-06',
        tipo: 'hoja'
      });
    }

    // Vidrios (1 por hoja)
    const anchoVidrio = anchoHoja - sys.descuentoVidrioAncho;
    const altoVidrio = altoHoja - sys.descuentoVidrioAlto;
    
    vidrios.push({
      nombre: tipo === 'corrediza4' ? 'Vidrio Corrediza (4 Hojas)' : (tipo === 'corrediza3' ? 'Vidrio Corrediza (3 Hojas)' : 'Vidrio Principal Corrediza'),
      cantidad: numHojas,
      ancho: anchoVidrio,
      alto: altoVidrio,
      area: parseFloat(((anchoVidrio * altoVidrio * numHojas) / 1000000).toFixed(3))
    });

  } else if (tipo === 'abatible') {
    const altoHoja = height - sys.holguraHojaVertical;
    const anchoHoja = width - sys.holguraHojaVertical; // Para abatible, holgura de marco simétrica

    if (ensamble === '45') {
      // Marco (45°)
      perfiles.push({
        nombre: 'Marco Horizontal',
        cantidad: 2,
        longitud: width,
        corte: '45°/45°',
        codigo: 'MA-01',
        tipo: 'marco'
      });
      perfiles.push({
        nombre: 'Marco Vertical',
        cantidad: 2,
        longitud: height,
        corte: '45°/45°',
        codigo: 'MA-02',
        tipo: 'marco'
      });
      // Hoja (45°)
      if (categoria === 'puerta') {
        perfiles.push({
          nombre: 'Hoja Cabezal (Superior de Hoja)',
          cantidad: 1,
          longitud: anchoHoja,
          corte: '45°/45°',
          codigo: 'HA-03',
          tipo: 'hoja'
        });
        perfiles.push({
          nombre: 'Hoja Zócalo Alto (Inferior de Puerta)',
          cantidad: 1,
          longitud: anchoHoja,
          corte: '45°/45°',
          codigo: 'HA-03-P',
          tipo: 'hoja'
        });
      } else {
        perfiles.push({
          nombre: 'Hoja Horizontal',
          cantidad: 2,
          longitud: anchoHoja,
          corte: '45°/45°',
          codigo: 'HA-03',
          tipo: 'hoja'
        });
      }
      perfiles.push({
        nombre: 'Hoja Vertical',
        cantidad: 2,
        longitud: altoHoja,
        corte: '45°/45°',
        codigo: 'HA-04',
        tipo: 'hoja'
      });
    } else {
      // Ensamble 90° (Junta Recta)
      // Marco Vertical va entero
      perfiles.push({
        nombre: 'Marco Vertical',
        cantidad: 2,
        longitud: height,
        corte: '90°/90°',
        codigo: 'MA-02',
        tipo: 'marco'
      });
      // Marco Horizontal interior (descuenta el perfil del marco jamba, que es igual al espesor del marco de este sistema)
      perfiles.push({
        nombre: 'Marco Horizontal',
        cantidad: 2,
        longitud: width - (sys.marcoEspesor * 2), // Descuenta espesor del marco
        corte: '90°/90°',
        codigo: 'MA-01',
        tipo: 'marco'
      });
      // Hoja Vertical
      perfiles.push({
        nombre: 'Hoja Vertical',
        cantidad: 2,
        longitud: altoHoja,
        corte: '90°/90°',
        codigo: 'HA-04',
        tipo: 'hoja'
      });
      // Hoja Horizontal (descuenta el espesor del perfil vertical)
      if (categoria === 'puerta') {
        perfiles.push({
          nombre: 'Hoja Cabezal (Superior de Hoja)',
          cantidad: 1,
          longitud: anchoHoja - sys.descuentoHojaHorizontal90,
          corte: '90°/90°',
          codigo: 'HA-03',
          tipo: 'hoja'
        });
        perfiles.push({
          nombre: 'Hoja Zócalo Alto (Inferior de Puerta)',
          cantidad: 1,
          longitud: anchoHoja - sys.descuentoHojaHorizontal90,
          corte: '90°/90°',
          codigo: 'HA-03-P',
          tipo: 'hoja'
        });
      } else {
        perfiles.push({
          nombre: 'Hoja Horizontal',
          cantidad: 2,
          longitud: anchoHoja - sys.descuentoHojaHorizontal90,
          corte: '90°/90°',
          codigo: 'HA-03',
          tipo: 'hoja'
        });
      }
    }

    // Vidrio (1 unidad)
    const anchoVidrio = anchoHoja - sys.descuentoVidrioAncho;
    const altoVidrio = altoHoja - sys.descuentoVidrioAlto;
    
    vidrios.push({
      nombre: 'Vidrio Abatible',
      cantidad: 1,
      ancho: anchoVidrio,
      alto: altoVidrio,
      area: parseFloat(((anchoVidrio * altoVidrio) / 1000000).toFixed(3))
    });

  } else if (tipo === 'fijo') {
    if (ensamble === '45') {
      perfiles.push({
        nombre: 'Marco Horizontal (Paño Fijo)',
        cantidad: 2,
        longitud: width,
        corte: '45°/45°',
        codigo: 'MF-01',
        tipo: 'marco'
      });
      perfiles.push({
        nombre: 'Marco Vertical (Paño Fijo)',
        cantidad: 2,
        longitud: height,
        corte: '45°/45°',
        codigo: 'MF-02',
        tipo: 'marco'
      });
    } else {
      // Ensamble 90° (Junta Recta)
      perfiles.push({
        nombre: 'Marco Vertical (Paño Fijo)',
        cantidad: 2,
        longitud: height,
        corte: '90°/90°',
        codigo: 'MF-02',
        tipo: 'marco'
      });
      perfiles.push({
        nombre: 'Marco Horizontal (Paño Fijo)',
        cantidad: 2,
        longitud: width - (sys.marcoEspesor * 2), // Descuenta el espesor del marco de este sistema
        corte: '90°/90°',
        codigo: 'MF-01',
        tipo: 'marco'
      });
    }

    // Vidrio (1 unidad encastrada en el marco)
    const anchoVidrio = width - sys.descuentoVidrioAncho;
    const altoVidrio = height - sys.descuentoVidrioAlto;

    vidrios.push({
      nombre: 'Vidrio Paño Fijo',
      cantidad: 1,
      ancho: anchoVidrio,
      alto: altoVidrio,
      area: parseFloat(((anchoVidrio * altoVidrio) / 1000000).toFixed(3))
    });
  }

  // Enriquecer y calcular peso de los vidrios al final
  const espesorNum = parseFloat(espesorVidrio) || 4;
  vidrios.forEach(v => {
    v.tipo = tipoVidrio;
    v.espesor = espesorVidrio;
    v.color = colorVidrio;

    // Calcular espesor real del vidrio para el peso
    let espesorReal = espesorNum;
    if (espesorVidrio.includes('+')) {
      espesorReal = espesorVidrio.split('+').reduce((a, b) => parseFloat(a) + parseFloat(b), 0);
    } else if (espesorVidrio.includes('-')) {
      const parts = espesorVidrio.split('-');
      espesorReal = parseFloat(parts[0]) + parseFloat(parts[parts.length - 1]);
    }

    // Fórmula física de peso (kg) = Ancho(m) * Alto(m) * Cantidad * Espesor(mm) * 2.5 (densidad)
    const peso = ((v.ancho / 1000) * (v.alto / 1000)) * v.cantidad * espesorReal * 2.5;
    v.pesoKg = parseFloat(peso.toFixed(2));
  });

  return { perfiles, vidrios };
}

// Exportamos las funciones globalmente para uso en otros archivos
window.calcularVentana = calcularVentana;
window.SISTEMAS_PERFIL = SISTEMAS_PERFIL;
