const { JSDOM } = require('jsdom');

module.exports = class DOM {
  constructor(html) {
    const dom = new JSDOM(html || '<html><head></head><body></body></html>', { runScripts: "dangerously", resources: "usable" });
    global.window = dom.window;
    global.document = global.window.document;
    global.Element = global.window.Element;
  }

  clear() {
    global.document.head.innerHTML = '';
    global.document.body.innerHTML = '';
  }

  destroy() {
    typeof global.window === 'function' && global.window.close();

    delete global.document;
    delete global.window;
  }
}