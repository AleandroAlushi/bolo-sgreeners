/** Ricreato a ogni cambio di pagina: fa partire l'animazione di entrata del contenuto. */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
