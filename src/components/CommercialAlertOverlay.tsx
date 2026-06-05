import React from 'react';

interface CommercialAlertOverlayProps {
  setView: (view: any) => void;
}

export function CommercialAlertOverlay({ setView }: CommercialAlertOverlayProps) {
  // Le système d'alertes commerciales est désactivé pour éviter les requêtes inutiles et les erreurs de permissions.
  // Il sera reconstruit de manière différente ultérieurement.
  return null;
}
