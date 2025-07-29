import Link from 'next/link';

export default function DropdownMenuItem({
  icon,
  label,
  href,
  kbd,
  handleClick,
}: {
  icon: undefined | null | React.ReactNode;
  label: string;
  href?: string;
  kbd?: string;
  handleClick?: () => void;
}) {
  const iconStyles =
    'ml-auto hidden font-sans text-xs text-typography-weak group-hover:text-typography-strong';
  const buttonStyles =
    'flex items-center gap-3 cursor-pointer hover:bg-hover w-full p-2 rounded-md data-[focus]:bg-fill no-underline text-sm text-typography-weak hover:text-typography-strong';

  if (href) {
    return (
      <Link href={href} className={buttonStyles}>
        {icon}
        <span className="text-inherit">{label}</span>
        {kbd && <kbd className={iconStyles}>{kbd}</kbd>}
      </Link>
    );
  } else {
    return (
      <button className={buttonStyles} onClick={handleClick}>
        {icon}
        <span className="text-inherit">{label}</span>
        {kbd && <kbd className={iconStyles}>{kbd}</kbd>}
      </button>
    );
  }
}
