export default class Element {
    constructor(tag, text, events, className, attributes) {
      this.tag = tag;
      this.text = text;
      this.events = events;
      this.className = className;
      this.attributes = attributes;
    }
  
    get element() {
      const element = document.createElement(this.tag);
      element.innerHTML = this.text;
      this.className && (element.className = this.className);
      this.events &&
        Object.keys(this.events).forEach((type) => {
          const listener = this.events[type];
          element.addEventListener(type, listener);
        });
      this.attributes &&
        Object.keys(this.attributes).forEach((attribute) => {
          const value = this.attributes[attribute];
          element.setAttribute(attribute, value);
        });
      return element;
    }
  }