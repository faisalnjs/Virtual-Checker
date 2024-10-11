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
      console.log(`Synchronized localStorage with cookie data: ${cookieData}`);
    } else {
      console.log(`No cookie data found for id: ${this.id}`);
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
  const domain = ".vssfalcons.com";
  document.cookie = name + "=" + (value || "") + expires + "; path=/; domain=" + domain;
  console.log(`Set cookie: ${name}=${value}; domain=${domain}`);
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

export default new Storage("virtual-checker-2");