import { describe, expect, it } from "vitest";
import { matchPerson } from "../scripts/photos/import";

const person = (slug: string, first: string, last: string, nickname = "") => ({
  kind: "player" as const,
  id: slug,
  slug,
  name: `${first} ${last}`,
  first: [first.toLowerCase()],
  last: [last.toLowerCase()],
  nickname: nickname ? [nickname.toLowerCase()] : [],
  hasPhoto: false,
});
const people = [person("federico-hrvatin", "Federico", "Hrvatin", "Chicco"), person("federico-rossi", "Federico", "Rossi", "Fede"), person("luca-curati", "Luca", "Curati", "Lil")];

describe("abbinamento foto → persona", () => {
  it("nome e cognome in qualsiasi ordine, con numeri e simboli", () => {
    expect(matchPerson("HRVATIN_Federico (2)", people).person?.slug).toBe("federico-hrvatin");
    expect(matchPerson("Federico Rossi", people).person?.slug).toBe("federico-rossi");
  });

  it("solo cognome o soprannome, se non ambigui", () => {
    expect(matchPerson("curati", people).person?.slug).toBe("luca-curati");
    expect(matchPerson("Chicco 2023", people).person?.slug).toBe("federico-hrvatin");
  });

  it("nome di battesimo condiviso o nome sconosciuto: nessun abbinamento", () => {
    expect(matchPerson("Federico", people).person).toBeNull();
    expect(matchPerson("IMG_1234", people).reason).toBe("nessuno con questo nome");
  });
});
