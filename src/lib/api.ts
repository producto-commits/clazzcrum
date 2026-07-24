// Cliente de fetch para componentes del navegador. Lanza un Error con el
// mensaje del backend cuando la respuesta no es OK.

async function handle(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? `Error ${res.status}`);
  }
  return data;
}

export function apiGet<T = unknown>(url: string): Promise<T> {
  return fetch(url, { headers: { Accept: "application/json" } }).then(handle);
}

export function apiSend<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(handle);
}
