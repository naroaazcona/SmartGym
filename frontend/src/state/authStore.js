const KEY = "smartgym_token";

let state = {
  token: localStorage.getItem(KEY),
  me: null,
};

export const authStore = {
  get token() { return state.token; },
  get me() { return state.me; },
  get role() { return state.me?.role ?? null; },

  setToken(token) {
    state.token = token;
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  },

  setMe(me) { state.me = me; },

  logout() {
    this.setToken(null);
    this.setMe(null);
  },
};
