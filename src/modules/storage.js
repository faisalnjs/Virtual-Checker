class Storage {
  constructor(id) {
    this.id = id;
    this.syncWithCookie();
  }

  set(key, value) {
    let temp = this.object;
    temp[key] = value;
    localStorage.setItem(this.id, JSON.stringify(temp));
    setCookie(this.id, JSON.stringify(temp), 7);
    return this;
  }

  get(key) {
    return this.object[key];
  }

  all() {
    return this.object;
  }

  delete(key) {
    let temp = this.object;
    delete temp[key];
    localStorage.setItem(this.id, JSON.stringify(temp));
    setCookie(this.id, JSON.stringify(temp), 7);
    return this;
  }

  obliterate() {
    localStorage.removeItem(this.id);
    setCookie(this.id, "", -1);
  }

  get object() {
    return JSON.parse(localStorage.getItem(this.id)) || {};
  }

  syncWithCookie() {
    const cookieData = getCookie(this.id);
    if (cookieData) {
      localStorage.setItem(this.id, cookieData);
    }
  }
}

function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = `${name}=${(value || "")}${expires}; path=/; domain=.${document.domain}`;
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

const storageInstance = new Storage("virtual-falcons");

export default storageInstance;