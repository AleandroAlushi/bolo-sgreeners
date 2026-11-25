import { planPaste } from "@/lib/domain/paste";
import { render } from "@/lib/graphics/templates";
import { BigTitle, C, Canvas } from "@/lib/graphics/theme";
import { getTeamSession } from "@/lib/team/auth";
import { getTeamArea } from "@/lib/team/data";

const DAYS = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"];
const MONTHS = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];

/**
 * Immagine dei turni delle paste (formato storia) da mandare sul gruppo WhatsApp: /grafiche/paste.
 * Riservata a chi entra nell'area squadra.
 */
export async function GET() {
  const session = await getTeamSession();
  if (!session?.isMember) return new Response("Riservato all'area squadra", { status: 401 });
  const area = await getTeamArea(session.supabase);
  if (!area) return new Response("Nessuna stagione", { status: 404 });
  const plan = planPaste(area.people, area.setup);
  const short = new Map(area.people.map((p) => [p.id, p.short]));
  const today = new Date().toISOString().slice(0, 10);
  const next = plan.slots.find((s) => !s.done && s.day >= today);
  // con tanti turni le righe si stringono per stare nella storia
  const rowH = Math.min(72, Math.floor(1360 / Math.max(plan.slots.length, 1)));
  const font = Math.round(rowH * 0.62);

  return render(
    <Canvas format="storia" label={`Stagione ${area.season.slug}`}>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
        <BigTitle size={170}>TURNI PASTE</BigTitle>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
        {plan.slots.map((s, i) => {
          const isNext = s === next;
          const newMonth = i === 0 || plan.slots[i - 1].day.slice(0, 7) !== s.day.slice(0, 7);
          const d = new Date(`${s.day}T12:00:00Z`);
          return (
            <div
              key={s.personId}
              style={{
                display: "flex",
                alignItems: "center",
                height: rowH,
                paddingLeft: 18,
                paddingRight: 18,
                borderTop: newMonth && i > 0 ? `2px solid rgba(246,241,236,0.18)` : "2px solid transparent",
                backgroundColor: isNext ? "rgba(245,165,36,0.22)" : "transparent",
                borderRadius: isNext ? 14 : 0,
                opacity: s.done ? 0.6 : 1,
              }}
            >
              <span style={{ display: "flex", width: 120, fontFamily: "Bebas", fontSize: font * 1.15, color: newMonth ? C.green : "transparent" }}>
                {MONTHS[d.getUTCMonth()]}
              </span>
              <span style={{ display: "flex", width: 150, fontFamily: "Bebas", fontSize: font * 1.15, color: C.text }}>
                {`${d.getUTCDate()}`.padStart(2, "0")} {DAYS[d.getUTCDay()]}
              </span>
              <span style={{ display: "flex", flex: 1, minWidth: 0, fontWeight: 600, fontSize: font, color: isNext ? C.orange : C.text }}>{short.get(s.personId) ?? s.name}</span>
              {(s.done || isNext) && (
                <span
                  style={{
                    display: "flex",
                    flexShrink: 0,
                    padding: "6px 16px",
                    borderRadius: 999,
                    fontWeight: 600,
                    fontSize: font * 0.55,
                    letterSpacing: 2,
                    color: C.bg,
                    backgroundColor: s.done ? C.green : C.orange,
                  }}
                >
                  {s.done ? "PORTATE" : "PROSSIME"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Canvas>,
    "storia",
  );
}
