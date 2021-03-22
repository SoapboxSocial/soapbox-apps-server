export default function qs(params: { [key: string]: string }) {
  return Object.keys(params)
    .map((key) =>
      !!params[key] ? key + "=" + encodeURIComponent(params[key]) : ""
    )
    .filter(Boolean)
    .join("&");
}
