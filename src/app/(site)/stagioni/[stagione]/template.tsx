/** Tra le sezioni di una stagione (calendario, classifica…) l'intestazione resta ferma ed entra solo il contenuto. */
export default function SeasonTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
