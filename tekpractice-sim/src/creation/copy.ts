/** Every Mode Création shell string (wording owned by tekuxwriter). Grows task by task. */
export const COPY: { readonly [section: string]: Readonly<Record<string, string>> } = {
  picker: {
    title: 'Choisir un lieu',
    /** L1: the neutral blank room card. */
    blank: 'Salle vide neutre',
  },
  place: {
    // Task 6 wording, to be validated by tekuxwriter.
    dialogTitle: 'Changer de lieu',
    dialogBody: 'Du matériel est déjà installé. Que voulez-vous en faire dans le nouveau lieu ?',
    keep: 'Garder le matériel',
    empty: 'Repartir à vide',
    cancel: 'Annuler',
  },
}
