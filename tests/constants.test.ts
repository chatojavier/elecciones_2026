import {
  OTHER_CANDIDATE_COLOR,
  UNKNOWN_CANDIDATE_COLOR,
  getCandidateColor
} from "../src/lib/constants";

describe("getCandidateColor", () => {
  it("usa el color principal del logo oficial para partidos conocidos", () => {
    expect(getCandidateColor("35")).toBe("#0ea5e9");
    expect(getCandidateColor("8")).toBe("#f97316");
    expect(getCandidateColor("10")).toBe("#16a34a");
    expect(getCandidateColor("22")).toBe("#7c3aed");
  });

  it("mantiene gris editorial para Otros", () => {
    expect(getCandidateColor("otros")).toBe(OTHER_CANDIDATE_COLOR);
  });

  it("cae a un gris neutro para códigos no mapeados", () => {
    expect(getCandidateColor("999")).toBe(UNKNOWN_CANDIDATE_COLOR);
  });
});
