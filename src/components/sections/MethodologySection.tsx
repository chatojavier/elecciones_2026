export function MethodologySection() {
  return (
    <section className="panel methodology-panel" id="metodologia">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Metodología</p>
          <h2>Cómo se calcula la proyección</h2>
        </div>
      </div>
      <p>
        Mostramos resultados oficiales de ONPE y una estimación nacional de votos de acuerdo al avance del escrutinio. La aplicación emplea un modelo de <strong>extrapolación lineal por actas contabilizadas</strong> (no actas procesadas):
      </p>
      <ul>
        <li>
          <strong>Extrapolación local:</strong> Al estimar las actas faltantes en una circunscripción, se asume matemáticamente que mantendrán la composición de los votos ya escrutados (<code>Votos Proyectados = Votos Actuales / % avance de actas contabilizadas</code>). En caso se tengan 0 actas contabilizadas, la proyección es cero.
        </li>
        <li>
          <strong>Agregación bottom-up:</strong> Para mitigar inconsistencias de velocidades agregadas, la proyección total se calcula de forma descentralizada sumando de forma independiente la proyección de cada bloque geográfico mayor (las 25 regiones y el total consolidado de los peruanos en el extranjero).
        </li>
        <li>
          <strong>Consideraciones clave:</strong> El modelo puede presentar variaciones con el avance del tiempo y no debe considerarse como dato definitivo. Esto ocurre porque el método no corrige por sesgo geográfico intrínseco: los votos remanentes (por ejemplo, actas rurales que tardan más en ser trasladadas a centros de cómputo) pueden exhibir un patrón estadísticamemte diferente frente al voto predominantemente urbano contado al inicio de la jornada.
        </li>
      </ul>
    </section>
  );
}
