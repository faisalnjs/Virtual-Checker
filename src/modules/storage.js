class Storage {
  constructor(id) {
    this.id = id;
    this._cache = null;
    this._idbName = id;
    this._idbVersion = 1;
    this.idbReady = this._initIDB();
    this.syncWithCookie();
  }

  set(key, value) {
    if (key === 'cache') {
      try {
        this._cache = value;
        this.idbSet('cache', value).catch((e) => console.error('IDB set failed', e));
        const temp = this.object;
        if (temp && temp.cache) delete temp.cache;
        localStorage.setItem(this.id, JSON.stringify(temp));
        this.syncWithCookie();
      } catch (e) {
        console.error('storage.set(cache) failed', e);
      }
      return this;
    }

    let temp = this.object;
    temp[key] = value;
    localStorage.setItem(this.id, JSON.stringify(temp));
    this.syncWithCookie();
    return this;
  }

  get(key) {
    if (key === 'cache') return this._cache;
    return this.object[key];
  }

  all() {
    return this.object;
  }

  delete(key) {
    if (key === 'cache') {
      this._cache = null;
      this.idbDelete('cache').catch((e) => console.error('IDB delete failed', e));
      const temp = this.object;
      if (temp && temp.cache) delete temp.cache;
      localStorage.setItem(this.id, JSON.stringify(temp));
      this.syncWithCookie();
      return this;
    }

    let temp = this.object;
    delete temp[key];
    localStorage.setItem(this.id, JSON.stringify(temp));
    this.syncWithCookie();
    return this;
  }

  obliterate() {
    localStorage.removeItem(this.id);
    setCookie(this.id, "", -1);
    try {
      const req = indexedDB.deleteDatabase(this._idbName);
      req.onsuccess = () => { };
      req.onerror = () => { console.error('Failed to delete IDB', req.error); };
    } catch (e) {
      console.error('obliterate IDB error', e);
    }
  }

  get object() {
    return JSON.parse(localStorage.getItem(this.id)) || {};
  }

  syncWithCookie() {
    const localData = localStorage.getItem(this.id);
    const cookieData = getCookie(this.id);
    if (localData && cookieData && localData !== cookieData) {
      setCookie(this.id, localData, 7);
    } else if (!localData && cookieData) {
      localStorage.setItem(this.id, cookieData);
    }
  }

  _initIDB() {
    return this._openIDB()
      .then((db) => {
        this._db = db;
        return this.idbGet('cache').then((v) => { this._cache = v; }).catch(() => { this._cache = null; });
      })
      .catch((e) => {
        console.error('IndexedDB unavailable', e);
      });
  }

  _openIDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB not supported'));
      const request = indexedDB.open(this._idbName, this._idbVersion);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('virtual-falcons')) db.createObjectStore('virtual-falcons', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  idbSet(key, value) {
    return new Promise((resolve, reject) => {
      this._openIDB().then((db) => {
        const tx = db.transaction(['virtual-falcons'], 'readwrite');
        const store = tx.objectStore('virtual-falcons');
        const req = store.put({ key: key, value: value });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }).catch(reject);
    });
  }

  idbGet(key) {
    return new Promise((resolve, reject) => {
      this._openIDB().then((db) => {
        const tx = db.transaction(['virtual-falcons'], 'readonly');
        const store = tx.objectStore('virtual-falcons');
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result) resolve(req.result.value); else resolve(undefined);
        };
        req.onerror = () => reject(req.error);
      }).catch(reject);
    });
  }

  idbDelete(key) {
    return new Promise((resolve, reject) => {
      this._openIDB().then((db) => {
        const tx = db.transaction(['virtual-falcons'], 'readwrite');
        const store = tx.objectStore('virtual-falcons');
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }).catch(reject);
    });
  }

  idbAll() {
    return new Promise((resolve, reject) => {
      this._openIDB().then((db) => {
        const tx = db.transaction(['virtual-falcons'], 'readonly');
        const store = tx.objectStore('virtual-falcons');
        const req = store.openCursor();
        const out = {};
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            out[cursor.key] = cursor.value.value;
            cursor.continue();
          } else {
            resolve(out);
          }
        };
        req.onerror = () => reject(req.error);
      }).catch(reject);
    });
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