import {
  buildCandidateCatalog,
  buildProjectedNationalSummary,
  buildScopeResult,
  computeIsStale
} from "../src/lib/domain";
import type { OnpeParticipant, OnpeTotals } from "../src/lib/types";

const totals: OnpeTotals = {
  actasContabilizadas: 80.5,
  contabilizadas: 805,
  totalActas: 1000,
  participacionCiudadana: 72.4,
  actasEnviadasJee: 1.2,
  enviadasJee: 12,
  actasPendientesJee: 18.3,
  pendientesJee: 183,
  fechaActualizacion: Date.now(),
  idUbigeoDepartamento: 140000,
  idUbigeoProvincia: 140100,
  idUbigeoDistrito: 140101,
  idUbigeoDistritoElectoral: 15,
  totalVotosEmitidos: 100000,
  totalVotosValidos: 90000,
  porcentajeVotosEmitidos: 100,
  porcentajeVotosValidos: 100
};

const participants: OnpeParticipant[] = [
  {
    codigoAgrupacionPolitica: 35,
    nombreAgrupacionPolitica: "RENOVACIÓN POPULAR",
    nombreCandidato: "RAFAEL BERNARDO LÓPEZ ALIAGA CAZORLA",
    dniCandidato: "1",
    totalVotosValidos: 25000,
    porcentajeVotosValidos: 25,
    porcentajeVotosEmitidos: 22
  },
  {
    codigoAgrupacionPolitica: 8,
    nombreAgrupacionPolitica: "FUERZA POPULAR",
    nombreCandidato: "KEIKO SOFIA FUJIMORI HIGUCHI",
    dniCandidato: "2",
    totalVotosValidos: 20000,
    porcentajeVotosValidos: 20,
    porcentajeVotosEmitidos: 17
  },
  {
    codigoAgrupacionPolitica: 16,
    nombreAgrupacionPolitica: "PARTIDO DEL BUEN GOBIERNO",
    nombreCandidato: "JORGE NIETO MONTESINOS",
    dniCandidato: "3",
    totalVotosValidos: 15000,
    porcentajeVotosValidos: 15,
    porcentajeVotosEmitidos: 13
  },
  {
    codigoAgrupacionPolitica: 10,
    nombreAgrupacionPolitica: "JUNTOS POR EL PERÚ",
    nombreCandidato: "ROBERTO HELBERT SANCHEZ PALOMINO",
    dniCandidato: "4",
    totalVotosValidos: 10000,
    porcentajeVotosValidos: 10,
    porcentajeVotosEmitidos: 9
  },
  {
    codigoAgrupacionPolitica: 14,
    nombreAgrupacionPolitica: "PARTIDO CÍVICO OBRAS",
    nombreCandidato: "RICARDO PABLO BELMONT CASSINELLI",
    dniCandidato: "5",
    totalVotosValidos: 5000,
    porcentajeVotosValidos: 5,
    porcentajeVotosEmitidos: 4
  },
  {
    codigoAgrupacionPolitica: 99,
    nombreAgrupacionPolitica: "OTRO PARTIDO",
    nombreCandidato: "OTRA PERSONA",
    dniCandidato: "6",
    totalVotosValidos: 15000,
    porcentajeVotosValidos: 15,
    porcentajeVotosEmitidos: 13
  },
  {
    codigoAgrupacionPolitica: 98,
    nombreAgrupacionPolitica: "SEGUNDO PARTIDO",
    nombreCandidato: "ALGUIEN MÁS",
    dniCandidato: "7",
    totalVotosValidos: 10000,
    porcentajeVotosValidos: 10,
    porcentajeVotosEmitidos: 8
  }
];

describe("buildScopeResult", () => {
  it("mantiene el orden editorial de destacados y agrupa Otros con votos reales", () => {
    const catalog = buildCandidateCatalog(participants);
    const scope = buildScopeResult({
      scopeId: "040000",
      kind: "department",
      label: "AREQUIPA",
      electores: 1000000,
      padronShare: 4.4,
      totals,
      participants,
      candidateCatalog: catalog
    });

    expect(scope.featuredCandidates.map((candidate) => candidate.code)).toEqual([
      "8",
      "35",
      "16",
      "10",
      "14"
    ]);
    expect(scope.otros.votesValid).toBe(25000);
    expect(scope.otros.pctValid).toBe(25);
    expect(scope.projectedVotes["8"]).toBe(200000);
    expect(scope.projectedVotes.otros).toBe(250000);
  });
});

describe("buildProjectedNationalSummary", () => {
  it("suma regiones y extranjero para la proyección nacional", () => {
    const catalog = buildCandidateCatalog(participants);
    const region = buildScopeResult({
      scopeId: "040000",
      kind: "department",
      label: "AREQUIPA",
      electores: 1000000,
      padronShare: 4.4,
      totals,
      participants,
      candidateCatalog: catalog
    });

    const foreign = buildScopeResult({
      scopeId: "2",
      kind: "foreign_total",
      label: "PERUANOS EN EL EXTRANJERO",
      electores: 500000,
      padronShare: 2,
      totals,
      participants,
      candidateCatalog: catalog
    });

    const projected = buildProjectedNationalSummary([region], foreign, 1500000);

    expect(projected.projectedVotes["35"]).toBe(375000);
    expect(projected.projectedVotes.otros).toBe(375000);
    expect(projected.projectedPercentages["8"]).toBe(20);
  });
});

describe("computeIsStale", () => {
  it("marca stale cuando la fuente supera el umbral", () => {
    const oldDate = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    expect(computeIsStale(oldDate)).toBe(true);
  });
});
