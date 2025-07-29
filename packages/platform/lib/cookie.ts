interface CookieObject {
  [key: string]: string;
}

function parseCookie(cookieStr: string): CookieObject {
  const parts = cookieStr.split(';').map((part) => part.trim());
  const cookieObj: CookieObject = {};

  parts.forEach((part) => {
    if (part.includes('=')) {
      const [key, ...valueArr] = part.split('=');
      const value = valueArr.join('=');
      cookieObj[key.trim()] = value;
    } else {
      cookieObj[part] = '';
    }
  });

  return cookieObj;
}

export function parseNextCookie(cookie: string): {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    path?: string;
    domain?: string;
    sameSite?: 'lax' | 'strict' | 'none';
    secure: boolean;
    expires?: Date;
    maxAge?: number;
  };
} {
  const parsed: CookieObject = parseCookie(cookie);

  const name = Object.keys(parsed)[0];
  const value: string = parsed[name];
  const options = {
    httpOnly: Boolean(parsed['HttpOnly']) || false,
    path: parsed['Path'] || '/',
    domain: parsed['Domain'] || undefined,
    sameSite: (parsed['SameSite']?.toLowerCase() || 'lax') as
      | 'lax'
      | 'strict'
      | 'none',
    secure: Boolean(parsed['Secure']) || false,
    expires: parsed['Expires'] ? new Date(parsed['Expires']) : undefined,
    maxAge: parsed['Max-Age'] ? parseInt(parsed['Max-Age'], 10) : undefined,
  };

  return { name, value, options };
}
