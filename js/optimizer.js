/**
 * Alumital SAS - Optimizador de Corte de Aluminio 1D
 * Implementa el algoritmo First-Fit Decreasing (FFD) considerando el espesor del disco de corte.
 */

/**
 * Optimiza la lista de cortes para barras de stock estándar.
 * @param {Array} cortesSolicitados - Array de objetos { longitud: number, cantidad: number, grupo: string, nombre: string }
 * @param {number} largoBarraStock - Largo de las barras de stock (ej. 6000 mm)
 * @param {number} espesorDisco - Espesor del disco de sierra (ej. 4 mm)
 * @returns {Object} Resultados de optimización agrupados por perfil
 */
function optimizarCortes(cortesSolicitados, largoBarraStock = 6000, espesorDisco = 4) {
  // 1. Agrupar los cortes por grupo (por ejemplo, por código de perfil o nombre)
  const grupos = {};
  cortesSolicitados.forEach(c => {
    if (c.cantidad <= 0 || c.longitud <= 0) return;
    const key = c.grupo || c.nombre;
    if (!grupos[key]) {
      grupos[key] = {
        nombre: c.nombre,
        grupo: key,
        cortes: []
      };
    }
    grupos[key].cortes.push({ ...c });
  });

  const resultados = {};
  let totalBarrasGeneral = 0;
  let desperdicioTotalGeneral = 0; // en mm
  let longitudUtilizadaGeneral = 0; // en mm

  // 2. Optimizar cada grupo de perfiles por separado (no se mezclan marcos con hojas)
  for (const [key, grupoInfo] of Object.entries(grupos)) {
    // Expandir las cantidades a piezas individuales
    let piezasIndividuales = [];
    grupoInfo.cortes.forEach(c => {
      for (let i = 0; i < c.cantidad; i++) {
        piezasIndividuales.push({
          longitud: c.longitud,
          nombre: c.nombre,
          grupo: key
        });
      }
    });

    // Ordenar piezas de mayor a menor longitud (FFD)
    piezasIndividuales.sort((a, b) => b.longitud - a.longitud);

    // Array de barras utilizadas para este grupo
    const barrasUtilizadas = [];

    piezasIndividuales.forEach(pieza => {
      // Intentar meter en alguna de las barras ya abiertas
      let barEncontrada = null;
      
      for (let bar of barrasUtilizadas) {
        // Espacio libre actual en la barra
        // Si ya tiene piezas, debemos considerar el espesor de la sierra para el nuevo corte
        const costoSerrado = bar.piezas.length > 0 ? espesorDisco : 0;
        const espacioRequerido = pieza.longitud + costoSerrado;

        if (bar.espacioLibre >= espacioRequerido) {
          barEncontrada = bar;
          break;
        }
      }

      if (barEncontrada) {
        const costoSerrado = barEncontrada.piezas.length > 0 ? espesorDisco : 0;
        barEncontrada.piezas.push(pieza);
        barEncontrada.longitudUsada += pieza.longitud + costoSerrado;
        barEncontrada.espacioLibre -= (pieza.longitud + costoSerrado);
      } else {
        // Crear nueva barra
        const nuevaBarra = {
          id: barrasUtilizadas.length + 1,
          largoTotal: largoBarraStock,
          piezas: [pieza],
          longitudUsada: pieza.longitud,
          espacioLibre: largoBarraStock - pieza.longitud
        };
        barrasUtilizadas.push(nuevaBarra);
      }
    });

    // Calcular estadísticas específicas de este grupo
    let totalLongitudUsadaGrupo = 0;
    let totalDesperdicioGrupo = 0;

    barrasUtilizadas.forEach(b => {
      // El espacio libre es desperdicio
      totalDesperdicioGrupo += b.espacioLibre;
      totalLongitudUsadaGrupo += (b.largoTotal - b.espacioLibre);
      
      // Calcular rendimiento individual de la barra
      b.eficiencia = parseFloat(((b.longitudUsada / b.largoTotal) * 100).toFixed(1));
    });

    const eficienciaGrupo = barrasUtilizadas.length > 0 
      ? parseFloat(((totalLongitudUsadaGrupo / (barrasUtilizadas.length * largoBarraStock)) * 100).toFixed(1))
      : 0;

    resultados[key] = {
      nombre: grupoInfo.nombre,
      barras: barrasUtilizadas,
      totalBarras: barrasUtilizadas.length,
      eficiencia: eficienciaGrupo,
      desperdicioMm: totalDesperdicioGrupo,
      longitudUsadaMm: totalLongitudUsadaGrupo
    };

    totalBarrasGeneral += barrasUtilizadas.length;
    desperdicioTotalGeneral += totalDesperdicioGrupo;
    longitudUtilizadaGeneral += totalLongitudUsadaGrupo;
  }

  const eficienciaGeneral = totalBarrasGeneral > 0
    ? parseFloat(((longitudUtilizadaGeneral / (totalBarrasGeneral * largoBarraStock)) * 100).toFixed(1))
    : 0;

  return {
    grupos: resultados,
    totalBarras: totalBarrasGeneral,
    eficienciaGeneral: eficienciaGeneral,
    desperdicioTotalM: parseFloat((desperdicioTotalGeneral / 1000).toFixed(2)),
    longitudUtilizadaM: parseFloat((longitudUtilizadaGeneral / 1000).toFixed(2))
  };
}

// Exportamos la función para uso global
window.optimizarCortes = optimizarCortes;
