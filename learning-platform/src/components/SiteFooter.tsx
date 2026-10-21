import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="no-print border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-ink-faint">
            La plateforme de préparation dédiée au BTS Métiers de l&apos;audiovisuel,
            option Métiers du son. Cours gratuits, alignés sur le référentiel officiel.
          </p>
        </div>
        <div>
          <h3 className="mb-3 font-display text-sm font-semibold text-ink">Plateforme</h3>
          <ul className="space-y-2 text-sm text-ink-mute">
            <li><Link className="hover:text-amber-bright" href="/cours">Parcours &amp; cours</Link></li>
            <li><Link className="hover:text-amber-bright" href="/annales">Bibliothèque d&apos;annales</Link></li>
            <li><Link className="hover:text-amber-bright" href="/certificats">Mes certificats</Link></li>
            <li><Link className="hover:text-amber-bright" href="/verification">Vérifier un certificat</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-display text-sm font-semibold text-ink">Transparence</h3>
          <ul className="space-y-2 text-sm text-ink-mute">
            <li><Link className="hover:text-amber-bright" href="/a-propos">Sources officielles</Link></li>
            <li>
              <a
                className="hover:text-amber-bright"
                href="https://www.francecompetences.fr/recherche/rncp/37196/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Fiche RNCP37196 ↗
              </a>
            </li>
            <li>
              <a
                className="hover:text-amber-bright"
                href="https://sti.eduscol.education.fr/formations/bts/bts-metiers-de-laudiovisuel-mav"
                target="_blank"
                rel="noopener noreferrer"
              >
                Référentiel éduscol ↗
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-ink-faint sm:px-6">
          <span>© {new Date().getFullYear()} Tech Nest — contenus pédagogiques indépendants, conformes au référentiel officiel (arrêté du 4 juin 2013, RNCP37196).</span>
          <span className="font-mono">Tech Nest n&apos;est pas affilié au ministère de l&apos;Éducation nationale.</span>
        </div>
      </div>
    </footer>
  );
}
