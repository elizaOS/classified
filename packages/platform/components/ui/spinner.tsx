import { Loader2 } from 'lucide-react';

function Spinner({ variant = 'light' }) {
  if (variant === 'light') {
    return <Loader2 className="h-4 w-4 animate-spin text-typography-strong" />;
  } else {
    return <Loader2 className="h-4 w-4 animate-spin text-background" />;
  }
}

export default Spinner;
export { Spinner };
