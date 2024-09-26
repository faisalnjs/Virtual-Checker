class Storage {
  constructor(id) {
    this.id = id;
  }

  set(key, value) {
    let temp = this.object;
    temp[key] = value;
    localStorage.setItem(this.id, JSON.stringify(temp));
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
    return this;
  }

  obliterate() {
    localStorage.removeItem(this.id);
  }

  get object() {
    return JSON.parse(localStorage.getItem(this.id)) || {};
  }
}

export default new Storage("virtual-checker-2");