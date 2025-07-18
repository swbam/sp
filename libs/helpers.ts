export const validateUuid = (
  id: string | undefined | null,
  errorMessage = 'Invalid UUID'
): string => {
  if (!id || id === 'undefined') {
    throw new Error(errorMessage);
  }
  return id;
};

export const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? //* Set this to your site URL in production env.
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? //* Automatically set by Vercel.
    'http://localhost:3000/';
  //* Make sure to include `https://` when not localhost.
  url = url.includes('http') ? url : `https://${url}`;
  //* Make sure to including trailing `/`.
  url = url.charAt(url.length - 1) === '/' ? url : `${url}/`;
  return url;
};

export const postData = async ({ url, data }: { url: string; data?: any }) => {
  const res: Response = await fetch(url, {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    credentials: 'same-origin',
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw Error(res.statusText);
  }

  return res.json();
};

export const toDateTime = (secs: number) => {
  var t = new Date('1970-01-01T00:30:00Z');
  t.setSeconds(secs);
  return t;
};
