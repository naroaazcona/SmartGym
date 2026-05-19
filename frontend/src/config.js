const host = window.location.hostname;
const isIpv4Host = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || isIpv4Host;
const localApiHost = host === "0.0.0.0" ? "localhost" : host;

export const CONFIG = {
  API_BASE: isLocalHost ? `http://${localApiHost}:3000` : "https://api.smartgym-app.com",
  GOOGLE_CLIENT_ID: "493299841269-icpmea26pki4ufl1b1uib94u91ij9p33.apps.googleusercontent.com",
};
