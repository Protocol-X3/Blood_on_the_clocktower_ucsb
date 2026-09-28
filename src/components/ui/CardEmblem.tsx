/** The clock emblem on the back of a role card. */
export function CardEmblem({ dim, className = 'size-12' }: { dim?: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 52 52" className={className} fill="none" stroke={dim ? '#3a4466' : '#c9a55a'} strokeLinecap="round">
      <circle cx="26" cy="26" r="20" strokeWidth="1.2" />
      <circle cx="26" cy="26" r="15" strokeWidth="0.8" opacity="0.6" />
      <path d="M26 8v3M26 41v3M8 26h3M41 26h3" strokeWidth="1" />
      <path d="M26 26V16M26 26l6 4" strokeWidth="1.8" />
    </svg>
  );
}

/** The navy, gold-rimmed card back, shared by the draw and the hidden role card. */
export const CARD_BACK =
  'border border-[#c9a55a] bg-[#151c33] shadow-[inset_0_0_0_5px_#151c33,inset_0_0_0_6px_rgb(201_165_90/0.5),0_10px_22px_rgb(0_0_0/0.45)]';
