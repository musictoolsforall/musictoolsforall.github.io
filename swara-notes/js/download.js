// Save text as a file on the user's device (nothing is uploaded).

export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeName = (t) => (t || 'song').replace(/[\\/:*?"<>|]+/g, '').trim() || 'song';
